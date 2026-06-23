import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

/**
 * GET /api/search?q=keyword&type=all|pdf|image|video|audio|document|spreadsheet|presentation
 * Search files AND folders by name. Respects folder visibility for viewers.
 */
export async function GET(request: NextRequest) {
  try {
    // Rate limit: 30 searches per minute
    const limited = rateLimit(request, RATE_LIMITS.search);
    if (limited) return limited;

    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const isAdmin = session.user.role === "ADMIN";

    const query = request.nextUrl.searchParams.get("q")?.trim();
    const type = request.nextUrl.searchParams.get("type") || "all";

    if (!query || query.length < 1) {
      return NextResponse.json(
        { error: "Query must be at least 1 character" },
        { status: 400 }
      );
    }

    // Build mime type filter for files
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
        mimeFilter = { mimeType: { contains: "word" } };
        break;
      case "spreadsheet":
        mimeFilter = { mimeType: { contains: "sheet" } };
        break;
      case "presentation":
        mimeFilter = { mimeType: { contains: "presentation" } };
        break;
      default:
        mimeFilter = undefined;
    }

    // Search files
    const files = await db.file.findMany({
      where: {
        name: { contains: query, mode: "insensitive" },
        deletedAt: null,
        ...mimeFilter,
        // Viewers can only see files in public folders or root
        ...(!isAdmin
          ? {
              OR: [
                { folder: { visibility: "PUBLIC" } },
                { folderId: null },
              ],
            }
          : {}),
      },
      include: {
        folder: { select: { id: true, name: true, visibility: true } },
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    // Search folders (only when type is "all")
    let folders: Array<{
      id: string;
      name: string;
      parentId: string | null;
      visibility: string;
      _count?: { files: number; children: number };
    }> = [];

    if (type === "all") {
      folders = await db.folder.findMany({
        where: {
          name: { contains: query, mode: "insensitive" },
          deletedAt: null,
          // Viewers can only see public folders
          ...(!isAdmin ? { visibility: "PUBLIC" } : {}),
        },
        include: {
          _count: { select: { files: true, children: true } },
        },
        orderBy: { name: "asc" },
        take: 20,
      });
    }

    // Convert BigInt to string for JSON serialization
    const fileResults = files.map((file) => ({
      ...file,
      size: file.size.toString(),
    }));

    return NextResponse.json({
      query,
      type,
      count: fileResults.length + folders.length,
      results: fileResults,
      folders,
    });
  } catch (error) {
    console.error("Search error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
