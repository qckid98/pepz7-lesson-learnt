import { NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPreviewPresignedUrl } from "@/lib/s3";

/** GET /api/recent — Recent files (last 20) */
export async function GET() {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const files = await db.file.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { folder: { select: { id: true, name: true } } },
    });

    const filesWithPreviews = await Promise.all(
      files.map(async (f) => {
        const isPreviewable =
          f.mimeType.startsWith("image/") ||
          f.mimeType.startsWith("video/") ||
          f.mimeType === "application/pdf";
        const previewUrl = isPreviewable
          ? await getPreviewPresignedUrl(f.s3Key, f.mimeType, 3600)
          : undefined;
        return { ...f, size: f.size.toString(), previewUrl };
      })
    );

    return NextResponse.json({ files: filesWithPreviews });
  } catch (error) {
    console.error("Recent files error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
