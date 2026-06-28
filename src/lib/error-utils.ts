/**
 * Sanitize error for API response — hide stack traces in production
 * Only returns generic error message, logs full error server-side
 */
export function sanitizeError(error: unknown, defaultMessage = "Internal server error"): string {
  // Always log full error server-side
  console.error("[API Error]", error);

  // In development, return full error for debugging
  if (process.env.NODE_ENV === "development") {
    return error instanceof Error ? error.message : String(error);
  }

  // In production, return generic message
  // Don't leak: stack traces, file paths, DB errors, S3 keys, internal IDs
  if (error instanceof Error) {
    // Whitelist of known safe error messages
    const safeErrors = [
      "Unauthorized",
      "Forbidden",
      "Not found",
      "File not found",
      "Folder not found",
      "File type",
      "File too large",
      "File already",
      "Invalid",
      "No file provided",
      "Empty",
      "Expected multipart",
      "Cannot",
      "Network error",
      "Timeout",
    ];

    const msg = error.message;
    if (safeErrors.some(safe => msg.toLowerCase().includes(safe.toLowerCase()))) {
      return msg;
    }
  }

  return defaultMessage;
}
