import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client, generateS3Key } from "@/lib/s3";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { isFileTypeAllowed, getFileExtension } from "@/lib/validators";
import Busboy from "busboy";
import { Readable } from "stream";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

/**
 * POST /api/files/upload-direct
 * Upload file via server proxy using busboy for multipart parsing.
 * Handles large files (video, pptx, etc) that fail with request.formData()
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Parse multipart form data using busboy (handles large files)
    const contentType = request.headers.get("content-type") || "";
    if (!contentType.includes("multipart/form-data")) {
      return NextResponse.json({ error: "Expected multipart/form-data" }, { status: 400 });
    }

    const bb = Busboy({ headers: { "content-type": contentType } });

    const fields: Record<string, string> = {};
    let fileBuffer: Buffer | null = null;
    let fileName = "";
    let fileType = "";
    let fileSize = 0;

    const filePromise = new Promise<void>((resolve, reject) => {
      bb.on("file", (name, file, info) => {
        const { filename, mimeType } = info;
        if (name !== "file") {
          file.resume();
          return;
        }
        fileName = filename;
        fileType = mimeType;
        const chunks: Buffer[] = [];
        file.on("data", (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        file.on("end", () => {
          fileBuffer = Buffer.concat(chunks);
          fileSize = fileBuffer.length;
        });
        file.on("error", reject);
      });

      bb.on("field", (name, value) => {
        fields[name] = value;
      });

      bb.on("finish", resolve);
      bb.on("error", reject);
    });

    // Pipe request body to busboy
    const reader = request.body?.getReader();
    if (!reader) {
      return NextResponse.json({ error: "No body" }, { status: 400 });
    }

    const pushData = async () => {
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          bb.end();
          break;
        }
        bb.write(value);
      }
    };

    await Promise.all([filePromise, pushData()]);

    if (!fileBuffer || !fileName) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Fallback: detect mime type from extension if not provided
    if (!fileType) {
      const ext = fileName.split(".").pop()?.toLowerCase() || "";
      const extToMime: Record<string, string> = {
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
        zip: "application/zip",
        rar: "application/x-rar-compressed",
        "7z": "application/x-7z-compressed",
      };
      fileType = extToMime[ext] || "application/octet-stream";
    }

    // Validate file type
    if (!isFileTypeAllowed(fileType)) {
      return NextResponse.json(
        { error: `File type "${fileType}" not allowed` },
        { status: 400 }
      );
    }

    const folderId = fields.folderId || null;

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
