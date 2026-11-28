/**
 * Typed fetch wrapper for the Flask REST API.
 *
 * Usage — Client Components / hooks:
 * ```ts
 * import { apiClient } from "@/lib/apiClient";
 *
 * const data = await apiClient<Board[]>("/api/boards", {
 *   token,
 *   on401: () => { logout(); router.push("/login"); },
 * });
 * ```
 *
 * Usage — Server Components (no token, no on401):
 * ```ts
 * const data = await apiClient<Board[]>("/api/boards");
 * ```
 *
 * Base URL resolution:
 *   Client Components   → NEXT_PUBLIC_API_BASE_URL  (exposed to browser bundle)
 *   Server Components   → API_BASE_URL               (server-only, never sent to client)
 *   Fallback            → "" (relative URL — works when Next.js and Flask share
 *                         the same origin or are proxied together)
 *
 * Note on 401 handling:
 *   `router.push()` and React context hooks cannot run inside a plain `lib/`
 *   module — they require a component or hook render context.  Instead,
 *   `apiClient` throws an `ApiError` with `statusCode === 401` and calls the
 *   optional `on401` callback before throwing.  Callers that need to clear
 *   auth state and redirect should supply `on401` from within a Client
 *   Component or custom hook where `useAuth()` and `useRouter()` are available.
 */

import { ApiError, isFlaskErrorEnvelope, type FlaskSuccessEnvelope } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Base URL — resolved once at module load time
// ---------------------------------------------------------------------------

/**
 * Determine the correct base URL for the current rendering context.
 *
 * - `NEXT_PUBLIC_API_BASE_URL`  is set in `.env.local` (client-safe, prefixed).
 * - `API_BASE_URL`               is set in `.env.local` (server-only, no prefix).
 *
 * During SSR `typeof window === "undefined"` is true, so we prefer the
 * server-only variable.  On the client we use the public variable.
 */
function resolveBaseUrl(): string {
  if (typeof window === "undefined") {
    // Server context — use the private env var if set, fall back to public
    return process.env.API_BASE_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
  }
  // Client context — only the NEXT_PUBLIC_ prefixed var is available
  return process.env.NEXT_PUBLIC_API_BASE_URL ?? "";
}

const BASE_URL = resolveBaseUrl();

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type HttpMethod = "GET" | "POST" | "PUT" | "PATCH" | "DELETE";

export interface ApiClientOptions {
  /** HTTP method. Defaults to "GET". */
  method?: HttpMethod;
  /**
   * JWT access token.  When provided, an `Authorization: Bearer <token>`
   * header is added to the request.  Omit for public endpoints.
   */
  token?: string | null;
  /** Request body — will be JSON-serialised and Content-Type set automatically. */
  body?: unknown;
  /**
   * Additional headers to merge into the request.
   * Authorization and Content-Type are managed automatically and should not
   * be included here.
   */
  headers?: Record<string, string>;
  /**
   * Called synchronously before the ApiError is thrown when the response
   * status is 401.  Use this to clear auth state and redirect in Client
   * Component / hook contexts where React APIs are available.
   *
   * Example:
   * ```ts
   * on401: () => { logout(); router.push("/login"); }
   * ```
   *
   * This callback is intentionally synchronous so it can be called before
   * the `throw` without requiring an `await`.
   */
  on401?: () => void;
  /**
   * Next.js fetch cache setting.  Defaults to `"no-store"` for
   * authenticated requests (token present) and `"default"` otherwise.
   * Pass an explicit value to override.
   */
  cache?: RequestCache;
  /** Next.js ISR revalidation interval in seconds. */
  next?: NextFetchRequestConfig;
  /**
   * Fetch credentials mode. Defaults to "same-origin".
   * Pass "include" for cross-origin requests that must carry cookies
   * (e.g. the /api/auth/refresh call that sends the HttpOnly cookie).
   */
  credentials?: RequestCredentials;
}

/** Subset of Next.js fetch config exposed through the wrapper. */
interface NextFetchRequestConfig {
  revalidate?: number | false;
  tags?: string[];
}

// ---------------------------------------------------------------------------
// Core function
// ---------------------------------------------------------------------------

/**
 * Make an authenticated or public request to the Flask API.
 *
 * @param path   API path starting with `/`, e.g. `/api/boards`.
 * @param opts   Request options (see `ApiClientOptions`).
 * @returns      The `data` field from the Flask success envelope `{ data: T }`.
 * @throws       `ApiError`  for non-2xx responses.
 * @throws       `TypeError` for network failures (no response received).
 */
