"use client";

import { useState, useEffect, useRef } from "react";
import { FileTypeIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { XlsxViewer } from "@silurus/ooxml/xlsx";
import { DocxViewer } from "@silurus/ooxml/docx";
import { PptxViewer } from "@silurus/ooxml/pptx";

interface OfficePreviewProps {
  fileId: string;
  type: "xlsx" | "docx" | "pptx";
}

export default function OfficePreview({ fileId, type }: OfficePreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const viewerRef = useRef<XlsxViewer | DocxViewer | PptxViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentIdx, setCurrentIdx] = useState(0);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadOffice() {
      try {
        if (!containerRef.current || !canvasRef.current) return;

        const res = await fetch(`/api/files/${fileId}/proxy`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response");

        if (cancelled) return;

        // Clean up previous viewer
        if (viewerRef.current) {
          try {
            (viewerRef.current as { destroy?: () => void }).destroy?.();
          } catch { /* ignore */ }
          viewerRef.current = null;
        }

        // Clear container
        containerRef.current.innerHTML = "";
        const canvas = document.createElement("canvas");
        canvas.style.width = "100%";
        canvas.style.height = "100%";
        containerRef.current.appendChild(canvas);

        const opts = {
          onError: (err: Error) => {
            if (!cancelled) {
              setError(true);
              setErrorMsg(err.message);
              setLoading(false);
            }
          },
        };

        let viewer: XlsxViewer | DocxViewer | PptxViewer;

        if (type === "xlsx") {
          // XlsxViewer manages its own canvas + tab bar
          // It needs a container div, not a canvas
          containerRef.current.innerHTML = "";
          viewer = new XlsxViewer(containerRef.current, opts);
          await (viewer as XlsxViewer).load(arrayBuffer);
          if (!cancelled) {
            setTotalCount((viewer as XlsxViewer).sheetCount);
            setCurrentIdx((viewer as XlsxViewer).sheetIndex);
          }
        } else if (type === "docx") {
          viewer = new DocxViewer(canvas, opts);
          await (viewer as DocxViewer).load(arrayBuffer);
          if (!cancelled) {
            setTotalCount((viewer as DocxViewer).pageCount);
            setCurrentIdx((viewer as DocxViewer).currentPage);
          }
        } else {
          viewer = new PptxViewer(canvas, opts);
          await (viewer as PptxViewer).load(arrayBuffer);
          if (!cancelled) {
            setTotalCount((viewer as PptxViewer).slideCount);
            setCurrentIdx((viewer as PptxViewer).slideIndex);
          }
        }

        viewerRef.current = viewer;

        if (!cancelled) setLoading(false);
      } catch (e) {
        console.error("Office preview error:", e);
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
        try {
          (viewerRef.current as { destroy?: () => void }).destroy?.();
        } catch { /* ignore */ }
        viewerRef.current = null;
      }
    };
  }, [fileId, type]);

  const goPrev = async () => {
    const v = viewerRef.current;
    if (!v) return;
    try {
      if (type === "xlsx") await (v as XlsxViewer).prevSheet();
      else if (type === "docx") await (v as DocxViewer).prevPage();
      else await (v as PptxViewer).prevSlide();
      updateIdx();
    } catch { /* ignore */ }
  };

  const goNext = async () => {
    const v = viewerRef.current;
    if (!v) return;
    try {
      if (type === "xlsx") await (v as XlsxViewer).nextSheet();
      else if (type === "docx") await (v as DocxViewer).nextPage();
      else await (v as PptxViewer).nextSlide();
      updateIdx();
    } catch { /* ignore */ }
  };

  const updateIdx = () => {
    const v = viewerRef.current;
    if (!v) return;
    if (type === "xlsx") {
      setCurrentIdx((v as XlsxViewer).sheetIndex);
      setTotalCount((v as XlsxViewer).sheetCount);
    } else if (type === "docx") {
      setCurrentIdx((v as DocxViewer).currentPage);
      setTotalCount((v as DocxViewer).pageCount);
    } else {
      setCurrentIdx((v as PptxViewer).slideIndex);
      setTotalCount((v as PptxViewer).slideCount);
    }
  };

  const label = type === "xlsx" ? "Sheet" : type === "docx" ? "Page" : "Slide";
  const accentColor = type === "xlsx" ? "text-green-500" : type === "docx" ? "text-blue-500" : "text-orange-500";

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className={`w-8 h-8 border-2 border-gray-600 border-t-current rounded-full animate-spin mb-3 ${accentColor}`} />
          <p className="text-gray-400 text-sm">
            Memuat {type === "xlsx" ? "spreadsheet" : type === "docx" ? "dokumen" : "presentasi"}...
          </p>
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
      {/* Canvas container */}
      <div className="flex-1 overflow-hidden relative" ref={containerRef} />

      {/* Navigation bar */}
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
