"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useFileManager, type FileItem, type FolderItem } from "@/hooks/use-file-manager";
import { formatFileSize, getFileCategory } from "@/lib/validators";
import PDFThumbnail from "@/components/file-manager/PDFThumbnail";
import PreviewOverlay from "@/components/file-manager/PreviewOverlay";
import {
  FolderIcon,
  FolderOpenIcon,
  StarIcon,
  TrashIcon,
  DownloadIcon,
  UploadIcon,
  PlusIcon,
  ListIcon,
  GridIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  MoreVerticalIcon,
  EyeIcon,
  MoveIcon,
  ClockIcon,
  HardDriveIcon,
  HomeIcon,
  XIcon,
  FileIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTypeIcon,
  ArrowLeftIcon,
  MenuIcon,
} from "lucide-react";

// ============ Helper: File icon by type ============
function getFileIcon(mimeType: string) {
  const cat = getFileCategory(mimeType);
  switch (cat) {
    case "image": return <ImageIcon className="w-5 h-5 text-green-500" />;
    case "video": return <VideoIcon className="w-5 h-5 text-purple-500" />;
    case "audio": return <MusicIcon className="w-5 h-5 text-pink-500" />;
    case "pdf": return <FileTypeIcon className="w-5 h-5 text-red-500" />;
    default: return <FileIcon className="w-5 h-5 text-gray-400" />;
  }
}

// ============ Helper: File type tag ============
function getFileTypeTag(mimeType: string, extension: string) {
  const cat = getFileCategory(mimeType);
  const label = extension.toUpperCase().slice(0, 4);
  let color = "bg-gray-100 text-gray-600";
  switch (cat) {
    case "image": color = "bg-green-100 text-green-700"; break;
    case "video": color = "bg-purple-100 text-purple-700"; break;
    case "audio": color = "bg-pink-100 text-pink-700"; break;
    case "pdf": color = "bg-red-100 text-red-700"; break;
    case "document": color = "bg-blue-100 text-blue-700"; break;
    case "spreadsheet": color = "bg-emerald-100 text-emerald-700"; break;
    case "presentation": color = "bg-orange-100 text-orange-700"; break;
    case "text": color = "bg-gray-100 text-gray-600"; break;
  }
  return { label, color };
}

