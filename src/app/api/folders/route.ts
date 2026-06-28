import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createFolderSchema } from "@/lib/validators";

/** Recursively count all files inside a folder (including sub-folders) */
async function countAllFiles(folderId: string, depth = 0): Promise<number> {
  if (depth > 10) return 0; // Prevent infinite recursion
  try {
    let count = 0;
    const directFiles = await db.file.count({ where: { folderId, deletedAt: null } });
    count += directFiles;
    const subFolders = await db.folder.findMany({
      where: { parentId: folderId, deletedAt: null },
      select: { id: true },
    });
    for (const sub of subFolders) {
      count += await countAllFiles(sub.id, depth + 1);
    }
    return count;
  } catch {
    return 0;
  }
}

/** Recursively count all sub-folders inside a folder */
async function countAllSubFolders(folderId: string, depth = 0): Promise<number> {
  if (depth > 10) return 0;
  try {
    let count = 0;
    const subFolders = await db.folder.findMany({
      where: { parentId: folderId, deletedAt: null },
      select: { id: true },
    });
    count += subFolders.length;
    for (const sub of subFolders) {
      count += await countAllSubFolders(sub.id, depth + 1);
    }
    return count;
  } catch {
    return 0;
  }
}

/**
 * GET /api/folders
 * List folders (requires login)
 * ?all=true → return all folders (flat, for tree view)
 * ?parentId=xxx → return children of specific folder
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const parentId = request.nextUrl.searchParams.get("parentId");
    const fetchAll = request.nextUrl.searchParams.get("all") === "true";
    const isAdmin = session.user.role === "ADMIN";

    const folders = await db.folder.findMany({
      where: {
        deletedAt: null,
        ...(fetchAll ? {} : { parentId: parentId || null }),
        ...(!isAdmin ? { visibility: "PUBLIC" } : {}),
      },
      include: {
        _count: {
          select: { files: true, children: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Add recursive file count — wrapped in try-catch to prevent 500
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        try {
          const totalFiles = await countAllFiles(folder.id);
          const totalSubFolders = await countAllSubFolders(folder.id);
          return {
            ...folder,
            _count: {
              files: folder._count?.files || 0,
              children: folder._count?.children || 0,
              totalFiles,
              totalSubFolders,
            },
          };
        } catch {
          return folder;
        }
      })
    );

    return NextResponse.json(foldersWithCounts);
  } catch (error) {
    console.error("List folders error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/folders
 * Create a new folder (Admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || session.user.role !== "ADMIN") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const parsed = createFolderSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Invalid request", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const { name, parentId, visibility } = parsed.data;

    const existing = await db.folder.findFirst({
      where: { name, parentId: parentId || null, deletedAt: null },
    });

    if (existing) {
      return NextResponse.json(
        { error: "Folder with this name already exists" },
        { status: 409 }
      );
    }

    const folder = await db.folder.create({
      data: {
        name,
        parentId: parentId || null,
        visibility,
      },
      include: {
        _count: { select: { files: true, children: true } },
      },
    });

    return NextResponse.json(folder, { status: 201 });
  } catch (error) {
    console.error("Create folder error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
