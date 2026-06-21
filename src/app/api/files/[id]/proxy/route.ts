import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";

export const runtime = "nodejs";

/**
 * GET /api/files/[id]/proxy
 * Streams file content from S3 through our server (bypasses CORS).
 * Used by pdf.js, SheetJS, mammoth.js, JSZip for preview rendering.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    const { id } = await params;

    const file = await db.file.findUnique({
      where: { id },
      include: { folder: true },
    });

    if (!file || file.deletedAt) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    // Require login
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch from S3
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET || "file-sharing-prod",
      Key: file.s3Key,
    });

    let response;
    try {
      response = await s3Client.send(command);
    } catch (s3Err) {
      console.error("S3 fetch error for key:", file.s3Key, s3Err);
      return NextResponse.json(
        { error: "File not found in storage", s3Key: file.s3Key },
        { status: 404 }
      );
    }

    const body = response.Body as import("stream").Readable;
    if (!body) {
      return NextResponse.json(
        { error: "Empty response from storage" },
        { status: 500 }
      );
    }

    // Convert stream to buffer — preserve binary data exactly
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    if (buffer.length === 0) {
      return NextResponse.json(
        { error: "Empty file content" },
        { status: 500 }
      );
    }

    // Set headers — binary safe
    const headers = new Headers();
    headers.set("Content-Type", file.mimeType);
    headers.set("Content-Length", buffer.length.toString());
    headers.set("Cache-Control", "public, max-age=3600");
    headers.set("Accept-Ranges", "bytes");

    // Return as Uint8Array to ensure binary-safe response
    return new NextResponse(new Uint8Array(buffer), { headers });
  } catch (error) {
    console.error("Proxy error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json(
      { error: message },
      { status: 500 }
    );
  }
}