export async function apiClient<T>(
  path: string,
  opts: ApiClientOptions = {},
): Promise<T> {
  const envelope = await requestEnvelope<T, never>(path, opts);
  return envelope.data;
}

/** Pagination metadata returned by list endpoints. */
export interface PageMeta {
  page: number;
  per_page: number;
  total: number;
  /** Present on GET /api/notifications only. */
  unread_count?: number;
}

/**
 * Like `apiClient`, but returns the whole success envelope so callers can read
 * `meta` (pagination, unread counts). Additive: `apiClient` is unchanged.
 */
export async function requestEnvelope<T, M = PageMeta>(
  path: string,
  opts: ApiClientOptions = {},
): Promise<{ data: T; meta: M }> {
  const {
    method = "GET",
    token,
    body,
    headers: extraHeaders = {},
    on401,
    cache,
    next,
    credentials,
  } = opts;

  // ---- Build headers -------------------------------------------------------

  const headers: Record<string, string> = { ...extraHeaders };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  // ---- Build fetch init ----------------------------------------------------

  const init: RequestInit & { next?: NextFetchRequestConfig } = {
    method,
    headers,
    // Per frontend.md §7.3: opt out of caching for authenticated requests to
    // prevent one user's data being served to another user.
    cache: cache ?? (token ? "no-store" : "default"),
    credentials: credentials ?? "same-origin",
  };

  if (body !== undefined) {
    init.body = JSON.stringify(body);
  }

  if (next) {
    init.next = next;
  }

  // ---- Execute request ------------------------------------------------------

  const url = `${BASE_URL}${path}`;
  const response = await fetch(url, init);

  // ---- Handle errors --------------------------------------------------------

  if (!response.ok) {
    // Try to parse the Flask error envelope for a structured error message.
    let parsed: unknown = null;
    try {
      parsed = await response.json();
    } catch {
      // Response body is not JSON — fall through to generic message.
    }

    let message = `Request failed with status ${response.status}`;
    let errorCode: string | undefined;
    let details: Record<string, string[]> | undefined;

    if (isFlaskErrorEnvelope(parsed)) {
      message = parsed.error.message;
      errorCode = parsed.error.code;
      details = parsed.error.details ?? undefined;
    }

    const apiError = new ApiError(response.status, message, errorCode, details);

    // Fire the 401 callback before throwing so the caller can clear auth state
    // and initiate a redirect.  The callback is called synchronously; the
    // throw follows immediately so the calling async function is interrupted.
    if (response.status === 401 && on401) {
      on401();
    }

    throw apiError;
  }

  // ---- Parse success response -----------------------------------------------

  // 204 No Content — Flask sends no body; return early without parsing.
  // Callers that use `del<void>(...)` receive `undefined` which is assignable
  // to `void`.  Callers that mistakenly use a non-void type parameter will get
  // a TypeScript error at the call site, not a runtime undefined.
  if (response.status === 204) {
    // `void` return: cast through `never` so the generic T is satisfied when
    // callers correctly declare del<void>().
    return { data: void 0 as never, meta: undefined as never };
  }

  const json = (await response.json()) as FlaskSuccessEnvelope<T> & { meta?: M };
  return { data: json.data, meta: json.meta as M };
}

// ---------------------------------------------------------------------------
// Convenience wrappers — thin aliases that set the HTTP method
// ---------------------------------------------------------------------------

/** GET /path and return typed data. */
export function get<T>(path: string, opts: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
  return apiClient<T>(path, { ...opts, method: "GET" });
}

/** GET /path and return `{ data, meta }` (pagination / unread count). */
export function getWithMeta<T>(path: string, opts: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<{ data: T; meta: PageMeta }> {
  return requestEnvelope<T>(path, { ...opts, method: "GET" });
}

/** POST /path with a JSON body and return typed data. */
export function post<T>(path: string, body: unknown, opts: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
  return apiClient<T>(path, { ...opts, method: "POST", body });
}

/** PATCH /path with a JSON body and return typed data. */
export function patch<T>(path: string, body: unknown, opts: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
  return apiClient<T>(path, { ...opts, method: "PATCH", body });
}

/** PUT /path with a JSON body and return typed data. */
export function put<T>(path: string, body: unknown, opts: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
  return apiClient<T>(path, { ...opts, method: "PUT", body });
}

/** DELETE /path and return typed data (or undefined for 204). */
export function del<T = void>(path: string, opts: Omit<ApiClientOptions, "method" | "body"> = {}): Promise<T> {
  return apiClient<T>(path, { ...opts, method: "DELETE" });
}
