"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderIcon,
  StarIcon,
  TrashIcon,
  ClockIcon,
  HomeIcon,
} from "lucide-react";
import { useFileManager, type FolderItem } from "@/hooks/use-file-manager";
import { dragState } from "@/lib/drag-state";

interface SidebarProps {
  onNavigate: (id: string | null) => void;
  onRefresh: () => void;
  open: boolean;
  onClose: () => void;
  isAdmin?: boolean;
  rootLabel?: string;
}

export default function ExplorerSidebar({ onNavigate, onRefresh, open, onClose, isAdmin = true, rootLabel = "My Files" }: SidebarProps) {
  const store = useFileManager();
  const [folders, setFolders] = useState<FolderItem[]>([]);

  const fetchFolders = useCallback(async () => {
    const res = await fetch("/api/folders?all=true");
    const data = await res.json();
    setFolders(data);
  }, []);

  // Fetch on mount + whenever store folders change (after create/move/delete)
  const storeFolderCount = store.folders.length;
  useEffect(() => {
    fetchFolders();
  }, [fetchFolders, storeFolderCount]);

  type TreeNode = FolderItem & { children: TreeNode[] };

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

  // Viewer: hide PRIVATE folders. Admin: see all.
  const visibleFolders = isAdmin ? folders : folders.filter((f) => f.visibility === "PUBLIC");
  const tree = buildTree(visibleFolders);

  const navItems: { mode: typeof store.viewMode; icon: React.ReactNode; label: string }[] = [
    { mode: "all", icon: <HomeIcon className="w-4 h-4" />, label: rootLabel },
    { mode: "recent", icon: <ClockIcon className="w-4 h-4" />, label: "Recent" },
    ...(isAdmin ? [
      { mode: "starred" as const, icon: <StarIcon className="w-4 h-4" />, label: "Starred" },
      { mode: "trash" as const, icon: <TrashIcon className="w-4 h-4" />, label: "Trash" },
    ] : []),
  ];

  function renderTreeNodes(nodes: TreeNode[], depth = 0) {
    return nodes.map((node) => {
      const isActive = store.currentFolderId === node.id && store.viewMode === "all";
      const isDragOver = store.dragOverFolderId === node.id;
      return (
        <div key={node.id}>
          <button
            onClick={() => { onNavigate(node.id); onRefresh(); }}
            onDragOver={(e) => { e.preventDefault(); store.setDragOverFolderId(node.id); }}
            onDragLeave={() => store.setDragOverFolderId(null)}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              store.setDragOverFolderId(null);
              const dd = dragState.current;
              if (dd) {
                const fIds = dd.type === "file" ? dd.ids : [];
                const flIds = dd.type === "folder" ? dd.ids : [];
                fetch("/api/files/move", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ fileIds: fIds, targetFolderId: node.id }),
                }).then(() => onRefresh());
                flIds.forEach((fid: string) =>
                  fetch("/api/folders/move", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ folderId: fid, targetParentId: node.id }),
                  })
                );
                dragState.current = null;
              }
            }}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition ${
              isDragOver ? "bg-blue-200 text-blue-800 ring-2 ring-blue-400" : isActive ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
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
