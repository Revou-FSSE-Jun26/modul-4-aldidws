import { del, get, patch, post } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { Label, LabelColor } from "@/lib/types/api";

export function listLabels(token: string, boardId: string): Promise<Label[]> {
  return get<Label[]>(apiPaths.boardLabels(boardId), { token });
}

export function createLabel(
  token: string,
  boardId: string,
  payload: { name: string; color: LabelColor },
): Promise<Label> {
  return post<Label>(apiPaths.boardLabels(boardId), payload, { token });
}

export function updateLabel(
  token: string,
  labelId: string,
  payload: { name?: string; color?: LabelColor },
): Promise<Label> {
  return patch<Label>(apiPaths.label(labelId), payload, { token });
}

export function deleteLabel(token: string, labelId: string): Promise<void> {
  return del<void>(apiPaths.label(labelId), { token });
}
