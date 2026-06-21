import { z } from "zod";

// Allowed file types and their max sizes
export const ALLOWED_FILE_TYPES: Record<string, { maxSize: number }> = {
  // Documents
  "application/pdf": { maxSize: 100 * 1024 * 1024 },
  "application/msword": { maxSize: 100 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxSize: 100 * 1024 * 1024 },
  "application/vnd.ms-excel": { maxSize: 50 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { maxSize: 50 * 1024 * 1024 },
  "application/vnd.ms-powerpoint": { maxSize: 200 * 1024 * 1024 },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxSize: 200 * 1024 * 1024 },
  "text/plain": { maxSize: 10 * 1024 * 1024 },
  "text/csv": { maxSize: 50 * 1024 * 1024 },
  // Images
  "image/jpeg": { maxSize: 50 * 1024 * 1024 },
  "image/png": { maxSize: 50 * 1024 * 1024 },
  "image/gif": { maxSize: 25 * 1024 * 1024 },
  "image/webp": { maxSize: 50 * 1024 * 1024 },
  "image/svg+xml": { maxSize: 5 * 1024 * 1024 },
  // Video
  "video/mp4": { maxSize: 5 * 1024 * 1024 * 1024 },
  "video/webm": { maxSize: 5 * 1024 * 1024 * 1024 },
  "video/quicktime": { maxSize: 5 * 1024 * 1024 * 1024 },
  // Audio
  "audio/mpeg": { maxSize: 500 * 1024 * 1024 },
  "audio/wav": { maxSize: 500 * 1024 * 1024 },
  "audio/ogg": { maxSize: 500 * 1024 * 1024 },
  // Archives
  "application/zip": { maxSize: 5 * 1024 * 1024 * 1024 },
  "application/x-rar-compressed": { maxSize: 5 * 1024 * 1024 * 1024 },
  "application/x-7z-compressed": { maxSize: 5 * 1024 * 1024 * 1024 },
};

export const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  fileSize: z.number().positive().max(5 * 1024 * 1024 * 1024),
  folderId: z.string().optional().nullable(),
});

export const createFolderSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.string().optional().nullable(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).default("PUBLIC"),
});

export const updateFolderSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  visibility: z.enum(["PUBLIC", "PRIVATE"]).optional(),
  sortOrder: z.number().optional(),
});

export const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1).max(100),
  role: z.enum(["ADMIN", "VIEWER"]).default("VIEWER"),
});

export const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

/**
 * Check if a file type is allowed
 */
export function isFileTypeAllowed(mimeType: string): boolean {
  return mimeType in ALLOWED_FILE_TYPES;
}

/**
 * Get max file size for a given mime type
 */
export function getMaxFileSize(mimeType: string): number {
  return ALLOWED_FILE_TYPES[mimeType]?.maxSize || 0;
}

/**
 * Get file extension from filename
 */
export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

/**
 * Format file size to human readable
 */
export function formatFileSize(bytes: number | bigint): string {
  const size = Number(bytes);
  if (size === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

/**
 * Get file category from mime type
 */
export function getFileCategory(mimeType: string, extension?: string): string {
  const ext = (extension || "").toLowerCase();
  const mt = (mimeType || "").toLowerCase();

  // Check by extension first (more reliable than mime type from browser)
  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (["doc", "docx"].includes(ext)) return "document";
  if (["ppt", "pptx"].includes(ext)) return "presentation";
  if (["txt", "md", "log"].includes(ext)) return "text";

  // Fallback to mime type
  if (mt.startsWith("image/")) return "image";
  if (mt.startsWith("video/")) return "video";
  if (mt.startsWith("audio/")) return "audio";
  if (mt === "application/pdf") return "pdf";
  if (mt.includes("sheet") || mt.includes("excel") || mt.includes("spreadsheet")) return "spreadsheet";
  if (mt.includes("presentation") || mt.includes("powerpoint")) return "presentation";
  if (mt.includes("word") || mt.includes("wordprocessing")) return "document";
  if (mt.startsWith("text/")) return "text";
  return "other";
}
