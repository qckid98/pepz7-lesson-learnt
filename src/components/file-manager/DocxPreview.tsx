"use client";

import { useState, useEffect } from "react";
import { FileTypeIcon } from "lucide-react";
// Static import — dynamic import breaks in Next.js production build
import mammoth from "mammoth/mammoth.browser";

interface DocxPreviewProps {
  fileId: string;
}

/**
 * Word (.docx) preview — converts DOCX to HTML client-side using mammoth.js
 * Fetches file via server proxy to avoid CORS
 */
export default function DocxPreview({ fileId }: DocxPreviewProps) {
  const [html, setHtml] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function parseDocx() {
      try {
        const res = await fetch(`/api/files/${fileId}/proxy`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response");

        // mammoth.browser expects { arrayBuffer: ArrayBuffer }
        const result = await mammoth.convertToHtml({ arrayBuffer });

        if (!cancelled) {
          setHtml(result.value || "<p>Dokumen kosong</p>");
          setLoading(false);
        }
      } catch (e) {
        console.error("DOCX parse error:", e);
        if (!cancelled) {
          setError(true);
          setErrorMsg(e instanceof Error ? e.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    parseDocx();
    return () => { cancelled = true; };
  }, [fileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-blue-500 rounded-full animate-spin mb-3" />
          <p className="text-gray-400 text-sm">Memuat dokumen...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center max-w-md text-center">
          <FileTypeIcon className="w-12 h-12 text-blue-500 mb-2" />
          <p className="text-gray-400 text-sm mb-1">Gagal memuat dokumen</p>
          <p className="text-gray-600 text-xs">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full overflow-y-auto bg-white rounded-lg p-6 sm:p-10">
      <div
        className="max-w-3xl mx-auto prose prose-sm sm:prose-base text-gray-700
          [&_h1]:text-xl [&_h1]:font-bold [&_h1]:mb-3 [&_h1]:text-gray-900
          [&_h2]:text-lg [&_h2]:font-bold [&_h2]:mb-2 [&_h2]:text-gray-900
          [&_h3]:text-base [&_h3]:font-semibold [&_h3]:mb-2 [&_h3]:text-gray-800
          [&_p]:mb-3 [&_p]:leading-relaxed
          [&_ul]:list-disc [&_ul]:ml-5 [&_ul]:mb-3
          [&_ol]:list-decimal [&_ol]:ml-5 [&_ol]:mb-3
          [&_li]:mb-1
          [&_table]:border-collapse [&_table]:w-full [&_table]:mb-4
          [&_th]:border [&_th]:border-gray-300 [&_th]:px-3 [&_th]:py-1.5 [&_th]:bg-gray-100 [&_th]:font-semibold
          [&_td]:border [&_td]:border-gray-300 [&_td]:px-3 [&_td]:py-1.5
          [&_img]:max-w-full [&_img]:h-auto [&_img]:rounded-lg [&_img]:mb-3
          [&_a]:text-blue-600 [&_a]:underline
          [&_blockquote]:border-l-4 [&_blockquote]:border-gray-300 [&_blockquote]:pl-4 [&_blockquote]:italic"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  );
}
