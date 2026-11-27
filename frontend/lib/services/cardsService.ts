import { del, getWithMeta, patch, post, put } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { Card, CardListItem, Paginated } from "@/lib/types/api";

export function createCard(
  token: string,
  columnId: string,
  payload: {
    title: string;
    description?: string;
    due_date?: string | null;
    /** low, medium or high. Omitted means no priority (null). */
    priority?: "low" | "medium" | "high";
    /** Where the new card goes in its column. The server default is "bottom". */
    position?: "top" | "bottom";
  },
): Promise<Card> {
  return post<Card>(apiPaths.columnCards(columnId), payload, { token });
}

export function updateCard(
  token: string,
  cardId: string,
  payload: {
    title?: string;
    description?: string;
    due_date?: string | null;
    /** Omitted = unchanged; null clears the priority. */
    priority?: "low" | "medium" | "high" | null;
  },
): Promise<Card> {
  return patch<Card>(apiPaths.card(cardId), payload, { token });
}

export function setCardLabels(
  token: string,
  cardId: string,
  labelIds: string[],
): Promise<Card> {
  return put<Card>(apiPaths.cardLabels(cardId), { label_ids: labelIds }, { token });
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
