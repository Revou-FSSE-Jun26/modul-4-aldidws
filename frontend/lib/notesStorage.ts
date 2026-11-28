import { showError } from "@/lib/toast";

export interface Note {
  id: string;
  title: string;
  body: string;
  pinned: boolean;
  createdAt: string; // ISO
  updatedAt: string; // ISO
}

const STORAGE_PREFIX = "kanban-notes:v1:";

function storageKey(userId: string): string {
  return STORAGE_PREFIX + userId;
}

export function readNotes(userId: string): Note[] {
  if (typeof window === "undefined" || !userId) return [];
  try {
    const raw = window.localStorage.getItem(storageKey(userId));
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (n): n is Note =>
        n !== null &&
        typeof n === "object" &&
        "id" in n &&
        "title" in n &&
        "body" in n &&
        "pinned" in n,
    ) as Note[];
  } catch {
    return [];
  }
}

export function writeNotes(userId: string, notes: Note[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(storageKey(userId), JSON.stringify(notes));
  } catch (err) {
    showError("Could not save notes to this browser. Storage may be full.");
    throw err;
  }
}