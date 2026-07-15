"use client";

import { useState } from "react";

interface ConflictDialogProps {
  files: File[];
  existingNames: string[];
  onResolve: (resolved: File[]) => void;
}

export default function ConflictDialog({ files, existingNames, onResolve }: ConflictDialogProps) {
  const [skipAllSame, setSkipAllSame] = useState(false);
  const [resolved, setResolved] = useState<File[]>([]);
  const [remaining, setRemaining] = useState(files);

  const currentFile = remaining[0];
  const currentName = currentFile?.name.replace(/^.*\//, "") || "";
  const isLast = remaining.length <= 1;

  function handleAction(action: "skip" | "overwrite") {
    let newResolved = [...resolved];
    if (action === "overwrite") {
      newResolved.push(currentFile);
    }
    if (skipAllSame && action === "skip") {
      onResolve(newResolved);
      return;
    }
    if (skipAllSame && action === "overwrite") {
      newResolved.push(...remaining.slice(1));
      onResolve(newResolved);
      return;
    }
    if (isLast) {
      onResolve(newResolved);
    } else {
      setResolved(newResolved);
      setRemaining(remaining.slice(1));
    }
  }

  if (!currentFile) {
    onResolve(resolved);
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
        <h3 className="text-lg font-bold text-gray-900 mb-2">File sudah ada</h3>
        <p className="text-sm text-gray-500 mb-4">
          <span className="font-medium text-gray-700">{currentName}</span> sudah ada di folder ini.
          Apa yang ingin Anda lakukan?
        </p>

        <div className="flex flex-col gap-2">
          <button
            onClick={() => handleAction("skip")}
            className="flex items-center justify-between px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm"
          >
            <span>Skip (jangan upload)</span>
            <span className="text-xs text-gray-400">File lama tetap</span>
          </button>
          <button
            onClick={() => handleAction("overwrite")}
            className="flex items-center justify-between px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm"
          >
            <span>Overwrite (ganti file lama)</span>
            <span className="text-xs text-blue-200">Upload yang baru</span>
          </button>
        </div>

        <label className="flex items-center gap-2 mt-4 text-sm text-gray-600 cursor-pointer">
          <input
            type="checkbox"
            checked={skipAllSame}
            onChange={(e) => setSkipAllSame(e.target.checked)}
            className="rounded"
          />
          Terapkan untuk semua file yang sama ({remaining.length} file tersisa)
        </label>

        <div className="flex justify-between items-center mt-4 pt-4 border-t border-gray-100">
          <span className="text-xs text-gray-400">
            {remaining.length} dari {files.length} file perlu konfirmasi
          </span>
          <button
            onClick={() => onResolve(resolved)}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Skip semua
          </button>
        </div>
      </div>
    </div>
  );
}
