"use client";
import { type ReactNode, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

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
export function ActionMenu({
  label,
  items,
  symbol = "\u2026",
  symbolNode,
  triggerClassName = "",
}: ActionMenuProps) {
  const menuId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState<React.CSSProperties>({});

  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 4,
        right: document.documentElement.clientWidth - rect.right,
        maxHeight: Math.max(window.innerHeight - rect.bottom - 8, 0),
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

  function closeAndRestoreFocus() {
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
      closeAndRestoreFocus();
    } else if (event.key === "Tab") {
      setOpen(false);
      triggerRef.current?.focus();
    }
  }

  const menuDropdown =
    open && typeof document !== "undefined"
      ? createPortal(
          <div
            id={menuId}
            ref={menuRef}
            role="menu"
            aria-label={label}
            onKeyDown={handleMenuKeyDown}
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => e.stopPropagation()}
            style={position}
            className="fixed z-50 flex min-w-44 flex-col gap-0.5 overflow-y-auto rounded-xl border border-[#D5DDD0] bg-[#FAF9F6] p-1.5 text-[#1A2E26] shadow-[var(--shadow-drag)]"
          >
            {items.map((item) => {
              const isCheckedRadio =
                item.role === "menuitemradio" && Boolean(item.checked);

              return (
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
                  onClick={(e) => {
                    e.stopPropagation();
                    setOpen(false);
                    item.onSelect();
                  }}
                  className={[
                    "cursor-pointer rounded-lg px-3 py-1.5 text-left text-xs font-medium transition-colors duration-150 focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AA995] disabled:cursor-not-allowed disabled:opacity-50",
                    isCheckedRadio
                      ? "bg-[#DCE5CC] text-[#16382C] hover:bg-[#CFDAB9]"
                      : "text-[#1A2E26] hover:bg-[#EBF0E2] hover:text-[#16382C]",
                  ].join(" ")}
                >
                  {item.label}
                </button>
              );
            })}
          </div>,
          document.body,
        )
      : null;

  return (
    <div className="relative shrink-0">
      <button
        ref={triggerRef}
        type="button"
        aria-label={label}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onKeyDown={handleTriggerKeyDown}
        className={[
          "flex cursor-pointer items-center justify-center rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[#EBF0E2] hover:text-[#16382C] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#8AA995] focus-visible:ring-offset-2",
          triggerClassName || "h-9 w-9",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span aria-hidden="true">{symbolNode ?? symbol}</span>
      </button>
      {menuDropdown}
    </div>
  );
}