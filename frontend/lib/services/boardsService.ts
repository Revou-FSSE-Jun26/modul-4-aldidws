
import {
  del,
  get,
  patch,
  post,
  type ApiClientOptions,
} from "@/lib/apiClient";

import { apiPaths } from "@/lib/apiPaths";

import type {
  Board,
  BoardDetail,
  BoardMember,
} from "@/lib/types/api";

type AuthOptions = Pick<ApiClientOptions, "on401">;

export function listBoards(
  token: string,
  options: AuthOptions = {}
): Promise<Board[]> {
  return get<Board[]>(apiPaths.boards(), {
    token,
    ...options,
  });
}

export function getBoard(
  token: string,
  boardId: string
): Promise<BoardDetail> {
  return get<BoardDetail>(apiPaths.board(boardId), { token });
}

export function createBoard(
  token: string,
  name: string
): Promise<Board> {
  return post<Board>(apiPaths.boards(), { name }, { token });
}

export function renameBoard(
  token: string,
  boardId: string,
  name: string
): Promise<Board> {
  return patch<Board>(
    apiPaths.board(boardId),
    { name },
    { token }
  );
}

export function deleteBoard(
  token: string,
  boardId: string
): Promise<void> {
  return del<void>(apiPaths.board(boardId), { token });
}

export function setFavorite(
  token: string,
  boardId: string,
  is_favorite: boolean
): Promise<Board> {
  return patch<Board>(
    apiPaths.board(boardId),
    { is_favorite },
    { token }
  );
}
