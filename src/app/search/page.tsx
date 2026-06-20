"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import {
  SearchIcon,
  FileIcon,
  DownloadIcon,
  EyeIcon,
  FolderIcon,
  FilterIcon,
} from "lucide-react";
import { formatFileSize } from "@/lib/validators";

interface SearchResult {
  id: string;
  name: string;
  mimeType: string;
  size: string;
  extension: string;
  downloadCount: number;
  createdAt: string;
  folder: { id: string; name: string; visibility: string } | null;
}

interface SearchResponse {
  query: string;
  type: string;
  count: number;
  results: SearchResult[];
}

const FILE_TYPES = [
  { value: "all", label: "Semua" },
  { value: "pdf", label: "PDF" },
  { value: "image", label: "Gambar" },
  { value: "video", label: "Video" },
  { value: "audio", label: "Audio" },
  { value: "document", label: "Dokumen" },
];

export default function SearchPage() {
  const [query, setQuery] = useState("");
  const [type, setType] = useState("all");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [count, setCount] = useState(0);

  // Read initial query from URL params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const q = params.get("q");
    if (q) {
      setQuery(q);
      performSearch(q, type);
    }
  }, []);

  const performSearch = useCallback(
    async (searchQuery: string, searchType: string) => {
      if (!searchQuery || searchQuery.trim().length < 2) return;

      setLoading(true);
      setSearched(true);

      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(searchQuery.trim())}&type=${searchType}`
        );
        if (res.ok) {
          const data: SearchResponse = await res.json();
          setResults(data.results);
          setCount(data.count);
        }
      } catch {
        console.error("Search failed");
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    performSearch(query, type);
    // Update URL without reload
    window.history.replaceState(null, "", `/search?q=${encodeURIComponent(query)}`);
  };

  const handleTypeChange = (newType: string) => {
    setType(newType);
    if (query.trim().length >= 2) {
      performSearch(query, newType);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                <FileIcon className="w-5 h-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">
                File Sharing
              </span>
            </Link>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Search Form */}
        <form onSubmit={handleSubmit} className="mb-6">
          <div className="relative">
            <SearchIcon className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Cari file berdasarkan nama..."
              className="w-full pl-12 pr-28 py-4 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-lg"
              autoFocus
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 px-6 py-2.5 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition"
            >
              Cari
            </button>
          </div>
        </form>

        {/* Type Filter */}
        <div className="flex items-center gap-2 mb-6 flex-wrap">
          <FilterIcon className="w-4 h-4 text-gray-500" />
          {FILE_TYPES.map((ft) => (
            <button
              key={ft.value}
              onClick={() => handleTypeChange(ft.value)}
              className={`px-3 py-1.5 text-sm rounded-lg transition ${
                type === ft.value
                  ? "bg-blue-600 text-white"
                  : "bg-white border border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              {ft.label}
            </button>
          ))}
        </div>

        {/* Results */}
        {loading && (
          <div className="text-center py-12">
            <p className="text-gray-500">Mencari...</p>
          </div>
        )}

        {!loading && searched && results.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-gray-200">
            <SearchIcon className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500 text-lg">
              Tidak ditemukan file dengan kata kunci &quot;{query}&quot;
            </p>
            <p className="text-gray-400 text-sm mt-1">
              Coba kata kunci lain atau ubah filter jenis file
            </p>
          </div>
        )}

        {!loading && results.length > 0 && (
          <>
            <p className="text-sm text-gray-500 mb-4">
              Ditemukan <span className="font-medium">{count}</span> file
            </p>
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
              <div className="divide-y divide-gray-100">
                {results.map((file) => (
                  <div
                    key={file.id}
                    className="flex items-center justify-between px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="flex items-center gap-3 min-w-0 flex-1">
                      <FileIcon className="w-5 h-5 text-gray-400 flex-shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatFileSize(BigInt(file.size))} •{" "}
                          {file.extension.toUpperCase()} •{" "}
                          {file.folder ? (
                            <span className="inline-flex items-center gap-1">
                              <FolderIcon className="w-3 h-3" />
                              {file.folder.name}
                            </span>
                          ) : (
                            "Root"
                          )}{" "}
                          •{" "}
                          {new Date(file.createdAt).toLocaleDateString("id-ID")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <Link
                        href={`/preview/${file.id}`}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
                      >
                        <EyeIcon className="w-3 h-3" />
                        Preview
                      </Link>
                      <a
                        href={`/api/files/${file.id}/download`}
                        className="flex items-center gap-1 text-xs px-3 py-1.5 bg-blue-50 text-blue-700 rounded-lg hover:bg-blue-100 transition"
                      >
                        <DownloadIcon className="w-3 h-3" />
                        Download
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
