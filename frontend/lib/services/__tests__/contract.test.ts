/**
 * Contract test: every request the frontend services send must match
 * docs/api/frontend-request-payloads.json (method, path and body).
 * The backend test backend/tests/contract/test_frontend_payloads.py reads the
 * same file, so a drifting field name fails one of the two.
 */
import fs from "fs";
import path from "path";
import * as auth from "@/lib/services/authService";
import * as boards from "@/lib/services/boardsService";
import * as columns from "@/lib/services/columnsService";
import * as cards from "@/lib/services/cardsService";
import * as comments from "@/lib/services/commentsService";
import * as labels from "@/lib/services/labelsService";
import * as members from "@/lib/services/membersService";
import type { LabelColor } from "@/lib/types/api";
import * as users from "@/lib/services/usersService";

interface Entry {
  method: string;
  path: string;
  schema: string;
  pathParams: Record<string, string>;
  body: Record<string, unknown>;
}

const fixturePath = path.resolve(__dirname, "../../../../docs/api/frontend-request-payloads.json");
const requests: Record<string, Entry> = JSON.parse(fs.readFileSync(fixturePath, "utf-8")).requests;

const TOKEN = "tok";
const fetchMock = jest.fn();

function expectedPath(entry: Entry): string {
  return entry.path.replace(/\{(\w+)\}/g, (_m, name: string) => entry.pathParams[name]);
}

type Driver = (entry: Entry) => Promise<unknown>;

const drivers: Record<string, Driver> = {
  register: (e) => auth.register(e.body as Parameters<typeof auth.register>[0]),
  login: (e) => auth.login(e.body.email as string, e.body.password as string),
  createBoard: (e) => boards.createBoard(TOKEN, e.body.name as string),
  createColumn: (e) => columns.createColumn(TOKEN, e.pathParams.board_id, e.body.name as string),
  renameColumn: (e) => columns.renameColumn(TOKEN, e.pathParams.column_id, e.body.name as string),
  reorderColumns: (e) =>
    columns.reorderColumns(TOKEN, e.pathParams.board_id, e.body.ordered_ids as string[]),
  createCard: (e) =>
    cards.createCard(TOKEN, e.pathParams.column_id, e.body as { title: string; description?: string }),
  updateCard: (e) => cards.updateCard(TOKEN, e.pathParams.card_id, e.body as { title?: string }),
  createCardWithDueDate: (e) =>
    cards.createCard(TOKEN, e.pathParams.column_id, e.body as { title: string; due_date?: string | null }),
  createCardAtTop: (e) =>
    cards.createCard(TOKEN, e.pathParams.column_id, e.body as { title: string; position?: "top" | "bottom" }),
  createCardWithPriority: (e) =>
    cards.createCard(
      TOKEN,
      e.pathParams.column_id,
      e.body as { title: string; priority?: "low" | "medium" | "high" },
    ),
  updateCardPriority: (e) =>
    cards.updateCard(
      TOKEN,
      e.pathParams.card_id,
      e.body as { priority?: "low" | "medium" | "high" | null },
    ),
  createCardWithDueDateAndLabels: (e) =>
    cards.createCard(
      TOKEN,
      e.pathParams.column_id,
      e.body as { title: string; due_date?: string | null; priority?: "low" | "medium" | "high"; labels?: { id: string; name: string; color: LabelColor }[] },
    ),
  setCardDueDate: (e) =>
    cards.updateCard(TOKEN, e.pathParams.card_id, e.body as { due_date?: string | null }),
  clearCardDueDate: (e) =>
    cards.updateCard(TOKEN, e.pathParams.card_id, e.body as { due_date?: string | null }),
  createLabel: (e) =>
    labels.createLabel(TOKEN, e.pathParams.board_id, e.body as { name: string; color: LabelColor }),
  renameLabel: (e) =>
    labels.updateLabel(TOKEN, e.pathParams.label_id, e.body as { name?: string }),
  recolourLabel: (e) =>
    labels.updateLabel(TOKEN, e.pathParams.label_id, e.body as { color?: LabelColor }),
  setCardLabels: (e) =>
    cards.setCardLabels(TOKEN, e.pathParams.card_id, e.body.label_ids as string[]),
  moveCard: (e) =>
    cards.moveCard(TOKEN, e.pathParams.card_id, e.body as { column_id: string; order: number }),
  createComment: (e) => comments.createComment(TOKEN, e.pathParams.card_id, e.body.body as string),
  updateComment: (e) => comments.updateComment(TOKEN, e.pathParams.comment_id, e.body.body as string),
  updateProfile: (e) => users.updateProfile(TOKEN, e.body as { name?: string; timezone?: string }),
  inviteBoardMember: (e) =>
    members.inviteMember(TOKEN, e.pathParams.board_id, e.body.email as string),
  setCardAssignees: (e) =>
    members.setCardAssignees(TOKEN, e.pathParams.card_id, e.body.user_ids as string[]),
};

describe("frontend request contract", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    fetchMock.mockResolvedValue({ ok: true, status: 200, json: async () => ({ data: {} }) });
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("fixture and drivers cover the same requests", () => {
    expect(Object.keys(drivers).sort()).toEqual(Object.keys(requests).sort());
  });

  it.each(Object.keys(drivers))("%s sends the method, path and body in the fixture", async (key) => {
    const entry = requests[key];
    await drivers[key](entry);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(new URL(String(url), "http://localhost").pathname).toBe(expectedPath(entry));
    expect(init.method).toBe(entry.method);
    expect(JSON.parse(init.body as string)).toEqual(entry.body);
  });
});
