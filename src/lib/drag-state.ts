// Module-level drag state — replaces window.__dragData hack.
// Shared between FileManager (drag source) and ExplorerSidebar (drop target).
export interface DragData {
  type: "file" | "folder";
  ids: string[];
}

export const dragState: { current: DragData | null } = { current: null };
