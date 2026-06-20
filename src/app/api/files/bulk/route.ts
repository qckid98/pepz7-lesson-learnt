import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/s3";

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
      case "trash":
        if (fIds.length) await db.file.updateMany({ where: { id: { in: fIds } }, data: { deletedAt: new Date() } });
        if (flIds.length) await db.folder.updateMany({ where: { id: { in: flIds } }, data: { deletedAt: new Date() } });
        break;

      case "restore":
        if (fIds.length) await db.file.updateMany({ where: { id: { in: fIds } }, data: { deletedAt: null } });
        if (flIds.length) await db.folder.updateMany({ where: { id: { in: flIds } }, data: { deletedAt: null } });
        break;

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
        if (flIds.length) {
          await db.folder.deleteMany({ where: { id: { in: flIds } } });
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
