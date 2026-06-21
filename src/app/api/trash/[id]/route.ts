import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/s3";

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

/** DELETE /api/trash/[id] — Permanently delete file or folder (recursive for folders) */
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    const file = await db.file.findUnique({ where: { id } });
    if (file) {
      try { await deleteFile(file.s3Key); } catch { /* ignore */ }
      await db.file.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    const folder = await db.folder.findUnique({ where: { id } });
    if (folder) {
      // Recursively delete folder + all sub-folders + all files
      await deleteFolderPermanentRecursive(id);
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("Permanent delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
