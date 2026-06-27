import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * POST /api/files/check-existing
 * Check which filenames already exist in a folder
 * Body: { folderId: string|null, fileNames: string[] }
 * Returns: { existing: string[] } — list of filenames that already exist
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { folderId, fileNames } = body as { folderId: string | null; fileNames: string[] };

    if (!fileNames || !Array.isArray(fileNames) || fileNames.length === 0) {
      return NextResponse.json({ existing: [] });
    }

    const existing = await db.file.findMany({
      where: {
        name: { in: fileNames },
        folderId: folderId || null,
        deletedAt: null,
      },
      select: { name: true },
    });

    return NextResponse.json({
      existing: existing.map((f) => f.name),
    });
  } catch (error) {
    console.error("Check existing error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
