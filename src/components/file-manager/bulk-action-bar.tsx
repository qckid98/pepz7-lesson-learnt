"use client";

import { useState } from "react";
import { DownloadIcon, TrashIcon, ArrowLeftIcon, XIcon } from "lucide-react";
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
    <div className="px-3 sm:px-6 py-3 bg-blue-50/80 border-b border-blue-100 flex items-center justify-between flex-wrap gap-3">
      <span className="text-sm font-medium text-blue-700">{props.selectedCount} item dipilih</span>
      
      <div className="flex items-center gap-2">
        {props.viewMode !== "trash" && (
          <>
            <button 
              onClick={handleZipDownload} 
              disabled={isDownloading}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-lg transition ${
                isDownloading 
                  ? 'bg-blue-100 text-blue-400 cursor-not-allowed' 
                  : 'bg-blue-600 text-white hover:bg-blue-700 shadow-sm'
              }`}
            >
              {isDownloading ? (
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <DownloadIcon className="w-4 h-4" />
              )}
              <span className="hidden sm:inline">{isDownloading ? "Menyiapkan..." : "Download ZIP"}</span>
              <span className="sm:hidden">{isDownloading ? "Menyiapkan..." : "Download"}</span>
            </button>
            
            {props.isAdmin && (
              <button
                onClick={() => props.onTrash(selectedFileIds, selectedFolderIds)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-white border border-red-200 text-red-600 rounded-lg hover:bg-red-50 hover:border-red-300 transition shadow-sm"
              >
                <TrashIcon className="w-4 h-4" />
                <span className="hidden sm:inline">Hapus</span>
              </button>
            )}
          </>
        )}

        {props.isAdmin && props.viewMode === "trash" && (
          <>
            <button
              onClick={() => props.onBulkRestore(selectedIdArray)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-white border border-green-200 text-green-700 rounded-lg hover:bg-green-50 hover:border-green-300 transition shadow-sm"
            >
              <ArrowLeftIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Restore Semua</span>
              <span className="sm:hidden">Restore</span>
            </button>
            <button
              onClick={() => props.onBulkPermanentDelete(selectedIdArray, props.selectedCount)}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium bg-red-600 text-white rounded-lg hover:bg-red-700 transition shadow-sm"
            >
              <TrashIcon className="w-4 h-4" />
              <span className="hidden sm:inline">Hapus Permanen</span>
              <span className="sm:hidden">Hapus</span>
            </button>
          </>
        )}

        <div className="w-px h-6 bg-blue-200 mx-1 hidden sm:block"></div>
        
        <button 
          onClick={props.onClearSelection} 
          className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm font-medium text-gray-500 hover:text-gray-700 hover:bg-blue-100 rounded-lg transition"
        >
          <XIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Batal</span>
        </button>
      </div>
    </div>
  );
}
