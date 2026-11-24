/**
 * API types. Field names match the Flask backend exactly
 * (Card.order, Board.user_id, notification title/body/is_read).
 */

export interface User {
  id: string;
  email: string;
  name: string | null;
  role: string;
  timezone: string;
}

export interface Board {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  created_at: string;
  updated_at: string;
}

export interface Card {
  id: string;
  column_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  /** Float sort key within a column. */
  order: number;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ColumnWithCards extends Column {
  cards: Card[];
}

export interface BoardDetail extends Board {
  columns: ColumnWithCards[];
}

/** Card as returned by GET /api/v1/cards (search and My Tasks). */
export interface CardListItem extends Card {
  board_id: string;
  board_name: string;
  column_name: string;
}

export interface ApiComment {
  id: string;
  card_id: string;
  author_id: string;
  author_name: string;
  body: string;
  created_at: string;
  updated_at: string;
}

export interface ApiNotification {
  id: string;
  user_id: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  updated_at: string;
}

import type { PageMeta } from "@/lib/apiClient";

export type { PageMeta };

export interface Paginated<T> {
  data: T[];
  meta: PageMeta;
}

export interface LoginResult {
  access_token: string;
  /** Returned by the backend but intentionally never stored. */
  refresh_token?: string;
  user: User;
}
