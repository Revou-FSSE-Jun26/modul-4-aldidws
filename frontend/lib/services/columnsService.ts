import { del, patch, post } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { Column } from "@/lib/types/api";

export function createColumn(token: string, boardId: string, name: string): Promise<Column> {
  return post<Column>(apiPaths.boardColumns(boardId), { name }, { token });
}

export function renameColumn(token: string, columnId: string, name: string): Promise<Column> {
  return patch<Column>(apiPaths.column(columnId), { name }, { token });
}

export function deleteColumn(token: string, columnId: string): Promise<void> {
  return del<void>(apiPaths.column(columnId), { token });
}
