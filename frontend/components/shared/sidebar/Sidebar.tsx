"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Grid2X2,
  Plus,
  Star,
  X,
  Loader2,
  UserRound,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import { SidebarNav } from "./SidebarNav";
import { ActionMenu } from "@/components/shared/ActionMenu";

import { get } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";

import {
  listBoards,
  createBoard,
  setFavorite,
} from "@/lib/services/boardsService";

import type { Board, WorkspaceSummary } from "@/lib/types/api";

const COLLAPSED_KEY = "sidebar-collapsed";

function readCollapsed(): boolean {
  if (typeof window === "undefined") return false;
  const stored = window.localStorage.getItem(COLLAPSED_KEY);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return false;
}

// Props are optional for backward-compat; Sidebar manages its own state internally.
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface SidebarProps {
  collapsed?: boolean;
  onToggle?: () => void;
}

export function LeafRLogo({ size = 28 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 36 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      className="shrink-0"
    >
      <path
        d="M5 19.5C5 10.94 11.94 4 20.5 4H31V14.5C31 23.06 24.06 30 15.5 30H5V19.5Z"
        fill="#DCE5CC"
      />
      <path
        d="M10 25C15.5 20.5 20.5 15.5 25.5 9.5"
        stroke="#8EA876"
        strokeWidth="1.5"
        strokeLinecap="round"
      />
      <path
        d="M13 24.5V11.5H19.5C22.1 11.5 23.8 13.1 23.8 15.4C23.8 17.3 22.6 18.7 20.6 19.1L24.2 24.5H20.8L17.6 19.4H16V24.5H13ZM16 17H19.2C20.4 17 21.1 16.4 21.1 15.4C21.1 14.4 20.4 13.9 19.2 13.9H16V17Z"
        fill="#173F35"
      />
    </svg>
  );
}

