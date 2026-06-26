import { z } from "zod";

// Global max file size: 200MB for all file types
const MAX_FILE_SIZE = 200 * 1024 * 1024;

// Allowed file types (max size is global 200MB for all)
export const ALLOWED_FILE_TYPES: Record<string, { maxSize: number }> = {
  // Documents
  "application/pdf": { maxSize: MAX_FILE_SIZE },
  "application/msword": { maxSize: MAX_FILE_SIZE },
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": { maxSize: MAX_FILE_SIZE },
  "application/vnd.ms-excel": { maxSize: MAX_FILE_SIZE },
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": { maxSize: MAX_FILE_SIZE },
  "application/vnd.ms-powerpoint": { maxSize: MAX_FILE_SIZE },
  "application/vnd.openxmlformats-officedocument.presentationml.presentation": { maxSize: MAX_FILE_SIZE },
  "text/plain": { maxSize: MAX_FILE_SIZE },
  "text/csv": { maxSize: MAX_FILE_SIZE },
  // Images
  "image/jpeg": { maxSize: MAX_FILE_SIZE },
  "image/png": { maxSize: MAX_FILE_SIZE },
  "image/gif": { maxSize: MAX_FILE_SIZE },
  "image/webp": { maxSize: MAX_FILE_SIZE },
  "image/svg+xml": { maxSize: MAX_FILE_SIZE },
  // Video
  "video/mp4": { maxSize: MAX_FILE_SIZE },
  "video/webm": { maxSize: MAX_FILE_SIZE },
  "video/quicktime": { maxSize: MAX_FILE_SIZE },
  // Audio
  "audio/mpeg": { maxSize: MAX_FILE_SIZE },
  "audio/wav": { maxSize: MAX_FILE_SIZE },
  "audio/ogg": { maxSize: MAX_FILE_SIZE },
  // Archives
  "application/zip": { maxSize: MAX_FILE_SIZE },
  "application/x-rar-compressed": { maxSize: MAX_FILE_SIZE },
  "application/x-7z-compressed": { maxSize: MAX_FILE_SIZE },
};

export const MAX_UPLOAD_SIZE = MAX_FILE_SIZE;

export const uploadRequestSchema = z.object({
  fileName: z.string().min(1).max(255),
  fileType: z.string().min(1),
  fileSize: z.number().positive().max(MAX_FILE_SIZE),
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

export function isFileTypeAllowed(mimeType: string): boolean {
  return mimeType in ALLOWED_FILE_TYPES;
}

export function getMaxFileSize(mimeType: string): number {
  return ALLOWED_FILE_TYPES[mimeType]?.maxSize || MAX_FILE_SIZE;
}

export function getFileExtension(fileName: string): string {
  return fileName.split(".").pop()?.toLowerCase() || "";
}

export function formatFileSize(bytes: number | bigint): string {
  const size = Number(bytes);
  if (size === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(size) / Math.log(k));
  return parseFloat((size / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
}

export function getFileCategory(mimeType: string, extension?: string): string {
  const ext = (extension || "").toLowerCase();
  const mt = (mimeType || "").toLowerCase();

  if (["jpg", "jpeg", "png", "gif", "webp", "svg", "bmp"].includes(ext)) return "image";
  if (["mp4", "webm", "mov", "avi", "mkv"].includes(ext)) return "video";
  if (["mp3", "wav", "ogg", "flac", "aac"].includes(ext)) return "audio";
  if (ext === "pdf") return "pdf";
  if (["xls", "xlsx", "csv"].includes(ext)) return "spreadsheet";
  if (["doc", "docx"].includes(ext)) return "document";
  if (["ppt", "pptx"].includes(ext)) return "presentation";
  if (["txt", "md", "log"].includes(ext)) return "text";

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