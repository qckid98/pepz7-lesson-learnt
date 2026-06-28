import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client, generateS3Key, deleteFile } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { isFileTypeAllowed, getFileExtension, MAX_UPLOAD_SIZE } from "@/lib/validators";
import Busboy from "busboy";
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

/**
 * Parse multipart/form-data using busboy — bypasses Next.js/undici FormData parser
 * which corrupts bodies >10MB with "Chunk Header in chunk body not in expected format"
 */
function parseMultipart(request: NextRequest): Promise<{ file: { buffer: Buffer; name: string; type: string; size: number } | null; fields: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      reject(new Error("Expected multipart/form-data"));
      return;
    }

    const bb = Busboy({ headers: { "content-type": contentType } });
    let fileResult: { buffer: Buffer; name: string; type: string; size: number } | null = null;
    const fields: Record<string, string> = {};

    bb.on("file", (fieldname, file, info) => {
      if (fieldname !== "file") {
        file.resume();
        return;
      }
      const { filename, mimeType } = info;
      const chunks: Buffer[] = [];
      file.on("data", (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      file.on("end", () => {
        const buffer = Buffer.concat(chunks);
        fileResult = { buffer, name: filename, type: mimeType, size: buffer.length };
      });
      file.on("error", reject);
    });

    bb.on("field", (name, value) => {
      fields[name] = value;
    });

    bb.on("finish", () => {
      resolve({ file: fileResult, fields });
    });

    bb.on("error", reject);

    // Pipe request body to busboy
    const nodeStream = Readable.fromWeb(request.body as import("stream/web").ReadableStream);
    nodeStream.pipe(bb);
  });
}

/**
 * POST /api/files/upload-direct
 * Uses busboy for multipart parsing — fixes "Chunk Header" error for files >10MB
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart using busboy (not request.formData())
    const { file: fileData, fields } = await parseMultipart(request);

    if (!fileData) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    const fileName = fileData.name.replace(/^.*\//, "").trim();
    let fileType = fileData.type || "";
    if (!fileType) fileType = getMimeType(fileName, "");
    const fileSize = fileData.size;
    const fileBuffer = fileData.buffer;
    const folderId = fields.folderId || null;

    // Validate
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

    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: process.env.S3_BUCKET || "file-sharing-prod",
      Key: s3Key,
      Body: fileBuffer,
      ContentType: fileType,
    });
    await s3Client.send(command);

    // Overwrite: delete old file with same name
    const existingFile = await db.file.findFirst({
      where: { name: fileName, folderId: folderId || null, deletedAt: null },
      select: { id: true, s3Key: true },
    });
    if (existingFile) {
      try { await deleteFile(existingFile.s3Key); } catch (e) { console.error("Old file delete:", e); }
      await db.file.delete({ where: { id: existingFile.id } });
    }

    // Create DB record
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
    console.error("Upload error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
