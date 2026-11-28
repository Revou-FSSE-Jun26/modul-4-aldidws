"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  House,
  ListChecks,
  Inbox,
  ChartNoAxesColumnIncreasing,
  LayoutGrid,
  FileText,
  UserRound,
  Plus,
  Grid2X2,
  Star,
  LogOut,
  X,
  Loader2,
} from "lucide-react";
import toast from "react-hot-toast";

import { useAuth } from "@/context/AuthContext";
import {
  listBoards,
  createBoard,
  setFavorite,
} from "@/lib/services/boardsService";
import type { Board } from "@/lib/types/api";

const PRIMARY_TABS = [
  {
    label: "Boards",
    href: "/",
    icon: House,
  },
  {
    label: "My Tasks",
    href: "/my-tasks",
    icon: ListChecks,
  },
  {
    label: "Inbox",
    href: "/inbox",
    icon: Inbox,
  },
  {
    label: "Reports",
    href: "/reports",
    icon: ChartNoAxesColumnIncreasing,
  },
] as const;

function isTabActive(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function MobileBottomNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { currentUser, token, logout } = useAuth();

  const [moreOpen, setMoreOpen] = useState(false);
  const [boards, setBoards] = useState<Board[]>([]);
  const [loadingBoards, setLoadingBoards] = useState(false);
  const [updatingFavorites, setUpdatingFavorites] = useState<string[]>([]);

  const [createOpen, setCreateOpen] = useState(false);
  const [boardName, setBoardName] = useState("");
  const [creating, setCreating] = useState(false);

  // Tutup sheet otomatis saat berpindah halaman
  useEffect(() => {
    setMoreOpen(false);
  }, [pathname]);

  // Tutup dengan tombol Escape
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        if (createOpen && !creating) {
          setCreateOpen(false);
        } else if (moreOpen) {
          setMoreOpen(false);
        }
      }
    }
    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [moreOpen, createOpen, creating]);

  const handleUnauthorized = useCallback(() => {
    void logout();
    router.replace("/login");
  }, [logout, router]);

  useEffect(() => {
    if (!token) {
      setBoards([]);
      return;
    }

    let cancelled = false;

    async function loadBoards() {
      setLoadingBoards(true);
      try {
        const data = await listBoards(token!, {
          on401: handleUnauthorized,
        } as never);
        if (!cancelled) setBoards(data);
      } catch {
        // Abaikan error silent di nav bawah
      } finally {
        if (!cancelled) setLoadingBoards(false);
      }
    }

    void loadBoards();
    return () => {
      cancelled = true;
    };
  }, [token, handleUnauthorized]);

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
      setBoards((prev) => [...prev, newBoard]);
      setBoardName("");
      setCreateOpen(false);
      setMoreOpen(false);
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
    setUpdatingFavorites((prev) => [...prev, board.id]);

    try {
      const updated = await setFavorite(token, board.id, nextFavorite);
      setBoards((prev) =>
        prev.map((item) => (item.id === board.id ? updated : item)),
      );
      toast.success(
        nextFavorite ? "Added to favorites." : "Removed from favorites.",
      );
    } catch {
      toast.error("Unable to update favorite.");
    } finally {
      setUpdatingFavorites((prev) => prev.filter((id) => id !== board.id));
    }
  }

  async function handleSignOut() {
    try {
      await logout();
      setMoreOpen(false);
      toast.success("Signed out successfully.");
      router.replace("/login");
    } catch {
      toast.error("Unable to sign out.");
    }
  }

  const isSecondaryRouteActive =
    pathname.startsWith("/notes") ||
    pathname.startsWith("/profile") ||
    pathname.startsWith("/boards/");

  const favoriteBoards = boards.filter((b) => b.is_favorite);

  return (
    <>
      {/* Bottom Navigation Bar (< md) */}
      <nav
        aria-label="Mobile navigation"
        className="fixed inset-x-0 bottom-0 z-40 border-t border-[#31594C] bg-[#173F35] px-2 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))] text-white shadow-[0_-4px_16px_rgba(22,43,34,0.12)] md:hidden"
      >
        <ul role="list" className="grid grid-cols-5 items-center gap-1">
          {PRIMARY_TABS.map((tab) => {
            const Icon = tab.icon;
            const active = !moreOpen && isTabActive(pathname, tab.href);

            return (
              <li key={tab.href}>
                <Link
                  href={tab.href}
                  aria-current={active ? "page" : undefined}
                  className={[
                    "flex min-h-[48px] flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors",
                    active
                      ? "bg-white font-semibold text-[#173F35] shadow-xs"
                      : "text-white/85 hover:bg-[#285346] hover:text-white",
                  ].join(" ")}
                >
                  <Icon
                    size={18}
                    strokeWidth={active ? 2 : 1.65}
                    aria-hidden="true"
                  />
                  <span className="truncate text-[10px] leading-none">
                    {tab.label}
                  </span>
                </Link>
              </li>
            );
          })}

          {/* Tombol More untuk Notes, Profile, Projects, & Sign out */}
          <li>
            <button
              type="button"
              onClick={() => setMoreOpen((prev) => !prev)}
              aria-expanded={moreOpen}
              aria-label="More menu"
              className={[
                "flex min-h-[48px] w-full cursor-pointer flex-col items-center justify-center gap-1 rounded-xl px-1 py-1.5 transition-colors",
                moreOpen || isSecondaryRouteActive
                  ? "bg-white font-semibold text-[#173F35] shadow-xs"
                  : "text-white/85 hover:bg-[#285346] hover:text-white",
              ].join(" ")}
            >
              <LayoutGrid
                size={18}
                strokeWidth={moreOpen || isSecondaryRouteActive ? 2 : 1.65}
                aria-hidden="true"
              />
              <span className="truncate text-[10px] leading-none">More</span>
            </button>
          </li>
        </ul>
      </nav>

      {/* Bottom Sheet Drawer saat tombol "More" ditekan */}
      {moreOpen && (
        <div
          className="fixed inset-0 z-50 flex flex-col justify-end bg-[#162B22]/50 backdrop-blur-[1px] md:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) {
              setMoreOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Workspace menu"
            className="max-h-[82dvh] w-full overflow-y-auto rounded-t-3xl border-t border-[#31594C] bg-[#173F35] px-5 pt-3 pb-[calc(1.25rem+env(safe-area-inset-bottom))] text-white shadow-2xl"
          >
            {/* Drag handle visual */}
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-white/25" />

            {/* Header Sheet */}
            <div className="flex items-center justify-between border-b border-[#31594C] pb-3.5">
              <div>
                <p className="text-base font-semibold tracking-tight text-white">
                  RevoTask
                </p>
                <p className="text-[11px] text-white/75">
                  A little order. A lot of possibility.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setMoreOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg bg-[#285346] text-white transition-colors hover:bg-[#315F50]"
              >
                <X size={16} />
              </button>
            </div>

            {/* Menu Tambahan: Notes & Profile */}
            <div className="mt-4">
              <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                Menu
              </p>
              <div className="grid grid-cols-2 gap-2.5">
                {[
                  { label: "Notes", href: "/notes", icon: FileText },
                  { label: "Profile", href: "/profile", icon: UserRound },
                ].map((item) => {
                  const Icon = item.icon;
                  const active = isTabActive(pathname, item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMoreOpen(false)}
                      className={[
                        "flex items-center gap-2.5 rounded-xl px-3.5 py-3 text-xs font-medium transition-colors",
                        active
                          ? "bg-white text-[#173F35]"
                          : "bg-[#285346] text-white hover:bg-[#315F50]",
                      ].join(" ")}
                    >
                      <Icon size={16} strokeWidth={1.75} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            {/* Favorites (jika ada) */}
            {favoriteBoards.length > 0 && (
              <div className="mt-5">
                <p className="mb-2 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  <Star size={11} className="text-[#DCEBC0]" fill="currentColor" />
                  <span>Favorites</span>
                </p>
                <div className="space-y-1.5">
                  {favoriteBoards.map((board) => (
                    <Link
                      key={board.id}
                      href={`/boards/${board.id}`}
                      onClick={() => setMoreOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl bg-[#214B3E] px-3.5 py-2.5 text-xs text-white transition-colors hover:bg-[#285346]"
                    >
                      <Grid2X2 size={14} className="shrink-0 text-[#DCEBC0]" />
                      <span className="truncate">{board.name}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}

            {/* Projects / Boards */}
            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-white/70">
                  Projects
                </p>
                <button
                  type="button"
                  onClick={() => setCreateOpen(true)}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-lg bg-[#DCE5CC] px-2.5 py-1 text-[11px] font-semibold text-[#173F35] transition-colors hover:bg-white"
                >
                  <Plus size={13} />
                  <span>New board</span>
                </button>
              </div>

              {loadingBoards ? (
                <div className="flex justify-center py-4">
                  <Loader2 size={16} className="animate-spin text-white/80" />
                </div>
              ) : boards.length === 0 ? (
                <p className="rounded-xl bg-[#214B3E] px-3.5 py-3 text-xs text-white/75">
                  No boards yet. Tap &ldquo;New board&rdquo; to create one.
                </p>
              ) : (
                <div className="space-y-1.5">
                  {boards.map((board) => {
                    const active = pathname === `/boards/${board.id}`;
                    return (
                      <div
                        key={board.id}
                        className={[
                          "flex items-center justify-between rounded-xl px-3.5 py-2.5 text-xs transition-colors",
                          active
                            ? "bg-white font-medium text-[#173F35]"
                            : "bg-[#214B3E] text-white hover:bg-[#285346]",
                        ].join(" ")}
                      >
                        <Link
                          href={`/boards/${board.id}`}
                          onClick={() => setMoreOpen(false)}
                          className="flex min-w-0 flex-1 items-center gap-2.5"
                        >
                          <Grid2X2 size={14} className="shrink-0" />
                          <span className="truncate">{board.name}</span>
                        </Link>

                        <button
                          type="button"
                          onClick={() => void handleToggleFavorite(board)}
                          disabled={updatingFavorites.includes(board.id)}
                          aria-label={
                            board.is_favorite
                              ? `Remove ${board.name} from favorites`
                              : `Add ${board.name} to favorites`
                          }
                          className={[
                            "ml-2 shrink-0 cursor-pointer p-1 transition-colors disabled:opacity-50",
                            board.is_favorite
                              ? active
                                ? "text-[#173F35]"
                                : "text-[#DCEBC0]"
                              : active
                                ? "text-[#173F35]/50"
                                : "text-white/60",
                          ].join(" ")}
                        >
                          {updatingFavorites.includes(board.id) ? (
                            <Loader2 size={13} className="animate-spin" />
                          ) : (
                            <Star
                              size={13}
                              fill={board.is_favorite ? "currentColor" : "none"}
                            />
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* User Profile & Sign Out */}
            <div className="mt-5 flex items-center justify-between border-t border-[#31594C] pt-4">
              <Link
                href="/profile"
                onClick={() => setMoreOpen(false)}
                className="min-w-0 flex-1"
              >
                <p className="truncate text-xs font-semibold text-white">
                  {currentUser?.name || "User"}
                </p>
                <p className="truncate text-[11px] text-white/75">
                  {currentUser?.email || ""}
                </p>
              </Link>

              <button
                type="button"
                onClick={() => void handleSignOut()}
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-[#285346] px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-red-500/20 hover:text-red-200"
              >
                <LogOut size={14} />
                <span>Sign out</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal Create Board di Mobile */}
      {createOpen && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-[#162B22]/55 p-4 backdrop-blur-xs md:hidden"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget && !creating) {
              setCreateOpen(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="mobile-create-board-title"
            className="w-full max-w-sm overflow-hidden rounded-2xl border border-[#D5DDD0] bg-[#FAF9F6] text-[#1A2E26] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#DCE5CC] bg-[#EBF0E2] px-5 py-3.5">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[#4E6356]">
                  Projects
                </p>
                <h2
                  id="mobile-create-board-title"
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
                className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-lg text-[#4E6356] transition-colors hover:bg-[#DCE5CC] hover:text-[#162B22] disabled:opacity-50"
              >
                <X size={15} />
              </button>
            </div>

            <form onSubmit={handleCreateBoard} className="p-5">
              <label
                htmlFor="mobile-board-name"
                className="mb-1.5 block text-xs font-medium text-[#173B30]"
              >
                Board name
              </label>

              <input
                id="mobile-board-name"
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
                  className="inline-flex h-8.5 cursor-pointer items-center rounded-lg border border-[#D5DDD0] bg-white px-3.5 text-xs font-medium text-[#4E6356] transition-colors hover:bg-[#F4F6EE] disabled:opacity-50"
                >
                  Cancel
                </button>

                <button
                  type="submit"
                  disabled={creating || !boardName.trim()}
                  className="inline-flex h-8.5 cursor-pointer items-center gap-2 rounded-lg bg-[#16382C] px-4 text-xs font-medium text-white transition-colors hover:bg-[#1E4A3A] disabled:opacity-50"
                >
                  {creating && <Loader2 size={13} className="animate-spin" />}
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