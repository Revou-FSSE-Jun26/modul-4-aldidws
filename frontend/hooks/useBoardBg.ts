"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { DEFAULT_BG_ID, type BoardBgId } from "@/lib/board-backgrounds";

/**
 * Persist board background choice in localStorage.
 * Key: board-bg-<boardId> when boardId is provided, "board-bg" for the global default.
 *
 * TODO: replace localStorage with backend Board.background_id once the API
 * field exists.  At that point, the initial value should be fetched from the
 * board object and mutations should PATCH /api/boards/<boardId>.
 */
function storageKey(boardId?: string) {
  return boardId ? `board-bg-${boardId}` : "board-bg";
}

function readStorage(boardId?: string): BoardBgId {
  if (typeof window === "undefined") return DEFAULT_BG_ID;
  // Per-board value takes precedence; fall back to global, then default.
  const perBoard = boardId
    ? (window.localStorage.getItem(storageKey(boardId)) as BoardBgId | null)
    : null;
  if (perBoard) return perBoard;
  const global = window.localStorage.getItem("board-bg") as BoardBgId | null;
  return global ?? DEFAULT_BG_ID;
}

/**
 * Returns `{ bgId, setBgId }` and synchronises `data-board-bg` on the
 * provided wrapper ref.
 *
 * @param boardId  Optional board ID.  When omitted the global "board-bg"
 *                 localStorage key is used.
 * @param wrapperRef  Optional ref to the DOM element that should receive the
 *                    `data-board-bg` attribute.  When omitted the caller is
 *                    responsible for applying the attribute itself.
 */
export function useBoardBg(
  boardId?: string,
  wrapperRef?: React.RefObject<HTMLElement | null>,
) {
  // Always start with DEFAULT_BG_ID so server and client render the same
  // initial HTML, preventing a React hydration mismatch.  The real value is
  // read from localStorage in the effect below, after mount.
  const [bgId, setBgIdState] = useState<BoardBgId>(DEFAULT_BG_ID);
  // Track the most recent boardId so we can re-read storage when it changes.
  const prevBoardId = useRef(boardId);

  // Hydrate from localStorage after mount (client-only).
  useEffect(() => {
    setBgIdState(readStorage(boardId));
    prevBoardId.current = boardId;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (prevBoardId.current !== boardId) {
      prevBoardId.current = boardId;
      setBgIdState(readStorage(boardId));
    }
  }, [boardId]);

  // Sync the data attribute to the wrapper element whenever bgId changes.
  useEffect(() => {
    if (!wrapperRef?.current) return;
    wrapperRef.current.setAttribute("data-board-bg", bgId);
  }, [bgId, wrapperRef]);

  const setBgId = useCallback(
    (id: BoardBgId) => {
      setBgIdState(id);
      if (typeof window !== "undefined") {
        window.localStorage.setItem(storageKey(boardId), id);
      }
    },
    [boardId],
  );

  return { bgId, setBgId };
}
