import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/trash/[id]/restore — Restore file or folder from trash */
export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { id } = await params;

    // Try file first, then folder
    const file = await db.file.findUnique({ where: { id } });
    if (file) {
      await db.file.update({ where: { id }, data: { deletedAt: null } });
      return NextResponse.json({ success: true, type: "file" });
    }

    const folder = await db.folder.findUnique({ where: { id } });
    if (folder) {
      await db.folder.update({ where: { id }, data: { deletedAt: null } });
      return NextResponse.json({ success: true, type: "folder" });
    }

    return NextResponse.json({ error: "Not found" }, { status: 404 });
  } catch (error) {
    console.error("Restore error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