export function Sidebar(_props: SidebarProps) {
  const router = useRouter();
  const { currentUser, token, logout } = useAuth();

  // Internal collapsed state — read from localStorage on mount.
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(readCollapsed());
  }, []);

  function handleToggle() {
    setCollapsed((prev) => {
      const next = !prev;
      if (typeof window !== "undefined") {
        window.localStorage.setItem(COLLAPSED_KEY, String(next));
      }
      return next;
    });
  }

  const [boards, setBoards] = useState<Board[]>([]);
  const [workspace, setWorkspace] = useState<WorkspaceSummary | null>(null);

  const [loadingBoards, setLoadingBoards] = useState(false);
  const [workspaceOpen, setWorkspaceOpen] = useState(false);
  const workspaceRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleOutsideClick(event: PointerEvent) {
      if (
        workspaceRef.current &&
        !workspaceRef.current.contains(event.target as Node)
      ) {
        setWorkspaceOpen(false);
      }
    }

    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setWorkspaceOpen(false);
      }
    }

    document.addEventListener("pointerdown", handleOutsideClick);
    document.addEventListener("keydown", handleEscape);

    return () => {
      document.removeEventListener("pointerdown", handleOutsideClick);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const [createOpen, setCreateOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [creating, setCreating] = useState(false);

  const [updatingFavorites, setUpdatingFavorites] = useState<string[]>([]);

  const handleUnauthorized = useCallback(() => {
    void logout();
    router.replace("/login");
  }, [logout, router]);

  useEffect(() => {
    if (!createOpen) return;

    function handleCreateEscape(event: KeyboardEvent) {
      if (event.key === "Escape" && !creating) {
        setCreateOpen(false);
      }
    }

    document.addEventListener("keydown", handleCreateEscape);
    return () => document.removeEventListener("keydown", handleCreateEscape);
  }, [createOpen, creating]);

  useEffect(() => {
    if (!token) {
      setBoards([]);
      setWorkspace(null);
      return;
    }

    let cancelled = false;

    async function loadSidebarData() {
      setLoadingBoards(true);

      const [boardsResult, workspaceResult] = await Promise.allSettled([
        listBoards(token!, { on401: handleUnauthorized } as never),
        get<WorkspaceSummary>(apiPaths.workspaceSummary(), {
          token,
          on401: handleUnauthorized,
        }),
      ]);

      if (cancelled) return;

      if (boardsResult.status === "fulfilled") {
        setBoards(boardsResult.value);
      } else {
        toast.error("Unable to load boards.");
      }

      if (workspaceResult.status === "fulfilled") {
        setWorkspace(workspaceResult.value);
      }

      setLoadingBoards(false);
    }

    void loadSidebarData();

    return () => {
      cancelled = true;
    };
  }, [token, handleUnauthorized]);

  const favoriteBoards = boards.filter((board) => board.is_favorite);

  async function handleCreateBoard(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const name = boardName.trim();

    if (!name) {
      toast.error("Please enter a board name.");
      return;
    }

    if (!token) {
      toast.error("Please sign in again.");
      return;
    }

    try {
      setCreating(true);

      const newBoard = await createBoard(token, name);

      setBoards((previous) => [...previous, newBoard]);

      setBoardName("");
      setCreateOpen(false);

      toast.success("Board created successfully.");

      router.push(`/boards/${newBoard.id}`);
    } catch {
      toast.error("Unable to create board.");
    } finally {
      setCreating(false);
    }
  }

  async function handleToggleFavorite(board: Board) {
    if (!token || updatingFavorites.includes(board.id)) return;

    const nextFavorite = !board.is_favorite;

    setUpdatingFavorites((previous) => [...previous, board.id]);

    try {
      const updatedBoard = await setFavorite(
        token,
        board.id,
        nextFavorite
      );

      setBoards((previous) =>
        previous.map((item) =>
          item.id === board.id ? updatedBoard : item
        )
      );

      toast.success(
        nextFavorite
          ? "Added to favorites."
          : "Removed from favorites."
      );
    } catch {
      toast.error("Unable to update favorite.");
    } finally {
      setUpdatingFavorites((previous) =>
        previous.filter((id) => id !== board.id)
      );
    }
  }

  async function handleSignOut() {
    try {
      await logout();
      toast.success("Signed out successfully.");
      router.replace("/login");
    } catch {
      toast.error("Unable to sign out.");
    }
  }

  const userMenuItems = [
    {
      id: "profile",
      label: "Profile",
      onSelect: () => router.push("/profile"),
    },
    {
      id: "sign-out",
      label: "Sign out",
      onSelect: () => void handleSignOut(),
    },
  ];

  return (
    <>
      <aside
        data-collapsed={collapsed ? "true" : "false"}
        className={[
          "fixed inset-y-0 left-0 z-40 hidden flex-col md:flex",
          "border-r border-[#31594C]",
          "bg-[#173F35] text-white",
          "transition-[width] duration-200 ease-in-out",
          collapsed ? "w-16" : "w-[180px]",
        ].join(" ")}
      >
        <div
          className={[
            "flex items-center pt-5 pb-2",
            collapsed
              ? "justify-center px-1.5"
              : "justify-between gap-1.5 px-3",
          ].join(" ")}
        >
          <Link
            href="/"
            aria-label="RevoTask Home"
            className="flex min-w-0 flex-1 items-center gap-2"
          >
            {collapsed ? (
              <LeafRLogo size={28} />
            ) : (
              <>
                <LeafRLogo size={26} />
                <div className="min-w-0">
                  <h1 className="whitespace-nowrap text-[21px] font-semibold leading-none tracking-tight text-white">
                    RevoTask
                  </h1>
                  <p className="mt-1 truncate text-[8px] text-white/80">
                    A little order. A lot of possibility.
                  </p>
                </div>
              </>
            )}
          </Link>

          <button
            type="button"
            onClick={handleToggle}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-md text-white transition-colors hover:bg-[#285346] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCEBC0]"
          >
            {collapsed ? (
              <ChevronRight size={15} />
            ) : (
              <ChevronLeft size={15} />
            )}
          </button>
        </div>

        <div
          ref={workspaceRef}
          className="relative mt-5 px-3"
        >
          <button
            type="button"
            onClick={() => setWorkspaceOpen((previous) => !previous)}
            aria-expanded={workspaceOpen}
            title="Workspace information"
            className={[
              "flex w-full cursor-pointer items-center rounded-lg text-white",
              "bg-[#285346] transition-colors hover:bg-[#315F50] hover:text-white",
              collapsed
                ? "justify-center p-3"
                : "justify-between px-3 py-3",
            ].join(" ")}
          >
            {collapsed ? (
              <Grid2X2 size={16} className="text-white" />
            ) : (
              <>
                <div className="min-w-0 text-left">
                  <p className="text-[8px] uppercase tracking-wide text-white/80">
                    Workspace
                  </p>
                  <p className="mt-1 truncate text-xs font-medium text-white">
                    {workspace?.workspace_name || "My Workspace"}
                  </p>
                </div>

                <ChevronDown
                  size={13}
                  className={[
                    "shrink-0 text-white transition-transform",
                    workspaceOpen ? "rotate-180" : "",
                  ].join(" ")}
                />
              </>
            )}
          </button>

          {workspaceOpen && (
            <div
              className={[
                "absolute z-[60]",
                collapsed
                  ? "left-full top-0 ml-2 w-64"
                  : "left-3 right-3 top-full mt-2",
                "rounded-lg border border-[#416456]",
                "bg-[#214B3E] p-3 text-white shadow-xl",
              ].join(" ")}
            >
              <p className="truncate text-xs font-semibold text-white">
                {workspace?.workspace_name || "My Workspace"}
              </p>

              <p className="mt-1 text-[9px] text-white/80">
                Workspace overview
              </p>

              <div className="mt-3 grid grid-cols-2 gap-2">
                {[
                  { label: "Boards", value: workspace?.projects ?? boards.length },
                  { label: "Tasks", value: workspace?.tasks ?? 0 },
                  { label: "Members", value: workspace?.members ?? 0 },
                ].map((item) => (
                  <div
                    key={item.label}
                    className="rounded-md bg-[#173F35] p-2"
                  >
                    <p className="text-[9px] text-white/80">
                      {item.label}
                    </p>
                    <p className="mt-1 text-sm font-semibold text-white">
                      {item.value}
                    </p>
                  </div>
                ))}
              </div>

              <p className="mt-3 text-[9px] text-white/80">
                Workspace switching is not available yet.
              </p>
            </div>
          )}
        </div>

        <section className="mt-7 px-[10px] text-white">
          {!collapsed && (
            <p className="mb-3 px-[10px] text-[8px] font-medium uppercase tracking-wider text-white/80">
              Workspace
            </p>
          )}

          <SidebarNav collapsed={collapsed} />
        </section>

        <section className="mt-7 px-[10px] text-white">
          <div
            className={[
              "mb-3 flex items-center",
              collapsed ? "justify-center" : "justify-between px-[10px]",
            ].join(" ")}
          >
            {!collapsed && (
              <p className="text-[11px] font-medium uppercase tracking-wider text-white">
                Favorites
              </p>
            )}

            <Star
              size={13}
              className="text-[#DCEBC0]"
              aria-hidden="true"
            />
          </div>

          {!collapsed && (
            <ul className="space-y-1">
              {loadingBoards ? (
                <li className="flex justify-center py-3">
                  <Loader2
                    size={14}
                    className="animate-spin text-white"
                  />
                </li>
              ) : favoriteBoards.length === 0 ? (
                <li>
                  <p className="px-[10px] text-[10px] leading-relaxed text-white/80">
                    Star a board to pin it here.
                  </p>
                </li>
              ) : (
                favoriteBoards.map((board) => (
                  <li
                    key={board.id}
                    className="group flex items-center justify-between rounded-md px-[10px] py-2 text-white transition-colors hover:bg-[#285346] hover:text-white"
                  >
                    <Link
                      href={`/boards/${board.id}`}
                      title={board.name}
                      className="flex min-w-0 flex-1 items-center gap-2 text-white"
                    >
                      <Grid2X2 size={13} className="shrink-0 text-white" />
                      <span className="truncate text-[10px] text-white">
                        {board.name}
                      </span>
                    </Link>

                    <button
                      type="button"
                      onClick={() => void handleToggleFavorite(board)}
                      disabled={updatingFavorites.includes(board.id)}
                      aria-label="Remove from favorites"
                      title="Remove from favorites"
                      className="shrink-0 cursor-pointer text-[#DCEBC0] transition-colors hover:text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {updatingFavorites.includes(board.id) ? (
                        <Loader2 size={12} className="animate-spin" />
                      ) : (
                        <Star size={12} fill="currentColor" />
                      )}
                    </button>
                  </li>
                ))
              )}
            </ul>
          )}
        </section>

        <section className="mt-7 flex-1 overflow-y-auto px-[10px] text-white">
          <div
            className={[
              "mb-3 flex items-center",
              collapsed ? "justify-center" : "justify-between px-[10px]",
            ].join(" ")}
          >
            {!collapsed && (
              <p className="text-[11px] font-medium uppercase tracking-wider text-white">
                Projects
              </p>
            )}

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              aria-label="Create board"
              title="Create board"
              className="cursor-pointer rounded p-0.5 text-white transition-colors hover:bg-[#285346] hover:text-white"
            >
              <Plus size={15} />
            </button>
          </div>

          {collapsed ? (
            <div className="flex flex-col items-center gap-3">
              {boards.map((board) => (
                <Link
                  key={board.id}
                  href={`/boards/${board.id}`}
                  title={board.name}
                  aria-label={board.name}
                  className="rounded-md p-1.5 text-white transition-colors hover:bg-[#285346] hover:text-white"
                >
                  <Grid2X2 size={14} />
                </Link>
              ))}
            </div>
          ) : loadingBoards ? (
            <div className="flex justify-center py-3">
              <Loader2
                size={14}
                className="animate-spin text-white"
              />
            </div>
          ) : boards.length === 0 ? (
            <p className="px-[10px] text-[9px] leading-relaxed text-white/80">
              No boards yet. Click + to create one.
            </p>
          ) : (
            <ul className="space-y-1">
              {boards.map((board) => (
                <li
                  key={board.id}
                  className="group flex items-center justify-between rounded-md px-[10px] py-2 text-[11px] text-white transition-colors hover:bg-[#285346] hover:text-white"
                >
                  <Link
                    href={`/boards/${board.id}`}
                    title={board.name}
                    className="flex min-w-0 flex-1 items-center gap-2 text-white"
                  >
                    <Grid2X2 size={13} className="shrink-0 text-white" />
                    <span className="truncate text-white">{board.name}</span>
                  </Link>

                  <button
                    type="button"
                    onClick={() => void handleToggleFavorite(board)}
                    disabled={updatingFavorites.includes(board.id)}
                    aria-label={
                      board.is_favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                    title={
                      board.is_favorite
                        ? "Remove from favorites"
                        : "Add to favorites"
                    }
                    className={[
                      "ml-1 shrink-0 cursor-pointer transition-colors disabled:cursor-not-allowed disabled:opacity-50",
                      board.is_favorite
                        ? "text-[#DCEBC0] hover:text-white"
                        : "text-white/80 opacity-0 group-hover:opacity-100 hover:text-white",
                    ].join(" ")}
                  >
                    {updatingFavorites.includes(board.id) ? (
                      <Loader2 size={12} className="animate-spin" />
                    ) : (
                      <Star
                        size={12}
                        fill={board.is_favorite ? "currentColor" : "none"}
                      />
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {currentUser && (
          <div className="mt-auto border-t border-[#31594C] px-3 py-4 text-white">
            <div
              className={[
                "flex w-full items-center gap-2",
                collapsed ? "justify-center" : "justify-between",
              ].join(" ")}
            >
              {!collapsed && (
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[11px] font-medium text-white">
                    {currentUser.name || "User"}
                  </p>
                  <p className="mt-1 truncate text-[9px] text-white/80">
                    {currentUser.email || ""}
                  </p>
                </div>
              )}

              <ActionMenu
                label={`User menu for ${currentUser.name || "User"}`}
                items={userMenuItems}
                symbolNode={<UserRound size={15} strokeWidth={1.8} />}
                triggerClassName="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-lg text-white transition-colors hover:bg-[#285346] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DCEBC0]"
              />
            </div>
          </div>
        )}
      </aside>

      {createOpen && (
        <div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-[#162B22]/45 p-4 backdrop-blur-xs"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) {
              setCreateOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="create-board-title"
            className="max-h-[90dvh] w-full max-w-sm overflow-y-auto rounded-2xl border border-[#D5DDD0] bg-[#FAF9F6] text-[#1A2E26] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#DCE5CC] bg-[#EBF0E2] px-5 py-3.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
                  Projects
                </p>
                <h2
                  id="create-board-title"
                  className="font-serif text-lg italic text-[#162B22]"
                >
                  Create a board
                </h2>
              </div>

              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                disabled={creating}
                aria-label="Close dialog"
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#4E6356] transition-colors hover:bg-[#DCE5CC] hover:text-[#162B22] disabled:cursor-not-allowed disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateBoard} className="p-5">
              <label
                htmlFor="board-name"
                className="mb-1.5 block text-xs font-medium text-[#173B30]"
              >
                Board name
              </label>

              <input
                id="board-name"
                type="text"
                value={boardName}
                onChange={(event) => setBoardName(event.target.value)}
                placeholder="Enter board name"
                maxLength={100}
                autoFocus
                required
                disabled={creating}
                className="h-9 w-full rounded-lg border border-[#D5DDD0] bg-[#F4F6EE] px-3 text-xs text-[#173B30] placeholder:text-[#7B8B81] outline-none transition-colors focus:border-[#16382C] focus:bg-white disabled:opacity-50"
              />

              <div className="mt-5 flex justify-end gap-2 border-t border-[#E6E8E3] pt-3.5">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  disabled={creating}
                  className="inline-flex h-8.5 cursor-pointer items-center rounded-lg border border-[#D5DDD0] bg-white px-3.5 text-xs font-medium text-[#4E6356] transition-colors hover:bg-[#F4F6EE] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating || !boardName.trim()}
                  className="inline-flex h-8.5 cursor-pointer items-center gap-2 rounded-lg bg-[#16382C] px-4 text-xs font-medium text-white transition-colors hover:bg-[#1E4A3A] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {creating && (
                    <Loader2 size={13} className="animate-spin" />
                  )}
                  Create board
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}
