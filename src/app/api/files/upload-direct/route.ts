import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client, generateS3Key, getUploadPresignedUrl } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { isFileTypeAllowed, getFileExtension, MAX_UPLOAD_SIZE } from "@/lib/validators";
import { Readable } from "stream";

export const runtime = "nodejs";
export const maxDuration = 600;
export const dynamic = "force-dynamic";

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
  if (providedType && providedType !== "application/octet-stream") return providedType;
  const ext = filename.split(".").pop()?.toLowerCase() || "";
  return EXT_TO_MIME[ext] || "application/octet-stream";
}

/** Threshold: files larger than this use presigned URL (bypass proxy) */
const PRESIGNED_URL_THRESHOLD = 10 * 1024 * 1024; // 10MB

/**
 * POST /api/files/upload-direct
 * For files < 10MB: stream through server to S3
 * For files >= 10MB: return presigned URL, client uploads directly to S3
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

    const fileName = file.name.replace(/^.*\//, "").trim();
    let fileType = file.type || "";
    if (!fileType) fileType = getMimeType(fileName, "");
    const fileSize = file.size;

    if (!isFileTypeAllowed(fileType)) {
      return NextResponse.json({ error: `File type "${fileType}" not allowed` }, { status: 400 });
    }

    if (fileSize > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: `File too large. Max ${MAX_UPLOAD_SIZE / 1024 / 1024}MB` }, { status: 400 });
    }

    if (folderId) {
      const folder = await db.folder.findUnique({ where: { id: folderId } });
      if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const s3Key = generateS3Key(fileName, folderId || undefined);

    // Stream upload to S3
    const nodeStream = Readable.fromWeb(file.stream() as import("stream/web").ReadableStream);
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || "file-sharing-prod",
      Key: s3Key,
      Body: nodeStream,
      ContentType: fileType,
      ContentLength: fileSize,
    });
    await s3Client.send(command);

    // Check if file with same name already exists in this folder
    // If yes, delete the old one (overwrite behavior)
    const existingFile = await db.file.findFirst({
      where: { name: fileName, folderId: folderId || null, deletedAt: null },
      select: { id: true, s3Key: true },
    });

    if (existingFile) {
      // Delete old file from S3
      try {
        const { deleteFile } = await import("@/lib/s3");
        await deleteFile(existingFile.s3Key);
      } catch (e) {
        console.error("Old file S3 delete error:", e);
      }
      // Delete old file from DB
      await db.file.delete({ where: { id: existingFile.id } });
    }

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

/**
 * POST /api/files/upload-direct?presigned=true
 * Returns presigned URL for direct browser→S3 upload (for large files)
 * Body: { fileName, fileType, fileSize, folderId }
 */
export async function PUT(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, fileType, fileSize, folderId } = body;

    if (!fileName || !fileSize) {
      return NextResponse.json({ error: "fileName and fileSize required" }, { status: 400 });
    }

    let mime = fileType || "";
    if (!mime) mime = getMimeType(fileName, "");

    if (!isFileTypeAllowed(mime)) {
      return NextResponse.json({ error: `File type not allowed` }, { status: 400 });
    }

    if (fileSize > MAX_UPLOAD_SIZE) {
      return NextResponse.json({ error: `File too large` }, { status: 400 });
    }

    if (folderId) {
      const folder = await db.folder.findUnique({ where: { id: folderId } });
      if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    const s3Key = generateS3Key(fileName, folderId || undefined);
    const presignedUrl = await getUploadPresignedUrl(s3Key, mime, fileSize, 900);

    return NextResponse.json({
      presignedUrl,
      s3Key,
      fileId: null, // Will be created after upload confirms
    });
  } catch (error) {
    console.error("Presigned URL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
