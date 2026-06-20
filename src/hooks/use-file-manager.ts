import { create } from "zustand";

export interface FileItem {
  id: string;
  name: string;
  originalName: string;
  mimeType: string;
  size: string; // BigInt serialized as string
  extension: string;
  s3Key: string;
  folderId: string | null;
  uploadedBy: string;
  downloadCount: number;
  starred: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  previewUrl?: string; // Presigned URL for image/video thumbnail
}

export interface FolderItem {
  id: string;
  name: string;
  parentId: string | null;
  visibility: "PUBLIC" | "PRIVATE";
  sortOrder: number;
  starred: boolean;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  _count?: { files: number; children: number };
}

export interface BreadcrumbItem {
  id: string | null;
  name: string;
}

export type ViewMode = "all" | "recent" | "starred" | "trash";
export type LayoutMode = "grid" | "list";
export type SortBy = "name" | "modified" | "size" | "type";
export type SortDir = "asc" | "desc";

interface FileManagerState {
  // Navigation
  currentFolderId: string | null;
  viewMode: ViewMode;
  breadcrumbs: BreadcrumbItem[];

  // Layout
  layout: LayoutMode;

  // Selection
  selectedIds: Set<string>;
  lastSelectedId: string | null;

  // Sort
  sortBy: SortBy;
  sortDir: SortDir;

  // Data
  files: FileItem[];
  folders: FolderItem[];
  loading: boolean;

  // UI
  contextMenu: { x: number; y: number; type: "file" | "folder"; id: string } | null;
  renamingId: string | null;
  dragOverFolderId: string | null;

  // Actions
  setCurrentFolder: (id: string | null) => void;
  setViewMode: (mode: ViewMode) => void;
  setLayout: (layout: LayoutMode) => void;
  toggleLayout: () => void;
  setSort: (by: SortBy, dir?: SortDir) => void;
  setData: (files: FileItem[], folders: FolderItem[]) => void;
  setLoading: (loading: boolean) => void;
  toggleSelect: (id: string) => void;
  selectRange: (ids: string[]) => void;
  selectAll: (ids: string[]) => void;
  clearSelection: () => void;
  setContextMenu: (menu: FileManagerState["contextMenu"]) => void;
  setRenamingId: (id: string | null) => void;
  setDragOverFolderId: (id: string | null) => void;
  setBreadcrumbs: (crumbs: BreadcrumbItem[]) => void;
}

export const useFileManager = create<FileManagerState>((set) => ({
  currentFolderId: null,
  viewMode: "all",
  breadcrumbs: [{ id: null, name: "My Files" }],
  layout: "list",
  selectedIds: new Set(),
  lastSelectedId: null,
  sortBy: "name",
  sortDir: "asc",
  files: [],
  folders: [],
  loading: false,
  contextMenu: null,
  renamingId: null,
  dragOverFolderId: null,

  setCurrentFolder: (id) =>
    set({ currentFolderId: id, selectedIds: new Set(), lastSelectedId: null }),

  setViewMode: (mode) =>
    set({ viewMode: mode, selectedIds: new Set(), lastSelectedId: null }),

  setLayout: (layout) => set({ layout }),
  toggleLayout: () =>
    set((s) => ({ layout: s.layout === "grid" ? "list" : "grid" })),

  setSort: (by, dir) =>
    set((s) => ({ sortBy: by, sortDir: dir ?? (s.sortBy === by ? (s.sortDir === "asc" ? "desc" : "asc") : "asc") })),

  setData: (files, folders) => set({ files, folders }),
  setLoading: (loading) => set({ loading }),

  toggleSelect: (id) =>
    set((s) => {
      const newSet = new Set(s.selectedIds);
      if (newSet.has(id)) newSet.delete(id);
      else newSet.add(id);
      return { selectedIds: newSet, lastSelectedId: id };
    }),

  selectRange: (ids) =>
    set(() => ({ selectedIds: new Set(ids), lastSelectedId: ids[ids.length - 1] })),

  selectAll: (ids) => set({ selectedIds: new Set(ids), lastSelectedId: ids[ids.length - 1] }),
  clearSelection: () => set({ selectedIds: new Set(), lastSelectedId: null }),

  setContextMenu: (menu) => set({ contextMenu: menu }),
  setRenamingId: (id) => set({ renamingId: id }),
  setDragOverFolderId: (id) => set({ dragOverFolderId: id }),
  setBreadcrumbs: (crumbs) => set({ breadcrumbs: crumbs }),
}));
