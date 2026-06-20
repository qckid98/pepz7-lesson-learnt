import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/folders/[id]/star — Toggle star on folder */
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
    const folder = await db.folder.findUnique({ where: { id } });
    if (!folder) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.folder.update({ where: { id }, data: { starred: !folder.starred } });
    return NextResponse.json({ success: true, starred: !folder.starred });
  } catch (error) {
    console.error("Star folder error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
