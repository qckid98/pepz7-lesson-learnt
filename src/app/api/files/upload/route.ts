import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getUploadPresignedUrl, generateS3Key } from "@/lib/s3";
import { uploadRequestSchema, isFileTypeAllowed, getFileExtension } from "@/lib/validators";

/**
 * POST /api/files/upload
 * Generate presigned URL for file upload (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = uploadRequestSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { fileName, fileType, fileSize, folderId } = parsed.data;

    // Validate file type
    if (!isFileTypeAllowed(fileType)) {
      return NextResponse.json(
        { error: "File type not allowed" },
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

    // Generate presigned URL
    const presignedUrl = await getUploadPresignedUrl(s3Key, fileType, fileSize);

    // Create file record in database (status: uploading)
    const file = await db.file.create({
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
      presignedUrl,
      fileId: file.id,
      s3Key,
      expiresAt: Date.now() + 900 * 1000, // 15 minutes
    });
  } catch (error) {
    console.error("Upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
