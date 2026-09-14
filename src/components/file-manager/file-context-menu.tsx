"use client";

import { useRef, useEffect, useState } from "react";
import { EyeIcon, DownloadIcon, StarIcon, MoveIcon, TrashIcon, ArrowLeftIcon } from "lucide-react";

interface ContextMenuProps {
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
  isAdmin?: boolean;
}

export default function FileContextMenu(props: ContextMenuProps) {
  const isAdmin = props.isAdmin !== false; // default true for backward compat
  const menuRef = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ x: -1000, y: -1000 }); // hidden initially to prevent flicker

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      let newX = props.x;
      let newY = props.y;
      if (props.x + rect.width > window.innerWidth) newX = window.innerWidth - rect.width - 8;
      if (props.y + rect.height > window.innerHeight) newY = window.innerHeight - rect.height - 8;
      setPos({ x: newX, y: newY });
    }
  }, [props.x, props.y]);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) props.onClose();
    };
    document.addEventListener("mousedown", handler);
    document.addEventListener("contextmenu", handler);
    return () => {
      document.removeEventListener("mousedown", handler);
      document.removeEventListener("contextmenu", handler);
    };
  }, [props]);

  return (
    <div
      ref={menuRef}
      className={`fixed z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 w-48 ${pos.x < 0 ? 'opacity-0' : 'opacity-100'}`}
      style={{ left: Math.max(8, pos.x), top: Math.max(8, pos.y) }}
    >
      {!props.isTrash ? (
        <>
          <MenuItem icon={<EyeIcon className="w-4 h-4" />} label="Preview / Buka" onClick={() => { if (props.type === "file") props.onPreview(props.id); props.onClose(); }} />
          {props.type === "file" && (
            <MenuItem icon={<DownloadIcon className="w-4 h-4" />} label="Download" onClick={() => { window.location.href = `/api/files/${props.id}/download`; props.onClose(); }} />
          )}
          {isAdmin && (
            <>
              <Divider />
              <MenuItem icon={<StarIcon className="w-4 h-4" />} label="Star" onClick={() => { props.onStar(props.type, props.id); props.onClose(); }} />
              <MenuItem icon={<MoveIcon className="w-4 h-4" />} label="Rename" onClick={() => props.onRename(props.id)} />
              <Divider />
              <MenuItem icon={<TrashIcon className="w-4 h-4" />} label="Move to Trash" danger onClick={() => { props.onTrash(props.type === "file" ? [props.id] : [], props.type === "folder" ? [props.id] : []); props.onClose(); }} />
            </>
          )}
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
