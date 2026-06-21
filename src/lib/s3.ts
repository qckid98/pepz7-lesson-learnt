import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  HeadObjectCommand,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

// Biznet Gio NEO Object Storage (S3 Compatible)
export const s3Client = new S3Client({
  region: process.env.S3_REGION || "us-east-1",
  endpoint: process.env.S3_ENDPOINT || "https://s3.biznetgio.com",
  credentials: {
    accessKeyId: process.env.S3_ACCESS_KEY || "",
    secretAccessKey: process.env.S3_SECRET_KEY || "",
  },
  forcePathStyle: true, // Required for S3-compatible services
});

const BUCKET = process.env.S3_BUCKET || "file-sharing-prod";

/**
 * Generate presigned URL for uploading a file directly to S3
 */
export async function getUploadPresignedUrl(
  key: string,
  contentType: string,
  _contentLength: number,
  expiresIn: number = 900 // 15 minutes
): Promise<string> {
  const command = new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ContentType: contentType,
  });

  return getSignedUrl(s3Client, command, {
    expiresIn,
    signableHeaders: new Set(["host"]),
  });
}

/**
 * Generate presigned URL for downloading/previewing a file
 */
export async function getDownloadPresignedUrl(
  key: string,
  expiresIn: number = 3600, // 1 hour
  fileName?: string
): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ...(fileName && {
      ResponseContentDisposition: `attachment; filename="${encodeURIComponent(fileName)}"`,
    }),
  });

  return getSignedUrl(s3Client, command, {
    expiresIn,
    signableHeaders: new Set(["host"]),
  });
}

/**
 * Generate presigned URL for previewing (inline, not download)
 * For video/audio: include 'range' in signableHeaders to support streaming/seeking
 */
export async function getPreviewPresignedUrl(
  key: string,
  contentType: string,
  expiresIn: number = 3600
): Promise<string> {
  const isStreamable = contentType.startsWith("video/") || contentType.startsWith("audio/");
  const command = new GetObjectCommand({
    Bucket: BUCKET,
    Key: key,
    ResponseContentType: contentType,
    ResponseContentDisposition: "inline",
  });

  const signableHeaders = isStreamable
    ? new Set(["host", "range"])
    : new Set(["host"]);

  return getSignedUrl(s3Client, command, {
    expiresIn,
    signableHeaders,
  });
}

/**
 * Delete a file from S3
 */
export async function deleteFile(key: string): Promise<void> {
  const command = new DeleteObjectCommand({
    Bucket: BUCKET,
    Key: key,
  });

  await s3Client.send(command);
}

/**
 * Check if a file exists in S3
 */
export async function fileExists(key: string): Promise<boolean> {
  try {
    const command = new HeadObjectCommand({
      Bucket: BUCKET,
      Key: key,
    });
    await s3Client.send(command);
    return true;
  } catch {
    return false;
  }
}

/**
 * Generate a unique S3 key for a file
 */
export function generateS3Key(
  fileName: string,
  folderId?: string
): string {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 10);
  const ext = fileName.split(".").pop()?.toLowerCase() || "bin";
  const safeName = fileName
    .replace(/[^a-zA-Z0-9.-]/g, "_")
    .substring(0, 50);

  const prefix = folderId ? `folders/${folderId}` : "root";
  return `${prefix}/${timestamp}-${random}-${safeName}.${ext}`;
}
