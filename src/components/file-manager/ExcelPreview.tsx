"use client";

import { useState, useEffect, useRef } from "react";
import { FileTypeIcon } from "lucide-react";

interface ExcelPreviewProps {
  fileId: string;
}

interface SheetData {
  name: string;
  rows: (string | number | boolean | null)[][];
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

  useEffect(() => {
    let cancelled = false;

    async function parseExcel() {
      try {
        const XLSX = await import("xlsx");
        const res = await fetch(`/api/files/${fileId}/proxy`);
        if (!res.ok) throw new Error(`Fetch failed: ${res.status}`);
        const arrayBuffer = await res.arrayBuffer();
        if (arrayBuffer.byteLength === 0) throw new Error("Empty response");
        const workbook = XLSX.read(arrayBuffer, { type: "array" });

        if (cancelled) return;

        const sheetData: SheetData[] = workbook.SheetNames.map((name) => {
          const sheet = workbook.Sheets[name];
          const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: null });
          return { name, rows: rows as (string | number | boolean | null)[][] };
        });

        if (!cancelled) {
          setSheets(sheetData);
          setLoading(false);
        }
      } catch (e) {
        console.error("Excel parse error:", e);
        if (!cancelled) {
          setError(true);
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
        <div className="flex flex-col items-center">
          <FileTypeIcon className="w-12 h-12 text-green-500 mb-2" />
          <p className="text-gray-400 text-sm">Gagal memuat spreadsheet</p>
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
                {row.map((cell, ci) => (
                  <td
                    key={ci}
                    className={`px-2 sm:px-3 py-1.5 border-r border-gray-100 whitespace-nowrap ${
                      ri === 0 ? "font-semibold text-gray-700" : "text-gray-600"
                    }`}
                  >
                    {cell === null || cell === undefined ? "" : String(cell)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 bg-gray-50 border-t border-gray-200 text-xs text-gray-400 flex-shrink-0">
        {current.rows.length} baris • {current.rows[0]?.length || 0} kolom • Sheet {activeSheet + 1} dari {sheets.length}
      </div>
    </div>
  );
}
