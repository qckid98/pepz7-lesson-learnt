import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { updateFolderSchema } from "@/lib/validators";
import { getPreviewPresignedUrl } from "@/lib/s3";

/** Recursively count all files inside a folder (including sub-folders) */
async function countAllFiles(folderId: string): Promise<number> {
  let count = 0;
  const directFiles = await db.file.count({ where: { folderId, deletedAt: null } });
  count += directFiles;
  const subFolders = await db.folder.findMany({
    where: { parentId: folderId, deletedAt: null },
    select: { id: true },
  });
  for (const sub of subFolders) {
    count += await countAllFiles(sub.id);
  }
  return count;
}

/** Recursively count all sub-folders inside a folder */
async function countAllSubFolders(folderId: string): Promise<number> {
  let count = 0;
  const subFolders = await db.folder.findMany({
    where: { parentId: folderId, deletedAt: null },
    select: { id: true },
  });
  count += subFolders.length;
  for (const sub of subFolders) {
    count += await countAllSubFolders(sub.id);
  }
  return count;
}

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

    // Add recursive file count to each child folder
    const childrenWithCounts = await Promise.all(
      folder.children.map(async (child) => {
        const totalFiles = await countAllFiles(child.id);
        const totalSubFolders = await countAllSubFolders(child.id);
        return {
          ...child,
          _count: {
            ...child._count,
            totalFiles,
            totalSubFolders,
          },
        };
      })
    );

    // Add recursive count to parent folder itself
    const parentTotalFiles = await countAllFiles(folder.id);
    const parentTotalSubFolders = await countAllSubFolders(folder.id);

    return NextResponse.json({
      ...folder,
      files: filesWithStringSize,
      children: childrenWithCounts,
      _count: {
        ...folder._count,
        totalFiles: parentTotalFiles,
        totalSubFolders: parentTotalSubFolders,
      },
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
 * Delete folder and ALL its contents recursively (Admin only)
 * - Delete all files in this folder from S3 + DB
 * - Recursively delete all sub-folders
 * - Then delete the folder itself
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

    const folder = await db.folder.findUnique({ where: { id } });
    if (!folder) {
      return NextResponse.json({ error: "Folder not found" }, { status: 404 });
    }

    // Recursive delete function
    async function deleteFolderRecursive(folderId: string): Promise<void> {
      // Get all sub-folders
      const subFolders = await db.folder.findMany({
        where: { parentId: folderId },
        select: { id: true },
      });

      // Recursively delete each sub-folder
      for (const sub of subFolders) {
        await deleteFolderRecursive(sub.id);
      }

      // Get all files in this folder
      const files = await db.file.findMany({
        where: { folderId },
        select: { id: true, s3Key: true },
      });

      // Delete files from S3 + DB
      for (const file of files) {
        try {
          const { deleteFile } = await import("@/lib/s3");
          await deleteFile(file.s3Key);
        } catch {
          // Ignore S3 errors — still delete from DB
        }
        await db.file.delete({ where: { id: file.id } });
      }

      // Finally delete the folder itself
      await db.folder.delete({ where: { id: folderId } });
    }

    await deleteFolderRecursive(id);

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
