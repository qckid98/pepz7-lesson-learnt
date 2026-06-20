"use client";

import { useState, useEffect, useRef } from "react";
import { FileTypeIcon } from "lucide-react";

interface PDFThumbnailProps {
  fileId: string;     // File ID — we'll use proxy URL to avoid CORS
  size: number;       // Pixel size (width = height)
  className?: string;
}

/**
 * Renders the first page of a PDF as a thumbnail image.
 * Uses pdf.js to render client-side in the browser.
 * Fetches PDF via /api/files/[id]/proxy to avoid CORS issues with S3.
 */
export default function PDFThumbnail({ fileId, size, className = "" }: PDFThumbnailProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function renderThumbnail() {
      try {
        // Dynamic import pdf.js (browser build)
        const pdfjsLib = await import("pdfjs-dist");

        // Set worker path — use CDN that matches installed version
        const version = pdfjsLib.version;
        pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${version}/build/pdf.worker.min.mjs`;

        // Use our proxy endpoint to avoid CORS issues with S3
        const proxyUrl = `/api/files/${fileId}/proxy`;

        // Load PDF document
        const loadingTask = pdfjsLib.getDocument({ url: proxyUrl });
        const pdf = await loadingTask.promise;

        if (cancelled) return;

        // Get first page
        const page = await pdf.getPage(1);
        if (cancelled) return;

        // Calculate scale to fit thumbnail size
        const viewport = page.getViewport({ scale: 1 });
        const scale = Math.min(size / viewport.width, size / viewport.height);
        const scaledViewport = page.getViewport({ scale: scale * 2 }); // 2x for sharper rendering

        // Render to canvas
        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;

        const context = canvas.getContext("2d");
        if (!context) return;

        canvas.width = scaledViewport.width;
        canvas.height = scaledViewport.height;

        // v6 requires canvas parameter
        await page.render({
          canvas,
          canvasContext: context,
          viewport: scaledViewport,
        }).promise;

        if (!cancelled) {
          setLoading(false);
        }

        // Cleanup
        try { await pdf.cleanup(); } catch { /* ignore */ }
      } catch (e) {
        console.error("PDF thumbnail error:", e);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    renderThumbnail();

    return () => {
      cancelled = true;
    };
  }, [fileId, size]);

  if (error) {
    return <FileTypeIcon className={`text-red-500 ${className}`} style={{ width: size, height: size }} />;
  }

  return (
    <div
      className={`relative flex items-center justify-center bg-gray-100 rounded-lg overflow-hidden ${className}`}
      style={{ width: size, height: size }}
    >
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center">
          <FileTypeIcon className="text-red-400 animate-pulse" style={{ width: size * 0.6, height: size * 0.6 }} />
        </div>
      )}
      <canvas
        ref={canvasRef}
        className={loading ? "opacity-0" : "opacity-100 transition-opacity duration-200"}
        style={{ maxWidth: "100%", maxHeight: "100%" }}
      />
    </div>
  );
}
