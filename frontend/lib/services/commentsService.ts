import { del, get, patch, post } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { ApiComment } from "@/lib/types/api";

export function listComments(token: string, cardId: string): Promise<ApiComment[]> {
  return get<ApiComment[]>(apiPaths.cardComments(cardId), { token });
}

export function createComment(token: string, cardId: string, body: string): Promise<ApiComment> {
  return post<ApiComment>(apiPaths.cardComments(cardId), { body }, { token });
}

export function updateComment(token: string, commentId: string, body: string): Promise<ApiComment> {
  return patch<ApiComment>(apiPaths.comment(commentId), { body }, { token });
}

export function deleteComment(token: string, commentId: string): Promise<void> {
  return del<void>(apiPaths.comment(commentId), { token });
}
