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
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Read the entire body as arrayBuffer first, then parse
    // This avoids streaming issues with busboy/formData in Next.js
    const body = await request.arrayBuffer();
    const contentType = request.headers.get("content-type") || "";

    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    // Parse multipart manually from the buffer
    const boundary = contentType.match(/boundary=(?:"([^"]+)"|([^;]+))/);
    if (!boundary) {
      return NextResponse.json({ error: "No boundary found" }, { status: 400 });
    }
    const boundaryStr = `--${boundary[1] || boundary[2]}`;

    // Convert to string for parsing headers, keep as buffer for file data
    const bodyStr = Buffer.from(body).toString("latin1");
    const parts = bodyStr.split(boundaryStr).filter((p) => p.trim() && p !== "--" && p !== "--\r\n");

    let fileName = "";
    let fileType = "";
    let fileBuffer: Buffer | null = null;
    let folderId: string | null = null;

    for (const part of parts) {
      // Remove leading \r\n
      const trimmed = part.replace(/^\r\n/, "");

      // Find header/body separator
      const headerEnd = trimmed.indexOf("\r\n\r\n");
      if (headerEnd === -1) continue;

      const headers = trimmed.substring(0, headerEnd);
      const bodyContent = trimmed.substring(headerEnd + 4);

      // Extract Content-Disposition
      const nameMatch = headers.match(/name="([^"]+)"/);
      if (!nameMatch) continue;
      const fieldName = nameMatch[1];

      if (fieldName === "file") {
        const filenameMatch = headers.match(/filename="([^"]+)"/);
        fileName = filenameMatch ? filenameMatch[1] : "unnamed";

        // Extract content type from header
        const ctMatch = headers.match(/Content-Type:\s*([^\r\n]+)/i);
        fileType = ctMatch ? ctMatch[1].trim() : "";

        // Body content ends with \r\n before next boundary
        const fileBody = bodyContent.replace(/\r\n$/, "");
        // Convert back to Buffer (latin1 preserves binary data)
        fileBuffer = Buffer.from(fileBody, "latin1");
      } else if (fieldName === "folderId") {
        // Trim ALL whitespace (including \r\n, spaces) from folderId
        folderId = bodyContent.trim() || null;
        console.log("[upload-direct] Parsed folderId:", JSON.stringify(folderId));
      }
    }

    console.log("[upload-direct] Final folderId:", JSON.stringify(folderId), "fileName:", fileName);

    if (!fileBuffer || !fileName) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileSize = fileBuffer.length;
    fileType = getMimeType(fileName, fileType);

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
