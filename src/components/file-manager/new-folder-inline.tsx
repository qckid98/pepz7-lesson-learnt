"use client";

import { FolderIcon } from "lucide-react";

interface NewFolderInlineProps {
  value: string;
  onChange: (v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onCancel: () => void;
}

export default function NewFolderInline({ value, onChange, onSubmit, onCancel }: NewFolderInlineProps) {
  return (
    <form onSubmit={onSubmit} className="px-6 py-3 bg-blue-50 border-b border-blue-100 flex items-center gap-3">
      <FolderIcon className="w-5 h-5 text-blue-500" />
      <input
        autoFocus
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Nama folder baru"
        className="flex-1 max-w-xs px-3 py-1.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-blue-500"
        onKeyDown={(e) => e.key === "Escape" && onCancel()}
      />
      <button type="submit" className="px-3 py-1.5 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700">Buat</button>
      <button type="button" onClick={onCancel} className="px-3 py-1.5 text-gray-600 text-sm">Batal</button>
    </form>
  );
}
