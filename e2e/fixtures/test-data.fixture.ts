import { randomUUID } from "crypto";
import type { APIRequestContext } from "@playwright/test";
import { API_URL } from "../utils/env";

export const PASSWORD = "E2ePass123";

export interface Account {
  name: string;
  email: string;
  password: string;
}

/** Short unique suffix so parallel tests never share names or emails. */
export function uniqueSuffix(): string {
  return randomUUID().slice(0, 8);
}

export function uniqueName(prefix: string): string {
  return `${prefix} ${uniqueSuffix()}`;
}

export function newAccount(): Account {
  const id = uniqueSuffix();
  return { name: `E2E User ${id}`, email: `e2e-${id}@example.com`, password: PASSWORD };
}

/** Registers the account directly through the backend API. */
export async function registerAccount(request: APIRequestContext, account: Account): Promise<void> {
  const response = await request.post(`${API_URL}/api/auth/register`, {
    data: { name: account.name, email: account.email, password: account.password },
  });
  if (response.status() !== 201) {
    throw new Error(`Registering the e2e user failed with HTTP ${response.status()}`);
  }
}

export interface SeededBoard {
  id: string;
  name: string;
  columns: Record<string, string>;
  /** Card id by card title. */
  cards: Record<string, string>;
  /** Bearer token of the seeding login (API calls only, never stored in the browser). */
  token: string;
}

/**
 * Creates a board with columns and cards through the backend API so a test
 * can start from a known state. `cards` maps a column name to card titles.
 */
export async function seedBoard(
  request: APIRequestContext,
  account: Account,
  spec: { name: string; columns: string[]; cards?: Record<string, string[]> },
): Promise<SeededBoard> {
  const login = await request.post(`${API_URL}/api/auth/login`, {
    data: { email: account.email, password: account.password },
  });
  if (!login.ok()) throw new Error(`API login failed with HTTP ${login.status()}`);
  const token: string = (await login.json()).data.access_token;
  const headers = { Authorization: `Bearer ${token}` };

  async function create(path: string, data: Record<string, string>): Promise<string> {
    const response = await request.post(`${API_URL}${path}`, { data, headers });
    if (!response.ok()) throw new Error(`POST ${path} failed with HTTP ${response.status()}`);
    return (await response.json()).data.id as string;
  }

  const boardId = await create("/api/boards", { name: spec.name });
  const columns: Record<string, string> = {};
  for (const columnName of spec.columns) {
    columns[columnName] = await create(`/api/boards/${boardId}/columns`, { name: columnName });
  }
  const cards: Record<string, string> = {};
  for (const [columnName, titles] of Object.entries(spec.cards ?? {})) {
    for (const title of titles) {
      cards[title] = await create(`/api/v1/columns/${columns[columnName]}/cards`, { title });
    }
  }
  return { id: boardId, name: spec.name, columns, cards, token };
}

/** Creates a board label and attaches it to cards, all through the backend API. */
export async function seedLabel(
  request: APIRequestContext,
  board: SeededBoard,
  label: { name: string; color: string },
  cardTitles: string[],
): Promise<string> {
  const headers = { Authorization: `Bearer ${board.token}` };
  const created = await request.post(`${API_URL}/api/boards/${board.id}/labels`, {
    data: label,
    headers,
  });
  if (!created.ok()) throw new Error(`Creating the label failed with HTTP ${created.status()}`);
  const labelId: string = (await created.json()).data.id;
  for (const title of cardTitles) {
    const attached = await request.put(`${API_URL}/api/v1/cards/${board.cards[title]}/labels`, {
      data: { label_ids: [labelId] },
      headers,
    });
    if (!attached.ok()) throw new Error(`Attaching the label failed with HTTP ${attached.status()}`);
  }
  return labelId;
}
