import { useCallback } from "react";
import toast from "react-hot-toast";
import { ApiError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Status-code → user-facing message map
// ---------------------------------------------------------------------------

const STATUS_MESSAGES: Record<number, string> = {
  401: "Your session expired. Please log in again.",
  403: "You do not have access to that.",
  404: "This item no longer exists.",
  500: "Something went wrong on our end. Try again.",
};

const FALLBACK_MESSAGE = "An unexpected error occurred. Please try again.";

/**
 * Resolve a user-safe toast message from an error.
 *
 * Rules:
 * - `ApiError` with a known status code → mapped message from `STATUS_MESSAGES`.
 * - `ApiError` with an unknown status code → the API's own `message` field
 *   (already safe to show — Flask strips stack traces before sending).
 * - `ApiError` with a 5xx code → always use the generic 500 message,
 *   regardless of what the server said, to avoid leaking internals.
 * - Non-`ApiError` → `FALLBACK_MESSAGE`.
 */
export function resolveErrorMessage(err: unknown): string {
  if (!(err instanceof ApiError)) {
    return FALLBACK_MESSAGE;
  }

  // All 5xx errors map to the same safe message.
  if (err.isServerError) {
    return STATUS_MESSAGES[500];
  }

  // Known 4xx status codes get their mapped message.
  if (STATUS_MESSAGES[err.statusCode] !== undefined) {
    return STATUS_MESSAGES[err.statusCode];
  }

  // Other 4xx errors (e.g. 400 validation, 409 conflict) — surface the API's
  // own message, which is controlled and safe per the Flask error envelope.
  return err.message;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface UseErrorHandlerReturn {
  /**
   * Show an error toast mapped from the given error.
   *
   * Pass any caught value — `ApiError`, plain `Error`, or `unknown`.
   * The hook narrows the type internally and chooses an appropriate message.
   */
  handleError: (err: unknown) => void;
}

/**
 * Maps `ApiError` status codes to user-facing `react-hot-toast` messages.
 *
 * Status-code mapping:
 *   401 → "Your session expired. Please log in again."
 *   403 → "You do not have access to that."
 *   404 → "This item no longer exists."
 *   5xx → "Something went wrong on our end. Try again."
 *   Other ApiError → the API's own message (safe per Flask envelope contract)
 *   Non-ApiError   → generic fallback message
 *
 * Usage:
 * ```ts
 * const { handleError } = useErrorHandler();
 *
 * try {
 *   await someApiCall();
 * } catch (err) {
 *   handleError(err);
 * }
 * ```
 *
 * The hook is `useCallback`-stable so it can be listed in dependency arrays
 * without triggering unnecessary re-renders.
 */
export function useErrorHandler(): UseErrorHandlerReturn {
  const handleError = useCallback((err: unknown) => {
    const message = resolveErrorMessage(err);
    toast.error(message);
  }, []);

  return { handleError };
}
