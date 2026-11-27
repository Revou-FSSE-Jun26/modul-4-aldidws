"use client";

import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import { ApiError } from "@/lib/errors";
import { LABEL_COLORS } from "@/lib/labelColors";
import type { Label } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";
import { LabelPill } from "@/components/board/LabelPill";

interface LabelPickerProps {
  /** All labels of the board. */
  labels: Label[];
  /** Ids currently attached to the card. */
  selectedIds: string[];
  /** Sends the staged ids. Rejects when the server refuses. */
  onApply: (labelIds: string[]) => Promise<void>;
}

/**
 * "Labels" button with a multi-select listbox. The choice is staged locally
 * and only sent when the user presses Apply. Escape closes without sending.
 */
export function LabelPicker({ labels, selectedIds, onApply }: LabelPickerProps) {
  const baseId = useId();
  const listRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [staged, setStaged] = useState<string[]>(selectedIds);
  const [activeIndex, setActiveIndex] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const buttonId = `${baseId}-button`;
  const focusButton = () => document.getElementById(buttonId)?.focus();

  useEffect(() => {
    if (open) listRef.current?.focus();
  }, [open]);

  function openPanel() {
    setStaged(selectedIds);
    setActiveIndex(0);
    setError(null);
    setOpen(true);
  }

  function closePanel() {
    setOpen(false);
    setError(null);
    focusButton();
  }

  function toggle(id: string) {
    setStaged((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  async function apply() {
    setBusy(true);
    setError(null);
    // Keep board order so the request is stable.
    const ordered = labels.filter((l) => staged.includes(l.id)).map((l) => l.id);
    try {
      await onApply(ordered);
      setOpen(false);
      focusButton();
    } catch (err: unknown) {
      setError(
        err instanceof ApiError && err.isNotFound
          ? "That label no longer exists."
          : err instanceof Error && err.message
            ? err.message
            : "Could not update the labels.",
      );
    } finally {
      setBusy(false);
    }
  }

  function handleKeyDown(e: KeyboardEvent<HTMLElement>) {
    if (e.key === "Escape") {
      // Keep the surrounding dialog open.
      e.stopPropagation();
      e.preventDefault();
      closePanel();
      return;
    }
    if (e.target !== listRef.current || labels.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, labels.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Home") {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setActiveIndex(labels.length - 1);
    } else if (e.key === " " || e.key === "Enter") {
      e.preventDefault();
      toggle(labels[activeIndex].id);
    }
  }

  const optionId = (i: number) => `${baseId}-option-${i}`;
  const listId = `${baseId}-list`;

  return (
    <div className="flex flex-col gap-2" onKeyDown={open ? handleKeyDown : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <BaseButton
          variant="secondary"
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-controls={open ? listId : undefined}
          onClick={() => (open ? closePanel() : openPanel())}
          id={`${baseId}-button`}
        >
          Labels
        </BaseButton>
        {!open &&
          labels
            .filter((l) => selectedIds.includes(l.id))
            .map((l) => <LabelPill key={l.id} name={l.name} color={l.color} />)}
      </div>

      {open && (
        <div className="flex flex-col gap-2 rounded-md border border-border p-2">
          {labels.length === 0 ? (
            <p className="text-xs text-muted-foreground">
              This board has no labels yet. Create one below.
            </p>
          ) : (
            <div
              id={listId}
              ref={listRef}
              role="listbox"
              aria-label="Labels"
              aria-multiselectable="true"
              aria-activedescendant={optionId(activeIndex)}
              tabIndex={0}
              className="flex flex-col gap-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              {labels.map((label, i) => {
                const selected = staged.includes(label.id);
                return (
                  <div
                    key={label.id}
                    id={optionId(i)}
                    role="option"
                    aria-selected={selected}
                    onClick={() => {
                      setActiveIndex(i);
                      toggle(label.id);
                    }}
                    className={`flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm ${
                      i === activeIndex ? "bg-muted" : ""
                    }`}
                  >
                    <span aria-hidden="true" className="w-4 text-foreground">
                      {selected ? "✓" : ""}
                    </span>
                    <LabelPill name={label.name} color={label.color} />
                    <span className="text-xs text-muted-foreground">
                      {LABEL_COLORS[label.color].name}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <BaseButton size="sm" disabled={busy || labels.length === 0} onClick={() => void apply()}>
              Apply
            </BaseButton>
            <BaseButton size="sm" variant="secondary" disabled={busy} onClick={closePanel}>
              Cancel
            </BaseButton>
          </div>
        </div>
      )}
    </div>
  );
}
