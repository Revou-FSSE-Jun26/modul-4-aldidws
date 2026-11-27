"use client";

import {
  useEffect,
  useId,
  useLayoutEffect,
  useRef,
  useState,
  type KeyboardEvent,
} from "react";import { Check, Palette } from "lucide-react";
import { BOARD_BACKGROUNDS, type BoardBgId } from "@/lib/board-backgrounds";

interface BackgroundPickerProps {
  /** Currently selected background ID. */
  value: BoardBgId;
  /** Called when the user selects a background. */
  onChange: (id: BoardBgId) => void;
}

/**
 * A "Change background" palette button + popover (desktop) / bottom sheet (mobile).
 *
 * Keyboard:
 *  - ArrowRight / ArrowLeft / ArrowDown / ArrowUp navigate swatches.
 *  - Space / Enter select the focused swatch.
 *  - Escape closes the picker and returns focus to the trigger.
 *
 * Accessibility:
 *  - role="radiogroup" on the grid; each swatch is role="radio" with aria-checked.
 *  - Roving tabindex: only the selected (or first) swatch is in the tab order
 *    when the picker is open.
 */
export function BackgroundPicker({ value, onChange }: BackgroundPickerProps) {
  const pickerId = useId();
  const [open, setOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const swatchRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const [position, setPosition] = useState<React.CSSProperties>({});

  // Position the desktop popover anchored below the trigger.
  // (On mobile the .bg-picker-popover media query overrides this into a
  // bottom sheet, so positioning is irrelevant there.)
  useLayoutEffect(() => {
    if (!open) return;
    function place() {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      setPosition({
        top: rect.bottom + 4,
        right: document.documentElement.clientWidth - rect.right,
        maxHeight: Math.max(window.innerHeight - rect.bottom - 8, 120),
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

  // Focus the selected (or first) swatch after open.
  useEffect(() => {
    if (!open) return;
    const selectedIdx = BOARD_BACKGROUNDS.findIndex((bg) => bg.id === value);
    swatchRefs.current[selectedIdx >= 0 ? selectedIdx : 0]?.focus();
  }, [open, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function handleOutside(e: MouseEvent) {
      const t = e.target as Node;
      if (!panelRef.current?.contains(t) && !triggerRef.current?.contains(t)) {
        close();
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [open]);

  function close() {
    setOpen(false);
    triggerRef.current?.focus();
  }

  function handleSwatchKeyDown(e: KeyboardEvent<HTMLButtonElement>, idx: number) {
    const cols = 3;
    const total = BOARD_BACKGROUNDS.length;
    let next = idx;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      next = (idx + 1) % total;
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      next = (idx - 1 + total) % total;
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      next = Math.min(idx + cols, total - 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      next = Math.max(idx - cols, 0);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      close();
      return;
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      onChange(BOARD_BACKGROUNDS[idx].id);
      return;
    } else {
      return;
    }
    swatchRefs.current[next]?.focus();
  }

  const panelContent = (
    <div
      id={pickerId}
      ref={panelRef}
      role="dialog"
      aria-label="Change background"
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.preventDefault();
          e.stopPropagation();
          close();
        }
      }}
      className="w-[260px] max-w-full rounded-[12px] border border-[var(--border)] bg-[var(--bg-panel)] p-3 shadow-[var(--shadow-drag)]"
    >
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
        Background
      </p>
      <div
        role="radiogroup"
        aria-label="Board background"
        className="grid grid-cols-3 gap-2"
      >
        {BOARD_BACKGROUNDS.map((bg, idx) => {
          const isSelected = bg.id === value;
          return (
            <button
              key={bg.id}
              ref={(el) => {
                swatchRefs.current[idx] = el;
              }}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={bg.name}
              tabIndex={isSelected ? 0 : -1}
              onClick={() => onChange(bg.id)}
              onKeyDown={(e) => handleSwatchKeyDown(e, idx)}
              className="group flex flex-col items-center gap-1 rounded-[6px] p-0.5 focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--bg-ring)] focus-visible:ring-offset-1"
              style={{ background: "transparent", border: "none" }}
            >
              {/* Swatch preview — 8:5 aspect ratio */}
              <span
                className="relative block w-full overflow-hidden rounded-[8px]"
                style={{
                  paddingTop: "62.5%", /* 5/8 = 62.5% */
                  background: `linear-gradient(160deg, ${bg.light.from}, ${bg.light.to})`,
                  outline: isSelected
                    ? "2px solid var(--bg-ring)"
                    : "1px solid transparent",
                  outlineOffset: "1px",
                }}
              >
                {isSelected && (
                  <span
                    className="absolute right-1 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[var(--bg-ring)]"
                    aria-hidden="true"
                  >
                    <Check size={10} strokeWidth={3} className="text-white" />
                  </span>
                )}
              </span>
              <span className="text-[11px] leading-tight text-[var(--text-secondary)]">
                {bg.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        aria-label="Change background"
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? pickerId : undefined}
        onClick={() => setOpen((v) => !v)}
        className="flex h-9 w-9 items-center justify-center rounded-[var(--radius-ctrl)] border border-[var(--border)] bg-[var(--bg-panel)] text-[var(--text-muted)] transition-colors duration-150 hover:bg-[var(--bg-hover)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-light)] focus-visible:ring-offset-2"
      >
        <Palette size={18} strokeWidth={1.5} aria-hidden="true" />
      </button>

      {open && (
        <div
          style={position}
          className="bg-picker-popover fixed z-50"
        >
          {panelContent}
        </div>
      )}
    </>
  );
}
