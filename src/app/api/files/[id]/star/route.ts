import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** POST /api/files/[id]/star — Toggle star on file */
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
    const file = await db.file.findUnique({ where: { id } });
    if (!file) return NextResponse.json({ error: "Not found" }, { status: 404 });

    await db.file.update({ where: { id }, data: { starred: !file.starred } });
    return NextResponse.json({ success: true, starred: !file.starred });
  } catch (error) {
    console.error("Star file error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
