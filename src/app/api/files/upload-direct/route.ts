import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client, generateS3Key } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { isFileTypeAllowed, getFileExtension } from "@/lib/validators";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

// MIME type fallback from extension
const EXT_TO_MIME: Record<string, string> = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  ppt: "application/vnd.ms-powerpoint",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  txt: "text/plain",
  csv: "text/csv",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  mp4: "video/mp4",
  webm: "video/webm",
  mov: "video/quicktime",
  mp3: "audio/mpeg",
  wav: "audio/wav",
  ogg: "audio/ogg",
  zip: "application/zip",
  rar: "application/x-rar-compressed",
  "7z": "application/x-7z-compressed",
};

function getMimeType(filename: string, providedType: string): string {
  if (providedType && providedType !== "application/octet-stream") {
    return providedType;
  }
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

/**
 * POST /api/files/upload-direct
 * Upload file via server proxy (avoids CORS issues with S3)
 * Uses request.formData() which handles binary data correctly
 */
export async function POST(request: NextRequest) {
  try {
    // Note: Upload rate limiting removed — admin-only endpoint, 
    // folder uploads can send 50+ files in rapid succession.
    // Auth check below is sufficient protection.

    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = (formData.get("folderId") as string) || null;

    if (!file) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = file.name;
    let fileType = file.type || "";

    // Fallback: detect mime type from extension if browser doesn't provide it
    if (!fileType) {
      fileType = getMimeType(fileName, "");
    }

    const fileSize = file.size;

    // Validate file type
    if (!isFileTypeAllowed(fileType)) {
      return NextResponse.json(
        { error: `File type "${fileType}" not allowed` },
        { status: 400 }
      );
    }

    // If folderId provided, verify folder exists
    if (folderId) {
      const folder = await db.folder.findUnique({ where: { id: folderId } });
      if (!folder) {
        return NextResponse.json({ error: "Folder not found" }, { status: 404 });
      }
    }

    // Read file as ArrayBuffer — this preserves binary data correctly
    const arrayBuffer = await file.arrayBuffer();
    const fileBuffer = Buffer.from(arrayBuffer);

    // Generate S3 key
    const s3Key = generateS3Key(fileName, folderId || undefined);

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || "file-sharing-prod",
      Key: s3Key,
      Body: fileBuffer,
      ContentType: fileType,
    });

    await s3Client.send(command);

    // Create file record in database
    const fileRecord = await db.file.create({
      data: {
        name: fileName,
        originalName: fileName,
        mimeType: fileType,
        size: BigInt(fileSize),
        extension: getFileExtension(fileName),
        s3Key,
        folderId: folderId || null,
        uploadedBy: session.user.id,
      },
    });

    return NextResponse.json({
      success: true,
      fileId: fileRecord.id,
      fileName,
      size: fileSize,
    });
  } catch (error) {
    console.error("Upload-direct error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
