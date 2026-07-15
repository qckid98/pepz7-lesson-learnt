"use client";

import { FileIcon, CheckCircleIcon, XCircleIcon } from "lucide-react";
import { formatFileSize } from "@/lib/validators";
import type { UploadItem } from "@/hooks/use-file-upload";

interface UploadProgressPanelProps {
  uploads: UploadItem[];
  onClear: () => void;
}

export default function UploadProgressPanel({ uploads, onClear }: UploadProgressPanelProps) {
  if (uploads.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 left-4 sm:left-auto z-50 bg-white rounded-xl shadow-2xl border border-gray-200 w-auto sm:w-80 max-h-96 overflow-y-auto">
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">
          Upload ({uploads.filter((u) => u.status === "done").length}/{uploads.length})
        </h3>
        <button
          onClick={onClear}
          className="text-gray-400 hover:text-gray-600 text-xs"
        >
          {uploads.every((u) => u.status !== "uploading") ? "Tutup" : ""}
        </button>
      </div>
      <div className="p-2 space-y-2">
        {uploads.map((u) => (
          <div key={u.id} className="px-2 py-2 rounded-lg bg-gray-50">
            <div className="flex items-center justify-between mb-1.5">
              <div className="flex items-center gap-2 min-w-0">
                <FileIcon className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
                <span className="text-xs font-medium text-gray-900 truncate">{u.name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0 ml-2">
                {u.status === "done" && <CheckCircleIcon className="w-4 h-4 text-green-500" />}
                {u.status === "error" && <XCircleIcon className="w-4 h-4 text-red-500" />}
                {u.status === "uploading" && (
                  <span className="text-xs text-blue-600 font-medium tabular-nums">{u.progress}%</span>
                )}
              </div>
            </div>
            {u.status === "uploading" && (
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-blue-600 h-1.5 rounded-full transition-all duration-300 ease-out"
                  style={{ width: `${u.progress}%` }}
                />
              </div>
            )}
            {u.status === "error" && (
              <p className="text-xs text-red-600 mt-1">{u.error}</p>
            )}
            {u.status === "done" && (
              <p className="text-xs text-green-600">
                {formatFileSize(BigInt(u.size))} • Selesai
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
