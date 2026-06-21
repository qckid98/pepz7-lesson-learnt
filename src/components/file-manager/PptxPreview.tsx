"use client";

import { useState, useEffect, useRef } from "react";
import { FileTypeIcon, ChevronLeftIcon, ChevronRightIcon, MaximizeIcon } from "lucide-react";
import { PPTXViewer } from "pptx-viewer";

interface PptxPreviewProps {
  fileId: string;
}

/**
 * PowerPoint (.pptx) preview using pptx-viewer library
 * Features: SVG rendering, shapes, text, images, tables, charts, slide navigation
 * Lightweight: only 8KB dependency (fflate for ZIP decompression)
 */
export default function PptxPreview({ fileId }: PptxPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<PPTXViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");
  const [currentSlide, setCurrentSlide] = useState(0);
  const [slideCount, setSlideCount] = useState(0);

  useEffect(() => {
    let cancelled = false;

    async function loadPptx() {
      try {
        if (!containerRef.current) return;

        // Fetch file via proxy
        const res = await fetch(`/api/files/${fileId}/proxy`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response");

        if (cancelled) return;

        // Clean up previous viewer
        if (viewerRef.current) {
          viewerRef.current.destroy();
        }

        // Create new viewer
        const viewer = new PPTXViewer(containerRef.current, {
          showControls: false,
          keyboardNavigation: true,
          onSlideChange: (index: number) => {
            if (!cancelled) setCurrentSlide(index);
          },
          onLoad: () => {
            if (!cancelled) {
              setLoading(false);
              setSlideCount(viewer.getSlideCount());
            }
          },
          onError: (err: Error) => {
            if (!cancelled) {
              setError(true);
              setErrorMsg(err.message);
              setLoading(false);
            }
          },
        });

        viewerRef.current = viewer;
        await viewer.load(arrayBuffer);

        if (!cancelled) {
          setSlideCount(viewer.getSlideCount());
        }
      } catch (e) {
        console.error("PPTX parse error:", e);
        if (!cancelled) {
          setError(true);
          setErrorMsg(e instanceof Error ? e.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    loadPptx();
    return () => {
      cancelled = true;
      if (viewerRef.current) {
        viewerRef.current.destroy();
        viewerRef.current = null;
      }
    };
  }, [fileId]);

  const goPrev = () => {
    const idx = viewerRef.current?.previous() ?? -1;
    if (idx >= 0) setCurrentSlide(idx);
  };

  const goNext = () => {
    const idx = viewerRef.current?.next() ?? -1;
    if (idx >= 0) setCurrentSlide(idx);
  };

  const goFullscreen = () => {
    viewerRef.current?.enterFullscreen();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-orange-500 rounded-full animate-spin mb-3" />
          <p className="text-gray-400 text-sm">Memuat presentasi...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center max-w-md text-center">
          <FileTypeIcon className="w-12 h-12 text-orange-500 mb-2" />
          <p className="text-gray-400 text-sm">Gagal memuat presentasi</p>
          <p className="text-gray-600 text-xs mt-1">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      {/* Slide content */}
      <div className="flex-1 overflow-hidden relative">
        <div ref={containerRef} className="w-full h-full" />
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-900 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={goPrev}
          disabled={currentSlide === 0}
          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs sm:text-sm text-gray-400">
            Slide {currentSlide + 1} / {slideCount}
          </span>
          <button
            onClick={goFullscreen}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition"
            title="Fullscreen"
          >
            <MaximizeIcon className="w-4 h-4" />
          </button>
        </div>

        <button
          onClick={goNext}
          disabled={currentSlide >= slideCount - 1}
          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
