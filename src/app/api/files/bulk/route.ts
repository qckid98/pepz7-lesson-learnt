import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/s3";

/** Recursively trash a folder and all its contents */
async function trashFolderRecursive(folderId: string, now: Date): Promise<void> {
  // Trash the folder itself
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: now } });

  // Trash all files in this folder
  await db.file.updateMany({
    where: { folderId, deletedAt: null },
    data: { deletedAt: now },
  });

  // Find and recursively trash all sub-folders
  const subFolders = await db.folder.findMany({
    where: { parentId: folderId, deletedAt: null },
    select: { id: true },
  });
  for (const sub of subFolders) {
    await trashFolderRecursive(sub.id, now);
  }
}

/** Recursively restore a folder and all its contents */
async function restoreFolderRecursive(folderId: string): Promise<void> {
  // Restore the folder itself
  await db.folder.update({ where: { id: folderId }, data: { deletedAt: null } });

  // Restore all files in this folder
  await db.file.updateMany({
    where: { folderId },
    data: { deletedAt: null },
  });

  // Find and recursively restore all sub-folders
  const subFolders = await db.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  for (const sub of subFolders) {
    await restoreFolderRecursive(sub.id);
  }
}

/** Recursively permanently delete a folder and all its contents */
async function deleteFolderPermanentRecursive(folderId: string): Promise<void> {
  // Find and recursively delete all sub-folders first
  const subFolders = await db.folder.findMany({
    where: { parentId: folderId },
    select: { id: true },
  });
  for (const sub of subFolders) {
    await deleteFolderPermanentRecursive(sub.id);
  }

  // Delete all files in this folder from S3 + DB
  const files = await db.file.findMany({
    where: { folderId },
    select: { id: true, s3Key: true },
  });
  for (const file of files) {
    try { await deleteFile(file.s3Key); } catch { /* ignore s3 errors */ }
    await db.file.delete({ where: { id: file.id } });
  }

  // Finally delete the folder itself
  await db.folder.delete({ where: { id: folderId } });
}

/** POST /api/files/bulk — Bulk operations: trash, star, unstar, delete-permanent */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, fileIds, folderIds } = body as {
      action: "trash" | "restore" | "star" | "unstar" | "delete-permanent";
      fileIds?: string[];
      folderIds?: string[];
    };

    const fIds = fileIds || [];
    const flIds = folderIds || [];

    switch (action) {
      case "trash": {
        const now = new Date();
        // Trash files
        if (fIds.length) await db.file.updateMany({ where: { id: { in: fIds } }, data: { deletedAt: now } });

        // Trash folders + recursively trash all contents (subfolders + files)
        for (const folderId of flIds) {
          await trashFolderRecursive(folderId, now);
        }
        break;
      }

      case "restore": {
        if (fIds.length) await db.file.updateMany({ where: { id: { in: fIds } }, data: { deletedAt: null } });
        // Restore folders + recursively restore all contents
        for (const folderId of flIds) {
          await restoreFolderRecursive(folderId);
        }
        break;
      }

      case "star":
        if (fIds.length) await db.file.updateMany({ where: { id: { in: fIds } }, data: { starred: true } });
        if (flIds.length) await db.folder.updateMany({ where: { id: { in: flIds } }, data: { starred: true } });
        break;

      case "unstar":
        if (fIds.length) await db.file.updateMany({ where: { id: { in: fIds } }, data: { starred: false } });
        if (flIds.length) await db.folder.updateMany({ where: { id: { in: flIds } }, data: { starred: false } });
        break;

      case "delete-permanent":
        // Delete files from S3 + DB
        if (fIds.length) {
          const files = await db.file.findMany({ where: { id: { in: fIds } } });
          for (const f of files) {
            try { await deleteFile(f.s3Key); } catch { /* ignore s3 errors */ }
          }
          await db.file.deleteMany({ where: { id: { in: fIds } } });
        }
        // Delete folders recursively (including all sub-folders + files)
        for (const folderId of flIds) {
          await deleteFolderPermanentRecursive(folderId);
        }
        break;

      default:
        return NextResponse.json({ error: "Unknown action" }, { status: 400 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Bulk action error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
