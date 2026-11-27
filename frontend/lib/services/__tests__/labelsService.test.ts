import { setCardLabels } from "@/lib/services/cardsService";
import { createLabel, deleteLabel, listLabels, updateLabel } from "@/lib/services/labelsService";
import { jsonResponse, noContent, routeFetch } from "@/tests/fetchRoutes";

const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

describe("labelsService", () => {
  it("lists labels of a board", async () => {
    const calls = routeFetch(fetchMock, {
      "GET /api/boards/b%2F1/labels": jsonResponse(200, { data: [{ id: "l-1" }] }),
    });
    await expect(listLabels("tok", "b/1")).resolves.toEqual([{ id: "l-1" }]);
    expect(calls[0].headers.Authorization).toBe("Bearer tok");
  });

  it("creates, updates and deletes with the documented method, path and body", async () => {
    const calls = routeFetch(fetchMock, {
      "POST /api/boards/b-1/labels": jsonResponse(201, { data: { id: "l-1" } }),
      "PATCH /api/labels/l-1": jsonResponse(200, { data: { id: "l-1" } }),
      "DELETE /api/labels/l-1": noContent(),
    });
    await createLabel("tok", "b-1", { name: "Bug", color: "red" });
    await updateLabel("tok", "l-1", { color: "sky" });
    await deleteLabel("tok", "l-1");

    expect(calls.map((c) => [c.method, c.path, c.body])).toEqual([
      ["POST", "/api/boards/b-1/labels", { name: "Bug", color: "red" }],
      ["PATCH", "/api/labels/l-1", { color: "sky" }],
      ["DELETE", "/api/labels/l-1", undefined],
    ]);
  });

  it("setCardLabels sends PUT with exactly {label_ids}", async () => {
    const calls = routeFetch(fetchMock, {
      "PUT /api/v1/cards/c-1/labels": jsonResponse(200, { data: { id: "c-1", labels: [] } }),
    });
    await setCardLabels("tok", "c-1", ["l-1", "l-2"]);
    expect(calls[0].method).toBe("PUT");
    expect(calls[0].body).toEqual({ label_ids: ["l-1", "l-2"] });
  });

  it("propagates API errors", async () => {
    routeFetch(fetchMock, {
      "DELETE /api/labels/l-1": jsonResponse(404, { error: { code: "LABEL_NOT_FOUND", message: "Label not found", details: null } }),
    });
    await expect(deleteLabel("tok", "l-1")).rejects.toMatchObject({ statusCode: 404 });
  });
});
