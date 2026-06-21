"use client";

import { useState, useEffect, useRef } from "react";
import { FileTypeIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface OfficePreviewProps {
  fileId: string;
  type: "xlsx" | "docx" | "pptx";
}

export default function OfficePreview({ fileId, type }: OfficePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOffice() {
      try {
        if (!containerRef.current) {
          console.log("[OfficePreview] No container ref");
          return;
        }

        console.log("[OfficePreview] Fetching proxy for", fileId);
        const res = await fetch(`/api/files/${fileId}/proxy`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response");

        console.log("[OfficePreview] Proxy fetched, size:", arrayBuffer.byteLength);

        if (cancelled) return;

        // Dynamic import — avoids static import resolution issues
        console.log("[OfficePreview] Importing @silurus/ooxml...");
        const mod = await import("@silurus/ooxml");
        console.log("[OfficePreview] Module loaded, keys:", Object.keys(mod));

        // Clean up previous viewer
        if (viewerRef.current) {
          try { viewerRef.current.destroy?.(); } catch { /* ignore */ }
          viewerRef.current = null;
        }
        containerRef.current.innerHTML = "";

        const opts = {
          onError: (err: Error) => {
            console.error("[OfficePreview] Viewer error:", err);
            if (!cancelled) {
              setError(true);
              setErrorMsg(err.message);
              setLoading(false);
            }
          },
        };

        if (type === "xlsx") {
          console.log("[OfficePreview] Creating XlsxViewer...");
          const XlsxViewer = (mod as any).xlsx?.XlsxViewer;
          if (!XlsxViewer) throw new Error("XlsxViewer not found in module");
          const viewer = new XlsxViewer(containerRef.current, opts);
          await viewer.load(arrayBuffer);
          viewerRef.current = viewer;
          if (!cancelled) {
            setTotalCount(viewer.sheetCount || 0);
            setCurrentIdx(viewer.sheetIndex || 0);
          }
        } else if (type === "docx") {
          console.log("[OfficePreview] Creating DocxViewer...");
          const DocxViewer = (mod as any).docx?.DocxViewer;
          if (!DocxViewer) throw new Error("DocxViewer not found in module");
          const canvas = document.createElement("canvas");
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          containerRef.current.appendChild(canvas);
          const viewer = new DocxViewer(canvas, opts);
          await viewer.load(arrayBuffer);
          viewerRef.current = viewer;
          if (!cancelled) {
            setTotalCount(viewer.pageCount || 0);
            setCurrentIdx(viewer.currentPage || 0);
          }
        } else {
          console.log("[OfficePreview] Creating PptxViewer...");
          const PptxViewer = (mod as any).pptx?.PptxViewer;
          if (!PptxViewer) throw new Error("PptxViewer not found in module");
          const canvas = document.createElement("canvas");
          canvas.style.width = "100%";
          canvas.style.height = "100%";
          containerRef.current.appendChild(canvas);
          const viewer = new PptxViewer(canvas, opts);
          await viewer.load(arrayBuffer);
          viewerRef.current = viewer;
          if (!cancelled) {
            setTotalCount(viewer.slideCount || 0);
            setCurrentIdx(viewer.slideIndex || 0);
          }
        }

        console.log("[OfficePreview] Done loading");
        if (!cancelled) setLoading(false);
      } catch (e) {
        console.error("[OfficePreview] Error:", e);
        if (!cancelled) {
          setError(true);
          setErrorMsg(e instanceof Error ? e.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    loadOffice();
    return () => {
      cancelled = true;
      if (viewerRef.current) {
        try { viewerRef.current.destroy?.(); } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
  }, [fileId, type]);

  const goPrev = async () => {
    const v = viewerRef.current;
    if (!v) return;
    try {
      if (type === "xlsx") await v.prevSheet();
      else if (type === "docx") await v.prevPage();
      else await v.prevSlide();
      updateIdx();
    } catch { /* ignore */ }
  };

  const goNext = async () => {
    const v = viewerRef.current;
    if (!v) return;
    try {
      if (type === "xlsx") await v.nextSheet();
      else if (type === "docx") await v.nextPage();
      else await v.nextSlide();
      updateIdx();
    } catch { /* ignore */ }
  };

  const updateIdx = () => {
    const v = viewerRef.current;
    if (!v) return;
    if (type === "xlsx") {
      setCurrentIdx(v.sheetIndex || 0);
      setTotalCount(v.sheetCount || 0);
    } else if (type === "docx") {
      setCurrentIdx(v.currentPage || 0);
      setTotalCount(v.pageCount || 0);
    } else {
      setCurrentIdx(v.slideIndex || 0);
      setTotalCount(v.slideCount || 0);
    }
  };

  const label = type === "xlsx" ? "Sheet" : type === "docx" ? "Page" : "Slide";
  const accentColor = type === "xlsx" ? "text-green-500" : type === "docx" ? "text-blue-500" : "text-orange-500";

  if (loading) {
    return (
      <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden relative">
        <div ref={containerRef} className="flex-1 overflow-hidden" style={{ display: 'none' }} />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex flex-col items-center">
            <div className={`w-8 h-8 border-2 border-gray-600 border-t-current rounded-full animate-spin mb-3 ${accentColor}`} />
            <p className="text-gray-400 text-sm">
              Memuat {type === "xlsx" ? "spreadsheet" : type === "docx" ? "dokumen" : "presentasi"}...
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center max-w-md text-center">
          <FileTypeIcon className={`w-12 h-12 mb-2 ${accentColor}`} />
          <p className="text-gray-400 text-sm">
            Gagal memuat {type === "xlsx" ? "spreadsheet" : type === "docx" ? "dokumen" : "presentasi"}
          </p>
          <p className="text-gray-600 text-xs mt-1">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden">
      <div className="flex-1 overflow-hidden relative" ref={containerRef} />
      {totalCount > 1 && (
        <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-50 border-t border-gray-200 flex-shrink-0">
          <button
            onClick={goPrev}
            disabled={currentIdx === 0}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <ChevronLeftIcon className="w-4 h-4" />
            <span className="hidden sm:inline">Sebelumnya</span>
          </button>
          <span className="text-xs sm:text-sm text-gray-400">
            {label} {currentIdx + 1} / {totalCount}
          </span>
          <button
            onClick={goNext}
            disabled={currentIdx >= totalCount - 1}
            className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
          >
            <span className="hidden sm:inline">Berikutnya</span>
            <ChevronRightIcon className="w-4 h-4" />
          </button>
        </div>
      )}
    </div>
  );
}
