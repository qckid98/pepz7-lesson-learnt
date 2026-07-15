"use client";

import { FolderIcon, MoreVerticalIcon } from "lucide-react";
import { formatFileSize } from "@/lib/validators";
import type { FileItem, FolderItem } from "@/hooks/use-file-manager";
import { getFileIcon, getFileTypeTag } from "./file-helpers";
import PDFThumbnail from "./PDFThumbnail";

type Item = (FileItem | FolderItem) & { _isFolder: boolean };

interface GridCardProps {
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

export default function FileGridCard(props: GridCardProps) {
  const isFolder = "_isFolder" in props.item && props.item._isFolder;
  const file = !isFolder ? (props.item as FileItem) : null;

  return (
    <div
      draggable={!props.renaming}
      onDragStart={props.onDragStart}
      onDragOver={props.onDragOver}
      onDragLeave={props.onDragLeave}
      onDrop={props.onDrop}
      onClick={props.onOpen}
      onContextMenu={props.onContextMenu}
      className={`relative p-3 rounded-xl border-2 cursor-pointer transition ${
        props.dragOver ? "border-blue-500 bg-blue-50" : props.selected ? "border-blue-400 bg-blue-50" : "border-transparent hover:border-gray-200 hover:bg-gray-50"
      }`}
    >
      {props.selectMode && (
        <div className="absolute top-1.5 left-1.5 z-10">
          <input type="checkbox" checked={props.selected} onChange={() => props.onToggleSelect()} onClick={(e) => e.stopPropagation()} className="rounded" />
        </div>
      )}
      <div className="flex flex-col items-center gap-2">
        <div className="relative w-16 h-16 flex items-center justify-center overflow-hidden rounded-md border border-gray-200">
          {isFolder ? (
            <FolderIcon className="w-10 h-10 text-blue-400" />
          ) : file?.previewUrl ? (
            file.mimeType.startsWith("image/") ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={file.previewUrl} alt={file.name} loading="lazy" className="w-16 h-16 object-cover" />
            ) : file.mimeType.startsWith("video/") ? (
              <video src={file.previewUrl} preload="metadata" muted className="w-16 h-16 object-cover" />
            ) : file.mimeType === "application/pdf" ? (
              <PDFThumbnail fileId={file.id} size={64} className="w-16 h-16" />
            ) : (
              file && getFileIcon(file.mimeType)
            )
          ) : (
            file && getFileIcon(file.mimeType)
          )}
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
          {isFolder ? `${(props.item as FolderItem)._count?.totalFiles ?? (props.item as FolderItem)._count?.files ?? 0} file` : file ? formatFileSize(BigInt(file.size)) : ""}
        </p>
      </div>
    </div>
  );
}