// ============ Main Component ============
export default function FileManager() {
  const store = useFileManager();
  const [showNewFolder, setShowNewFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [uploadInputRef, setUploadInputRef] = useState<HTMLInputElement | null>(null);
  const [isDragOverPage, setIsDragOverPage] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
        // "all" — browse folder
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

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // ===== Breadcrumbs =====
  const fetchBreadcrumbs = useCallback(async (folderId: string | null) => {
    if (!folderId) {
      store.setBreadcrumbs([{ id: null, name: "My Files" }]);
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
      crumbs.unshift({ id: null, name: "My Files" });
      store.setBreadcrumbs(crumbs);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    if (store.viewMode === "all") fetchBreadcrumbs(store.currentFolderId);
    else if (store.viewMode === "recent") store.setBreadcrumbs([{ id: null, name: "Recent" }]);
    else if (store.viewMode === "starred") store.setBreadcrumbs([{ id: null, name: "Starred" }]);
    else if (store.viewMode === "trash") store.setBreadcrumbs([{ id: null, name: "Trash" }]);
  }, [store.viewMode, store.currentFolderId]);

  // ===== Actions =====
  const handleNavigate = (folderId: string | null) => {
    store.setCurrentFolder(folderId);
    store.setViewMode("all");
  };

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

  const handleUpload = async (files: FileList) => {
    for (const file of Array.from(files)) {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("folderId", store.currentFolderId || "");
      try {
        await fetch("/api/files/upload-direct", { method: "POST", body: formData });
      } catch (e) { console.error("Upload error:", e); }
    }
    fetchData();
  };

  const handleRename = async (id: string, type: "file" | "folder", newName: string) => {
    if (!newName.trim()) { store.setRenamingId(null); return; }
    try {
      await fetch(`/api/${type}s/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });
    } catch { /* ignore */ }
    store.setRenamingId(null);
    fetchData();
  };

  const handleStar = async (id: string, type: "file" | "folder") => {
    await fetch(`/api/${type}s/${id}/star`, { method: "POST" });
    fetchData();
  };

  const handleTrash = async (fileIds: string[], folderIds: string[]) => {
    await fetch("/api/files/bulk", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "trash", fileIds, folderIds }),
    });
    store.clearSelection();
    fetchData();
  };

  const handleRestore = async (id: string) => {
    await fetch(`/api/trash/${id}/restore`, { method: "POST" });
    fetchData();
  };

  const handlePermanentDelete = async (id: string) => {
    if (!confirm("Hapus permanen? Tidak bisa dikembalikan.")) return;
    await fetch(`/api/trash/${id}`, { method: "DELETE" });
    fetchData();
  };

  const handleMove = async (fileIds: string[], folderIds: string[], targetId: string | null) => {
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
    fetchData();
  };

  // ===== Context menu handler =====
  const handleContextMenu = (e: React.MouseEvent, type: "file" | "folder", id: string) => {
    e.preventDefault();
    store.setContextMenu({ x: e.clientX, y: e.clientY, type, id });
  };

  // ===== Sort items =====
  const sortedItems = (() => {
    const items: Array<(FileItem | FolderItem) & { _isFolder: boolean }> = [
      ...store.folders.map((f) => ({ ...f, _isFolder: true })),
      ...store.files.map((f) => ({ ...f, _isFolder: false })),
    ];
    const dir = store.sortDir === "asc" ? 1 : -1;
    items.sort((a, b) => {
      // Folders always first
      if (a._isFolder !== b._isFolder) return a._isFolder ? -1 : 1;
      let cmp = 0;
      if (store.sortBy === "name") cmp = a.name.localeCompare(b.name);
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

  // ===== Drag state =====
  const dragDataRef = useRef<{ type: "file" | "folder"; ids: string[] } | null>(null);

  const handleDragStart = (e: React.DragEvent, id: string, type: "file" | "folder") => {
    const ids = store.selectedIds.has(id) ? Array.from(store.selectedIds) : [id];
    dragDataRef.current = { type, ids };
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
      onDragOver={(e) => { e.preventDefault(); setIsDragOverPage(true); }}
      onDragLeave={() => setIsDragOverPage(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOverPage(false);
        if (e.dataTransfer.files.length > 0) handleUpload(e.dataTransfer.files);
      }}
    >
      {/* ===== SIDEBAR (drawer on mobile) ===== */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar onNavigate={(id) => { handleNavigate(id); setSidebarOpen(false); }} onRefresh={fetchData} open={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <Toolbar
          onNewFolder={() => setShowNewFolder(true)}
          onUploadClick={() => uploadInputRef?.click()}
          onSort={store.setSort}
          sortBy={store.sortBy}
          sortDir={store.sortDir}
          layout={store.layout}
          onToggleLayout={store.toggleLayout}
          viewMode={store.viewMode}
          onMenuClick={() => setSidebarOpen(true)}
        />

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-3 sm:px-6 py-2 text-xs sm:text-sm border-b border-gray-100 flex-wrap overflow-x-auto">
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
        </div>

        {/* New folder form */}
        {showNewFolder && (
          <form onSubmit={handleCreateFolder} className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
            <FolderIcon className="w-5 h-5 text-blue-500" />
            <input
              autoFocus
              type="text"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              placeholder="Nama folder baru"
              className="flex-1 max-w-xs px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Escape" && setShowNewFolder(false)}
            />
            <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Buat</button>
            <button type="button" onClick={() => setShowNewFolder(false)} className="px-3 py-1.5 text-gray-600 text-sm">Batal</button>
          </form>
        )}

        {/* Bulk action bar */}
        {selectedCount > 0 && (
          <div className="px-6 py-2 bg-blue-50 border-b border-blue-100 flex items-center gap-3 text-sm">
            <span className="font-medium text-blue-700">{selectedCount} dipilih</span>
            {store.viewMode !== "trash" && (
              <>
                <button onClick={() => handleTrash(Array.from(store.selectedIds).filter(id => store.files.some(f => f.id === id)), Array.from(store.selectedIds).filter(id => store.folders.some(f => f.id === id)))} className="text-red-600 hover:underline">Hapus</button>
                <button onClick={store.clearSelection} className="text-gray-500 hover:underline">Batal</button>
              </>
            )}
            {store.viewMode === "trash" && (
              <>
                {Array.from(store.selectedIds).map(id => (
                  <button key={id} onClick={() => handleRestore(id)} className="text-green-600 hover:underline">Restore {id.slice(-4)}</button>
                ))}
                <button onClick={store.clearSelection} className="text-gray-500 hover:underline">Batal</button>
              </>
            )}
          </div>
        )}

        {/* Content area */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
          {store.loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">Memuat...</div>
          ) : sortedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <FolderIcon className="w-12 h-12 mb-2 text-gray-300" />
              <p>{store.viewMode === "trash" ? "Tempat sampah kosong" : "Belum ada file atau folder"}</p>
            </div>
          ) : store.layout === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {sortedItems.map((item) => (
                <GridCard
                  key={item.id}
                  item={item}
                  selected={store.selectedIds.has(item.id)}
                  renaming={store.renamingId === item.id}
                  onSelect={(e) => handleSelect(e, item.id)}
                  onOpen={() => item._isFolder ? handleNavigate(item.id) : setPreviewFileId(item.id)}
                  onContextMenu={(e) => handleContextMenu(e, item._isFolder ? "folder" : "file", item.id)}
                  onDragStart={(e) => handleDragStart(e, item.id, item._isFolder ? "folder" : "file")}
                  onDragOver={item._isFolder ? (e) => { e.preventDefault(); store.setDragOverFolderId(item.id); } : undefined}
                  onDragLeave={item._isFolder ? () => store.setDragOverFolderId(null) : undefined}
                  onDrop={item._isFolder ? (e) => handleDropOnFolder(e, item.id) : undefined}
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
                    <th className="w-10 px-4 py-2"><input type="checkbox" onChange={(e) => e.target.checked ? store.selectAll(allIds) : store.clearSelection()} className="rounded" /></th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer" onClick={() => store.setSort("name")}>Nama</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell">Tipe</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer hidden md:table-cell" onClick={() => store.setSort("size")}>Ukuran</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase cursor-pointer hidden sm:table-cell" onClick={() => store.setSort("modified")}>Diubah</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {sortedItems.map((item) => (
                    <ListRow
                      key={item.id}
                      item={item}
                      selected={store.selectedIds.has(item.id)}
                      renaming={store.renamingId === item.id}
                      onSelect={(e) => handleSelect(e, item.id)}
                      onOpen={() => item._isFolder ? handleNavigate(item.id) : setPreviewFileId(item.id)}
                      onContextMenu={(e) => handleContextMenu(e, item._isFolder ? "folder" : "file", item.id)}
                      onDragStart={(e) => handleDragStart(e, item.id, item._isFolder ? "folder" : "file")}
                      onDragOver={item._isFolder ? (e) => { e.preventDefault(); store.setDragOverFolderId(item.id); } : undefined}
                      onDragLeave={item._isFolder ? () => store.setDragOverFolderId(null) : undefined}
                      onDrop={item._isFolder ? (e) => handleDropOnFolder(e, item.id) : undefined}
                      dragOver={store.dragOverFolderId === item.id}
                      onRename={(name) => handleRename(item.id, item._isFolder ? "folder" : "file", name)}
                      isTrash={store.viewMode === "trash"}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Hidden upload input */}
      <input
        ref={(el) => setUploadInputRef(el)}
        type="file"
        multiple
        className="hidden"
        onChange={(e) => e.target.files && handleUpload(e.target.files)}
      />

      {/* Drag overlay */}
      {isDragOverPage && (
        <div className="fixed inset-0 bg-blue-50/80 flex items-center justify-center z-50 pointer-events-none">
          <div className="bg-white rounded-2xl p-8 shadow-lg flex flex-col items-center">
            <UploadIcon className="w-12 h-12 text-blue-500 mb-2" />
            <p className="text-lg font-medium text-gray-700">Drop file untuk upload</p>
            <p className="text-sm text-gray-500">ke {store.currentFolderId ? "folder ini" : "root"}</p>
          </div>
        </div>
      )}

      {/* Context menu */}
      {store.contextMenu && (
        <ContextMenu
          {...store.contextMenu}
          onClose={() => store.setContextMenu(null)}
          onStar={(type, id) => handleStar(id, type)}
          onRename={(id) => { store.setRenamingId(id); store.setContextMenu(null); }}
          onTrash={(fileIds, folderIds) => handleTrash(fileIds, folderIds)}
          onRestore={handleRestore}
          onPermanentDelete={handlePermanentDelete}
          onPreview={(id) => setPreviewFileId(id)}
          isTrash={store.viewMode === "trash"}
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

  // ===== Selection handler =====
  function handleSelect(e: React.MouseEvent, id: string) {
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
    } else {
      store.clearSelection();
      store.toggleSelect(id);
    }
  }
}

// ============ Sidebar ============
function Sidebar({ onNavigate, onRefresh, open, onClose }: { onNavigate: (id: string | null) => void; onRefresh: () => void; open: boolean; onClose: () => void }) {
  const store = useFileManager();
  const [folders, setFolders] = useState<FolderItem[]>([]);

  const fetchFolders = useCallback(async () => {
    const res = await fetch("/api/folders?all=true");
    const data = await res.json();
    setFolders(data);
  }, []);

  useEffect(() => { fetchFolders(); }, [fetchFolders]);
  useEffect(() => {
    // Refresh folder tree when data changes
    const interval = setInterval(fetchFolders, 5000);
    return () => clearInterval(interval);
  }, [fetchFolders]);

  // Build tree
  type TreeNode = FolderItem & { children: TreeNode[] };
  const tree = buildTree(folders);

  function buildTree(flat: FolderItem[]): TreeNode[] {
    const map = new Map<string, TreeNode>();
    const roots: TreeNode[] = [];
    flat.forEach((f) => map.set(f.id, { ...f, children: [] }));
    flat.forEach((f) => {
      if (f.parentId && map.has(f.parentId)) map.get(f.parentId)!.children.push(map.get(f.id)!);
      else roots.push(map.get(f.id)!);
    });
    return roots;
  }

  const navItems: { mode: typeof store.viewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "all", icon: <HomeIcon className="w-4 h-4" />, label: "My Files" },
    { mode: "recent", icon: <ClockIcon className="w-4 h-4" />, label: "Recent" },
    { mode: "starred", icon: <StarIcon className="w-4 h-4" />, label: "Starred" },
    { mode: "trash", icon: <TrashIcon className="w-4 h-4" />, label: "Trash" },
  ];

  function renderTreeNodes(nodes: TreeNode[], depth = 0) {
    return nodes.map((node) => {
      const isActive = store.currentFolderId === node.id && store.viewMode === "all";
      return (
        <div key={node.id}>
          <button
            onClick={() => { onNavigate(node.id); onRefresh(); }}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition ${
              isActive ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
            }`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            <FolderIcon className="w-4 h-4 flex-shrink-0 text-blue-400" />
            <span className="truncate">{node.name}</span>
          </button>
          {node.children.length > 0 && renderTreeNodes(node.children, depth + 1)}
        </div>
      );
    });
  }

  return (
    <aside className={`fixed lg:static top-0 left-0 h-full w-60 bg-white border-r border-gray-200 flex flex-col overflow-hidden z-50 transition-transform duration-300 lg:translate-x-0 ${open ? "translate-x-0" : "-translate-x-full"}`}>
      <div className="p-3 space-y-0.5">
        {navItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => { store.setViewMode(item.mode); if (item.mode === "all") onNavigate(null); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
              store.viewMode === item.mode ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {item.icon}
            {item.label}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100" />
      <div className="px-3 py-2">
        <p className="text-xs font-semibold text-gray-400 uppercase mb-1 px-2">Folders</p>
      </div>
      <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
        {tree.length === 0 ? (
          <p className="text-xs text-gray-400 px-2 py-2">Belum ada folder</p>
        ) : (
          renderTreeNodes(tree)
        )}
      </div>
    </aside>
  );
}

// ============ Toolbar ============
function Toolbar(props: {
  onNewFolder: () => void;
  onUploadClick: () => void;
  onSort: (by: "name" | "modified" | "size" | "type", dir?: "asc" | "desc") => void;
  sortBy: string;
  sortDir: string;
  layout: string;
  onToggleLayout: () => void;
  viewMode: string;
  onMenuClick?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 px-3 sm:px-6 py-3 border-b border-gray-100">
      {props.onMenuClick && (
        <button onClick={props.onMenuClick} className="lg:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition" aria-label="Menu">
          <MenuIcon className="w-5 h-5" />
        </button>
      )}
      {props.viewMode !== "trash" && (
        <>
          <button onClick={props.onUploadClick} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition">
            <UploadIcon className="w-4 h-4" /> <span className="hidden sm:inline">Upload</span>
          </button>
          <button onClick={props.onNewFolder} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border border-gray-300 text-gray-700 text-xs sm:text-sm rounded-lg hover:bg-gray-50 transition">
            <PlusIcon className="w-4 h-4" /> <span className="hidden sm:inline">Folder Baru</span>
          </button>
        </>
      )}
      <div className="flex-1" />
      <button onClick={() => props.onSort("name")} className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 px-2 py-1 hidden sm:block">
        Sort: {props.sortBy} ({props.sortDir})
      </button>
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        <button onClick={props.onToggleLayout} className={`p-1.5 ${props.layout === "list" ? "bg-gray-100" : ""}`} title="List view">
          <ListIcon className="w-4 h-4" />
        </button>
        <button onClick={props.onToggleLayout} className={`p-1.5 ${props.layout === "grid" ? "bg-gray-100" : ""}`} title="Grid view">
          <GridIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ============ Grid Card ============
function GridCard(props: {
  item: FileItem | FolderItem & { _isFolder: boolean };
  selected: boolean;
  renaming: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  dragOver: boolean;
  onRename: (name: string) => void;
  isTrash: boolean;
}) {
  const isFolder = "_isFolder" in props.item && props.item._isFolder;
  const file = !isFolder ? (props.item as FileItem) : null;

  return (
    <div
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      onClick={props.onSelect}
      onDoubleClick={props.onOpen}
      onContextMenu={props.onContextMenu}
      className={`relative p-3 rounded-xl border-2 cursor-pointer transition ${
        props.dragOver ? "border-blue-500 bg-blue-50" : props.selected ? "border-blue-400 bg-blue-50" : "border-transparent hover:border-gray-200 hover:bg-gray-50"
      }`}
    >
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-16 h-16 flex items-center justify-center overflow-hidden rounded-md border border-gray-200">
          {isFolder ? (
            <FolderIcon className="w-10 h-10 text-blue-400" />
          ) : file?.previewUrl ? (
            file.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={file.previewUrl}
                alt={file.name}
                loading="lazy"
                className="w-16 h-16 object-cover"
              />
            ) : file.mimeType.startsWith("video/") ? (
              <video
                src={file.previewUrl}
                preload="metadata"
                muted
                className="w-16 h-16 object-cover"
              />
            ) : file.mimeType === "application/pdf" ? (
              <PDFThumbnail fileId={file.id} size={64} className="w-16 h-16" />
            ) : (
              file && getFileIcon(file.mimeType)
            )
          ) : (
            file && getFileIcon(file.mimeType)
          )}
          {/* File type tag */}
          {!isFolder && file && (() => {
            const tag = getFileTypeTag(file.mimeType, file.extension);
            return (
              <span className={`absolute top-0 right-0 text-[8px] font-bold px-1 py-0.5 rounded-bl-md ${tag.color}`}>
                {tag.label}
              </span>
            );
          })()}
        </div>
        {props.renaming ? (
          <input
            autoFocus
            defaultValue={props.item.name}
            onBlur={(e) => props.onRename(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") props.onRename((e.target as HTMLInputElement).value);
              if (e.key === "Escape") props.onRename(props.item.name);
            }}
            onClick={(e) => e.stopPropagation()}
            className="w-full text-xs text-center px-1 py-0.5 border border-blue-400 rounded outline-none"
          />
        ) : (
          <p className="text-xs text-center text-gray-700 truncate w-full">{props.item.name}</p>
        )}
        <p className="text-[10px] text-gray-400">
          {isFolder ? `${(props.item as FolderItem)._count?.files || 0} file` : file ? formatFileSize(BigInt(file.size)) : ""}
        </p>
      </div>
    </div>
  );
}

// ============ List Row ============
function ListRow(props: {
  item: FileItem | FolderItem & { _isFolder: boolean };
  selected: boolean;
  renaming: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  dragOver: boolean;
  onRename: (name: string) => void;
  isTrash: boolean;
}) {
  const isFolder = "_isFolder" in props.item && props.item._isFolder;
  const file = !isFolder ? (props.item as FileItem) : null;

  return (
    <tr
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      onClick={props.onSelect}
      onDoubleClick={props.onOpen}
      onContextMenu={props.onContextMenu}
      className={`cursor-pointer transition ${props.dragOver ? "bg-blue-100" : props.selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
    >
      <td className="px-4 py-2.5"><input type="checkbox" checked={props.selected} onChange={() => {}} onClick={(e) => e.stopPropagation()} className="rounded" /></td>
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2">
          {isFolder ? (
            <FolderIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
          ) : file?.previewUrl ? (
            file.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.previewUrl} alt={file.name} loading="lazy" className="w-5 h-5 object-cover rounded flex-shrink-0" />
            ) : file.mimeType.startsWith("video/") ? (
              <video src={file.previewUrl} preload="metadata" muted className="w-5 h-5 object-cover rounded flex-shrink-0" />
            ) : file.mimeType === "application/pdf" ? (
              <PDFThumbnail fileId={file.id} size={20} className="w-5 h-5" />
            ) : (
              file && getFileIcon(file.mimeType)
            )
          ) : (
            file && getFileIcon(file.mimeType)
          )}
          {props.renaming ? (
            <input
              autoFocus
              defaultValue={props.item.name}
              onBlur={(e) => props.onRename(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") props.onRename((e.target as HTMLInputElement).value);
                if (e.key === "Escape") props.onRename(props.item.name);
              }}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 text-sm px-2 py-0.5 border border-blue-400 rounded outline-none"
            />
          ) : (
            <span className="text-sm text-gray-900 truncate">{props.item.name}</span>
          )}
        </div>
      </td>
      <td className="px-2 py-2.5 hidden sm:table-cell">
        {!isFolder && file ? (() => {
          const tag = getFileTypeTag(file.mimeType, file.extension);
          return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.color}`}>{tag.label}</span>;
        })() : <span className="text-xs text-blue-500">FOLDER</span>}
      </td>
      <td className="px-2 py-2.5 text-sm text-gray-500 hidden md:table-cell">
        {isFolder ? "—" : file ? formatFileSize(BigInt(file.size)) : ""}
      </td>
      <td className="px-2 py-2.5 text-sm text-gray-500 hidden sm:table-cell">
        {new Date(props.item.updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
      </td>
      <td className="px-2 py-2.5">
        <button onClick={(e) => { e.stopPropagation(); props.onContextMenu(e); }} className="p-1 text-gray-400 hover:text-gray-600">
          <MoreVerticalIcon className="w-4 h-4" />
        </button>
      </td>
    </tr>
  );
}

// ============ Context Menu ============
function ContextMenu(props: {
  x: number;
  y: number;
  type: "file" | "folder";
  id: string;
  onClose: () => void;
  onStar: (type: "file" | "folder", id: string) => void;
  onRename: (id: string) => void;
  onTrash: (fileIds: string[], folderIds: string[]) => void;
  onRestore: (id: string) => void;
  onPermanentDelete: (id: string) => void;
  onPreview: (id: string) => void;
  isTrash: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) props.onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("contextmenu", handler);
    return () => { document.removeEventListener("mousedown", handler); document.removeEventListener("contextmenu", handler); };
  }, [props]);

  // Adjust position to stay in viewport
  const x = Math.min(props.x, window.innerWidth - 200);
  const y = Math.min(props.y, window.innerHeight - 300);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-48"
      style={{ left: x, top: y }}
    >
      {!props.isTrash ? (
        <>
          <MenuItem icon={<EyeIcon className="w-4 h-4" />} label="Preview / Buka" onClick={() => { if (props.type === "file") props.onPreview(props.id); props.onClose(); }} />
          <MenuItem icon={<DownloadIcon className="w-4 h-4" />} label="Download" onClick={() => { if (props.type === "file") window.location.href = `/api/files/${props.id}/download`; props.onClose(); }} />
          <Divider />
          <MenuItem icon={<StarIcon className="w-4 h-4" />} label="Star" onClick={() => { props.onStar(props.type, props.id); props.onClose(); }} />
          <MenuItem icon={<MoveIcon className="w-4 h-4" />} label="Rename" onClick={() => props.onRename(props.id)} />
          <Divider />
          <MenuItem icon={<TrashIcon className="w-4 h-4" />} label="Move to Trash" danger onClick={() => { props.onTrash(props.type === "file" ? [props.id] : [], props.type === "folder" ? [props.id] : []); props.onClose(); }} />
        </>
      ) : (
        <>
          <MenuItem icon={<ArrowLeftIcon className="w-4 h-4" />} label="Restore" onClick={() => { props.onRestore(props.id); props.onClose(); }} />
          <Divider />
          <MenuItem icon={<TrashIcon className="w-4 h-4" />} label="Delete Permanently" danger onClick={() => { props.onPermanentDelete(props.id); props.onClose(); }} />
        </>
      )}
    </div>
  );
}

function MenuItem({ icon, label, onClick, danger }: { icon: React.ReactNode; label: string; onClick: () => void; danger?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center gap-2.5 px-3 py-2 text-sm transition hover:bg-gray-50 ${danger ? "text-red-600 hover:bg-red-50" : "text-gray-700"}`}
    >
      {icon}
      {label}
    </button>
  );
}

function Divider() {
  return <div className="my-1 border-t border-gray-100" />;
}
