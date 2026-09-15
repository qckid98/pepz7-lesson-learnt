"use client";

import { useState } from "react";
import type { FileItem, FolderItem } from "@/hooks/use-file-manager";

interface BulkActionBarProps {
  selectedCount: number;
  viewMode: string;
  selectedIds: Set<string>;
  files: FileItem[];
  folders: FolderItem[];
  isAdmin: boolean;
  onClearSelection: () => void;
  onTrash: (fileIds: string[], folderIds: string[]) => void;
  onBulkRestore: (ids: string[]) => void;
  onBulkPermanentDelete: (ids: string[], count: number) => void;
}

export default function BulkActionBar(props: BulkActionBarProps) {
  const [isDownloading, setIsDownloading] = useState(false);

  if (props.selectedCount === 0) return null;

  const selectedIdArray = Array.from(props.selectedIds);
  const selectedFileIds = selectedIdArray.filter((id) => props.files.some((f) => f.id === id));
  const selectedFolderIds = selectedIdArray.filter((id) => props.folders.some((f) => f.id === id));

  const handleZipDownload = async () => {
    if (selectedFileIds.length + selectedFolderIds.length === 0) return;
    setIsDownloading(true);
    try {
      const res = await fetch("/api/files/bulk-download", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fileIds: selectedFileIds, folderIds: selectedFolderIds }),
      });

      if (!res.ok) {
        const { toast } = await import("sonner");
        const data = await res.json().catch(() => null);
        toast.error(data?.error || "Gagal mengunduh ZIP");
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "download.zip";
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="px-3 sm:px-6 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-sm">
      <span className="font-medium text-blue-700">{props.selectedCount} dipilih</span>
      {props.viewMode !== "trash" && (
        <>
          <button 
            onClick={handleZipDownload} 
            disabled={isDownloading}
            className={`flex items-center gap-1.5 ${isDownloading ? 'text-gray-400 cursor-not-allowed' : 'text-blue-600 hover:underline'}`}
          >
            {isDownloading && <div className="w-3 h-3 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />}
            {isDownloading ? "Menyiapkan ZIP..." : "Download ZIP"}
          </button>
          {props.isAdmin && (
            <button
              onClick={() => props.onTrash(selectedFileIds, selectedFolderIds)}
              className="text-red-600 hover:underline"
            >
              Hapus
            </button>
          )}
          <button onClick={props.onClearSelection} className="text-gray-500 hover:underline">Batal</button>
        </>
      )}
      {props.isAdmin && props.viewMode === "trash" && (
        <>
          <button
            onClick={() => props.onBulkRestore(selectedIdArray)}
            className="text-green-600 hover:underline"
          >
            Restore Semua
          </button>
          <button
            onClick={() => props.onBulkPermanentDelete(selectedIdArray, props.selectedCount)}
            className="text-red-600 hover:underline"
          >
            Hapus Permanen
          </button>
          <button onClick={props.onClearSelection} className="text-gray-500 hover:underline">Batal</button>
        </>
      )}
    </div>
  );
}
