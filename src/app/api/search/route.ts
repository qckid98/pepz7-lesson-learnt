import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";

/**
 * GET /api/search?q=keyword&type=all|pdf|image|video|audio|document
 * Search files by name. Respects folder visibility.
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const query = request.nextUrl.searchParams.get("q")?.trim();
    const type = request.nextUrl.searchParams.get("type") || "all";

    if (!query || query.length < 2) {
      return NextResponse.json(
        { error: "Query must be at least 2 characters" },
        { status: 400 }
      );
    }

    // Build mime type filter
    let mimeFilter: object | undefined;
    switch (type) {
      case "pdf":
        mimeFilter = { mimeType: "application/pdf" };
        break;
      case "image":
        mimeFilter = { mimeType: { startsWith: "image/" } };
        break;
      case "video":
        mimeFilter = { mimeType: { startsWith: "video/" } };
        break;
      case "audio":
        mimeFilter = { mimeType: { startsWith: "audio/" } };
        break;
      case "document":
        mimeFilter = {
          OR: [
            { mimeType: { contains: "word" } },
            { mimeType: { contains: "document" } },
            { mimeType: { contains: "sheet" } },
            { mimeType: { contains: "excel" } },
            { mimeType: { contains: "presentation" } },
            { mimeType: { contains: "powerpoint" } },
            { mimeType: "text/plain" },
            { mimeType: "text/csv" },
          ],
        };
        break;
      default:
        mimeFilter = undefined;
    }

    const files = await db.file.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        deletedAt: null,
        ...mimeFilter,
      },
      include: {
        folder: { select: { id: true, name: true, visibility: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Convert BigInt to string for JSON serialization
    const results = files.map((file) => ({
      ...file,
      size: file.size.toString(),
    }));

    return NextResponse.json({
      query,
      type,
      count: results.length,
      results,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
