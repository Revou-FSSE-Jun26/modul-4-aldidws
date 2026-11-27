import { del, get, patch, post } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { BoardMember } from "@/lib/types/api";

export function listMembers(
  token: string,
  boardId: string
): Promise<BoardMember[]> {
  return get<BoardMember[]>(apiPaths.boardMembers(boardId), { token });
}

export function inviteMember(
  token: string,
  boardId: string,
  email: string
): Promise<{ user_id: string; role: "member" }> {
  return post(apiPaths.boardMembers(boardId), { email }, { token });
}

export function removeMember(
  token: string,
  boardId: string,
  userId: string
): Promise<void> {
  return del<void>(apiPaths.boardMember(boardId, userId), { token });
}

export function setCardAssignees(
  token: string,
  cardId: string,
  userIds: string[]
): Promise<unknown> {
  return patch(apiPaths.cardAssignees(cardId), { user_ids: userIds }, { token });
}
