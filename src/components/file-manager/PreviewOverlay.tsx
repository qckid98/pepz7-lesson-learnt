"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  XIcon,
  DownloadIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  CalendarIcon,
  ZoomInIcon,
  ZoomOutIcon,
  RotateCwIcon,
  MaximizeIcon,
} from "lucide-react";
import { formatFileSize, getFileCategory } from "@/lib/validators";
import ExcelPreview from "@/components/file-manager/ExcelPreview";
import DocxPreview from "@/components/file-manager/DocxPreview";
import PptxPreview from "@/components/file-manager/PptxPreview";

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

  // Image zoom state
  const [zoom, setZoom] = useState(1);
  const [rotation, setRotation] = useState(0);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = useState(false);
  const panStart = useRef({ x: 0, y: 0 });

  const fetchPreviewUrl = useCallback(async () => {
    if (!file) return;
    setLoading(true);
    setError(false);
    setPreviewUrl(null);
    setZoom(1);
    setRotation(0);
    setPan({ x: 0, y: 0 });
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
      if (e.key === "+" || e.key === "=") setZoom((z) => Math.min(z + 0.25, 5));
      if (e.key === "-") setZoom((z) => Math.max(z - 0.25, 0.25));
      if (e.key === "0") { setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [file, onClose, onNavigate, hasPrev, hasNext]);

  if (!file) return null;

  const category = getFileCategory(file.mimeType);

  // Image pan handlers
  const handleMouseDown = (e: React.MouseEvent) => {
    if (zoom <= 1) return;
    setIsPanning(true);
    panStart.current = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - panStart.current.x, y: e.clientY - panStart.current.y });
  };
  const handleMouseUp = () => setIsPanning(false);

  // Touch pan + pinch zoom handlers for mobile
  const pinchStartDist = useRef(0);
  const pinchStartZoom = useRef(1);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && zoom > 1) {
      // Single finger pan
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    } else if (e.touches.length === 2) {
      // Pinch to zoom — calculate initial distance
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      pinchStartDist.current = Math.sqrt(dx * dx + dy * dy);
      pinchStartZoom.current = zoom;
      setIsPanning(false);
    }
  };
  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 1 && isPanning) {
      // Single finger pan
      setPan({ x: e.touches[0].clientX - panStart.current.x, y: e.touches[0].clientY - panStart.current.y });
    } else if (e.touches.length === 2 && pinchStartDist.current > 0) {
      // Pinch to zoom
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const scale = dist / pinchStartDist.current;
      const newZoom = Math.min(Math.max(pinchStartZoom.current * scale, 0.5), 6);
      setZoom(newZoom);
    }
  };
  const handleTouchEnd = (e: React.TouchEvent) => {
    if (e.touches.length === 0) {
      setIsPanning(false);
      pinchStartDist.current = 0;
    } else if (e.touches.length === 1 && zoom > 1) {
      // Switch from pinch to pan
      setIsPanning(true);
      panStart.current = { x: e.touches[0].clientX - pan.x, y: e.touches[0].clientY - pan.y };
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex flex-col" onClick={onClose}>
      {/* Top bar */}
      <div
        className="flex items-center justify-between px-3 sm:px-4 py-3 bg-gray-900/95 border-b border-gray-700 flex-shrink-0"
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
        <div className="flex items-center gap-1 sm:gap-2 flex-shrink-0">
          {/* Zoom controls — image only */}
          {category === "image" && previewUrl && (
            <div className="flex items-center gap-1 mr-1 sm:mr-2">
              <button
                onClick={() => setZoom((z) => Math.max(z - 0.25, 0.25))}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                title="Zoom out (-)"
              >
                <ZoomOutIcon className="w-4 h-4" />
              </button>
              <span className="text-xs text-gray-400 w-10 text-center">{Math.round(zoom * 100)}%</span>
              <button
                onClick={() => setZoom((z) => Math.min(z + 0.25, 5))}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
                title="Zoom in (+)"
              >
                <ZoomInIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => setRotation((r) => r + 90)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition hidden sm:block"
                title="Rotate"
              >
                <RotateCwIcon className="w-4 h-4" />
              </button>
              <button
                onClick={() => { setZoom(1); setPan({ x: 0, y: 0 }); setRotation(0); }}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition hidden sm:block"
                title="Reset (0)"
              >
                <MaximizeIcon className="w-4 h-4" />
              </button>
            </div>
          )}
          {/* Download — hidden on mobile, shown in bottom bar */}
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
        className="flex-1 overflow-hidden flex items-center justify-center p-2 sm:p-4 relative"
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
        ) : !["image", "video", "audio", "pdf", "text", "spreadsheet", "document", "presentation"].includes(category) ? (
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
          <div
            className="w-full h-full overflow-hidden flex items-center justify-center touch-none"
            style={{ cursor: zoom > 1 ? (isPanning ? "grabbing" : "grab") : "default" }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handleTouchEnd}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt={file.name}
              className="max-w-full max-h-full object-contain rounded-lg select-none"
              style={{
                transform: `scale(${zoom}) translate(${pan.x / zoom}px, ${pan.y / zoom}px) rotate(${rotation}deg)`,
                transition: isPanning ? "none" : "transform 0.2s ease-out",
                transformOrigin: "center",
              }}
              draggable={false}
            />
          </div>
        ) : previewUrl && category === "video" ? (
          <video
            src={previewUrl}
            controls
            autoPlay
            playsInline
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
            className="w-full h-full rounded-lg bg-white"
            title={file.name}
          />
        ) : category === "spreadsheet" ? (
          <ExcelPreview fileId={file.id} />
        ) : category === "document" ? (
          <DocxPreview fileId={file.id} />
        ) : category === "presentation" ? (
          <PptxPreview fileId={file.id} />
        ) : previewUrl && category === "text" ? (
          <iframe
            src={previewUrl}
            className="w-full h-full rounded-lg bg-white"
            title={file.name}
          />
        ) : null}
      </div>

      {/* Bottom bar — mobile: big download button + info; desktop: info only */}
      <div
        className="bg-gray-900/95 border-t border-gray-700 flex-shrink-0"
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
