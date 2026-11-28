"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  CheckSquare,
  ChevronRight,
  FileText,
  Grid2X2,
  Inbox,
  KanbanSquare,
  Loader2,
  Search,
  X,
} from "lucide-react";
import {
  useWorkspaceSearch,
  type SearchResult,
} from "@/hooks/useWorkspaceSearch";
import { NotificationBell } from "@/components/shared/NotificationBell";

const GROUPS = [
  { type: "board", label: "Boards", icon: KanbanSquare },
  { type: "task", label: "Tasks", icon: CheckSquare },
  { type: "note", label: "Notes", icon: FileText },
  { type: "inbox", label: "Inbox", icon: Inbox },
] as const;

interface PageHeaderProps {
  title?: string;
  description?: string;
  icon?: ReactNode;
  parent?: {
    label: string;
    href: string;
  };
}

export function PageHeader({
  title,
  description,
  icon,
  parent = { label: "Boards", href: "/" },
}: PageHeaderProps = {}) {
  const router = useRouter();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { results, loading, prime } = useWorkspaceSearch(search);

  // Same order as the rendered groups, so keyboard navigation matches the screen.
  const ordered = useMemo(
    () => GROUPS.flatMap((g) => results.filter((r) => r.type === g.type)),
    [results],
  );
  const active = Math.min(activeIndex, Math.max(ordered.length - 1, 0));
  const activeItem = ordered[active];

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setMobileSearchOpen(true);
        setOpen(true);
        prime();
        requestAnimationFrame(() => {
          inputRef.current?.focus();
        });
      }
    };
    const onPointerDown = (e: PointerEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
        setMobileSearchOpen(false);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [prime]);

  const scrollOptionIntoView = (index: number) => {
    const target = ordered[index];
    if (!target) return;
    requestAnimationFrame(() => {
      document
        .getElementById(`search-option-${target.type}-${target.id}`)
        ?.scrollIntoView({ block: "nearest" });
    });
  };

  const goTo = (item: SearchResult) => {
    setOpen(false);
    setMobileSearchOpen(false);
    setSearch("");
    setActiveIndex(0);
    inputRef.current?.blur();
    router.push(item.href);
  };

  const openMobileSearch = () => {
    setMobileSearchOpen(true);
    setOpen(true);
    prime();
    requestAnimationFrame(() => {
      inputRef.current?.focus();
    });
  };

  const closeMobileSearch = () => {
    setMobileSearchOpen(false);
    setOpen(false);
  };

  const onInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Escape") {
      setOpen(false);
      setMobileSearchOpen(false);
      inputRef.current?.blur();
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      if (!open && search.trim()) setOpen(true);
      const next = Math.min(active + 1, ordered.length - 1);
      setActiveIndex(next);
      scrollOptionIntoView(next);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (!open && search.trim()) setOpen(true);
      const next = Math.max(active - 1, 0);
      setActiveIndex(next);
      scrollOptionIntoView(next);
    } else if (e.key === "Enter" && activeItem) {
      e.preventDefault();
      goTo(activeItem);
    }
  };

  const showPanel = open && search.trim().length > 0;

  return (
    <header className="flex h-12 shrink-0 items-center justify-between gap-2 border-b border-[#E9E8E1] bg-[#FAF9F6] px-4 sm:gap-3 sm:px-5">
      <div
        className={`${
          mobileSearchOpen ? "hidden sm:flex" : "flex"
        } min-w-0 items-center gap-1.5 text-xs text-[#7C8178] sm:gap-2.5 sm:text-[11px]`}
      >
        <Grid2X2 size={14} className="shrink-0 text-[#24483D] sm:text-[#7C8178]" />
        <span className="hidden shrink-0 sm:inline">Workspace</span>
        <ChevronRight size={12} className="hidden shrink-0 sm:inline" />
        <Link
          href={parent.href}
          className={`shrink-0 transition hover:opacity-75 ${
            title ? "text-[#7C8178]" : "font-medium text-[#24483D]"
          }`}
        >
          {parent.label}
        </Link>
        {title && (
          <>
            <ChevronRight size={12} className="shrink-0" />
            <span
              title={description}
              className="flex min-w-0 items-center gap-1.5 font-medium text-[#24483D]"
            >
              {icon && <span className="shrink-0">{icon}</span>}
              <span className="truncate">{title}</span>
            </span>
          </>
        )}
      </div>

      <div
        className={`flex items-center gap-2 sm:gap-4 ${
          mobileSearchOpen ? "w-full sm:w-auto" : ""
        }`}
      >
        <div
          ref={containerRef}
          className={`relative ${
            mobileSearchOpen ? "block w-full sm:w-auto" : "hidden sm:block"
          }`}
        >
          <label className="flex h-8 w-full items-center gap-2 rounded-md bg-[#F0F0EA] px-2.5 sm:h-7 sm:w-56">
            <Search size={14} className="shrink-0 text-[#7C8178] sm:h-[13px] sm:w-[13px]" />
            <input
              ref={inputRef}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setActiveIndex(0);
                setOpen(true);
              }}
              onFocus={() => {
                setOpen(true);
                prime();
              }}
              onKeyDown={onInputKeyDown}
              placeholder="Search your workspace"
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showPanel}
              aria-controls="workspace-search-results"
              aria-activedescendant={
                showPanel && activeItem
                  ? `search-option-${activeItem.type}-${activeItem.id}`
                  : undefined
              }
              className="w-full bg-transparent text-base text-[#24483D] outline-none placeholder:text-[#92968D] sm:text-[11px]"
            />
            {loading ? (
              <Loader2
                size={13}
                className="shrink-0 animate-spin text-[#7C8178]"
              />
            ) : (
              <kbd className="hidden shrink-0 rounded border border-[#E1E0D8] px-1 text-[9px] text-[#92968D] sm:inline">
                Ctrl+K
              </kbd>
            )}
            {mobileSearchOpen && (
              <button
                type="button"
                onClick={closeMobileSearch}
                aria-label="Close search"
                className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-[#7C8178] transition-colors hover:bg-[#E4E3DB] hover:text-[#24483D] sm:hidden"
              >
                <X size={14} />
              </button>
            )}
          </label>

          {showPanel && (
            <div
              id="workspace-search-results"
              role="listbox"
              className="absolute right-0 top-10 z-50 max-h-[65dvh] w-full overflow-y-auto rounded-lg border border-[#E9E8E1] bg-white p-1.5 shadow-lg sm:top-9 sm:max-h-96 sm:w-80"
            >
              {ordered.length === 0 && (
                <p className="px-3 py-6 text-center text-xs text-[#7C8178] sm:text-[11px]">
                  {loading
                    ? "Searching…"
                    : `No results for “${search.trim()}”`}
                </p>
              )}

              {GROUPS.map(({ type, label, icon: Icon }) => {
                const items = results.filter((r) => r.type === type);
                if (items.length === 0) return null;

                return (
                  <div key={type} className="mb-1 last:mb-0">
                    <p className="px-2 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[#92968D] sm:text-[9px]">
                      {label}
                    </p>
                    {items.map((item) => {
                      const index = ordered.indexOf(item);
                      const isActive = index === active;
                      return (
                        <button
                          key={`${item.type}-${item.id}`}
                          id={`search-option-${item.type}-${item.id}`}
                          type="button"
                          role="option"
                          aria-selected={isActive}
                          onMouseEnter={() => setActiveIndex(index)}
                          onClick={() => goTo(item)}
                          className={`flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-2 text-left sm:px-2 sm:py-1.5 ${
                            isActive ? "bg-[#F0F0EA]" : ""
                          }`}
                        >
                          <Icon size={14} className="shrink-0 text-[#24483D] sm:h-[13px] sm:w-[13px]" />
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs text-[#24483D] sm:text-[11px]">
                              {item.title}
                            </span>
                            {item.subtitle && (
                              <span className="block truncate text-[10px] text-[#7C8178] sm:text-[9px]">
                                {item.subtitle}
                              </span>
                            )}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {!mobileSearchOpen && (
          <button
            type="button"
            onClick={openMobileSearch}
            aria-label="Search workspace"
            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-md text-[#24483D] transition-colors hover:bg-[#F0F0EA] sm:hidden"
          >
            <Search size={16} />
          </button>
        )}

        <div className={mobileSearchOpen ? "hidden sm:block" : ""}>
          <NotificationBell />
        </div>
      </div>
    </header>
  );
}