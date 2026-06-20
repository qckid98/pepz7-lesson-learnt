import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { getDownloadPresignedUrl } from "@/lib/s3";

/**
 * GET /api/files/[id]/download
 * Generate download URL and log the download
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const file = await db.file.findUnique({
      where: { id },
      include: { folder: true },
    });

    if (!file) {
      return NextResponse.json({ error: "File not found" }, { status: 404 });
    }

    // Require login
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Generate download presigned URL
    const downloadUrl = await getDownloadPresignedUrl(
      file.s3Key,
      3600,
      file.originalName
    );

    // Log the download
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";
    const userAgent = request.headers.get("user-agent") || "unknown";

    await db.downloadLog.create({
      data: {
        fileId: file.id,
        userId: session?.user?.id || null,
        ipAddress: ip,
        userAgent: userAgent.substring(0, 255),
      },
    });

    // Increment download count
    await db.file.update({
      where: { id },
      data: { downloadCount: { increment: 1 } },
    });

    // Redirect directly to presigned URL (auto-download)
    return NextResponse.redirect(downloadUrl, 302);
  } catch (error) {
    console.error("Download error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
