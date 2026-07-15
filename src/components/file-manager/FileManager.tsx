"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { useFileManager, type FileItem, type FolderItem } from "@/hooks/use-file-manager";
import { useFileUpload } from "@/hooks/use-file-upload";
import { useFileSearch } from "@/hooks/use-file-search";
import { useFileOperations } from "@/hooks/use-file-operations";
import { ChevronRightIcon, FolderIcon, UploadIcon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { dragState } from "@/lib/drag-state";
import PreviewOverlay from "@/components/file-manager/PreviewOverlay";
import ExplorerSidebar from "@/components/file-manager/explorer-sidebar";
import ExplorerToolbar from "@/components/file-manager/explorer-toolbar";
import FileGridCard from "@/components/file-manager/file-grid-card";
import FileListRow from "@/components/file-manager/file-list-row";
import FileContextMenu from "@/components/file-manager/file-context-menu";
import ConflictDialog from "@/components/file-manager/conflict-dialog";
import UploadProgressPanel from "@/components/file-manager/upload-progress-panel";
import BulkActionBar from "@/components/file-manager/bulk-action-bar";
import NewFolderInline from "@/components/file-manager/new-folder-inline";

// ============ Main Component ============
export default function FileManager({ mode = "admin" }: { mode?: "admin" | "viewer" }) {
  const isAdmin = mode === "admin";
  const store = useFileManager();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadInputRef, setUploadInputRef] = useState<HTMLInputElement | null>(null);
  const [folderUploadInputRef, setFolderUploadInputRef] = useState<HTMLInputElement | null>(null);
  const [isDragOverPage, setIsDragOverPage] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectMode, setSelectMode] = useState(false);

  // ===== Fetch data =====
  const fetchData = useCallback(async () => {
    store.setLoading(true);
    try {
      if (store.viewMode === "recent") {
        const res = await fetch("/api/recent");
        const data = await res.json();
        store.setData(data.files || [], []);
      } else if (store.viewMode === "starred") {
        const res = await fetch("/api/starred");
        const data = await res.json();
        store.setData(data.files || [], data.folders || []);
      } else if (store.viewMode === "trash") {
        const res = await fetch("/api/trash");
        const data = await res.json();
        store.setData(data.files || [], data.folders || []);
      } else {
        // "all" â€” browse folder
        if (store.currentFolderId) {
          const res = await fetch(`/api/folders/${store.currentFolderId}`);
          const data = await res.json();
          store.setData(
            (data.files || []).map((f: Record<string, unknown>) => ({ ...f, size: f.size as string })),
            (data.children || []).map((f: Record<string, unknown>) => ({ ...f, _count: f._count as { files: number; children: number } | undefined }))
          );
        } else {
          // Root: fetch all root folders + root files
          const [foldersRes, filesRes] = await Promise.all([
            fetch("/api/folders"),
            fetch("/api/files?root=true"),
          ]);
          const foldersData = await foldersRes.json();
          const filesData = await filesRes.ok ? await filesRes.json() : { files: [] };
          store.setData(filesData.files || [], foldersData);
        }
      }
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      store.setLoading(false);
    }
  }, [store.viewMode, store.currentFolderId]);

  // ===== Extracted hooks =====
  const { searchQuery, setSearchQuery, searchResults, searchLoading, clearSearch } = useFileSearch();
  const {
    uploads,
    conflictDialog,
    setConflictDialog,
    handleUpload,
    handleFolderUpload,
    resolveConflict,
    clearCompletedUploads,
  } = useFileUpload({ currentFolderId: store.currentFolderId, onUploaded: fetchData });
  const {
    deleteLoading,
    handleRename,
    handleStar,
    handleTrash,
    handleRestore,
    handlePermanentDelete,
    handleMove,
    handleSelect: handleSelectItem,
    handleBulkRestore,
    handleBulkPermanentDelete,
  } = useFileOperations({ store, fetchData });

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ===== Breadcrumbs =====
  const rootLabel = isAdmin ? "My Files" : "Shared Files";
  const setBreadcrumbs = store.setBreadcrumbs;
  const fetchBreadcrumbs = useCallback(async (folderId: string | null) => {
    if (!folderId) {
      setBreadcrumbs([{ id: null, name: rootLabel }]);
      return;
    }
    try {
      const crumbs: { id: string | null; name: string }[] = [];
      let currentId: string | null = folderId;
      while (currentId) {
        const res: Response = await fetch(`/api/folders/${currentId}`);
        if (!res.ok) break;
        const f: { id: string; name: string; parentId: string | null } = await res.json();
        crumbs.unshift({ id: f.id, name: f.name });
        currentId = f.parentId;
      }
      crumbs.unshift({ id: null, name: rootLabel });
      setBreadcrumbs(crumbs);
    } catch { /* ignore */ }
  }, [rootLabel, setBreadcrumbs]);

  useEffect(() => {
    if (store.viewMode === "all") fetchBreadcrumbs(store.currentFolderId);
    else if (store.viewMode === "recent") setBreadcrumbs([{ id: null, name: "Recent" }]);
    else if (store.viewMode === "starred") setBreadcrumbs([{ id: null, name: "Starred" }]);
    else if (store.viewMode === "trash") setBreadcrumbs([{ id: null, name: "Trash" }]);
  }, [store.viewMode, store.currentFolderId, fetchBreadcrumbs, setBreadcrumbs]);

  // ===== Actions =====
  const handleNavigate = (folderId: string | null) => {
    store.setCurrentFolder(folderId);
    store.setViewMode("all");
    clearSearch();
  };

  // ===== Create folder =====
  const handleCreateFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFolderName.trim()) return;
    try {
      await fetch("/api/folders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: newFolderName.trim(),
          parentId: store.currentFolderId,
          visibility: "PUBLIC",
        }),
      });
      setNewFolderName("");
      setShowNewFolder(false);
      fetchData();
    } catch { /* ignore */ }
  };

  // ===== Context menu handler =====
  const handleContextMenu = (e: React.MouseEvent, type: "file" | "folder", id: string) => {
    e.preventDefault();
    store.setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  // ===== Sort items =====
  const sortedItems = (() => {
    // If search is active, use search results instead of current folder
    if (searchResults && searchQuery.trim()) {
      const items: Array<(FileItem | FolderItem) & { _isFolder: boolean }> = [
        ...searchResults.folders.map((f) => ({ ...f, _isFolder: true }) as FolderItem & { _isFolder: boolean }),
        ...searchResults.files.map((f) => ({ ...f, _isFolder: false, size: (f.size as string) || "0" }) as FileItem & { _isFolder: boolean }),
      ];
      return items;
    }

    const items: Array<(FileItem | FolderItem) & { _isFolder: boolean }> = [
      ...store.folders.map((f) => ({ ...f, _isFolder: true })),
      ...store.files.map((f) => ({ ...f, _isFolder: false })),
    ];
    const dir = store.sortDir === "asc" ? 1 : -1;
    items.sort((a, b) => {
      // Folders always first
      if (a._isFolder !== b._isFolder) return a._isFolder ? -1 : 1;
      let cmp = 0;
      if (store.sortBy === "name") cmp = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      else if (store.sortBy === "modified") cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      else if (store.sortBy === "size") {
        const sa = "_isFolder" in a && !a._isFolder ? Number((a as FileItem).size) : 0;
        const sb = "_isFolder" in b && !b._isFolder ? Number((b as FileItem).size) : 0;
        cmp = sa - sb;
      }
      return cmp * dir;
    });
    return items;
  })();

  const allIds = sortedItems.map((i) => i.id);
  const selectedCount = store.selectedIds.size;

  // Virtualizer for list view — handles 1000+ rows smoothly
  const listScrollRef = useRef<HTMLDivElement>(null);
  const rowVirtualizer = useVirtualizer({
    count: sortedItems.length,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 45, // approx row height
    overscan: 10,
    enabled: store.layout === "list" && !store.loading,
  });

  // ===== Drag state =====
  const dragDataRef = useRef<{ type: "file" | "folder"; ids: string[] } | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string, type: "file" | "folder") => {
    const ids = store.selectedIds.has(id) ? Array.from(store.selectedIds) : [id];
    dragDataRef.current = { type, ids };
    dragState.current = { type, ids }; // Shared with sidebar drop
    e.dataTransfer.effectAllowed = "move";
  };

  const handleDropOnFolder = (e: React.DragEvent, folderId: string) => {
    e.preventDefault();
    e.stopPropagation();
    store.setDragOverFolderId(null);
    const dragData = dragDataRef.current;
    if (!dragData) return;
    const fileIds = dragData.type === "file" ? dragData.ids : [];
    const folderIds = dragData.type === "folder" ? dragData.ids : [];
    handleMove(fileIds, folderIds, folderId);
    dragDataRef.current = null;
  };

  // ===== Render =====
  return (
    <div
      className="flex h-[calc(100vh-4rem)]"
      onDragOver={isAdmin ? (e) => { e.preventDefault(); setIsDragOverPage(true); } : undefined}
      onDragLeave={isAdmin ? () => setIsDragOverPage(false) : undefined}
      onDrop={isAdmin ? async (e) => {
        e.preventDefault();
        setIsDragOverPage(false);

        // Check if this is an internal drag (file/folder move), not external file drop
        const dragData = dragState.current;
        if (dragData) {
          // Internal drag — don't trigger upload, let folder drop handlers deal with it
          dragState.current = null;
          return;
        }

        // External file drop â€” handle upload
        const items = e.dataTransfer.items;
        const droppedFiles: File[] = [];

        // If items API available, traverse directory tree recursively
        if (items && items.length > 0) {
          const traversePromises: Promise<void>[] = [];

          const traverseEntry = (entry: FileSystemEntry, path: string = ""): Promise<void> => {
            return new Promise((resolve) => {
              if (entry.isFile) {
                (entry as FileSystemFileEntry).file((file: File) => {
                  droppedFiles.push(file);
                  resolve();
                }, () => resolve());
              } else if (entry.isDirectory) {
                const dirReader = (entry as FileSystemDirectoryEntry).createReader();
                const allEntries: FileSystemEntry[] = [];
                const readEntries = () => {
                  dirReader.readEntries((entries: FileSystemEntry[]) => {
                    if (entries.length === 0) {
                      // Done reading this directory, recurse into children
                      const childPromises = allEntries.map((child) =>
                        traverseEntry(child, path + entry.name + "/")
                      );
                      Promise.all(childPromises).then(() => resolve());
                    } else {
                      allEntries.push(...entries);
                      readEntries(); // Continue reading (readEntries returns max 100 at a time)
                    }
                  }, () => resolve());
                };
                readEntries();
              } else {
                resolve();
              }
            });
          };

          for (let i = 0; i < items.length; i++) {
            const entry = items[i].webkitGetAsEntry?.();
            if (entry) {
              traversePromises.push(traverseEntry(entry));
            }
          }

          await Promise.all(traversePromises);

          if (droppedFiles.length > 0) {
            // Create a FileList-like object
            const dt = new DataTransfer();
            droppedFiles.forEach((f) => dt.items.add(f));
            handleFolderUpload(dt.files);
            return;
          }
        }

        // Fallback: regular file drop
        if (e.dataTransfer.files.length > 0) {
          handleUpload(e.dataTransfer.files);
        }
      } : undefined}
    >
      {/* ===== SIDEBAR (drawer on mobile) ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <ExplorerSidebar onNavigate={(id) => { handleNavigate(id); setSidebarOpen(false); }} onRefresh={fetchData} open={sidebarOpen} onClose={() => setSidebarOpen(false)} isAdmin={isAdmin} rootLabel={rootLabel} />

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <ExplorerToolbar
          onNewFolder={() => setShowNewFolder(true)}
          onUploadClick={() => uploadInputRef?.click()}
          onFolderUploadClick={() => folderUploadInputRef?.click()}
          onSort={store.setSort}
          sortBy={store.sortBy}
          sortDir={store.sortDir}
          layout={store.layout}
          onToggleLayout={store.toggleLayout}
          viewMode={store.viewMode}
          onMenuClick={() => setSidebarOpen(true)}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          searchLoading={searchLoading}
          selectMode={selectMode}
          onToggleSelectMode={() => { setSelectMode(!selectMode); if (selectMode) store.clearSelection(); }}
          isAdmin={isAdmin}
        />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-3 sm:px-6 py-2 text-xs sm:text-sm border-b border-gray-100 flex-wrap overflow-x-auto">
          {searchResults && searchQuery.trim() ? (
            <button
              onClick={() => clearSearch()}
              className="text-blue-600 hover:underline font-medium"
            >
              &larr; Kembali ke {store.currentFolderId ? "folder" : "My Files"}
            </button>
          ) : (
            <>
              {store.breadcrumbs.map((crumb, i) => (
                <div key={i} className="flex items-center gap-1">
                  {i > 0 && <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
                  <button
                    onClick={() => i === 0 ? handleNavigate(null) : handleNavigate(crumb.id)}
                    className={`hover:text-blue-600 ${i === store.breadcrumbs.length - 1 ? "font-semibold text-gray-900" : "text-gray-500"}`}
                  >
                    {crumb.name}
                  </button>
                </div>
              ))}
            </>
          )}
        </div>

        {/* New folder form */}
        {isAdmin && showNewFolder && (
          <NewFolderInline
            value={newFolderName}
            onChange={setNewFolderName}
            onSubmit={handleCreateFolder}
            onCancel={() => setShowNewFolder(false)}
          />
        )}

        {/* Bulk action bar */}
        {isAdmin && (
          <BulkActionBar
            selectedCount={selectedCount}
            viewMode={store.viewMode}
            selectedIds={store.selectedIds}
            files={store.files}
            folders={store.folders}
            onClearSelection={store.clearSelection}
            onTrash={handleTrash}
            onBulkRestore={handleBulkRestore}
            onBulkPermanentDelete={handleBulkPermanentDelete}
          />
        )}

        {/* Content area */}
        <div ref={listScrollRef} className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
          {store.loading ? (
            store.layout === "grid" ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="flex flex-col items-center gap-2 p-3">
                    <Skeleton className="w-16 h-16 rounded-md" />
                    <Skeleton className="w-20 h-3" />
                    <Skeleton className="w-12 h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <div className="border border-gray-200 rounded-xl overflow-hidden">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="flex items-center gap-2 px-2 py-2.5 border-b border-gray-100">
                    <Skeleton className="w-5 h-5 rounded" />
                    <Skeleton className="flex-1 h-4" />
                    <Skeleton className="w-10 h-3 hidden sm:block" />
                    <Skeleton className="w-16 h-3 hidden md:block" />
                    <Skeleton className="w-20 h-3 hidden sm:block" />
                  </div>
                ))}
              </div>
            )
          ) : sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <FolderIcon className="w-12 h-12 mb-2 text-gray-300" />
              <p className="mb-3">{searchResults && searchQuery.trim() ? `Tidak ditemukan hasil untuk "${searchQuery}"` : store.viewMode === "trash" ? "Tempat sampah kosong" : "Belum ada file atau folder"}</p>
              {isAdmin && store.viewMode === "all" && !searchResults && (
                <button onClick={() => uploadInputRef?.click()} className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition">
                  <UploadIcon className="w-4 h-4" /> Upload File
                </button>
              )}
            </div>
          ) : store.layout === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sortedItems.map((item) => (
                <FileGridCard
                  key={item.id}
                  item={item}
                  selected={store.selectedIds.has(item.id)}
                  renaming={store.renamingId === item.id}
                  selectMode={isAdmin && selectMode}
                  onSelect={(e) => handleSelectItem(e, item.id, allIds)}
                  onToggleSelect={() => store.toggleSelect(item.id)}
                  onOpen={() => item._isFolder ? handleNavigate(item.id) : setPreviewFileId(item.id)}
                  onContextMenu={(e) => handleContextMenu(e, item._isFolder ? "folder" : "file", item.id)}
                  onDragStart={isAdmin ? (e) => handleDragStart(e, item.id, item._isFolder ? "folder" : "file") : undefined}
                  onDragOver={isAdmin && item._isFolder ? (e) => { e.preventDefault(); store.setDragOverFolderId(item.id); } : undefined}
                  onDragLeave={isAdmin && item._isFolder ? () => store.setDragOverFolderId(null) : undefined}
                  onDrop={isAdmin && item._isFolder ? (e) => handleDropOnFolder(e, item.id) : undefined}
                  dragOver={store.dragOverFolderId === item.id}
                  onRename={(name) => handleRename(item.id, item._isFolder ? "folder" : "file", name)}
                  isTrash={store.viewMode === "trash"}
                />
              ))}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    {isAdmin && selectMode && <th className="w-10 px-4 py-2"><input type="checkbox" checked={allIds.length > 0 && allIds.every((id) => store.selectedIds.has(id))} onChange={(e) => e.target.checked ? store.selectAll(allIds) : store.clearSelection()} className="rounded" /></th>}
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer w-full" onClick={() => store.setSort("name")}>Nama</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell whitespace-nowrap">Tipe</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer hidden md:table-cell whitespace-nowrap" onClick={() => store.setSort("size")}>Ukuran</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer hidden sm:table-cell whitespace-nowrap" onClick={() => store.setSort("modified")}>Diubah</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {(() => {
                    const virtualItems = rowVirtualizer.getVirtualItems();
                    const paddingTop = virtualItems.length > 0 ? virtualItems[0].start : 0;
                    const paddingBottom = virtualItems.length > 0 ? rowVirtualizer.getTotalSize() - virtualItems[virtualItems.length - 1].end : 0;
                    return (
                      <>
                        {paddingTop > 0 && <tr style={{ height: paddingTop }}><td colSpan={6} /></tr>}
                        {virtualItems.map((virtualRow) => {
                          const item = sortedItems[virtualRow.index];
                          return (
                            <FileListRow
                              key={item.id}
                              item={item}
                              selected={store.selectedIds.has(item.id)}
                              renaming={store.renamingId === item.id}
                              selectMode={isAdmin && selectMode}
                              onSelect={(e) => handleSelectItem(e, item.id, allIds)}
                              onToggleSelect={() => store.toggleSelect(item.id)}
                              onOpen={() => item._isFolder ? handleNavigate(item.id) : setPreviewFileId(item.id)}
                              onContextMenu={(e) => handleContextMenu(e, item._isFolder ? "folder" : "file", item.id)}
                              onDragStart={isAdmin ? (e) => handleDragStart(e, item.id, item._isFolder ? "folder" : "file") : undefined}
                              onDragOver={isAdmin && item._isFolder ? (e) => { e.preventDefault(); store.setDragOverFolderId(item.id); } : undefined}
                              onDragLeave={isAdmin && item._isFolder ? () => store.setDragOverFolderId(null) : undefined}
                              onDrop={isAdmin && item._isFolder ? (e) => handleDropOnFolder(e, item.id) : undefined}
                              dragOver={store.dragOverFolderId === item.id}
                              onRename={(name) => handleRename(item.id, item._isFolder ? "folder" : "file", name)}
                              isTrash={store.viewMode === "trash"}
                            />
                          );
                        })}
                        {paddingBottom > 0 && <tr style={{ height: paddingBottom }}><td colSpan={6} /></tr>}
                      </>
                    );
                  })()}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Hidden upload inputs */}
      {isAdmin && (
        <>
          <input
            ref={(el) => setUploadInputRef(el)}
            type="file"
            multiple
            className="hidden"
            onChange={(e) => e.target.files && handleUpload(e.target.files)}
          />
          <input
            ref={(el) => setFolderUploadInputRef(el)}
            type="file"
            multiple
            className="hidden"
            // @ts-expect-error — webkitdirectory is non-standard but widely supported
            webkitdirectory=""
            directory=""
            onChange={(e) => {
              if (e.target.files && e.target.files.length > 0) handleFolderUpload(e.target.files);
              e.target.value = ""; // Reset so same folder can be selected again
            }}
          />
        </>
      )}

      {/* Conflict dialog */}
      {conflictDialog && (
        <ConflictDialog
          files={conflictDialog.files}
          existingNames={conflictDialog.existingNames}
          onResolve={resolveConflict}
        />
      )}

      {/* Delete loading overlay */}
      {deleteLoading && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center">
          <div className="bg-white rounded-2xl p-8 shadow-lg flex flex-col items-center">
            <div className="w-10 h-10 border-3 border-gray-200 border-t-red-500 rounded-full animate-spin mb-3" />
            <p className="text-gray-700 font-medium">Menghapus...</p>
          </div>
        </div>
      )}

      {/* Drag overlay */}
      {isDragOverPage && (
        <div className="fixed inset-0 bg-blue-50/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl p-8 shadow-lg flex flex-col items-center">
            <UploadIcon className="w-12 h-12 text-blue-500 mb-2" />
            <p className="text-lg font-medium text-gray-700">Drop file atau folder di sini</p>
            <p className="text-sm text-gray-500">ke {store.currentFolderId ? "folder ini" : "root"}</p>
          </div>
        </div>
      )}

      {/* Upload progress panel */}
      {isAdmin && <UploadProgressPanel uploads={uploads} onClear={clearCompletedUploads} />}

      {/* Context menu */}
      {store.contextMenu && (
        <FileContextMenu
          {...store.contextMenu}
          onClose={() => store.setContextMenu(null)}
          onStar={isAdmin ? (type, id) => handleStar(id, type) : () => {}}
          onRename={isAdmin ? (id) => { store.setRenamingId(id); store.setContextMenu(null); } : () => {}}
          onTrash={isAdmin ? (fileIds, folderIds) => handleTrash(fileIds, folderIds) : () => {}}
          onRestore={isAdmin ? handleRestore : () => {}}
          onPermanentDelete={isAdmin ? handlePermanentDelete : () => {}}
          onPreview={(id) => setPreviewFileId(id)}
          isTrash={store.viewMode === "trash"}
          isAdmin={isAdmin}
        />
      )}

      {/* Preview Overlay */}
      {previewFileId && (() => {
        const file = store.files.find((f) => f.id === previewFileId);
        if (!file) return null;
        const index = store.files.findIndex((f) => f.id === previewFileId);
        return (
          <PreviewOverlay
            file={file}
            onClose={() => setPreviewFileId(null)}
            onNavigate={(dir) => {
              if (dir === "prev" && index > 0) setPreviewFileId(store.files[index - 1].id);
              if (dir === "next" && index < store.files.length - 1) setPreviewFileId(store.files[index + 1].id);
            }}
            hasPrev={index > 0}
            hasNext={index < store.files.length - 1}
          />
        );
      })()}
    </div>
  );
}
