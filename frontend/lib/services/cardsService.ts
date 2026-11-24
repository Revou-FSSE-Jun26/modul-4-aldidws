import { del, getWithMeta, patch, post } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { Card, CardListItem, Paginated } from "@/lib/types/api";

export function createCard(
  token: string,
  columnId: string,
  payload: { title: string; description?: string },
): Promise<Card> {
  return post<Card>(apiPaths.columnCards(columnId), payload, { token });
}

export function updateCard(
  token: string,
  cardId: string,
  payload: { title?: string; description?: string },
): Promise<Card> {
  return patch<Card>(apiPaths.card(cardId), payload, { token });
}

export function moveCard(
  token: string,
  cardId: string,
  payload: { column_id: string; order: number },
): Promise<Card> {
  return patch<Card>(apiPaths.cardPosition(cardId), payload, { token });
}

export function deleteCard(token: string, cardId: string): Promise<void> {
  return del<void>(apiPaths.card(cardId), { token });
}

export async function listCards(
  token: string,
  params: {
    search?: string;
    board_id?: string;
    mine?: boolean;
    page?: number;
    per_page?: number;
  } = {},
): Promise<Paginated<CardListItem>> {
  return getWithMeta<CardListItem[]>(apiPaths.cards(params), { token });
}
