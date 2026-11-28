"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listBoards } from "@/lib/services/boardsService";
import { listCards } from "@/lib/services/cardsService";
import { listNotifications } from "@/lib/services/notificationsService";
import { readNotes } from "@/lib/notesStorage";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import type { ApiNotification, Board, CardListItem } from "@/lib/types/api";

export interface SearchResult {
  id: string;
  type: "board" | "task" | "note" | "inbox";
  title: string;
  subtitle?: string;
  href: string;
}

/** Boards and notifications are fetched once and filtered locally; refetch after this age. */
const SNAPSHOT_TTL_MS = 30_000;
const TASK_DEBOUNCE_MS = 250;

export function useWorkspaceSearch(query: string) {
  const router = useRouter();
  const pathname = usePathname();
  const { token } = useRequireAuth();
  const { currentUser } = useAuth();
  const userId = currentUser?.id ?? "";
  const q = query.trim();

  const [boards, setBoards] = useState<Board[]>([]);
  const [inbox, setInbox] = useState<ApiNotification[]>([]);
  const [tasks, setTasks] = useState<CardListItem[]>([]);
  const [tasksLoading, setTasksLoading] = useState(false);

  const snapshotAtRef = useRef(0);
  const snapshotPendingRef = useRef(false);

  const handleError = useCallback(
    (err: unknown) => {
      if (err instanceof ApiError && err.isUnauthorized) {
        router.replace(loginPath(pathname));
      }
    },
    [router, pathname],
  );

  /** Call when the search box gets focus: loads boards + notifications if stale. */
  const prime = useCallback(() => {
    if (!token || snapshotPendingRef.current) return;
    if (Date.now() - snapshotAtRef.current < SNAPSHOT_TTL_MS) return;
    snapshotPendingRef.current = true;

    Promise.allSettled([listBoards(token), listNotifications(token)]).then(
      ([b, n]) => {
        if (b.status === "fulfilled") setBoards(b.value);
        else handleError(b.reason);
        if (n.status === "fulfilled") setInbox(n.value.items);
        else handleError(n.reason);
        snapshotAtRef.current = Date.now();
        snapshotPendingRef.current = false;
      },
    );
  }, [token, handleError]);

  // Tasks: server-side search, debounced. Stale responses are ignored.
  useEffect(() => {
    if (!token || !q) {
      setTasks([]);
      setTasksLoading(false);
      return;
    }
    let cancelled = false;
    setTasksLoading(true);

    const timer = window.setTimeout(() => {
      listCards(token, { search: q, per_page: 8 })
        .then((res) => {
          if (!cancelled) setTasks(res.data);
        })
        .catch((err: unknown) => {
          if (cancelled) return;
          setTasks([]);
          handleError(err);
        })
        .finally(() => {
          if (!cancelled) setTasksLoading(false);
        });
    }, TASK_DEBOUNCE_MS);

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [token, q, handleError]);

  const results = useMemo<SearchResult[]>(() => {
    if (!q) return [];
    const needle = q.toLowerCase();
    const has = (text?: string | null) =>
      !!text && text.toLowerCase().includes(needle);

    const boardResults: SearchResult[] = boards
      .filter((b) => has(b.name))
      .slice(0, 5)
      .map((b) => ({
        id: b.id,
        type: "board",
        title: b.name,
        href: `/board/${b.id}`,
      }));

    const taskResults: SearchResult[] = tasks.map((t) => ({
      id: t.id,
      type: "task",
      title: t.title,
      subtitle: `${t.board_name} · ${t.column_name}`,
      href: `/board/${t.board_id}?card=${t.id}`,
    }));

    const noteResults: SearchResult[] = readNotes(userId)
      .filter((n) => has(n.title) || has(n.body))
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        type: "note",
        title: n.title,
        subtitle: n.body.trim().slice(0, 80) || undefined,
        href: `/notes?note=${n.id}`,
      }));

    const inboxResults: SearchResult[] = inbox
      .filter((n) => has(n.title) || has(n.body))
      .slice(0, 5)
      .map((n) => ({
        id: n.id,
        type: "inbox",
        title: n.title,
        subtitle: n.body.slice(0, 80),
        href: `/inbox?item=${n.id}`,
      }));

    return [...boardResults, ...taskResults, ...noteResults, ...inboxResults];
  }, [q, boards, tasks, inbox, userId]);

  return { results, loading: tasksLoading, prime };
}