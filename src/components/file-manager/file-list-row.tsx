"use client";

import { FolderIcon } from "lucide-react";
import { formatFileSize } from "@/lib/validators";
import type { FileItem, FolderItem } from "@/hooks/use-file-manager";
import { getFileIcon, getFileTypeTag } from "./file-helpers";
import PDFThumbnail from "./PDFThumbnail";
import { MoreVerticalIcon } from "lucide-react";

type Item = (FileItem | FolderItem) & { _isFolder: boolean };

interface ListRowProps {
  item: Item;
  selected: boolean;
  renaming: boolean;
  selectMode: boolean;
  onSelect: (e: React.MouseEvent) => void;
  onToggleSelect: () => void;
  onOpen: () => void;
  onContextMenu: (e: React.MouseEvent) => void;
  onDragStart?: (e: React.DragEvent) => void;
  onDragOver?: (e: React.DragEvent) => void;
  onDragLeave?: () => void;
  onDrop?: (e: React.DragEvent) => void;
  dragOver: boolean;
  onRename: (name: string) => void;
  isTrash: boolean;
}

export default function FileListRow(props: ListRowProps) {
  const isFolder = "_isFolder" in props.item && props.item._isFolder;
  const file = !isFolder ? (props.item as FileItem) : null;

  return (
    <tr
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      onClick={props.onOpen}
      onContextMenu={props.onContextMenu}
      className={`cursor-pointer transition ${props.dragOver ? "bg-blue-100" : props.selected ? "bg-blue-50" : "hover:bg-gray-50"}`}
    >
      {props.selectMode && (
        <td className="px-4 py-2.5">
          <input type="checkbox" checked={props.selected} onChange={() => props.onToggleSelect()} onClick={(e) => e.stopPropagation()} className="rounded" />
        </td>
      )}
      <td className="px-2 py-2.5">
        <div className="flex items-center gap-2 overflow-hidden">
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
              className="flex-1 min-w-0 text-sm px-2 py-0.5 border border-blue-400 rounded outline-none"
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
