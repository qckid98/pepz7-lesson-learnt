import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { createFolderSchema } from "@/lib/validators";

/** Recursively count all files inside a folder (including sub-folders) */
async function countAllFiles(folderId: string): Promise<number> {
  let count = 0;
  // Count direct files
  const directFiles = await db.file.count({ where: { folderId, deletedAt: null } });
  count += directFiles;
  // Recurse into sub-folders
  const subFolders = await db.folder.findMany({
    where: { parentId: folderId, deletedAt: null },
    select: { id: true },
  });
  for (const sub of subFolders) {
    count += await countAllFiles(sub.id);
  }
  return count;
}

/** Recursively count all sub-folders inside a folder */
async function countAllSubFolders(folderId: string): Promise<number> {
  let count = 0;
  const subFolders = await db.folder.findMany({
    where: { parentId: folderId, deletedAt: null },
    select: { id: true },
  });
  count += subFolders.length;
  for (const sub of subFolders) {
    count += await countAllSubFolders(sub.id);
  }
  return count;
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
        // Viewers can only see PUBLIC folders
        ...(!isAdmin ? { visibility: "PUBLIC" } : {}),
      },
      include: {
        _count: {
          select: { files: true, children: true },
        },
      },
      orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    });

    // Add recursive file count for each folder
    const foldersWithCounts = await Promise.all(
      folders.map(async (folder) => {
        const totalFiles = await countAllFiles(folder.id);
        const totalSubFolders = await countAllSubFolders(folder.id);
        return {
          ...folder,
          _count: {
            files: folder._count.files,
            children: folder._count.children,
            totalFiles,
            totalSubFolders,
          },
        };
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

    // Check if folder with same name exists in same parent
    const existing = await db.folder.findFirst({
      where: { name, parentId: parentId || null },
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
