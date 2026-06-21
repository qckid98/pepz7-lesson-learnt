"use client";

import { useState, useEffect, useRef } from "react";
import { FileTypeIcon } from "lucide-react";
import * as XLSX from "xlsx";
import { createSpreadsheetPreview } from "@nuptechs/nup-xlsx-preview/vanilla";
import type { NupWorkbook, NupWorksheet, NupCell, PreviewInstance, NupThemeConfig } from "@nuptechs/nup-xlsx-preview";
import "@nuptechs/nup-xlsx-preview/styles";

interface ExcelPreviewProps {
  fileId: string;
}

/**
 * Excel file preview using @nuptechs/nup-xlsx-preview
 * Features: virtual scroll, cell styling, merged cells, themes, sheet tabs
 */
export default function ExcelPreview({ fileId }: ExcelPreviewProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const instanceRef = useRef<PreviewInstance | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    let cancelled = false;

    async function parseExcel() {
      try {
        const res = await fetch(`/api/files/${fileId}/proxy`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response");

        // Parse with SheetJS
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellStyles: true, cellDates: true });

        if (cancelled) return;

        // Convert SheetJS workbook to NupWorkbook format
        const sheets: NupWorksheet[] = workbook.SheetNames.map((name, idx) => {
          const sheet = workbook.Sheets[name];
          const range = XLSX.utils.decode_range(sheet["!ref"] || "A1");
          const cells: Record<string, NupCell> = {};

          // Convert cells
          for (let r = range.s.r; r <= range.e.r; r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const cellRef = XLSX.utils.encode_cell({ r, c });
              const cell = sheet[cellRef];
              if (cell) {
                cells[cellRef] = {
                  v: cell.v ?? null,
                  t: cell.t as "s" | "n" | "b" | "e" | "d",
                };
              }
            }
          }

          // Get row/col dimensions
          const rows: Record<number, { h?: number; hidden?: boolean }> = {};
          const cols: Record<number, { w?: number; hidden?: boolean }> = {};
          
          if (sheet["!rows"]) {
            sheet["!rows"].forEach((row, i) => {
              if (row) rows[i] = { h: row.hpx, hidden: row.hidden };
            });
          }
          if (sheet["!cols"]) {
            sheet["!cols"].forEach((col, i) => {
              if (col) cols[i] = { w: col.wpx, hidden: col.hidden };
            });
          }

          // Get merges
          const merges = (sheet["!merges"] || []).map((m) => {
            const start = XLSX.utils.encode_cell({ r: m.s.r, c: m.s.c });
            const end = XLSX.utils.encode_cell({ r: m.e.r, c: m.e.c });
            return `${start}:${end}`;
          });

          return {
            id: `sheet-${idx}`,
            name,
            cells,
            rows,
            cols,
            merges,
            rowCount: range.e.r + 1,
            colCount: range.e.c + 1,
          };
        });

        const nupWorkbook: NupWorkbook = {
          sheets,
          activeSheet: 0,
        };

        if (cancelled || !containerRef.current) return;

        // Destroy previous instance if exists
        if (instanceRef.current) {
          instanceRef.current.destroy();
        }

        // Create preview — use "excel" theme for familiar look
        instanceRef.current = createSpreadsheetPreview(containerRef.current, {
          workbook: nupWorkbook,
          theme: "excel" as unknown as NupThemeConfig,
          height: "100%",
          showHeaders: true,
          showSheetTabs: sheets.length > 1,
          showGridLines: true,
          searchable: true,
          copyable: true,
          keyboardNavigation: true,
        });

        if (!cancelled) setLoading(false);
      } catch (e) {
        console.error("Excel parse error:", e);
        if (!cancelled) {
          setError(true);
          setErrorMsg(e instanceof Error ? e.message : "Unknown error");
          setLoading(false);
        }
      }
    }

    parseExcel();
    return () => {
      cancelled = true;
      if (instanceRef.current) {
        instanceRef.current.destroy();
        instanceRef.current = null;
      }
    };
  }, [fileId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-gray-600 border-t-green-500 rounded-full animate-spin mb-3" />
          <p className="text-gray-400 text-sm">Memuat spreadsheet...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center max-w-md text-center">
          <FileTypeIcon className="w-12 h-12 text-green-500 mb-2" />
          <p className="text-gray-400 text-sm">Gagal memuat spreadsheet</p>
          <p className="text-gray-600 text-xs mt-1">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="w-full h-full" />;
}
