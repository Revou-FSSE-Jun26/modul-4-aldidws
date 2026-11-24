/** Shared helpers for tests that mock `fetch` by "METHOD /path?query". */

export interface MockResponse {
  ok: boolean;
  status: number;
  json: () => Promise<unknown>;
}

export function jsonResponse(status: number, body: unknown): MockResponse {
  return { ok: status >= 200 && status < 300, status, json: async () => body };
}

export function errorResponse(
  status: number,
  code: string,
  message: string,
  details?: Record<string, string[]>,
): MockResponse {
  return jsonResponse(status, { error: { code, message, details: details ?? null } });
}

export const noContent = (): MockResponse => ({
  ok: true,
  status: 204,
  json: async () => {
    throw new Error("no body");
  },
});

export interface RecordedCall {
  method: string;
  path: string;
  body: unknown;
  headers: Record<string, string>;
}

export type RouteHandler = MockResponse | ((call: RecordedCall) => MockResponse);

/**
 * Routes `fetch` by exact "METHOD /path?query" key. Unmatched requests throw,
 * so a test never silently passes on an unexpected call.
 */
export function routeFetch(
  fetchMock: jest.Mock,
  routes: Record<string, RouteHandler>,
): RecordedCall[] {
  const calls: RecordedCall[] = [];
  fetchMock.mockImplementation(async (url: string, init: RequestInit & { headers: Record<string, string> }) => {
    const call: RecordedCall = {
      method: init?.method ?? "GET",
      path: String(url).replace(/^https?:\/\/[^/]+/, ""),
      body: init?.body ? JSON.parse(init.body as string) : undefined,
      headers: init?.headers ?? {},
    };
    calls.push(call);
    const handler = routes[`${call.method} ${call.path}`];
    if (!handler) throw new Error(`Unmocked request: ${call.method} ${call.path}`);
    return typeof handler === "function" ? handler(call) : handler;
  });
  return calls;
}
