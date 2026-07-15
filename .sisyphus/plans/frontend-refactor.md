# Frontend Refactor Plan: Hybrid + shadcn/ui Modernize

## Context
- **FileManager.tsx**: 1470-line god component (15 handler + full render + inline sub-components)
- **ViewerFileManager.tsx**: 548-line stripped copy — drift risk, maintenance pain
- **Zero component library**: custom Tailwind for every primitive (modal, dropdown, tooltip, context menu)
- **No virtualization**: 100+ files = lag
- **window.__dragData hack**: fragile cross-component drag state
- Stack: Next.js 16 + Tailwind v4 + Zustand + TanStack Query + lucide-react + clsx + tailwind-merge

## Verification Criteria (MUST pass ALL)
1. `npx tsc --noEmit` exit 0 after each phase
2. `npm run build` exit 0 after each phase
3. Manual: all existing features preserved (upload, folder upload, conflict dialog, drag-move, star, trash/restore, rename, preview, search, bulk ZIP, sort, grid/list toggle, breadcrumbs, sidebar tree)
4. Admin mode AND viewer mode work through single unified component
5. File list handles 500+ items smoothly (virtualized)
6. No `window.__` or `as any` hacks in new code

---

## Phase 1: Foundation (shadcn/ui + utilities)

**Goal**: Install design system primitives. Zero feature changes.

**Steps**:
1. Create `src/lib/utils.ts` with `cn()` helper (clsx + tailwind-merge already installed)
2. Install Radix UI primitives: `@radix-ui/react-dialog`, `@radix-ui/react-dropdown-menu`, `@radix-ui/react-context-menu`, `@radix-ui/react-tooltip`, `@radix-ui/react-scroll-area`, `@radix-ui/react-separator`, `@radix-ui/react-checkbox`, `@radix-ui/react-progress`, `@radix-ui/react-slot`
3. Install `sonner` (toast)
4. Create `src/components/ui/` with shadcn base components (copy-paste, no runtime dep):
   - `button.tsx`, `input.tsx`, `dialog.tsx`, `dropdown-menu.tsx`, `context-menu.tsx`, `tooltip.tsx`, `scroll-area.tsx`, `separator.tsx`, `checkbox.tsx`, `progress.tsx`, `skeleton.tsx`, `sonner.tsx`
5. Add `<Toaster />` to root layout

**Verify**: tsc + build pass. No visual changes yet.

---

## Phase 2: Extract hooks from FileManager

**Goal**: Separate business logic from rendering. FileManager shrinks ~400 lines.

**Files to create**:
- `src/hooks/use-file-upload.ts` — uploadSingleFile, checkAndUpload, handleUpload, handleFolderUpload, conflict resolution, upload progress state
- `src/hooks/use-file-operations.ts` — handleRename, handleStar, handleTrash, handleRestore, handlePermanentDelete, handleMove
- `src/hooks/use-file-search.ts` — handleSearch, debounce, search results state

**Pattern**: Each hook receives `fetchData` callback + store, returns handlers + local state.
**Verify**: FileManager still renders identically. tsc pass.

---

## Phase 3: Decompose FileManager into components

**Goal**: Break 1470-line god component into focused pieces. Each <200 lines.

**Target file structure** (`src/components/file-manager/`):
```
file-explorer.tsx          # Main orchestrator (~150 lines) — composes children, manages layout
explorer-sidebar.tsx       # Folder tree sidebar with navigation
explorer-toolbar.tsx       # Top bar: menu toggle, search, sort, view toggle, upload buttons
explorer-breadcrumbs.tsx   # Breadcrumb trail
explorer-content.tsx       # Grid/list content area
file-grid-card.tsx         # Single grid item (file/folder)
file-list-row.tsx          # Single list row (file/folder)
file-context-menu.tsx      # Right-click menu (shadcn ContextMenu)
upload-progress-panel.tsx  # Upload queue bottom-right panel
conflict-dialog.tsx        # Overwrite/skip dialog (shadcn Dialog)
bulk-action-bar.tsx        # Selection mode action bar
new-folder-inline.tsx      # Inline folder creation form
```

**Key decisions**:
- Drag-drop: keep native HTML5 DnD for now (dnd-kit in Phase 5). Replace `window.__dragData` with React context or ref lifted to `file-explorer.tsx`.
- Each component receives only the props it needs — no prop drilling of entire store.
- `file-explorer.tsx` owns the hooks (Phase 2) and passes handlers down.

**Verify**: All features work. tsc + build pass.

---

## Phase 4: Unify FileManager + ViewerFileManager

**Goal**: Delete ViewerFileManager.tsx. Single component with `mode` prop.

**Approach**:
1. Add `mode: "admin" | "viewer"` prop to FileExplorer
2. Admin mode: upload buttons, create folder, delete, rename, move, context menu full
3. Viewer mode: download, preview only. No upload/delete/rename. Sidebar shows shared folders only.
4. Update `src/app/page.tsx` (admin) and viewer-facing routes to use `<FileExplorer mode="admin" />` / `<FileExplorer mode="viewer" />`
5. Delete `ViewerFileManager.tsx`

**Conditional rendering**:
- Toolbar: upload buttons hidden in viewer mode
- Context menu: only "Download" + "Preview" in viewer mode
- Sidebar: no "New Folder" in viewer mode
- DnD: upload drop disabled in viewer mode (move may still work if permitted)

**Verify**: Admin can upload/delete/rename. Viewer can only view/download/preview. tsc + build pass.

---

## Phase 5: Virtualization + Polish

**Goal**: Performance + UX polish for "flawless" bar.

**Steps**:
1. Install `@tanstack/react-virtual`. Apply to list view (row virtualizer) and grid view (grid virtualizer). Handles 1000+ files smoothly.
2. Replace `window.__dragData` with React ref or context — clean DnD state management.
3. Add `sonner` toasts for: upload success/failure, delete success, move success, rename success, error states. Replace ad-hoc `confirm()` with shadcn AlertDialog for destructive actions.
4. Loading: replace "Memuat..." text with `Skeleton` grid/list placeholders.
5. Empty states: better illustrations + CTA (upload button in empty state).
6. Keyboard: arrow keys navigate items, Enter opens, Delete trashes, F2 renames, Ctrl+A select all.
7. Responsive: verify mobile sidebar drawer, touch-friendly tap targets.

**Verify**: 500+ items scroll smooth. All toasts fire. Keyboard works. tsc + build pass.

---

## Risk Mitigation
- **Phase order matters**: each phase builds on the previous. Skip none.
- **After each phase**: commit. Enables revert if next phase breaks.
- **ViewerFileManager unification (Phase 4)** is highest risk — test viewer mode thoroughly after.
- **Tailwind v4 + shadcn**: shadcn v2 supports Tailwind v4. Verify CSS variables work in `globals.css`.
- **lucide-react ^1.21.0**: unusual version. Verify icon imports match API. May need upgrade to ^0.4xx.x (standard lucide-react).

## What's explicitly skipped (YAGNI)
- dnd-kit migration (native HTML5 DnD works, upgrade only if bugs appear)
- Command palette (cmdk) — not requested, add when user asks
- Dark mode re-enable — separate effort, was disabled intentionally
- Presigned URL upload refactor — backend concern, separate from frontend
- Internationalization — current Indonesian strings preserved as-is
