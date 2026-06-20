import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/files/move — Move file(s) to a different folder */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileIds, targetFolderId } = body as { fileIds: string[]; targetFolderId: string | null };

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      return NextResponse.json({ error: "fileIds required" }, { status: 400 });
    }

    // Verify target folder exists if not null
    if (targetFolderId) {
      const folder = await db.folder.findUnique({ where: { id: targetFolderId } });
      if (!folder) return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
    }

    await db.file.updateMany({
      where: { id: { in: fileIds } },
      data: { folderId: targetFolderId },
    });

    return NextResponse.json({ success: true, moved: fileIds.length });
  } catch (error) {
    console.error("Move files error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
