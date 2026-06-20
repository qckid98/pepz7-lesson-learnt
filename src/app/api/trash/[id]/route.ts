import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/s3";

/** DELETE /api/trash/[id] — Permanently delete file or folder */
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
      await db.folder.delete({ where: { id } });
      return NextResponse.json({ success: true });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("Permanent delete error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
