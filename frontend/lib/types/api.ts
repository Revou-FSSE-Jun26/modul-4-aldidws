import type { PageMeta } from "@/lib/apiClient";

export type { PageMeta };

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

export type BoardRole = "owner" | "member";

export interface Board {
  id: string;
  name: string;
  user_id: string;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
  /** Present on list/detail payloads: the caller's role on this board. */
  role?: BoardRole;
}

/** A board member as returned by the board detail and member-list endpoints. */
export interface BoardMember {
  user_id: string;
  email: string;
  name: string | null;
  role: BoardRole;
}

export type ColumnColor = "gray" | "blue" | "orange" | "green" | "red";

export interface Column {
  id: string;
  board_id: string;
  name: string;
  position: number;
  /** Chosen status color; null means not picked (the client cycles by position). */
  color: ColumnColor | null;
  /** True when the column holds finished work. */
  is_done: boolean;
  created_at: string;
  updated_at: string;
}

export type LabelColor =
  | "blue"
  | "sky"
  | "graphite"
  | "silver"
  | "red"
  | "orange"
  | "green"
  | "purple";

/** Board label as returned by the label routes and inside the board. */
export interface Label {
  id: string;
  board_id: string;
  name: string;
  color: LabelColor;
  created_at: string;
  updated_at: string;
}

/** Label as it appears inside a card. */
export interface CardLabel {
  id: string;
  name: string;
  color: LabelColor;
}

export type CardPriority = "low" | "medium" | "high";

export interface Card {
  id: string;
  column_id: string;
  owner_id: string;
  title: string;
  description: string | null;
  /** Float sort key within a column. */
  order: number;
  /** UTC ISO 8601 string such as "2026-12-01T17:00:00Z", or null. */
  due_date: string | null;
  /** Priority level, or null for no priority. */
  priority: CardPriority | null;
  /** Sorted by name; empty when the card has no labels. */
  labels: CardLabel[];
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
  /**
   * Server-computed verdict for the *caller*: can the caller drag this card?
   * Present only on board-detail payloads. The server re-validates every
   * move; this flag drives the UI affordance.
   */
  can_move?: boolean;
  /**
   * Board-member ids tagged on this card, present only on board-detail
   * payloads. Drives the owner's "Who can move this card" picker.
   */
  assignee_ids?: string[];
}

export interface ColumnWithCards extends Column {
  cards: Card[];
}

export interface BoardDetail extends Board {
  columns: ColumnWithCards[];
  /** All labels defined on the board, sorted by name. */
  labels: Label[];
  /**
   * The caller's role on this board. Omitted on the legacy export/import
   * JSON fixture; present on the live board-detail payload.
   */
  role?: BoardRole;
  /** Nested for client convenience; mirrors {@link BoardDetail.role}. */
  access?: { role: BoardRole };
  /** Every board member, owner first. Omitted on the legacy export/import fixture. */
  members?: BoardMember[];
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

export interface WorkspaceSummary {
  workspace_name: string;
  projects: number;
  tasks: number;
  members: number;
}