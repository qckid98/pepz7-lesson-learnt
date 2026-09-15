import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { ZipArchive } from "archiver";
import { PassThrough } from "stream";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { fileIds, folderIds } = body as { fileIds: string[]; folderIds: string[] };

    const fIds = fileIds || [];
    const flIds = folderIds || [];

    if (fIds.length === 0 && flIds.length === 0) {
      return NextResponse.json({ error: "No files selected" }, { status: 400 });
    }

    const allFileIds = [...fIds];

    async function collectFolderFiles(folderId: string) {
      const files = await db.file.findMany({
        where: { folderId, deletedAt: null },
        select: { id: true },
      });
      allFileIds.push(...files.map((f) => f.id));

      const subFolders = await db.folder.findMany({
        where: { parentId: folderId, deletedAt: null },
        select: { id: true },
      });
      for (const sub of subFolders) {
        await collectFolderFiles(sub.id);
      }
    }

    for (const folderId of flIds) {
      await collectFolderFiles(folderId);
    }

    if (allFileIds.length === 0) {
      return NextResponse.json({ error: "No files found" }, { status: 404 });
    }

    const files = await db.file.findMany({
      where: { id: { in: allFileIds }, deletedAt: null },
      select: { id: true, name: true, s3Key: true, folderId: true },
    });

    const folderMap = new Map<string, string>();
    async function buildFolderPath(folderId: string | null): Promise<string> {
      if (!folderId) return "";
      if (folderMap.has(folderId)) return folderMap.get(folderId)!;
      const folder = await db.folder.findUnique({
        where: { id: folderId },
        select: { name: true, parentId: true },
      });
      if (!folder) return "";
      const parentPath = await buildFolderPath(folder.parentId);
      const path = parentPath ? `${parentPath}/${folder.name}` : folder.name;
      folderMap.set(folderId, path);
      return path;
    }

    const archive = new ZipArchive({ zlib: { level: 5 } });
    const chunks: Buffer[] = [];
    const passthrough = new PassThrough();
    archive.pipe(passthrough);

    passthrough.on("data", (chunk: Buffer) => {
      chunks.push(chunk);
    });

    const zipFinished = new Promise<void>((resolve, reject) => {
      passthrough.on("end", resolve);
      passthrough.on("error", reject);
    });

    const usedNames = new Set<string>();

    for (const file of files) {
      const command = new GetObjectCommand({
        Bucket: process.env.S3_BUCKET || "file-sharing-prod",
        Key: file.s3Key,
      });
      const s3Response = await s3Client.send(command);
      const bodyStream = s3Response.Body as import("stream").Readable;
      if (!bodyStream) continue;

      const fileChunks: Buffer[] = [];
      for await (const chunk of bodyStream) {
        fileChunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      }
      const fileBuffer = Buffer.concat(fileChunks);

      const folderPath = await buildFolderPath(file.folderId);
      let zipPath = folderPath ? `${folderPath}/${file.name}` : file.name;

      let counter = 1;
      while (usedNames.has(zipPath)) {
        const extMatch = file.name.match(/(\.[^.]+)$/);
        const ext = extMatch ? extMatch[0] : "";
        const base = extMatch ? file.name.slice(0, -ext.length) : file.name;
        zipPath = folderPath ? `${folderPath}/${base} (${counter})${ext}` : `${base} (${counter})${ext}`;
        counter++;
      }
      usedNames.add(zipPath);

      archive.append(fileBuffer, { name: zipPath });
    }

    archive.finalize();
    await zipFinished;

    const zipBuffer = Buffer.concat(chunks);

    const headers = new Headers();
    headers.set("Content-Type", "application/zip");
    headers.set("Content-Disposition", `attachment; filename="download.zip"`);
    headers.set("Content-Length", zipBuffer.length.toString());

    return new NextResponse(new Uint8Array(zipBuffer), { headers });
  } catch (error) {
    console.error("Bulk download error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
