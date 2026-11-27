"use client";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";

export interface ActionMenuItem {
  id: string;
  label: string;
  /** "menuitemradio" items expose `checked` through aria-checked. Default "menuitem". */
  role?: "menuitem" | "menuitemradio";
  checked?: boolean;
  disabled?: boolean;
  /** Exposed as `data-value` so the item can be styled or located later. */
  value?: string;
  onSelect: () => void;
}

export interface ActionMenuProps {
  /** Accessible name of the trigger button. */
  label: string;
  items: ActionMenuItem[];
  /**
   * Content rendered inside the trigger button's visible span.
   * Defaults to the horizontal ellipsis "…".
   */
  symbol?: string;
  /**
   * Optional ReactNode to render instead of `symbol`. When provided, `symbol`
   * is ignored. Used to pass a lucide icon into the trigger.
   */
  symbolNode?: ReactNode;
  /**
   * Extra class names appended to the trigger button's class list.
   * Use to override shape or spacing (e.g. `rounded-l-none`).
   */
  triggerClassName?: string;
}

/**
 * Small accessible "..." menu. Enter, Space and ArrowDown open it and focus the
 * first enabled item; arrows move, Escape and outside click close, Tab closes
 * and returns focus to the trigger.
 */
export function ActionMenu({ label, items, symbol = "\u2026", symbolNode, triggerClassName = "" }: ActionMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<React.CSSProperties>({});
  // The menu is fixed to the viewport, anchored under the trigger. An absolute
  // menu was clipped by the board's scrolling column list (overflow-x-auto also
  // clips vertically), so lower items could not be clicked on short columns.
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom,
        right: document.documentElement.clientWidth - rect.right,
        maxHeight: Math.max(window.innerHeight - rect.bottom, 0),
      });
    }
    place();
    window.addEventListener("scroll", place, true);
    window.addEventListener("resize", place);
    return () => {
      window.removeEventListener("scroll", place, true);
      window.removeEventListener("resize", place);
    };
  }, [open]);

  function enabledItems(): HTMLButtonElement[] {
    return Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        "button:not(:disabled)",
      ) ?? [],
    );
  }

  useEffect(() => {
    if (open) enabledItems()[0]?.focus();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function handleOutside(event: MouseEvent) {
      const target = event.target as Node;
      if (
        !menuRef.current?.contains(target) &&
        !triggerRef.current?.contains(target)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleTriggerKeyDown(event: React.KeyboardEvent<HTMLButtonElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
    }
  }

  function handleMenuKeyDown(event: React.KeyboardEvent<HTMLDivElement>) {
    const enabled = enabledItems();
    const current = enabled.indexOf(
      document.activeElement as HTMLButtonElement,
    );
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      if (enabled.length === 0) return;
      const step = event.key === "ArrowDown" ? 1 : -1;
      enabled[(current + step + enabled.length) % enabled.length].focus();
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      enabled[event.key === "Home" ? 0 : enabled.length - 1]?.focus();
    } else if (event.key === "Escape") {
      event.preventDefault();
      event.stopPropagation();
      close();
    } else if (event.key === "Tab") {
      // Focus the trigger first so the browser's Tab moves on from it.
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={() => setOpen((v) => !v)}
        onKeyDown={handleTriggerKeyDown}
        className={[
          "flex items-center justify-center rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2",
          triggerClassName || "h-9 w-9",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span aria-hidden="true">{symbolNode ?? symbol}</span>
      </button>
      {open && (
        <div
          id={menuId}
          ref={menuRef}
          role="menu"
          aria-label={label}
          onKeyDown={handleMenuKeyDown}
          style={position}
          className="fixed z-10 flex min-w-40 flex-col overflow-y-auto rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] p-1 shadow-[var(--shadow-drag)]"
        >
          {items.map((item) => (
            <button
              key={item.id}
              type="button"
              role={item.role ?? "menuitem"}
              aria-checked={
                item.role === "menuitemradio"
                  ? Boolean(item.checked)
                  : undefined
              }
              data-value={item.value}
              disabled={item.disabled}
              tabIndex={-1}
              onClick={() => {
                close();
                item.onSelect();
              }}
              className="rounded px-3 py-1.5 text-left text-sm text-[var(--text-primary)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
