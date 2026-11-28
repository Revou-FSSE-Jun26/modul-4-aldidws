import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/context/AuthContext";
import {
  listNotifications,
  markNotificationRead,
} from "@/lib/services/notificationsService";
import type { ApiNotification } from "@/lib/types/api";

export interface UseNotificationsReturn {
  notifications: ApiNotification[];
  /** Server-reported unread count (`meta.unread_count`), kept in sync after mark-read. */
  unreadCount: number;
  /** True while the most recent fetch is in flight. */
  isFetching: boolean;
  /** Last fetch or mark-read error, or null when the most recent request succeeded. */
  error: string | null;
  /** PATCH /api/notifications/{id}/read, then update local state. */
  markRead: (id: string) => Promise<void>;
}

const POLL_INTERVAL_MS = 30_000;

/**
 * Polls GET /api/notifications every 30 seconds while the user is
 * authenticated. The timer is cleared on unmount. Errors are surfaced in
 * `error`, never swallowed.
 */
export function useNotifications(): UseNotificationsReturn {
  const { token, isAuthLoading } = useAuth();

  const [notifications, setNotifications] = useState<ApiNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [isFetching, setIsFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthLoading) return;
    if (!token) return;

    let cancelled = false;

    async function poll() {
      setIsFetching(true);
      try {
        const result = await listNotifications(token!);
        if (!cancelled) {
          setNotifications(result.items);
          setUnreadCount(result.unreadCount);
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

    void poll();
    const intervalId = setInterval(() => {
      void poll();
    }, POLL_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(intervalId);
    };
  }, [token, isAuthLoading]);

  const markRead = useCallback(
    async (id: string) => {
      if (!token) return;
      try {
        await markNotificationRead(token, id);
      } catch (err: unknown) {
        setError(
          err instanceof Error ? err.message : "Failed to mark notification as read.",
        );
        return;
      }
      setError(null);
      const wasUnread = notifications.some((n) => n.id === id && !n.is_read);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)),
      );
      if (wasUnread) setUnreadCount((count) => Math.max(0, count - 1));
    },
    [token, notifications],
  );

  return { notifications, unreadCount, isFetching, error, markRead };
}
