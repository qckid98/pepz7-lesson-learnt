"use client";

import { useState } from "react";
import { toast } from "sonner";

export interface UploadItem {
  id: string;
  name: string;
  size: number;
  progress: number;
  status: "uploading" | "done" | "error";
  error?: string;
}

export interface ConflictState {
  files: File[];
  folderId: string | null;
  existingNames: string[];
  currentIndex: number;
  skipAllSame: boolean;
  overwriteAllSame: boolean;
  resolvedFiles: File[];
}

const cleanName = (name: string) => name.replace(/^.*\//, "").trim();

/**
 * Upload pipeline: single-file upload (XHR + retry), conflict detection,
 * folder-upload with tree creation, progress tracking.
 *
 * Conflict resolution uses a window callback bridge (window.__resolveConflict).
 * Phase 3 refactor will replace this with a React-level resolver.
 */
export function useFileUpload(opts: {
  currentFolderId: string | null;
  onUploaded: () => void; // fetchData
}) {
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [conflictDialog, setConflictDialog] = useState<ConflictState | null>(null);

  // ===== Single-file upload with retry =====
  const uploadSingleFile = async (file: File, folderId: string | null, uploadId: string) => {
    const maxRetries = 2;
    let lastError = "";

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const formData = new FormData();
        formData.append("file", file);
        formData.append("folderId", folderId || "");

        await new Promise<void>((resolve, reject) => {
          const xhr = new XMLHttpRequest();
          xhr.open("POST", "/api/files/upload-direct");
          xhr.timeout = 1800000; // 30 min — accommodates 1GB on slow links
          xhr.upload.onprogress = (event) => {
            if (event.lengthComputable) {
              const progress = Math.round((event.loaded / event.total) * 100);
              setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress } : u)));
            }
          };
          xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 100, status: "done" } : u)));
              toast.success(`"${cleanName(file.name)}" uploaded`);
              resolve();
            } else {
              let errMsg = "Upload gagal";
              try {
                errMsg = JSON.parse(xhr.responseText).error || errMsg;
              } catch {
                /* keep default */
              }
              lastError = errMsg;
              reject(new Error(errMsg));
            }
          };
          xhr.onerror = () => {
            lastError = "Network error";
            reject(new Error(lastError));
          };
          xhr.ontimeout = () => {
            lastError = "Timeout";
            reject(new Error(lastError));
          };
          xhr.send(formData);
        });
        return; // Success
      } catch {
        if (attempt < maxRetries) {
          await new Promise((r) => setTimeout(r, 1000));
          setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, progress: 0, status: "uploading" } : u)));
        } else {
          setUploads((prev) => prev.map((u) => (u.id === uploadId ? { ...u, status: "error", error: lastError } : u)));
          toast.error(`"${cleanName(file.name)}" failed: ${lastError}`);
        }
      }
    }
  };

  // ===== Check existing files and resolve conflicts =====
  const checkAndUpload = async (fileArray: File[], folderId: string | null) => {
    const fileNames = fileArray.map((f) => cleanName(f.name));
    let existingNames: string[] = [];
    try {
      const res = await fetch("/api/files/check-existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ folderId, fileNames }),
      });
      if (res.ok) {
        const data = await res.json();
        existingNames = data.existing || [];
      }
    } catch {
      /* ignore */
    }

    let filesToUpload: File[] = [];

    if (existingNames.length > 0) {
      const conflictFiles = fileArray.filter((f) => existingNames.includes(cleanName(f.name)));
      const nonConflictFiles = fileArray.filter((f) => !existingNames.includes(cleanName(f.name)));

      // Upload non-conflicting files immediately
      if (nonConflictFiles.length > 0) {
        const newUploads = nonConflictFiles.map((file, i) => ({
          id: `${Date.now()}-${i}`,
          name: cleanName(file.name),
          size: file.size,
          progress: 0,
          status: "uploading" as const,
        }));
        setUploads((prev) => [...prev, ...newUploads]);

        for (let i = 0; i < nonConflictFiles.length; i++) {
          await uploadSingleFile(nonConflictFiles[i], folderId, newUploads[i].id);
        }
      }

      // Show conflict dialog for conflicting files
      filesToUpload = await new Promise<File[]>((resolve) => {
        setConflictDialog({
          files: conflictFiles,
          folderId,
          existingNames,
          currentIndex: 0,
          skipAllSame: false,
          overwriteAllSame: false,
          resolvedFiles: [],
        });

        (window as unknown as Record<string, unknown>).__resolveConflict = (result: File[]) => {
          setConflictDialog(null);
          resolve(result);
        };
      });
    } else {
      filesToUpload = fileArray;
    }

    // Upload resolved files
    if (filesToUpload.length > 0) {
      const moreUploads = filesToUpload.map((file, i) => ({
        id: `${Date.now()}-r${i}`,
        name: cleanName(file.name),
        size: file.size,
        progress: 0,
        status: "uploading" as const,
      }));
      setUploads((prev) => [...prev, ...moreUploads]);

      for (let i = 0; i < filesToUpload.length; i++) {
        await uploadSingleFile(filesToUpload[i], folderId, moreUploads[i].id);
      }
    }

    opts.onUploaded();
    setTimeout(() => {
      setUploads((prev) => prev.filter((u) => u.status !== "done"));
    }, 3000);
  };

  const handleUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    await checkAndUpload(fileArray, opts.currentFolderId);
  };

  // ===== Folder upload (preserves directory structure) =====
  const handleFolderUpload = async (files: FileList) => {
    const fileArray = Array.from(files);
    if (fileArray.length === 0) return;

    const folderCache = new Map<string, string>();
    folderCache.set("", opts.currentFolderId || "");

    async function getOrCreateFolder(path: string): Promise<string> {
      if (folderCache.has(path)) return folderCache.get(path)!;

      const parts = path.split("/").filter(Boolean);
      let currentPath = "";
      let parentId = opts.currentFolderId || "";

      for (const part of parts) {
        currentPath = currentPath ? `${currentPath}/${part}` : part;
        if (folderCache.has(currentPath)) {
          parentId = folderCache.get(currentPath)!;
          continue;
        }

        try {
          const res = await fetch("/api/folders", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: part, parentId: parentId || null, visibility: "PUBLIC" }),
          });

          if (res.ok) {
            const data = await res.json();
            folderCache.set(currentPath, data.id);
            parentId = data.id;
          } else if (res.status === 409) {
            // Folder already exists — find it
            const listRes = await fetch(`/api/folders?parentId=${parentId || ""}`);
            if (listRes.ok) {
              const folders = await listRes.json();
              const existing = folders.find((f: { name: string }) => f.name === part);
              if (existing) {
                folderCache.set(currentPath, existing.id);
                parentId = existing.id;
              }
            }
          }
        } catch (e) {
          console.error("Folder create error:", e);
        }
      }
      return parentId;
    }

    // Group files by their target folder
    const filesByFolder = new Map<string, File[]>();
    for (const file of fileArray) {
      const relativePath = (file as File & { webkitRelativePath?: string }).webkitRelativePath || "";
      const dirPath = relativePath.includes("/") ? relativePath.substring(0, relativePath.lastIndexOf("/")) : "";
      const targetFolderId = await getOrCreateFolder(dirPath);
      if (!filesByFolder.has(targetFolderId)) {
        filesByFolder.set(targetFolderId, []);
      }
      filesByFolder.get(targetFolderId)!.push(file);
    }

    // Upload each group with conflict checking
    for (const [folderId, files] of filesByFolder) {
      await checkAndUpload(files, folderId);
    }
  };

  // ===== Conflict resolver (called by ConflictDialog) =====
  const resolveConflict = (result: File[]) => {
    const resolver = (window as unknown as Record<string, unknown>).__resolveConflict as
      | ((result: File[]) => void)
      | undefined;
    resolver?.(result);
  };

  const clearCompletedUploads = () => {
    setUploads((prev) => prev.filter((u) => u.status !== "done"));
  };

  return {
    uploads,
    setUploads,
    conflictDialog,
    setConflictDialog,
    handleUpload,
    handleFolderUpload,
    resolveConflict,
    clearCompletedUploads,
  };
}
