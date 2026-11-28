"use client";

import { useAuth } from "@/context/AuthContext";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  ArrowDownRight,
  ArrowRight,
  CalendarDays,
  CheckSquare,
  ChevronDown,
  FileText,
  Grid2X2,
  LayoutList,
  Plus,
  Star,
} from "lucide-react";

import { useRequireAuth } from "@/hooks/useRequireAuth";
import { listBoards, setFavorite } from "@/lib/services/boardsService";
import { ApiError } from "@/lib/errors";
import { loginPath } from "@/lib/loginPath";
import type { Board } from "@/lib/types/api";
import { CreateBoardForm } from "@/components/board/CreateBoardForm";
import { DashboardGuide } from "@/components/board/DashboardGuide";

type FetchState =
  | { status: "idle" }
  | { status: "success"; boards: Board[]; focusId: string | null }
  | { status: "error"; message: string };

type BoardFilter = "all" | "favorites";
type ViewMode = "grid" | "list";
type SortOption = "updated" | "created" | "name";

const PAGE_BG = "#FAF9F6";

export function BoardsGrid() {
  const { currentUser } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const { token, isAuthLoading } = useRequireAuth();

  const [state, setState] = useState<FetchState>({
    status: "idle",
  });

  const [activeFilter, setActiveFilter] =
    useState<BoardFilter>("all");

  const [viewMode, setViewMode] =
    useState<ViewMode>("grid");

  const [sortBy, setSortBy] =
    useState<SortOption>("updated");

  const [favoriteLoading, setFavoriteLoading] =
    useState<string[]>([]);

  useEffect(() => {
    if (isAuthLoading || !token) return;

    let cancelled = false;

    listBoards(token)
      .then((boards) => {
        if (!cancelled) {
          setState({
            status: "success",
            boards,
            focusId: null,
          });
        }
      })
      .catch((err: unknown) => {
        if (cancelled) return;

        if (err instanceof ApiError && err.isUnauthorized) {
          router.replace(loginPath(pathname));
          return;
        }

        setState({
          status: "error",
          message:
            err instanceof ApiError
              ? err.message
              : "Could not load boards. Please try again.",
        });
      });

    return () => {
      cancelled = true;
    };
  }, [token, isAuthLoading, router, pathname]);

  const boards =
    state.status === "success" ? state.boards : [];

  // Board tertua = 001, board terbaru = angka terakhir sesuai created_at
  const boardNumberMap = useMemo(() => {
    const byCreation = [...boards].sort(
      (a, b) =>
        new Date(a.created_at).getTime() -
        new Date(b.created_at).getTime(),
    );

    const map = new Map<string, number>();
    byCreation.forEach((board, idx) => {
      map.set(board.id, idx + 1);
    });
    return map;
  }, [boards]);

  const filteredBoards = useMemo(() => {
    const filtered = boards.filter((board) =>
      activeFilter === "favorites"
        ? board.is_favorite
        : true,
    );

    return [...filtered].sort((a, b) => {
      if (sortBy === "name") {
        return a.name.localeCompare(b.name);
      }

      const dateA = new Date(
        sortBy === "updated"
          ? a.updated_at
          : a.created_at,
      ).getTime();

      const dateB = new Date(
        sortBy === "updated"
          ? b.updated_at
          : b.created_at,
      ).getTime();

      return dateB - dateA;
    });
  }, [boards, activeFilter, sortBy]);

  const latestBoard = [...boards].sort(
    (a, b) =>
      new Date(b.updated_at).getTime() -
      new Date(a.updated_at).getTime(),
  )[0];

  function handleCreated(board: Board) {
    setState((current) => {
      if (current.status !== "success") {
        return {
          status: "success",
          boards: [board],
          focusId: board.id,
        };
      }

      return {
        status: "success",
        boards: [board, ...current.boards],
        focusId: board.id,
      };
    });
  }

  async function handleFavorite(board: Board) {
    if (!token || favoriteLoading.includes(board.id)) {
      return;
    }

    const previousFavorite = board.is_favorite;
    const nextFavorite = !previousFavorite;

    setFavoriteLoading((current) => [
      ...current,
      board.id,
    ]);

    setState((current) => {
      if (current.status !== "success") return current;

      return {
        ...current,
        boards: current.boards.map((item) =>
          item.id === board.id
            ? {
                ...item,
                is_favorite: nextFavorite,
              }
            : item,
        ),
      };
    });

    try {
      const updatedBoard = await setFavorite(
        token,
        board.id,
        nextFavorite,
      );

      setState((current) => {
        if (current.status !== "success") return current;

        return {
          ...current,
          boards: current.boards.map((item) =>
            item.id === board.id
              ? updatedBoard
              : item,
          ),
        };
      });
    } catch (err: unknown) {
      setState((current) => {
        if (current.status !== "success") return current;

        return {
          ...current,
          boards: current.boards.map((item) =>
            item.id === board.id
              ? {
                  ...item,
                  is_favorite: previousFavorite,
                }
              : item,
          ),
        };
      });

      if (
        err instanceof ApiError &&
        err.isUnauthorized
      ) {
        router.replace(loginPath(pathname));
        return;
      }

      window.alert(
        err instanceof Error
          ? err.message
          : "Could not update favorite. Please try again.",
      );
    } finally {
      setFavoriteLoading((current) =>
        current.filter((id) => id !== board.id),
      );
    }
  }

  function formatDate(date: string) {
    return new Date(date).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  function formatToday() {
    return new Date()
      .toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
      .toUpperCase();
  }

  function getGreeting() {
    const hour = new Date().getHours();
    if (hour >= 5 && hour < 12) {
      return "Good morning";
    }

    if (hour >= 12 && hour < 17) {
      return "Good afternoon";
    }

    if (hour >= 17 && hour < 21) {
      return "Good evening";
    }

    return "Good night";
  }

  function formatDisplayName(name?: string | null) {
    if (!name) return "";
    return name
      .trim()
      .split(/\s+/)
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  }

  if (
    isAuthLoading ||
    !token ||
    state.status === "idle"
  ) {
    return (
      <div
        className="min-h-full px-4 py-6 sm:px-8 sm:py-8 lg:px-10"
        style={{ backgroundColor: PAGE_BG }}
        aria-busy="true"
        aria-label="Loading dashboard"
      >
        <div className="mx-auto max-w-[1400px]">
          <div className="mb-8 animate-pulse">
            <div className="h-3 w-36 rounded bg-[#E9E9E0]" />
            <div className="mt-5 h-8 w-72 max-w-full rounded bg-[#E9E9E0] sm:h-9 sm:w-80" />
            <div className="mt-3 h-4 w-64 max-w-full rounded bg-[#E9E9E0]" />
          </div>

          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-[minmax(0,1fr)_232px]">
            <div className="h-[250px] animate-pulse rounded-xl bg-[#E9E9E0]" />
            <div className="hidden h-[360px] animate-pulse rounded-xl bg-[#E9E9E0] xl:block" />
          </div>
        </div>
      </div>
    );
  }

  if (state.status === "error") {
    return (
      <div
        className="min-h-full px-4 py-6 sm:px-8 sm:py-8 lg:px-10"
        style={{ backgroundColor: PAGE_BG }}
      >
        <div
          role="alert"
          className="mx-auto max-w-[1400px] rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
        >
          {state.message}
        </div>
      </div>
    );
  }

  const displayName = formatDisplayName(currentUser?.name);

  return (
    <div
      className="min-h-full px-4 pb-8 pt-5 sm:px-8 sm:pt-6 lg:px-10"
      style={{ backgroundColor: PAGE_BG }}
    >
      <div className="mx-auto w-full max-w-[2000px]">
        <section className="mb-6 sm:mb-7">
          <p className="flex items-center gap-2 text-[10px] font-medium tracking-wide text-[#697568] sm:text-[11px]">
            <CalendarDays size={11} className="shrink-0" />
            {formatToday()}
          </p>

          <div className="mt-3.5 flex flex-col justify-between gap-4 sm:mt-4 sm:flex-row sm:items-center sm:gap-5">
            <div className="min-w-0">
              <h1 className="text-[24px] font-medium leading-[1.2] tracking-[-0.8px] text-[#29483E] sm:text-[36px] sm:leading-tight sm:tracking-[-1.1px]">
                {getGreeting()}{displayName ? `, ${displayName}` : ""}.
              </h1>

              <p className="mt-1.5 text-xs text-[#858A80] sm:mt-2 sm:text-[13px]">
                Big ideas, small steps. Bring it all together here.
              </p>
            </div>

            <div className="w-full sm:w-auto [&_button]:!inline-flex [&_button]:!min-h-10 [&_button]:!w-full [&_button]:!items-center [&_button]:!justify-center [&_button]:!gap-2 [&_button]:!rounded-md [&_button]:!bg-[#193F34] [&_button]:!px-4 [&_button]:!py-2 [&_button]:!text-xs [&_button]:!font-medium [&_button]:!text-white [&_button]:!shadow-none [&_button:hover]:!bg-[#285747] sm:[&_button]:!min-h-9 sm:[&_button]:!w-auto sm:[&_button]:!text-[11px]">
              <CreateBoardForm onCreated={handleCreated} />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 sm:mt-6">
            <p className="text-[11px] text-[#858A80]">
              Your space to make things happen.
            </p>

            <p className="hidden text-[10px] font-medium tracking-wide text-[#858A80] sm:block">
              01 / YOUR WORKSPACE
            </p>
          </div>
        </section>

        <div className="grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_232px] xl:gap-5">
          <div className="min-w-0">
            <section>
              <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
                <div className="flex items-center gap-2">
                  <h2 className="text-[20px] font-semibold text-[#29483E] sm:text-[23px]">
                    My boards
                  </h2>

                  <span className="rounded-md bg-[#E9EDE2] px-1.5 py-0.5 text-[10px] font-medium text-[#526B57] sm:py-1 sm:text-[9px]">
                    {boards.length}
                  </span>
                </div>

                <div className="flex w-full items-center justify-between gap-3 sm:w-auto sm:justify-end">
                  <label className="relative flex items-center text-xs text-[#858A80] sm:text-[11px]">
                    <select
                      value={sortBy}
                      onChange={(event) =>
                        setSortBy(
                          event.target.value as SortOption,
                        )
                      }
                      className="cursor-pointer appearance-none border-0 bg-transparent py-1.5 pr-5 outline-none sm:py-1 sm:pr-4"
                    >
                      <option value="updated">Last updated</option>
                      <option value="created">Date created</option>
                      <option value="name">Board name</option>
                    </select>

                    <ChevronDown
                      size={15}
                      className="pointer-events-none absolute right-0"
                    />
                  </label>

                  <div className="flex rounded-lg bg-[#F0F0EA] p-1">
                    <button
                      type="button"
                      onClick={() => setViewMode("grid")}
                      aria-label="Grid view"
                      aria-pressed={viewMode === "grid"}
                      className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-md sm:h-7 ${
                        viewMode === "grid"
                          ? "bg-white text-[#24483D] shadow-sm"
                          : "text-[#858A80]"
                      }`}
                    >
                      <Grid2X2 size={14} />
                    </button>

                    <button
                      type="button"
                      onClick={() => setViewMode("list")}
                      aria-label="List view"
                      aria-pressed={viewMode === "list"}
                      className={`flex h-8 w-9 cursor-pointer items-center justify-center rounded-md sm:h-7 ${
                        viewMode === "list"
                          ? "bg-white text-[#24483D] shadow-sm"
                          : "text-[#858A80]"
                      }`}
                    >
                      <LayoutList size={14} />
                    </button>
                  </div>
                </div>
              </div>

              <div className="mb-5 mt-2 flex gap-6 border-b border-[#E8E7DF] sm:mt-3">
                <button
                  type="button"
                  onClick={() => setActiveFilter("all")}
                  className={`relative cursor-pointer py-2.5 text-[13px] sm:pb-2 sm:pt-1 ${
                    activeFilter === "all"
                      ? "font-semibold text-[#24483D]"
                      : "text-[#858A80]"
                  }`}
                >
                  All boards

                  {activeFilter === "all" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#24483D]" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveFilter("favorites")}
                  className={`relative cursor-pointer py-2.5 text-[13px] sm:pb-2 sm:pt-1 ${
                    activeFilter === "favorites"
                      ? "font-semibold text-[#24483D]"
                      : "text-[#858A80]"
                  }`}
                >
                  Favorites

                  {activeFilter === "favorites" && (
                    <span className="absolute bottom-0 left-0 right-0 h-[2px] bg-[#24483D]" />
                  )}
                </button>
              </div>

              {filteredBoards.length === 0 ? (
                <div className="flex min-h-[210px] flex-col items-center justify-center rounded-xl border border-dashed border-[#D9DED0] bg-[#F3F3EC] p-6 text-center sm:min-h-[230px]">
                  <h3 className="text-sm font-semibold text-[#24483D]">
                    {activeFilter === "favorites"
                      ? "No favorite boards yet"
                      : "No boards yet"}
                  </h3>

                  <p className="mt-2 text-xs text-[#858A80]">
                    Create your first board and start organizing your ideas.
                  </p>

                  {activeFilter === "all" && (
                    <div className="mt-4 [&_button]:!cursor-pointer [&_button]:!rounded-md [&_button]:!bg-[#193F34] [&_button]:!px-4 [&_button]:!py-2 [&_button]:!text-xs [&_button]:!text-white">
                      <CreateBoardForm onCreated={handleCreated} />
                    </div>
                  )}
                </div>
              ) : (
                <>
                  {viewMode === "grid" && (
                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
                      {filteredBoards.map((board, index) => {
                        const boardNumber =
                          boardNumberMap.get(board.id) ?? index + 1;

                        return (
                          <article
                            key={board.id}
                            className="group rounded-xl border border-[#E6E5DC] bg-white p-1.5 transition-shadow duration-200 hover:shadow-md"
                          >
                            <Link
                              href={`/boards/${board.id}`}
                              className="relative flex h-[156px] flex-col justify-between overflow-hidden rounded-lg bg-[#DCE7C9] p-4 sm:h-[170px] sm:p-[17px]"
                            >
                              <span className="text-[9px] font-medium uppercase tracking-wide text-[#405C45]">
                                BOARD / {String(boardNumber).padStart(3, "0")}
                              </span>

                              <span className="truncate font-serif text-[32px] italic leading-none tracking-tight text-[#24483D] sm:text-[36px]">
                                {board.name}
                              </span>

                              <div className="flex items-end justify-between">
                                <span className="text-[9px] uppercase tracking-wide text-[#405C45]">
                                  Your ideas. In motion.
                                </span>

                                <ArrowDownRight
                                  size={20}
                                  strokeWidth={1.5}
                                  className="text-[#405C45] transition-transform group-hover:translate-x-0.5 group-hover:translate-y-0.5"
                                />
                              </div>
                            </Link>

                            <div className="flex min-h-[76px] items-center justify-between gap-2 px-2.5 py-2.5 sm:min-h-[79px]">
                              <div className="min-w-0">
                                <Link
                                  href={`/boards/${board.id}`}
                                  className="block truncate text-[14px] font-semibold text-[#24483D]"
                                >
                                  {board.name}
                                </Link>

                                <div className="mt-1.5 flex flex-wrap items-center gap-2 sm:mt-2">
                                  {board.role && (
                                    <span className="rounded bg-[#EEF1E7] px-1.5 py-0.5 text-[10px] text-[#526B57] sm:py-1 sm:text-[11px]">
                                      {board.role}
                                    </span>
                                  )}

                                  <span className="text-[10px] text-[#858A80] sm:text-[9px]">
                                    Updated {formatDate(board.updated_at)}
                                  </span>
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-1">
                                <FavoriteButton
                                  board={board}
                                  loading={favoriteLoading.includes(board.id)}
                                  onClick={() => handleFavorite(board)}
                                />

                                <Link
                                  href={`/boards/${board.id}`}
                                  aria-label={`Open ${board.name}`}
                                  className="flex h-8 w-8 items-center justify-center rounded-full text-[#24483D] transition hover:bg-[#F0F2E9] sm:h-7 sm:w-7"
                                >
                                  <ArrowRight size={14} />
                                </Link>
                              </div>
                            </div>
                          </article>
                        );
                      })}

                      {activeFilter === "all" && (
                        <CreateBoardForm
                          onCreated={handleCreated}
                          triggerClassName="flex min-h-[185px] w-full cursor-pointer flex-col justify-between rounded-xl border border-dashed border-[#DFE1D5] bg-[#F3F3EC] p-5 text-left transition-colors hover:border-[#BEC9B6] hover:bg-[#EFF0E7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#526B57] sm:min-h-[237px]"
                          trigger={
                            <>
                              <div>
                                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-[#E5EBDD] text-[#24483D]">
                                  <Plus size={19} strokeWidth={1.7} />
                                </span>

                                <h3 className="mt-4 font-serif text-[22px] leading-[1.35] text-[#24483D] sm:text-[24px]">
                                  Room for your
                                  <br />
                                  next big idea.
                                </h3>

                                <p className="mt-2.5 text-[11px] text-[#858A80] sm:mt-3">
                                  A fresh board for a fresh perspective.
                                </p>
                              </div>

                              <div className="mt-5 flex items-center justify-between gap-3">
                                <span className="text-xs font-medium text-[#24483D] sm:text-[11px]">
                                  Create board
                                </span>

                                <ArrowRight
                                  size={14}
                                  className="shrink-0 text-[#24483D]"
                                />
                              </div>
                            </>
                          }
                        />
                      )}
                    </div>
                  )}

                  {viewMode === "list" && (
                    <div className="overflow-hidden rounded-xl border border-[#E6E5DC] bg-white">
                      {filteredBoards.map((board) => (
                        <article
                          key={board.id}
                          className="flex items-center justify-between gap-3 border-b border-[#E8E7DF] px-4 py-3.5 last:border-0 sm:py-3"
                        >
                          <div className="min-w-0">
                            <Link
                              href={`/boards/${board.id}`}
                              className="block truncate text-sm font-semibold text-[#24483D]"
                            >
                              {board.name}
                            </Link>

                            <div className="mt-1 flex flex-wrap items-center gap-2">
                              {board.role && (
                                <span className="rounded bg-[#EEF1E7] px-1.5 py-0.5 text-[10px] text-[#526B57]">
                                  {board.role}
                                </span>
                              )}
                              <p className="text-[10px] text-[#858A80] sm:text-[9px]">
                                Updated {formatDate(board.updated_at)}
                              </p>
                            </div>
                          </div>

                          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
                            <FavoriteButton
                              board={board}
                              loading={favoriteLoading.includes(board.id)}
                              onClick={() => handleFavorite(board)}
                            />

                            <Link
                              href={`/boards/${board.id}`}
                              aria-label={`Open ${board.name}`}
                              className="flex h-8 w-8 items-center justify-center rounded-full text-[#24483D] transition hover:bg-[#F0F2E9] sm:h-7 sm:w-7"
                            >
                              <ArrowRight size={15} />
                            </Link>
                          </div>
                        </article>
                      ))}
                    </div>
                  )}
                </>
              )}
            </section>

            <section className="mt-7">
              <h2 className="text-[13px] font-semibold text-[#24483D]">
                Pick up where you left off
              </h2>

              <p className="mt-1 text-[11px] text-[#858A80]">
                The latest from your workspace.
              </p>

              {latestBoard && (
                <Link
                  href={`/boards/${latestBoard.id}`}
                  className="mt-3 flex items-center justify-between gap-3 rounded-lg border border-[#E6E5DC] bg-white px-3.5 py-3 transition hover:bg-[#F7F7F1]"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-[#DCE7C9] font-serif text-xl text-[#24483D]">
                      {latestBoard.name.charAt(0)}
                    </span>

                    <div className="min-w-0">
                      <p className="truncate text-xs font-semibold text-[#24483D] sm:text-[11px]">
                        {latestBoard.name}
                      </p>

                      <p className="mt-0.5 text-[10px] text-[#858A80] sm:mt-1 sm:text-[9px]">
                        Updated {formatDate(latestBoard.updated_at)}
                      </p>
                    </div>
                  </div>

                  <div className="flex shrink-0 items-center gap-5">
                    <span className="hidden text-[11px] text-[#858A80] sm:inline">
                      Your board
                    </span>

                    <ArrowRight
                      size={14}
                      className="text-[#24483D]"
                    />
                  </div>
                </Link>
              )}
            </section>

            <section className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Link
                href="/notes"
                className="flex min-h-[60px] items-center justify-between gap-3 rounded-lg border border-[#E6E5DC] px-3.5 py-3 transition hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <FileText
                    size={15}
                    className="shrink-0 text-[#24483D]"
                  />

                  <div>
                    <p className="text-xs font-medium text-[#24483D] sm:text-[11px]">
                      Catch a passing thought
                    </p>

                    <p className="mt-0.5 text-[10px] text-[#858A80] sm:mt-1 sm:text-[9px]">
                      Keep ideas close in Notes.
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={13}
                  className="shrink-0 -rotate-45 text-[#24483D]"
                />
              </Link>

              <Link
                href="/my-tasks"
                className="flex min-h-[60px] items-center justify-between gap-3 rounded-lg border border-[#E6E5DC] px-3.5 py-3 transition hover:bg-white"
              >
                <div className="flex items-center gap-3">
                  <CheckSquare
                    size={15}
                    className="shrink-0 text-[#24483D]"
                  />

                  <div>
                    <p className="text-xs font-medium text-[#24483D] sm:text-[11px]">
                      One place for your next steps
                    </p>

                    <p className="mt-0.5 text-[10px] text-[#858A80] sm:mt-1 sm:text-[9px]">
                      Find your focus in My Tasks.
                    </p>
                  </div>
                </div>

                <ArrowRight
                  size={13}
                  className="shrink-0 -rotate-45 text-[#24483D]"
                />
              </Link>
            </section>
          </div>

          <aside className="min-w-0">
            <DashboardGuide />
          </aside>
        </div>
        <div className="mt-5 border-t border-[#E8E7DF]" />
      </div>
    </div>
  );
}

function FavoriteButton({
  board,
  loading,
  onClick,
}: {
  board: Board;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      aria-label={
        board.is_favorite
          ? `Remove ${board.name} from favorites`
          : `Add ${board.name} to favorites`
      }
      aria-pressed={board.is_favorite}
      className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-[#73806E] transition hover:bg-[#F0F2E9] disabled:opacity-50 sm:h-7 sm:w-7"
    >
      <Star
        size={14}
        strokeWidth={1.7}
        fill={board.is_favorite ? "currentColor" : "none"}
        className={board.is_favorite ? "text-[#526B57]" : ""}
      />
    </button>
  );
}