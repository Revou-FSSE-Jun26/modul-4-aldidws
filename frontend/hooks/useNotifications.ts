import { useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { get } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

export interface Notification {
  id: string;
  /** Human-readable message text. */
  message: string;
  /** Whether the user has seen this notification. */
  read: boolean;
  /** ISO 8601 timestamp string. */
  createdAt: string;
}

export interface UseNotificationsReturn {
  notifications: Notification[];
  /** Number of notifications where `read === false`. */
  unreadCount: number;
  /** True while the most recent fetch is in flight. */
  isFetching: boolean;
  /** Last fetch error, or null when the most recent fetch succeeded. */
  error: string | null;
}

// ---------------------------------------------------------------------------
// API helper — uses apiClient so base URL and Authorization header are
// handled centrally. No raw fetch here.
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 30_000;

interface NotificationApiItem {
  id: string;
  message: string;
  read: boolean;
  created_at: string;
}

async function fetchNotifications(token: string): Promise<Notification[]> {
  // GET /api/notifications is not yet implemented on the backend.
  // When it ships it should return { data: NotificationApiItem[] }.
  // ApiError with isNotFound (404) or status 405 is treated as an empty list
  // so the bell renders correctly today and populates once the endpoint exists.
  try {
    const items = await get<NotificationApiItem[]>("/api/notifications", { token });
    return items.map((n) => ({
      id: n.id,
      message: n.message,
      read: n.read,
      createdAt: n.created_at,
    }));
  } catch (err: unknown) {
    // 404 / 405 — endpoint not yet live; return empty list gracefully.
    if (err instanceof ApiError && (err.isNotFound || err.statusCode === 405)) {
      return [];
    }
    // Any other error propagates to the hook's catch block.
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

/**
 * Polls GET /api/notifications every 30 seconds while the user is
 * authenticated.  The interval is started on mount and cleared in the
 * `useEffect` cleanup function so no dangling timers remain after unmount.
 *
 * Returns `notifications`, `unreadCount`, `isFetching`, and `error`.
 * No fetch or timer logic belongs in the consuming component.
 *
 * Usage:
 * ```ts
 * const { notifications, unreadCount } = useNotifications();
 * ```
 */
export function useNotifications(): UseNotificationsReturn {
  const { token, isLoading: isAuthLoading } = useAuth();

  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Don't start polling until auth has rehydrated.
    if (isAuthLoading) return;
    // Don't poll when unauthenticated — avoids spurious 401s.
    if (!token) return;

    let cancelled = false;

    async function poll() {
      setIsFetching(true);
      try {
        const data = await fetchNotifications(token!);
        if (!cancelled) {
          setNotifications(data);
          setError(null);
        }
      } catch (err: unknown) {
        if (!cancelled) {
          setError(
            err instanceof Error ? err.message : "Failed to load notifications.",
          );
        }
      } finally {
        if (!cancelled) setIsFetching(false);
      }
    }

    // Fetch immediately on mount (don't wait 30 s for the first result).
    void poll();

    // Then poll every 30 seconds.
    const intervalId = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    // Cleanup: cancel in-flight state updates and clear the interval.
    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [token, isAuthLoading]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return { notifications, unreadCount, isFetching, error };
}
