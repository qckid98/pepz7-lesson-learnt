"use client";

import {
  FolderIcon,
  StarIcon,
  TrashIcon,
  UploadIcon,
  PlusIcon,
  ListIcon,
  GridIcon,
  MenuIcon,
  SearchIcon,
  CheckSquareIcon,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface ToolbarProps {
  onNewFolder: () => void;
  onUploadClick: () => void;
  onFolderUploadClick?: () => void;
  onSort: (by: "name" | "modified" | "size" | "type", dir?: "asc" | "desc") => void;
  sortBy: string;
  sortDir: string;
  layout: string;
  onToggleLayout: () => void;
  viewMode: string;
  onMenuClick?: () => void;
  searchQuery?: string;
  onSearchChange?: (q: string) => void;
  searchLoading?: boolean;
  selectMode?: boolean;
  onToggleSelectMode?: () => void;
  isAdmin?: boolean;
}

export default function ExplorerToolbar(props: ToolbarProps) {
  const isAdmin = props.isAdmin !== false;
  return (
    <div className="flex items-center gap-2 px-3 sm:px-6 py-3 border-b border-gray-100">
      {props.onMenuClick && (
        <button onClick={props.onMenuClick} className="lg:hidden p-1.5 text-gray-600 hover:bg-gray-100 rounded-lg transition" aria-label="Menu">
          <MenuIcon className="w-5 h-5" />
        </button>
      )}
      {isAdmin && props.viewMode !== "trash" && (
        <>
          <button onClick={props.onUploadClick} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 bg-blue-600 text-white text-xs sm:text-sm rounded-lg hover:bg-blue-700 transition">
            <UploadIcon className="w-4 h-4" /> <span className="hidden sm:inline">Upload</span>
          </button>
          {props.onFolderUploadClick && (
            <button onClick={props.onFolderUploadClick} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border border-gray-300 text-gray-700 text-xs sm:text-sm rounded-lg hover:bg-gray-50 transition">
              <FolderIcon className="w-4 h-4" /> <span className="hidden sm:inline">Upload Folder</span>
            </button>
          )}
          <button onClick={props.onNewFolder} className="flex items-center gap-1.5 px-2 sm:px-3 py-1.5 border border-gray-300 text-gray-700 text-xs sm:text-sm rounded-lg hover:bg-gray-50 transition">
            <PlusIcon className="w-4 h-4" /> <span className="hidden sm:inline">Folder Baru</span>
          </button>
          {props.onToggleSelectMode && (
            <button
              onClick={props.onToggleSelectMode}
              className={`flex items-center gap-1.5 px-2 sm:px-3 py-1.5 text-xs sm:text-sm rounded-lg transition ${
                props.selectMode
                  ? "bg-blue-600 text-white hover:bg-blue-700"
                  : "border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <CheckSquareIcon className="w-4 h-4" /> <span className="hidden sm:inline">{props.selectMode ? "Selesai" : "Pilih"}</span>
            </button>
          )}
        </>
      )}
      {props.viewMode !== "trash" && props.onSearchChange && (
        <div className="relative flex-1 max-w-xs">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={props.searchQuery || ""}
            onChange={(e) => props.onSearchChange?.(e.target.value)}
            placeholder="Cari file & folder..."
            className="w-full pl-9 pr-4 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
          />
          {props.searchLoading && (
            <div className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" />
          )}
        </div>
      )}
      <div className="flex-1" />
      <button onClick={() => props.onSort("name")} className="text-xs sm:text-sm text-gray-500 hover:text-gray-700 px-2 py-1 hidden sm:block">
        Sort: {props.sortBy} ({props.sortDir})
      </button>
      <div className="flex border border-gray-200 rounded-lg overflow-hidden">
        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={props.onToggleLayout} className={`p-1.5 ${props.layout === "list" ? "bg-gray-100" : "hover:bg-gray-50"}`}>
              <ListIcon className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Tampilan List</TooltipContent>
        </Tooltip>

        <Tooltip>
          <TooltipTrigger asChild>
            <button onClick={props.onToggleLayout} className={`p-1.5 ${props.layout === "grid" ? "bg-gray-100" : "hover:bg-gray-50"}`}>
              <GridIcon className="w-4 h-4" />
            </button>
          </TooltipTrigger>
          <TooltipContent>Tampilan Grid</TooltipContent>
        </Tooltip>
      </div>
    </div>
  );
}
