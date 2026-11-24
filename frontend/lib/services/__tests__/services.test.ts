import * as auth from "@/lib/services/authService";
import * as boards from "@/lib/services/boardsService";
import * as columns from "@/lib/services/columnsService";
import * as cards from "@/lib/services/cardsService";
import * as comments from "@/lib/services/commentsService";
import * as notifications from "@/lib/services/notificationsService";
import * as users from "@/lib/services/usersService";
import { ApiError } from "@/lib/errors";

const fetchMock = jest.fn();

function ok(body: unknown, status = 200) {
  return { ok: true, status, json: async () => body };
}

function lastCall() {
  const [url, init] = fetchMock.mock.calls[fetchMock.mock.calls.length - 1];
  return {
    url: String(url),
    method: init.method as string,
    body: init.body ? JSON.parse(init.body as string) : undefined,
    headers: init.headers as Record<string, string>,
  };
}

describe("services", () => {
  beforeEach(() => {
    fetchMock.mockReset();
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  it("login posts email and password without a token", async () => {
    fetchMock.mockResolvedValue(ok({ data: { access_token: "t", user: { id: "u" } } }));
    const result = await auth.login("a@b.co", "pw");
    const call = lastCall();
    expect(call.url).toMatch(/\/api\/auth\/login$/);
    expect(call.method).toBe("POST");
    expect(call.body).toEqual({ email: "a@b.co", password: "pw" });
    expect(call.headers.Authorization).toBeUndefined();
    expect(result.access_token).toBe("t");
  });

  it("boards service uses /api/boards and sends the bearer token", async () => {
    fetchMock.mockResolvedValue(ok({ data: [] }));
    await boards.listBoards("tok");
    expect(lastCall().url).toMatch(/\/api\/boards$/);
    expect(lastCall().headers.Authorization).toBe("Bearer tok");

    fetchMock.mockResolvedValue(ok({ data: { id: "b" } }, 201));
    await boards.createBoard("tok", "Roadmap");
    expect(lastCall().method).toBe("POST");
    expect(lastCall().body).toEqual({ name: "Roadmap" });

    fetchMock.mockResolvedValue(ok({ data: { id: "b", columns: [] } }));
    await boards.getBoard("tok", "b 1");
    expect(lastCall().url).toMatch(/\/api\/boards\/b%201$/);
  });

  it("columns service sends only the backend field names", async () => {
    fetchMock.mockResolvedValue(ok({ data: {} }, 201));
    await columns.createColumn("tok", "b1", "To do");
    expect(lastCall().url).toMatch(/\/api\/boards\/b1\/columns$/);
    expect(lastCall().body).toEqual({ name: "To do" });

    await columns.renameColumn("tok", "c1", "Doing");
    expect(lastCall().method).toBe("PATCH");
    expect(lastCall().url).toMatch(/\/api\/columns\/c1$/);
    expect(lastCall().body).toEqual({ name: "Doing" });

    fetchMock.mockResolvedValue({ ok: true, status: 204, json: async () => null });
    await expect(columns.deleteColumn("tok", "c1")).resolves.toBeUndefined();
    expect(lastCall().method).toBe("DELETE");
  });

  it("cards service uses /api/v1 paths and {column_id, order} for moves", async () => {
    fetchMock.mockResolvedValue(ok({ data: {} }, 201));
    await cards.createCard("tok", "c1", { title: "Task" });
    expect(lastCall().url).toMatch(/\/api\/v1\/columns\/c1\/cards$/);
    expect(lastCall().body).toEqual({ title: "Task" });

    await cards.moveCard("tok", "k1", { column_id: "c2", order: 0.5 });
    expect(lastCall().method).toBe("PATCH");
    expect(lastCall().url).toMatch(/\/api\/v1\/cards\/k1\/position$/);
    expect(lastCall().body).toEqual({ column_id: "c2", order: 0.5 });

    await cards.updateCard("tok", "k1", { title: "New" });
    expect(lastCall().url).toMatch(/\/api\/v1\/cards\/k1$/);
  });

  it("cards list builds the query string and returns data with meta", async () => {
    fetchMock.mockResolvedValue(
      ok({ data: [{ id: "k1" }], meta: { page: 1, per_page: 50, total: 1 } }),
    );
    const result = await cards.listCards("tok", { mine: true, page: 1, per_page: 50 });
    const url = lastCall().url;
    expect(url).toMatch(/\/api\/v1\/cards\?/);
    expect(url).toContain("mine=true");
    expect(url).toContain("per_page=50");
    expect(result.data).toHaveLength(1);
    expect(result.meta.total).toBe(1);

    await cards.listCards("tok", { search: "a&b" });
    expect(lastCall().url).toContain("search=a%26b");
  });

  it("comments service uses card and comment routes", async () => {
    fetchMock.mockResolvedValue(ok({ data: {} }, 201));
    await comments.createComment("tok", "k1", "Hi");
    expect(lastCall().url).toMatch(/\/api\/cards\/k1\/comments$/);
    expect(lastCall().body).toEqual({ body: "Hi" });

    await comments.updateComment("tok", "m1", "Edited");
    expect(lastCall().url).toMatch(/\/api\/comments\/m1$/);
    expect(lastCall().method).toBe("PATCH");
  });

  it("notifications list reads meta.unread_count and mark-read PATCHes /read", async () => {
    fetchMock.mockResolvedValue(
      ok({
        data: [{ id: "n1", is_read: false }, { id: "n2", is_read: true }],
        meta: { page: 1, per_page: 20, total: 2, unread_count: 7 },
      }),
    );
    const list = await notifications.listNotifications("tok");
    expect(list.unreadCount).toBe(7);
    expect(list.items).toHaveLength(2);

    fetchMock.mockResolvedValue(ok({ data: { id: "n1", is_read: true } }));
    await notifications.markNotificationRead("tok", "n1");
    expect(lastCall().url).toMatch(/\/api\/notifications\/n1\/read$/);
    expect(lastCall().method).toBe("PATCH");
  });

  it("users service patches /api/users/me", async () => {
    fetchMock.mockResolvedValue(ok({ data: {} }));
    await users.updateProfile("tok", { name: "Ann", timezone: "UTC" });
    expect(lastCall().url).toMatch(/\/api\/users\/me$/);
    expect(lastCall().body).toEqual({ name: "Ann", timezone: "UTC" });
  });

  it("rethrows backend errors as ApiError with code and details", async () => {
    fetchMock.mockResolvedValue({
      ok: false,
      status: 400,
      json: async () => ({
        error: { code: "VALIDATION_ERROR", message: "Bad", details: { name: ["Unknown field."] } },
      }),
    });
    await expect(boards.createBoard("tok", "x")).rejects.toMatchObject({
      statusCode: 400,
      code: "VALIDATION_ERROR",
      details: { name: ["Unknown field."] },
    });
    await expect(boards.createBoard("tok", "x")).rejects.toBeInstanceOf(ApiError);
  });
});
