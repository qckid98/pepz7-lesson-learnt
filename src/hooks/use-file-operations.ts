"use client";

import { useState } from "react";
import { toast } from "sonner";
import type { FileManagerState } from "@/hooks/use-file-manager";

import { useQueryClient } from "@tanstack/react-query";

/**
 * File/folder CRUD operations: rename, star, trash, restore, permanent-delete, move.
 * Selection logic (shift-range, ctrl-toggle) lives here too.
 */
export function useFileOperations(opts: {
  store: FileManagerState;
  fetchData: () => void;
  confirmAction?: (msg: string, onOk: () => void) => void;
}) {
  const { store, fetchData, confirmAction = (msg, onOk) => { if (window.confirm(msg)) onOk(); } } = opts;
  const [deleteLoading, setDeleteLoading] = useState(false);
  const queryClient = useQueryClient();

  const invalidateData = () => {
    queryClient.invalidateQueries({ queryKey: ["folders"] });
    queryClient.invalidateQueries({ queryKey: ["files"] });
    fetchData(); // fallback for components not using react-query yet
  };

  const handleRename = async (id: string, type: "file" | "folder", newName: string) => {
    if (!newName.trim()) {
      store.setRenamingId(null);
      return;
    }
    try {
      await fetch(`/api/${type}s/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
      toast.success("Renamed");
    } catch {
      toast.error("Rename failed");
    }
    store.setRenamingId(null);
    invalidateData();
  };

  const handleStar = async (id: string, type: "file" | "folder") => {
    await fetch(`/api/${type}s/${id}/star`, { method: "POST" });
    invalidateData();
  };

  const handleTrash = async (fileIds: string[], folderIds: string[]) => {
    const hasFolders = folderIds.length > 0;
    const confirmMsg = hasFolders
      ? `Pindahkan ${fileIds.length + folderIds.length} item ke tempat sampah? Folder beserta semua isinya akan dipindahkan.`
      : `Pindahkan ${fileIds.length} file ke tempat sampah?`;
    
    confirmAction(confirmMsg, async () => {
      setDeleteLoading(true);
      try {
        await fetch("/api/files/bulk", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "trash", fileIds, folderIds }),
        });
        toast.success(`${fileIds.length + folderIds.length} item moved to trash`);
      } catch {
        toast.error("Failed to move to trash");
      }
      store.clearSelection();
      setDeleteLoading(false);
      invalidateData();
    });
  };

  const handleRestore = async (id: string) => {
    await fetch(`/api/trash/${id}/restore`, { method: "POST" });
    toast.success("Restored from trash");
    invalidateData();
  };

  const handlePermanentDelete = async (id: string) => {
    confirmAction("Hapus permanen? Tidak bisa dikembalikan.", async () => {
      await fetch(`/api/trash/${id}`, { method: "DELETE" });
      toast.success("Deleted permanently");
      invalidateData();
    });
  };

  const handleMove = async (fileIds: string[], folderIds: string[], targetId: string | null) => {
    try {
      if (fileIds.length) {
        await fetch("/api/files/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fileIds, targetFolderId: targetId }),
        });
      }
      if (folderIds.length) {
        for (const fid of folderIds) {
          await fetch("/api/folders/move", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ folderId: fid, targetParentId: targetId }),
          });
        }
      }
      toast.success(`${fileIds.length + folderIds.length} item moved`);
    } catch {
      toast.error("Move failed");
    }
    invalidateData();
  };

  /**
   * Click selection with shift-range and ctrl/meta-toggle.
   * `allIds` is the visible, sorted item IDs — passed from the render layer.
   */
  const handleSelect = (e: React.MouseEvent, id: string, allIds: string[]) => {
    if (e.shiftKey && store.lastSelectedId) {
      const start = allIds.indexOf(store.lastSelectedId);
      const end = allIds.indexOf(id);
      if (start !== -1 && end !== -1) {
        const [from, to] = start < end ? [start, end] : [end, start];
        store.selectRange(allIds.slice(from, to + 1));
        return;
      }
    }
    if (e.ctrlKey || e.metaKey) {
      store.toggleSelect(id);
    } else if (store.selectedIds.has(id) && store.selectedIds.size === 1) {
      // Click on already-selected item → deselect
      store.clearSelection();
    } else {
      store.clearSelection();
      store.toggleSelect(id);
    }
  };

  const handleBulkRestore = async (ids: string[]) => {
    for (const id of ids) {
      await fetch(`/api/trash/${id}/restore`, { method: "POST" });
    }
    toast.success(`${ids.length} item restored`);
    store.clearSelection();
    invalidateData();
  };

  const handleBulkPermanentDelete = async (ids: string[], count: number) => {
    confirmAction(`Hapus permanen ${count} item? Tidak bisa dikembalikan.`, async () => {
      for (const id of ids) {
        await fetch(`/api/trash/${id}`, { method: "DELETE" });
      }
      toast.success(`${count} item deleted permanently`);
      store.clearSelection();
      invalidateData();
    });
  };

  const handleEmptyTrash = async () => {
    confirmAction("Kosongkan semua file di Trash? Aksi ini tidak bisa dikembalikan.", async () => {
      try {
        await fetch("/api/trash/empty", { method: "DELETE" });
        toast.success("Trash berhasil dikosongkan");
        store.clearSelection();
        invalidateData();
      } catch {
        toast.error("Gagal mengosongkan trash");
      }
    });
  };

  return {
    deleteLoading,
    handleRename,
    handleStar,
    handleTrash,
    handleRestore,
    handlePermanentDelete,
    handleMove,
    handleSelect,
    handleBulkRestore,
    handleBulkPermanentDelete,
    handleEmptyTrash,
  };
}
