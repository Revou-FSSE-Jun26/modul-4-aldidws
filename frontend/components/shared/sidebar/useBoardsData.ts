import { useEffect, useState } from "react";
import { listBoards, setFavorite } from "@/lib/services/boardsService";
import type { Board } from "@/lib/types/api";

interface UseBoardsDataReturn {
  boards: Board[];
  favorites: Board[];
  handleToggleFavorite: (board: Board) => Promise<void>;
}

/**
 * Hook for fetching and managing boards data with favorite toggle functionality.
 */
export function useBoardsData(token: string | null): UseBoardsDataReturn {
  const [boards, setBoards] = useState<Board[]>([]);

  useEffect(() => {
    if (!token) {
      return;
    }

    let cancelled = false;

    listBoards(token)
      .then((data) => {
        if (!cancelled) {
          setBoards(data);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setBoards([]);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [token]);

  async function handleToggleFavorite(board: Board): Promise<void> {
    if (!token) return;

    try {
      const updated = await setFavorite(token, board.id, !board.is_favorite);
      setBoards((prev) => prev.map((b) => (b.id === updated.id ? updated : b)));
    } catch {
      // Keep existing state on error
    }
  }

  const favorites = boards.filter((board) => board.is_favorite);

  return { boards, favorites, handleToggleFavorite };
}
