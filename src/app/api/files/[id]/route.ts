import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/s3";
import { getPreviewPresignedUrl } from "@/lib/s3";

/**
 * GET /api/files/[id]
 * Get file info + preview URL
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const file = await db.file.findUnique({
      where: { id },
      include: { folder: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Require login
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate preview URL
    const previewUrl = await getPreviewPresignedUrl(
      file.s3Key,
      file.mimeType,
      3600
    );

    return NextResponse.json({
      ...file,
      size: file.size.toString(),
      previewUrl,
    });
  } catch (error) {
    console.error("Get file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/files/[id]
 * Delete a file (Admin only)
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const file = await db.file.findUnique({ where: { id } });
    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Delete from S3
    await deleteFile(file.s3Key);

    // Delete from database
    await db.file.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/files/[id]
 * Rename a file (Admin only)
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;
    const body = await request.json();

    const file = await db.file.update({
      where: { id },
      data: {
        name: body.name,
        folderId: body.folderId !== undefined ? body.folderId : undefined,
      },
    });

    return NextResponse.json({ ...file, size: file.size.toString() });
  } catch (error) {
    console.error("Update file error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
