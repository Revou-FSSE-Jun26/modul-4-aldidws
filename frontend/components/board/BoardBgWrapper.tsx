"use client";

import {
  createContext,
  useContext,
  useRef,
  type ReactNode,
} from "react";
import { useBoardBg } from "@/hooks/useBoardBg";
import { type BoardBgId } from "@/lib/board-backgrounds";

interface BoardBgContextValue {
  bgId: BoardBgId;
  setBgId: (id: BoardBgId) => void;
}

const BoardBgContext = createContext<BoardBgContextValue | null>(null);

/**
 * Returns the board background context so child components (e.g. a header
 * with an icon button) can read and update the active background preset.
 *
 * Must be used inside <BoardBgWrapper>.
 */
export function useBoardBgContext(): BoardBgContextValue {
  const ctx = useContext(BoardBgContext);
  if (!ctx) {
    throw new Error("useBoardBgContext must be used inside <BoardBgWrapper>");
  }
  return ctx;
}

/**
 * Optional variant for components that render both inside and outside
 * <BoardBgWrapper> (e.g. BoardDetailView in unit tests). Returns null when
 * no wrapper is present, so callers can skip picker rendering.
 */
export function useOptionalBoardBgContext(): BoardBgContextValue | null {
  return useContext(BoardBgContext);
}

interface BoardBgWrapperProps {
  /** Board ID.  When omitted the global "board-bg" localStorage key is used. */
  boardId?: string;
  className?: string;
  children: ReactNode;
}

/**
 * Wrapper that:
 * 1. Applies the `board-bg` class so the gradient CSS kicks in.
 * 2. Applies `data-board-bg="<id>"` so the per-preset CSS variables are set.
 * 3. Exposes `useBoardBgContext()` for descendant components that need to
 *    read or change the active background preset.
 */
export function BoardBgWrapper({ boardId, className, children }: BoardBgWrapperProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { bgId, setBgId } = useBoardBg(boardId, wrapperRef as React.RefObject<HTMLElement | null>);

  return (
    <BoardBgContext.Provider value={{ bgId, setBgId }}>
      <div
        ref={wrapperRef}
        data-board-bg={bgId}
        className={["board-bg", className].filter(Boolean).join(" ")}
      >
        {children}
      </div>
    </BoardBgContext.Provider>
  );
}
