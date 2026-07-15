"use client";

import type { FileItem, FolderItem } from "@/hooks/use-file-manager";

interface BulkActionBarProps {
  selectedCount: number;
  viewMode: string;
  selectedIds: Set<string>;
  files: FileItem[];
  folders: FolderItem[];
  onClearSelection: () => void;
  onTrash: (fileIds: string[], folderIds: string[]) => void;
  onBulkRestore: (ids: string[]) => void;
  onBulkPermanentDelete: (ids: string[], count: number) => void;
}

export default function BulkActionBar(props: BulkActionBarProps) {
  if (props.selectedCount === 0) return null;

  const selectedIdArray = Array.from(props.selectedIds);
  const selectedFileIds = selectedIdArray.filter((id) => props.files.some((f) => f.id === id));
  const selectedFolderIds = selectedIdArray.filter((id) => props.folders.some((f) => f.id === id));

  const handleZipDownload = () => {
    if (selectedFileIds.length + selectedFolderIds.length === 0) return;
    fetch("/api/files/bulk-download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ fileIds: selectedFileIds, folderIds: selectedFolderIds }),
    })
      .then((res) => res.blob())
      .then((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "download.zip";
        a.click();
        URL.revokeObjectURL(url);
      })
      .catch((e) => console.error("ZIP download error:", e));
  };

  return (
    <div className="px-3 sm:px-6 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-sm">
      <span className="font-medium text-blue-700">{props.selectedCount} dipilih</span>
      {props.viewMode !== "trash" && (
        <>
          <button onClick={handleZipDownload} className="text-blue-600 hover:underline">
            Download ZIP
          </button>
          <button
            onClick={() => props.onTrash(selectedFileIds, selectedFolderIds)}
            className="text-red-600 hover:underline"
          >
            Hapus
          </button>
          <button onClick={props.onClearSelection} className="text-gray-500 hover:underline">Batal</button>
        </>
      )}
      {props.viewMode === "trash" && (
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
