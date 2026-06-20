import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/folders/move — Move folder to a different parent */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderId, targetParentId } = body as { folderId: string; targetParentId: string | null };

    if (!folderId) {
      return NextResponse.json({ error: "folderId required" }, { status: 400 });
    }

    // Prevent moving folder into itself or its descendants
    if (folderId === targetParentId) {
      return NextResponse.json({ error: "Cannot move folder into itself" }, { status: 400 });
    }

    if (targetParentId) {
      // Check for circular reference
      let current: string | null = targetParentId;
      while (current) {
        if (current === folderId) {
          return NextResponse.json({ error: "Cannot move folder into its own descendant" }, { status: 400 });
        }
        const parentFolder: { parentId: string | null } | null = await db.folder.findUnique({ where: { id: current }, select: { parentId: true } });
        current = parentFolder?.parentId ?? null;
      }

      const target = await db.folder.findUnique({ where: { id: targetParentId } });
      if (!target) return NextResponse.json({ error: "Target folder not found" }, { status: 404 });
    }

    await db.folder.update({
      where: { id: folderId },
      data: { parentId: targetParentId },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Move folder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
