import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/** GET /api/trash — List trashed files and folders */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const [files, folders] = await Promise.all([
      db.file.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
      db.folder.findMany({
        where: { deletedAt: { not: null } },
        orderBy: { deletedAt: "desc" },
      }),
    ]);

    return NextResponse.json({
      files: files.map((f) => ({ ...f, size: f.size.toString() })),
      folders,
    });
  } catch (error) {
    console.error("List trash error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
