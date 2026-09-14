import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { deleteFile } from "@/lib/s3";

export async function DELETE() {
  try {
    const session = await auth();
    if (session?.user?.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // 1. Delete all trashed files from S3
    const trashedFiles = await db.file.findMany({
      where: { deletedAt: { not: null } },
      select: { id: true, s3Key: true },
    });

    for (const f of trashedFiles) {
      await deleteFile(f.s3Key);
    }

    // 2. Delete all trashed files from DB
    await db.file.deleteMany({
      where: { deletedAt: { not: null } },
    });

    // 3. Delete all trashed folders from DB
    await db.folder.deleteMany({
      where: { deletedAt: { not: null } },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Empty trash error:", error);
    return NextResponse.json({ error: "Failed to empty trash" }, { status: 500 });
  }
}
