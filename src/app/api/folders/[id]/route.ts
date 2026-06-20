import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateFolderSchema } from "@/lib/validators";
import { getPreviewPresignedUrl } from "@/lib/s3";

/**
 * GET /api/folders/[id]
 * Get folder details with files
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const session = await auth();

    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    const folder = await db.folder.findUnique({
      where: { id },
      include: {
        parent: true,
        children: {
          where: {
            deletedAt: null,
            // Viewers can only see PUBLIC sub-folders
            ...(!isAdmin ? { visibility: "PUBLIC" } : {}),
          },
          include: { _count: { select: { files: true, children: true } } },
          orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
        },
        files: {
          where: { deletedAt: null },
          orderBy: { createdAt: "desc" },
        },
        _count: { select: { files: true, children: true } },
      },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Viewers cannot access PRIVATE folders
    if (folder.visibility === "PRIVATE" && !isAdmin) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Convert BigInt to string + generate previewUrl for image/video
    const filesWithStringSize = await Promise.all(
      folder.files.map(async (f) => {
        const isPreviewable =
          f.mimeType.startsWith("image/") ||
          f.mimeType.startsWith("video/") ||
          f.mimeType === "application/pdf";
        const previewUrl = isPreviewable
          ? await getPreviewPresignedUrl(f.s3Key, f.mimeType, 3600)
          : undefined;
        return { ...f, size: f.size.toString(), previewUrl };
      })
    );

    return NextResponse.json({
      ...folder,
      files: filesWithStringSize,
    });
  } catch (error) {
    console.error("Get folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/folders/[id]
 * Update folder (Admin only)
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
    const parsed = updateFolderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const folder = await db.folder.update({
      where: { id },
      data: parsed.data,
    });

    return NextResponse.json(folder);
  } catch (error) {
    console.error("Update folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/folders/[id]
 * Delete folder and all its contents (Admin only)
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

    // Check if folder has children
    const folder = await db.folder.findUnique({
      where: { id },
      include: { _count: { select: { files: true, children: true } } },
    });

    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    if (folder._count.children > 0) {
      return NextResponse.json(
        { error: "Cannot delete folder with sub-folders. Delete sub-folders first." },
        { status: 400 }
      );
    }

    if (folder._count.files > 0) {
      return NextResponse.json(
        { error: "Cannot delete folder with files. Delete or move files first." },
        { status: 400 }
      );
    }

    await db.folder.delete({ where: { id } });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
