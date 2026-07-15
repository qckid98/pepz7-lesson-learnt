"use client";

import { useState, useEffect, useCallback } from "react";

export interface SearchResults {
  files: Array<Record<string, unknown>>;
  folders: Array<Record<string, unknown>>;
}

/**
 * File/folder search with debounce.
 * Self-contained: owns searchQuery, searchResults, searchLoading.
 *
 * setSearchQuery only updates state — the actual fetch is debounced.
 */
export function useFileSearch(delayMs: number = 300) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResults | null>(null);
  const [searchLoading, setSearchLoading] = useState(false);

  const performSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setSearchResults(null);
      setSearchLoading(false);
      return;
    }
    setSearchLoading(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q.trim())}&type=all`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults({ files: data.results || [], folders: data.folders || [] });
      }
    } catch {
      /* ignore */
    }
    setSearchLoading(false);
  }, []);

  // Debounce — fires only after user stops typing for delayMs
  useEffect(() => {
    const timer = setTimeout(() => performSearch(searchQuery), delayMs);
    return () => clearTimeout(timer);
  }, [searchQuery, performSearch, delayMs]);

  const clearSearch = useCallback(() => {
    setSearchQuery("");
    setSearchResults(null);
  }, []);

  return {
    searchQuery,
    setSearchQuery, // plain setter — debounce handles the fetch
    searchResults,
    searchLoading,
    clearSearch,
  };
}
