import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client, generateS3Key } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { isFileTypeAllowed, getFileExtension } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * POST /api/files/upload-direct
 * Upload file via server proxy (avoids CORS issues with S3)
 * File is sent as multipart/form-data from browser → server → S3
 */
export async function POST(request: NextRequest) {
  try {
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
    const fileType = file.type || "application/octet-stream";
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
        return NextResponse.json(
          { error: "Folder not found" },
          { status: 404 }
        );
      }
    }

    // Generate S3 key
    const s3Key = generateS3Key(fileName, folderId || undefined);

    // Read file buffer
    const fileBuffer = Buffer.from(await file.arrayBuffer());

    // Upload directly to S3 (Biznet Gio)
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
      fileName: fileName,
      size: fileSize,
    });
  } catch (error) {
    console.error("Upload-direct error:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
