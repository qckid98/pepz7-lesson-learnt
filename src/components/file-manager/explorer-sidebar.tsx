"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FolderIcon,
  StarIcon,
  TrashIcon,
  ClockIcon,
  HomeIcon,
  PanelLeftCloseIcon,
  PanelLeftOpenIcon,
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

  useEffect(() => {
    if (typeof localStorage !== "undefined") {
      const saved = localStorage.getItem("sidebarExpanded");
      if (saved === "false") store.setSidebarExpanded(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    <aside
      className={`fixed lg:static top-0 left-0 h-full bg-white border-r border-gray-200 flex flex-col z-50 transition-all duration-300 ease-in-out ${
        open ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
      } ${store.sidebarExpanded ? "w-60" : "w-16"}`}
    >
      {/* Collapse button at top */}
      <div className={`p-3 border-b border-gray-100 hidden lg:flex ${store.sidebarExpanded ? "justify-end" : "justify-center"}`}>
        <button
          onClick={() => store.setSidebarExpanded(!store.sidebarExpanded)}
          className="p-1.5 text-gray-500 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition"
          title={store.sidebarExpanded ? "Collapse Sidebar" : "Expand Sidebar"}
        >
          {store.sidebarExpanded ? <PanelLeftCloseIcon className="w-5 h-5" /> : <PanelLeftOpenIcon className="w-5 h-5" />}
        </button>
      </div>

      <div className={`p-3 space-y-0.5 flex flex-col ${store.sidebarExpanded ? "items-stretch" : "items-center"}`}>
        {navItems.map((item) => (
          <button
            key={item.mode}
            onClick={() => {
              store.setViewMode(item.mode);
              
              const url = new URL(window.location.href);
              if (item.mode === "all") {
                onNavigate(null);
              } else {
                url.searchParams.set("mode", item.mode);
                url.searchParams.delete("folder");
                window.history.pushState({ mode: item.mode }, "", url.toString());
              }
            }}
            title={!store.sidebarExpanded ? item.label : undefined}
            className={`flex items-center gap-2.5 rounded-lg text-sm transition ${
              store.sidebarExpanded ? "w-full px-3 py-2" : "w-10 h-10 justify-center"
            } ${
              store.viewMode === item.mode
                ? "bg-blue-50 text-blue-700 font-medium"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <div className="flex-shrink-0">{item.icon}</div>
            {store.sidebarExpanded && <span className="truncate">{item.label}</span>}
          </button>
        ))}
      </div>

      <div className="border-t border-gray-100" />
      
      {store.sidebarExpanded ? (
        <>
          <div className="px-3 py-2 flex items-center justify-between">
            <p className="text-xs font-semibold text-gray-500 uppercase px-2">Folders</p>
          </div>
          <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
            {tree.length === 0 ? (
              <p className="text-xs text-gray-500 px-2 py-2">Belum ada folder</p>
            ) : (
              renderTreeNodes(tree)
            )}
          </div>
        </>
      ) : (
        <div className="flex-1" />
      )}
    </aside>
  );
}
