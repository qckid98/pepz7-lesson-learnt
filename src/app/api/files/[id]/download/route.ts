import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { s3Client } from "@/lib/s3";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { rateLimit, RATE_LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

/**
 * GET /api/files/[id]/download
 * Stream file from S3 through server with Content-Disposition: attachment
 * Works on all browsers (Desktop Chrome/Firefox/Safari, iOS Safari, Android Chrome)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Rate limit: 30 downloads per minute
    const limited = rateLimit(request, RATE_LIMITS.download);
    if (limited) return limited;

    const { id } = await params;

    const file = await db.file.findUnique({
      where: { id },
      include: { folder: true },
    });

    if (!file || file.deletedAt) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Require login
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Fetch file from S3
    const command = new GetObjectCommand({
      Bucket: process.env.S3_BUCKET || "file-sharing-prod",
      Key: file.s3Key,
    });

    let s3Response;
    try {
      s3Response = await s3Client.send(command);
    } catch (s3Err) {
      console.error("S3 fetch error for key:", file.s3Key, s3Err);
      return NextResponse.json(
        { error: "File not found in storage" },
        { status: 404 }
      );
    }

    const body = s3Response.Body as import("stream").Readable;
    if (!body) {
      return NextResponse.json(
        { error: "Empty response from storage" },
        { status: 500 }
      );
    }

    // Log the download
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await db.downloadLog.create({
      data: {
        fileId: file.id,
        userId: session.user.id,
        ipAddress: ip,
        userAgent: userAgent.substring(0, 255),
      },
    });

    // Increment download count
    await db.file.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    // Convert stream to buffer
    const chunks: Buffer[] = [];
    for await (const chunk of body) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }
    const buffer = Buffer.concat(chunks);

    // Validate downloaded size matches database record
    if (buffer.length !== Number(file.size)) {
      console.error(`Download size mismatch: expected ${file.size}, got ${buffer.length} for file ${id}`);
      return NextResponse.json(
        { error: "File integrity check failed" },
        { status: 500 }
      );
    }

    // Set headers — force download with original filename
    // Use application/octet-stream to prevent Safari from opening inline
    // Include both filename and filename* for RFC 5987 compatibility
    const encodedFilename = encodeURIComponent(file.originalName);
    const headers = new Headers();
    headers.set("Content-Type", "application/octet-stream");
    headers.set(
      "Content-Disposition",
      `attachment; filename="${encodedFilename}"; filename*=UTF-8''${encodedFilename}`
    );
    headers.set("Content-Length", buffer.length.toString());
    headers.set("Cache-Control", "no-store");

    return new NextResponse(buffer, { headers });
  } catch (error) {
    console.error("Download error:", error);
    const message = error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
