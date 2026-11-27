import { del, patch, post } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { Column, ColumnColor } from "@/lib/types/api";

export function createColumn(token: string, boardId: string, name: string): Promise<Column> {
  return post<Column>(apiPaths.boardColumns(boardId), { name }, { token });
}

export function renameColumn(token: string, columnId: string, name: string): Promise<Column> {
  return patch<Column>(apiPaths.column(columnId), { name }, { token });
}

export function updateColumn(
  token: string,
  columnId: string,
  patchBody: { color?: ColumnColor | null; is_done?: boolean },
): Promise<Column> {
  return patch<Column>(apiPaths.column(columnId), patchBody, { token });
}

export function reorderColumns(
  token: string,
  boardId: string,
  orderedIds: string[],
): Promise<Column[]> {
  return patch<Column[]>(apiPaths.reorderColumns(boardId), { ordered_ids: orderedIds }, { token });
}

export function deleteColumn(token: string, columnId: string): Promise<void> {
  return del<void>(apiPaths.column(columnId), { token });
}
