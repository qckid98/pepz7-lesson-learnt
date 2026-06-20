import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getPreviewPresignedUrl } from "@/lib/s3";

/** GET /api/files — List files (requires login). ?root=true for root-level files */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const root = request.nextUrl.searchParams.get("root") === "true";

    const files = await db.file.findMany({
      where: {
        deletedAt: null,
        ...(root ? { folderId: null } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    // Generate previewUrl for image/video files
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
    console.error("List files error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
