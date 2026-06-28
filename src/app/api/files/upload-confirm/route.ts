import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { fileExists } from "@/lib/s3";
import { getFileExtension } from "@/lib/validators";

export const runtime = "nodejs";

/**
 * POST /api/files/upload-confirm
 * After presigned URL upload completes, create DB record
 * Body: { fileName, fileType, fileSize, s3Key, folderId }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileName, fileType, fileSize, s3Key, folderId } = body;

    if (!fileName || !s3Key || !fileSize) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    // Verify file exists in S3
    const exists = await fileExists(s3Key);
    if (!exists) {
      return NextResponse.json({ error: "File not found in storage" }, { status: 404 });
    }

    // Verify folder if provided
    if (folderId) {
      const folder = await db.folder.findUnique({ where: { id: folderId } });
      if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Check if file with same name already exists (overwrite)
    const existingFile = await db.file.findFirst({
      where: { name: fileName, folderId: folderId || null, deletedAt: null },
      select: { id: true, s3Key: true },
    });

    if (existingFile) {
      try {
        const { deleteFile } = await import("@/lib/s3");
        await deleteFile(existingFile.s3Key);
      } catch (e) {
        console.error("Old file S3 delete error:", e);
      }
      await db.file.delete({ where: { id: existingFile.id } });
    }

    // Create file record
    const fileRecord = await db.file.create({
      data: {
        name: fileName,
        originalName: fileName,
        mimeType: fileType || "application/octet-stream",
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
    console.error("Upload confirm error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
