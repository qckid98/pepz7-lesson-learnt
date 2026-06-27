"use client";

import { useState, useEffect, useCallback } from "react";
import { formatFileSize, getFileCategory } from "@/lib/validators";
import PDFThumbnail from "@/components/file-manager/PDFThumbnail";
import PreviewOverlay from "@/components/file-manager/PreviewOverlay";
import {
  FolderIcon,
  StarIcon,
  ClockIcon,
  HomeIcon,
  ListIcon,
  GridIcon,
  ChevronRightIcon,
  MoreVerticalIcon,
  EyeIcon,
  DownloadIcon,
  FileIcon,
  ImageIcon,
  VideoIcon,
  MusicIcon,
  FileTypeIcon,
  LockIcon,
  SearchIcon,
  MenuIcon,
  XIcon,
} from "lucide-react";

interface FileItem {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  extension: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
  folder?: { id: string; name: string } | null;
  previewUrl?: string;
  downloadCount?: number;
}

interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  _count?: { files: number; children: number; totalFiles?: number; totalSubFolders?: number };
}

interface BreadcrumbItem {
  id: string | null;
  name: string;
}

type LayoutMode = "grid" | "list";
type ViewMode = "all" | "recent";

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

export default function ViewerFileManager() {
  const [currentFolderId, setCurrentFolderId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("all");
  const [layout, setLayout] = useState<LayoutMode>("grid");
  const [files, setFiles] = useState<FileItem[]>([]);
  const [folders, setFolders] = useState<FolderItem[]>([]);
  const [allFolders, setAllFolders] = useState<FolderItem[]>([]);
  const [breadcrumbs, setBreadcrumbs] = useState<BreadcrumbItem[]>([{ id: null, name: "My Files" }]);
  const [loading, setLoading] = useState(false);
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; id: string; name: string } | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<{ files: FileItem[]; folders: FolderItem[] } | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);
  const [previewFileId, setPreviewFileId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);

  // Check if current user is admin
  useEffect(() => {
    fetch("/api/auth/session")
      .then((r) => r.json())
      .then((data) => {
        setIsAdmin(data?.user?.role === "ADMIN");
      })
      .catch(() => {});
  }, []);

  // ===== Fetch data =====
  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      if (viewMode === "recent") {
        // Recent files — public only via existing API
        const res = await fetch("/api/folders");
        const rootFolders = await res.json();
        // Get files from each public root folder + root files
        const filesRes = await fetch("/api/files?root=true");
        const rootFiles = filesRes.ok ? (await filesRes.json()).files : [];
        setFiles(rootFiles);
        setFolders(rootFolders);
      } else {
        if (currentFolderId) {
          const res = await fetch(`/api/folders/${currentFolderId}`);
          const data = await res.json();
          setFiles(data.files || []);
          setFolders(data.children || []);
        } else {
          const [foldersRes, filesRes] = await Promise.all([
            fetch("/api/folders"),
            fetch("/api/files?root=true"),
          ]);
          const foldersData = await foldersRes.json();
          const filesData = filesRes.ok ? await filesRes.json() : { files: [] };
          setFiles(filesData.files || []);
          setFolders(foldersData);
        }
      }
    } catch (e) {
      console.error("Fetch error:", e);
    } finally {
      setLoading(false);
    }
  }, [viewMode, currentFolderId]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Fetch all folders for sidebar tree (public only)
  useEffect(() => {
    fetch("/api/folders?all=true")
      .then((r) => r.json())
      .then(setAllFolders)
      .catch(console.error);
  }, [fetchData]);

  // ===== Breadcrumbs =====
  useEffect(() => {
    if (viewMode === "recent") {
      setBreadcrumbs([{ id: null, name: "Recent Files" }]);
      return;
    }
    if (!currentFolderId) {
      setBreadcrumbs([{ id: null, name: "My Files" }]);
      return;
    }
    (async () => {
      try {
        const crumbs: BreadcrumbItem[] = [];
        let currentId: string | null = currentFolderId;
        while (currentId) {
          const res: Response = await fetch(`/api/folders/${currentId}`);
          if (!res.ok) break;
          const f: { id: string; name: string; parentId: string | null } = await res.json();
          crumbs.unshift({ id: f.id, name: f.name });
          currentId = f.parentId;
        }
        crumbs.unshift({ id: null, name: "My Files" });
        setBreadcrumbs(crumbs);
      } catch { /* ignore */ }
    })();
  }, [currentFolderId, viewMode]);

  // ===== Navigate =====
  const navigate = (folderId: string | null) => {
    setCurrentFolderId(folderId);
    setViewMode("all");
  };

  // ===== Context menu =====
  const handleContextMenu = (e: React.MouseEvent, file: FileItem) => {
    e.preventDefault();
    setContextMenu({ x: e.clientX, y: e.clientY, id: file.id, name: file.name });
  };

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null);
    if (contextMenu) {
      document.addEventListener("click", handler);
      document.addEventListener("contextmenu", handler);
      return () => {
        document.removeEventListener("click", handler);
        document.removeEventListener("contextmenu", handler);
      };
    }
  }, [contextMenu]);

  // ===== Build sidebar tree (hide PRIVATE folders for viewers) =====
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
  // Filter out PRIVATE folders for viewers only — admin can see all
  const visibleFolders = isAdmin ? allFolders : allFolders.filter((f) => f.visibility === "PUBLIC");
  const tree = buildTree(visibleFolders);

  function renderTreeNodes(nodes: TreeNode[], depth = 0): React.ReactNode {
    return nodes.map((node) => {
      const isActive = currentFolderId === node.id && viewMode === "all";
      const isPrivate = node.visibility === "PRIVATE";
      return (
        <div key={node.id}>
          <button
            onClick={() => navigate(node.id)}
            className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm transition ${
              isActive ? "bg-blue-100 text-blue-700 font-medium" : "text-gray-600 hover:bg-gray-100"
            }`}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
          >
            <FolderIcon className="w-4 h-4 flex-shrink-0 text-blue-400" />
            <span className="truncate flex-1 text-left">{node.name}</span>
            {isPrivate && <LockIcon className="w-3 h-3 text-amber-500 flex-shrink-0" />}
          </button>
          {node.children.length > 0 && renderTreeNodes(node.children, depth + 1)}
        </div>
      );
    });
  }

  // ===== Search handler with debounce =====
  const handleSearch = useCallback(async (q: string) => {
    setSearchQuery(q);
    if (!q.trim()) {
      setSearchResults(null);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&type=all`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults({ files: data.results || [], folders: data.folders || [] });
      }
    } catch { /* ignore */ }
    setSearchLoading(false);
  }, []);

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== "") handleSearch(searchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);

  // ===== Use search results if searching, otherwise current folder =====
  const displayFolders = searchResults && searchQuery.trim() ? searchResults.folders : folders;
  const displayFiles = searchResults && searchQuery.trim() ? searchResults.files : files;

  // ===== Combined items (folders first, then files) =====
  const items: Array<{ type: "folder"; data: FolderItem } | { type: "file"; data: FileItem }> = [
    ...displayFolders.map((f) => ({ type: "folder" as const, data: f })),
    ...displayFiles.map((f) => ({ type: "file" as const, data: f })),
  ];

  return (
    <div className="flex h-[calc(100vh-3.5rem)]">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 bg-black/40 z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* ===== SIDEBAR (drawer on mobile) ===== */}
      <aside className={`fixed lg:static top-0 left-0 h-full w-56 bg-white border-r border-gray-200 flex flex-col overflow-hidden z-50 transition-transform duration-300 lg:translate-x-0 ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="p-3 space-y-0.5">
          <button
            onClick={() => { navigate(null); setViewMode("all"); }}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
              viewMode === "all" && !currentFolderId ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <HomeIcon className="w-4 h-4" />
            My Files
          </button>
          <button
            onClick={() => setViewMode("recent")}
            className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition ${
              viewMode === "recent" ? "bg-blue-50 text-blue-700 font-medium" : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            <ClockIcon className="w-4 h-4" />
            Recent
          </button>
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

      {/* ===== MAIN CONTENT ===== */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-3 sm:px-6 py-3 border-b border-gray-100">
          {/* Mobile menu */}
          <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition" aria-label="Menu">
            <MenuIcon className="w-5 h-5" />
          </button>
          {/* Search */}
          <div className="relative flex-1 max-w-md">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Cari file & folder..."
              className="w-full pl-9 pr-9 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
            />
            {searchLoading && (
              <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
            )}
            {searchQuery && !searchLoading && (
              <button
                onClick={() => { setSearchQuery(""); setSearchResults(null); }}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <XIcon className="w-4 h-4" />
              </button>
            )}
          </div>
          <div className="flex-1" />
          <div className="flex border border-gray-200 rounded-lg overflow-hidden">
            <button onClick={() => setLayout("list")} className={`p-1.5 ${layout === "list" ? "bg-gray-100" : ""}`} title="List view">
              <ListIcon className="w-4 h-4" />
            </button>
            <button onClick={() => setLayout("grid")} className={`p-1.5 ${layout === "grid" ? "bg-gray-100" : ""}`} title="Grid view">
              <GridIcon className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-1 px-3 sm:px-6 py-2 text-xs sm:text-sm border-b border-gray-100 flex-wrap overflow-x-auto">
          {breadcrumbs.map((crumb, i) => (
            <div key={i} className="flex items-center gap-1">
              {i > 0 && <ChevronRightIcon className="w-4 h-4 text-gray-400" />}
              <button
                onClick={() => i === 0 ? navigate(null) : navigate(crumb.id)}
                className={`hover:text-blue-600 ${i === breadcrumbs.length - 1 ? "font-semibold text-gray-900" : "text-gray-500"}`}
              >
                {crumb.name}
              </button>
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-3 sm:px-6 py-4">
          {loading ? (
            <div className="flex items-center justify-center h-40 text-gray-400">Memuat...</div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-gray-400">
              <FolderIcon className="w-12 h-12 mb-2 text-gray-300" />
              <p>{searchResults && searchQuery.trim() ? `Tidak ditemukan hasil untuk "${searchQuery}"` : "Belum ada file atau folder"}</p>
            </div>
          ) : layout === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {items.map(({ type, data }) => (
                <div
                  key={data.id}
                  onClick={() => type === "folder" ? navigate(data.id) : setPreviewFileId(data.id)}
                  onContextMenu={(e) => type === "file" && handleContextMenu(e, data as FileItem)}
                  className="p-3 rounded-xl border-2 border-transparent hover:border-gray-200 hover:bg-gray-50 cursor-pointer transition"
                >
                  <div className="flex flex-col items-center gap-2">
                    <div className="relative w-16 h-16 flex items-center justify-center overflow-hidden rounded-md border border-gray-200">
                      {type === "folder" ? (
                        <FolderIcon className="w-10 h-10 text-blue-400" />
                      ) : (data as FileItem).previewUrl ? (
                        (data as FileItem).mimeType.startsWith("image/") ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={(data as FileItem).previewUrl} alt={data.name} loading="lazy" className="w-16 h-16 object-cover" />
                        ) : (data as FileItem).mimeType.startsWith("video/") ? (
                          <video src={(data as FileItem).previewUrl} preload="metadata" muted className="w-16 h-16 object-cover" />
                        ) : (data as FileItem).mimeType === "application/pdf" ? (
                          <PDFThumbnail fileId={(data as FileItem).id} size={64} className="w-16 h-16" />
                        ) : (
                          getFileIcon((data as FileItem).mimeType)
                        )
                      ) : (
                        getFileIcon((data as FileItem).mimeType)
                      )}
                      {/* File type tag */}
                      {type === "file" && (() => {
                        const fi = data as FileItem;
                        const tag = getFileTypeTag(fi.mimeType, fi.extension);
                        return (
                          <span className={`absolute top-0 right-0 text-[8px] font-bold px-1 py-0.5 rounded-bl-md ${tag.color}`}>
                            {tag.label}
                          </span>
                        );
                      })()}
                    </div>
                    <p className="text-xs text-center text-gray-700 truncate w-full">{data.name}</p>
                    <p className="text-[10px] text-gray-400">
                      {type === "folder"
                        ? `${(data as FolderItem)._count?.totalFiles ?? (data as FolderItem)._count?.files ?? 0} file`
                        : formatFileSize(BigInt((data as FileItem).size))}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="border border-gray-200 rounded-xl overflow-hidden">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="text-left px-4 py-2 text-xs font-medium text-gray-500 uppercase w-full">Nama</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell whitespace-nowrap">Tipe</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase hidden md:table-cell whitespace-nowrap">Ukuran</th>
                    <th className="text-left px-2 py-2 text-xs font-medium text-gray-500 uppercase hidden sm:table-cell whitespace-nowrap">Tanggal</th>
                    <th className="w-10 px-2 py-2"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {items.map(({ type, data }) => (
                    <tr
                      key={data.id}
                      onClick={() => type === "folder" ? navigate(data.id) : setPreviewFileId(data.id)}
                      onContextMenu={(e) => type === "file" && handleContextMenu(e, data as FileItem)}
                      className="hover:bg-gray-50 cursor-pointer"
                    >
                      <td className="px-4 py-2.5 max-w-0">
                        <div className="flex items-center gap-2 overflow-hidden">
                          {type === "folder" ? (
                            <FolderIcon className="w-5 h-5 text-blue-400 flex-shrink-0" />
                          ) : (data as FileItem).previewUrl ? (
                            (data as FileItem).mimeType.startsWith("image/") ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={(data as FileItem).previewUrl} alt={data.name} loading="lazy" className="w-5 h-5 object-cover rounded flex-shrink-0" />
                            ) : (data as FileItem).mimeType.startsWith("video/") ? (
                              <video src={(data as FileItem).previewUrl} preload="metadata" muted className="w-5 h-5 object-cover rounded flex-shrink-0" />
                            ) : (data as FileItem).mimeType === "application/pdf" ? (
                              <PDFThumbnail fileId={(data as FileItem).id} size={20} className="w-5 h-5" />
                            ) : (
                              getFileIcon((data as FileItem).mimeType)
                            )
                          ) : (
                            getFileIcon((data as FileItem).mimeType)
                          )}
                          <span className="text-sm text-gray-900 truncate min-w-0">{data.name}</span>
                          {type === "folder" && (data as FolderItem).visibility === "PRIVATE" && (
                            <LockIcon className="w-3 h-3 text-amber-500" />
                          )}
                        </div>
                      </td>
                      <td className="px-2 py-2.5 hidden sm:table-cell">
                        {type === "file" ? (() => {
                          const fi = data as FileItem;
                          const tag = getFileTypeTag(fi.mimeType, fi.extension);
                          return <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${tag.color}`}>{tag.label}</span>;
                        })() : <span className="text-xs text-blue-500">FOLDER</span>}
                      </td>
                      <td className="px-2 py-2.5 text-sm text-gray-500 hidden md:table-cell">
                        {type === "folder" ? "—" : formatFileSize(BigInt((data as FileItem).size))}
                      </td>
                      <td className="px-2 py-2.5 text-sm text-gray-500 hidden sm:table-cell">
                        {type === "folder" ? "—" : new Date((data as FileItem).updatedAt).toLocaleDateString("id-ID", { day: "numeric", month: "short", year: "numeric" })}
                      </td>
                      <td className="px-2 py-2.5">
                        {type === "file" && (
                          <button
                            onClick={(e) => { e.stopPropagation(); handleContextMenu(e, data as FileItem); }}
                            className="p-1 text-gray-400 hover:text-gray-600"
                          >
                            <MoreVerticalIcon className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Context Menu (Viewer: Preview + Download only) */}
      {contextMenu && (
        <div
          className="fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-44"
          style={{ left: Math.min(contextMenu.x, window.innerWidth - 180), top: Math.min(contextMenu.y, window.innerHeight - 150) }}
          onClick={() => setContextMenu(null)}
        >
          <button
            onClick={() => { setPreviewFileId(contextMenu.id); setContextMenu(null); }}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <EyeIcon className="w-4 h-4" />
            Preview
          </button>
          <a
            href={`/api/files/${contextMenu.id}/download`}
            className="w-full flex items-center gap-2.5 px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 transition"
          >
            <DownloadIcon className="w-4 h-4" />
            Download
          </a>
        </div>
      )}

      {/* Preview Overlay */}
      {previewFileId && (() => {
        const file = files.find((f) => f.id === previewFileId);
        if (!file) return null;
        const index = files.findIndex((f) => f.id === previewFileId);
        return (
          <PreviewOverlay
            file={{ ...file, downloadCount: file.downloadCount || 0 }}
            onClose={() => setPreviewFileId(null)}
            onNavigate={(dir) => {
              if (dir === "prev" && index > 0) setPreviewFileId(files[index - 1].id);
              if (dir === "next" && index < files.length - 1) setPreviewFileId(files[index + 1].id);
            }}
            hasPrev={index > 0}
            hasNext={index < files.length - 1}
          />
        );
      })()}
    </div>
  );
}
