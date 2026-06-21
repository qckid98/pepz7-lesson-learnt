"use client";

import { useState, useEffect } from "react";
import { FileTypeIcon } from "lucide-react";
import * as XLSX from "xlsx";

interface ExcelPreviewProps {
  fileId: string;
}

interface SheetData {
  name: string;
  rows: (string | number | boolean | null)[][];
  merges: { s: { r: number; c: number }; e: { r: number; c: number } }[];
}

/**
 * Excel file preview — parses .xlsx/.xls/.csv client-side using SheetJS
 * Fetches file via server proxy to avoid CORS
 */
export default function ExcelPreview({ fileId }: ExcelPreviewProps) {
  const [sheets, setSheets] = useState<SheetData[]>([]);
  const [activeSheet, setActiveSheet] = useState(0);
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
        const workbook = XLSX.read(arrayBuffer, { type: "array", cellStyles: true, cellDates: true });

        if (cancelled) return;

        const sheetData: SheetData[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null, raw: false });
          const merges = (sheet["!merges"] || []).map((m) => ({
            s: { r: m.s.r, c: m.s.c },
            e: { r: m.e.r, c: m.e.c },
          }));
          return { name, rows: rows as (string | number | boolean | null)[][], merges };
        });

        if (!cancelled) {
          setSheets(sheetData);
          setLoading(false);
        }
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
    return () => { cancelled = true; };
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

  if (sheets.length === 0) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-gray-400 text-sm">File kosong</p>
      </div>
    );
  }

  const current = sheets[activeSheet];

  // Build merged cell lookup
  const mergedCells = new Set<string>();
  current.merges.forEach((m) => {
    for (let r = m.s.r; r <= m.e.r; r++) {
      for (let c = m.s.c; c <= m.e.c; c++) {
        if (r !== m.s.r || c !== m.s.c) {
          mergedCells.add(`${r}-${c}`);
        }
      }
    }
  });

  return (
    <div className="w-full h-full flex flex-col bg-white rounded-lg overflow-hidden">
      {/* Sheet tabs */}
      {sheets.length > 1 && (
        <div className="flex border-b border-gray-200 bg-gray-50 overflow-x-auto flex-shrink-0">
          {sheets.map((sheet, i) => (
            <button
              key={i}
              onClick={() => setActiveSheet(i)}
              className={`px-3 sm:px-4 py-2 text-xs sm:text-sm whitespace-nowrap transition ${
                i === activeSheet
                  ? "bg-white text-green-600 font-medium border-b-2 border-green-500"
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-100"
              }`}
            >
              {sheet.name}
            </button>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="min-w-full border-collapse text-xs sm:text-sm">
          <tbody>
            {current.rows.map((row, ri) => (
              <tr key={ri} className={ri === 0 ? "bg-green-50 font-medium" : (ri % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                <td className="px-2 py-1.5 border-r border-gray-200 text-gray-400 text-right w-8 sm:w-10 sticky left-0 bg-inherit">
                  {ri + 1}
                </td>
                {row.map((cell, ci) => {
                  const isMerged = mergedCells.has(`${ri}-${ci}`);
                  const mergeInfo = current.merges.find(
                    (m) => m.s.r === ri && m.s.c === ci
                  );
                  return (
                    <td
                      key={ci}
                      className={`px-2 sm:px-3 py-1.5 border-r border-gray-100 whitespace-nowrap ${
                        ri === 0 ? "font-semibold text-gray-700 bg-gray-100" : "text-gray-600"
                      } ${isMerged ? "hidden" : ""}`}
                      {...(mergeInfo ? {
                        rowSpan: mergeInfo.e.r - mergeInfo.s.r + 1,
                        colSpan: mergeInfo.e.c - mergeInfo.s.c + 1,
                      } : {})}
                    >
                      {cell === null || cell === undefined ? "" : String(cell)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 flex-shrink-0">
        {current.rows.length} baris • {current.rows[0]?.length || 0} kolom
        {current.merges.length > 0 && ` • ${current.merges.length} merged cells`}
        {sheets.length > 1 && ` • Sheet ${activeSheet + 1}/${sheets.length}`}
      </div>
    </div>
  );
}
