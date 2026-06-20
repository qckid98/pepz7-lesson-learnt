"use client";

import { useState, useEffect, useCallback } from "react";
import {
  XIcon,
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  CalendarIcon,
} from "lucide-react";
import { formatFileSize, getFileCategory } from "@/lib/validators";

interface PreviewFile {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  extension: string;
  createdAt: string;
  downloadCount: number;
}

interface PreviewOverlayProps {
  file: PreviewFile | null;
  onClose: () => void;
  onNavigate?: (direction: "prev" | "next") => void;
  hasPrev?: boolean;
  hasNext?: boolean;
}

export default function PreviewOverlay({
  file,
  onClose,
  onNavigate,
  hasPrev,
  hasNext,
}: PreviewOverlayProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  const fetchPreviewUrl = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(false);
    setPreviewUrl(null);
    try {
      const res = await fetch(`/api/files/${file.id}`);
      if (!res.ok) throw new Error("Failed to fetch");
      const data = await res.json();
      setPreviewUrl(data.previewUrl || null);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [file]);

  useEffect(() => {
    if (file) fetchPreviewUrl();
  }, [file, fetchPreviewUrl]);

  // Keyboard navigation
  useEffect(() => {
    if (!file) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && hasPrev && onNavigate) onNavigate("prev");
      if (e.key === "ArrowRight" && hasNext && onNavigate) onNavigate("next");
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [file, onClose, onNavigate, hasPrev, hasNext]);

  if (!file) return null;

  const category = getFileCategory(file.mimeType);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gray-900/95 border-b border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center gap-2 sm:gap-3 min-w-0">
          {hasPrev && onNavigate && (
            <button
              onClick={() => onNavigate("prev")}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition flex-shrink-0"
              title="Sebelumnya (←)"
            >
              <ChevronLeftIcon className="w-5 h-5" />
            </button>
          )}
          {hasNext && onNavigate && (
            <button
              onClick={() => onNavigate("next")}
              className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition flex-shrink-0"
              title="Berikutnya (→)"
            >
              <ChevronRightIcon className="w-5 h-5" />
            </button>
          )}
          <FileIcon className="w-4 h-4 text-gray-400 flex-shrink-0 hidden sm:block" />
          <span className="text-white font-medium text-xs sm:text-sm truncate">
            {file.name}
          </span>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Download — hidden on mobile, shown in bottom bar instead */}
          <a
            href={`/api/files/${file.id}/download`}
            onClick={(e) => e.stopPropagation()}
            className="hidden sm:flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition"
          >
            <DownloadIcon className="w-4 h-4" />
            <span>Download</span>
          </a>
          <button
            onClick={onClose}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            title="Tutup (Esc)"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Preview area */}
      <div
        className="flex-1 flex items-center justify-center p-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {loading ? (
          <div className="text-gray-400 flex flex-col items-center">
            <div className="w-10 h-10 border-3 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-3" />
            <p className="text-sm">Memuat preview...</p>
          </div>
        ) : error ? (
          <div className="text-gray-400 flex flex-col items-center">
            <FileIcon className="w-16 h-16 text-gray-600 mb-3" />
            <p className="text-sm">Gagal memuat preview</p>
            <a
              href={`/api/files/${file.id}/download`}
              className="mt-3 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition"
            >
              Download File
            </a>
          </div>
        ) : !previewUrl && !["image", "video", "audio", "pdf", "text"].includes(category) ? (
          <div className="text-gray-400 flex flex-col items-center max-w-md text-center">
            <FileIcon className="w-16 h-16 text-gray-600 mb-4" />
            <p className="text-white font-medium text-lg mb-1">{file.name}</p>
            <p className="text-gray-500 text-sm mb-4">
              Preview tidak tersedia untuk tipe file ini (.{file.extension.toUpperCase()})
            </p>
            <a
              href={`/api/files/${file.id}/download`}
              className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              <DownloadIcon className="w-5 h-5" />
              Download File
            </a>
          </div>
        ) : previewUrl && category === "image" ? (
          <img
            src={previewUrl}
            alt={file.name}
            className="max-w-full max-h-full object-contain rounded-lg"
          />
        ) : previewUrl && category === "video" ? (
          <video
            src={previewUrl}
            controls
            autoPlay
            className="max-w-full max-h-full rounded-lg"
          >
            Browser tidak mendukung video.
          </video>
        ) : previewUrl && category === "audio" ? (
          <div className="bg-gray-800 p-8 rounded-2xl text-center max-w-md w-full">
            <div className="w-20 h-20 bg-gray-700 rounded-full flex items-center justify-center mx-auto mb-6">
              <FileIcon className="w-10 h-10 text-gray-400" />
            </div>
            <p className="text-white font-medium mb-4">{file.name}</p>
            <audio src={previewUrl} controls autoPlay className="w-full">
              Browser tidak mendukung audio.
            </audio>
          </div>
        ) : previewUrl && category === "pdf" ? (
          <iframe
            src={`/api/files/${file.id}/proxy`}
            className="w-full h-full max-w-5xl rounded-lg bg-white"
            title={file.name}
          />
        ) : previewUrl && category === "text" ? (
          <iframe
            src={previewUrl}
            className="w-full h-full max-w-4xl rounded-lg bg-white"
            title={file.name}
          />
        ) : null}
      </div>

      {/* Bottom bar — mobile: big download button + info; desktop: info only */}
      <div
        className="bg-gray-900/95 border-t border-gray-700"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Mobile download button */}
        <div className="sm:hidden p-3">
          <a
            href={`/api/files/${file.id}/download`}
            onClick={(e) => e.stopPropagation()}
            className="flex items-center justify-center gap-2 w-full py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
          >
            <DownloadIcon className="w-5 h-5" />
            Download
          </a>
        </div>

        {/* Info row */}
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 text-xs text-gray-400">
          <div className="flex items-center gap-4">
            <span className="font-bold uppercase">{file.extension}</span>
            <span>{formatFileSize(BigInt(file.size))}</span>
            <span className="hidden sm:flex items-center gap-1">
              <CalendarIcon className="w-3 h-3" />
              {new Date(file.createdAt).toLocaleDateString("id-ID", {
                day: "numeric",
                month: "long",
                year: "numeric",
              })}
            </span>
          </div>
          <span>{file.downloadCount}x didownload</span>
        </div>
      </div>
    </div>
  );
}
