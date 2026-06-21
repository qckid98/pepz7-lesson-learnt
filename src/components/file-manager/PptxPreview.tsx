"use client";

import { useState, useEffect } from "react";
import { FileTypeIcon, ChevronLeftIcon, ChevronRightIcon } from "lucide-react";

interface PptxPreviewProps {
  fileId: string;
}

interface SlideData {
  html: string;
}

/**
 * PowerPoint (.pptx) preview — extracts slide text + images client-side
 * Parses the OOXML structure using JSZip
 * Fetches file via server proxy to avoid CORS
 */
export default function PptxPreview({ fileId }: PptxPreviewProps) {
  const [slides, setSlides] = useState<SlideData[]>([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;

    async function parsePptx() {
      try {
        const JSZip = (await import("jszip")).default;
        const res = await fetch(`/api/files/${fileId}/proxy`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response");
        const zip = await JSZip.loadAsync(arrayBuffer);

        if (cancelled) return;

        // Find all slide XML files
        const slideFiles = Object.keys(zip.files)
          .filter((name) => /^ppt\/slides\/slide\d+\.xml$/.test(name))
          .sort((a, b) => {
            const numA = parseInt(a.match(/slide(\d+)\.xml/)?.[1] || "0");
            const numB = parseInt(b.match(/slide(\d+)\.xml/)?.[1] || "0");
            return numA - numB;
          });

        if (slideFiles.length === 0) {
          if (!cancelled) {
            setError(true);
            setLoading(false);
          }
          return;
        }

        // Extract images from ppt/media/
        const mediaFiles: Record<string, string> = {};
        const mediaEntries = Object.keys(zip.files).filter((name) =>
          name.startsWith("ppt/media/")
        );
        for (const mediaName of mediaEntries) {
          const blob = await zip.files[mediaName].async("blob");
          const ext = mediaName.split(".").pop()?.toLowerCase() || "";
          const mime =
            ext === "png" ? "image/png" :
            ext === "jpg" || ext === "jpeg" ? "image/jpeg" :
            ext === "gif" ? "image/gif" :
            ext === "bmp" ? "image/bmp" :
            ext === "svg" ? "image/svg+xml" : "image/png";
          const url = URL.createObjectURL(new Blob([blob], { type: mime }));
          mediaFiles[mediaName.split("/").pop()!] = url;
        }

        // Parse each slide
        const slideData: SlideData[] = [];
        for (const slideFile of slideFiles) {
          const xml = await zip.files[slideFile].async("text");

          // Parse XML to extract text and images
          const parser = new DOMParser();
          const doc = parser.parseFromString(xml, "text/xml");

          // Collect all text elements with their formatting
          const textElements: { text: string; level: number; bold: boolean }[] = [];
          const spElements = doc.getElementsByTagName("a:p");
          for (let i = 0; i < spElements.length; i++) {
            const p = spElements[i];
            const runs = p.getElementsByTagName("a:r");
            let slideText = "";
            let isBold = false;
            for (let j = 0; j < runs.length; j++) {
              const t = runs[j].getElementsByTagName("a:t")[0];
              const rPr = runs[j].getElementsByTagName("a:rPr")[0];
              if (rPr) {
                const b = rPr.getAttribute("b");
                if (b === "1") isBold = true;
              }
              if (t) slideText += t.textContent || "";
            }
            // Get indent level
            const pPr = p.getElementsByTagName("a:pPr")[0];
            const lvl = pPr ? parseInt(pPr.getAttribute("lvl") || "0") : 0;
            if (slideText.trim()) {
              textElements.push({ text: slideText.trim(), level: lvl, bold: isBold });
            }
          }

          // Collect images
          const imageElements = doc.getElementsByTagName("a:blip");
          const images: string[] = [];
          for (let i = 0; i < imageElements.length; i++) {
            const embed = imageElements[i].getAttribute("r:embed");
            if (embed) {
              // Look up the relationship
              const relsXml = await zip.files[`ppt/slides/_rels/${slideFile.split("/").pop()}.rels`]?.async("text");
              if (relsXml) {
                const relsDoc = parser.parseFromString(relsXml, "text/xml");
                const rels = relsDoc.getElementsByTagName("Relationship");
                for (let r = 0; r < rels.length; r++) {
                  if (rels[r].getAttribute("Id") === embed) {
                    const target = rels[r].getAttribute("Target");
                    if (target) {
                      const imageName = target.split("/").pop();
                      if (imageName && mediaFiles[imageName]) {
                        images.push(mediaFiles[imageName]);
                      }
                    }
                  }
                }
              }
            }
          }

          // Build HTML
          let html = "";
          // Images first (like slide layout)
          if (images.length > 0) {
            html += images.map((url) =>
              `<div style="text-align:center;margin-bottom:16px;"><img src="${url}" style="max-width:100%;max-height:400px;object-fit:contain;border-radius:8px;" /></div>`
            ).join("");
          }
          // Then text
          if (textElements.length > 0) {
            html += textElements.map((t) => {
              const tag = t.level === 0 ? "p" : t.level === 1 ? "h3" : "h4";
              const style = `margin:8px 0;padding-left:${t.level * 20}px;${t.bold ? "font-weight:bold;" : ""}`;
              return `<${tag} style="${style}">${escapeHtml(t.text)}</${tag}>`;
            }).join("");
          }
          if (!html) html = '<p style="color:#9ca3af;text-align:center;">Slide kosong</p>';

          slideData.push({ html });
        }

        if (!cancelled) {
          setSlides(slideData);
          setLoading(false);
        }
      } catch (e) {
        console.error("PPTX parse error:", e);
        if (!cancelled) {
          setError(true);
          setLoading(false);
        }
      }
    }

    parsePptx();
    return () => { cancelled = true; };
  }, [fileId]);

  function escapeHtml(text: string): string {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

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
        <div className="flex flex-col items-center">
          <FileTypeIcon className="w-12 h-12 text-orange-500 mb-2" />
          <p className="text-gray-400 text-sm">Gagal memuat presentasi</p>
        </div>
      </div>
    );
  }

  if (slides.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">File kosong</p>
      </div>
    );
  }

  const current = slides[currentSlide];

  return (
    <div className="w-full h-full flex flex-col bg-gray-800 rounded-lg overflow-hidden">
      {/* Slide content */}
      <div className="flex-1 overflow-y-auto bg-white flex items-start justify-center p-4 sm:p-8">
        <div
          className="max-w-4xl w-full text-gray-700
            [&_p]:text-sm [&_p]:leading-relaxed
            [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800
            [&_h4]:text-sm [&_h4]:font-semibold [&_h4]:text-gray-600"
          dangerouslySetInnerHTML={{ __html: current.html }}
        />
      </div>

      {/* Navigation bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 py-2.5 bg-gray-900 border-t border-gray-700 flex-shrink-0">
        <button
          onClick={() => setCurrentSlide((s) => Math.max(0, s - 1))}
          disabled={currentSlide === 0}
          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <ChevronLeftIcon className="w-4 h-4" />
          <span className="hidden sm:inline">Sebelumnya</span>
        </button>

        <span className="text-xs sm:text-sm text-gray-400">
          Slide {currentSlide + 1} / {slides.length}
        </span>

        <button
          onClick={() => setCurrentSlide((s) => Math.min(slides.length - 1, s + 1))}
          disabled={currentSlide === slides.length - 1}
          className="flex items-center gap-1 px-2 sm:px-3 py-1.5 text-sm text-gray-300 hover:text-white hover:bg-gray-800 rounded-lg transition disabled:opacity-30 disabled:cursor-not-allowed"
        >
          <span className="hidden sm:inline">Berikutnya</span>
          <ChevronRightIcon className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
