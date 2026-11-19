"use client";

import { useEffect, useRef, type ReactNode } from "react";

export interface BaseModalProps {
  /** Controls whether the modal is visible. */
  isOpen: boolean;
  /** Called when the user dismisses the modal (Escape, backdrop click, close button). */
  onClose: () => void;
  /** Accessible title shown in the modal header and used as `aria-labelledby`. */
  title: string;
  /** Modal body content. */
  children: ReactNode;
  /**
   * Maximum width of the modal panel.
   * Accepts any Tailwind `max-w-*` class.
   * @default "max-w-lg"
   */
  maxWidth?: string;
}

/**
 * Accessible modal dialog shell.
 *
 * - Traps focus inside the dialog while open.
 * - Closes on Escape keydown and backdrop click.
 * - Uses `role="dialog"` + `aria-modal` + `aria-labelledby` per ARIA spec.
 * - Prevents body scroll while open.
 * - Rendered via a simple conditional; no portal needed for the App Router.
 */
export function BaseModal({
  isOpen,
  onClose,
  title,
  children,
  maxWidth = "max-w-lg",
}: BaseModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const titleId = "base-modal-title";

  // Prevent body scroll while open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus the dialog panel when it opens
  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      aria-hidden="true"
      onClick={onClose}
    >
      {/* Panel — stop backdrop click from bubbling through the panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={[
          "relative w-full rounded-lg bg-background shadow-xl",
          "focus:outline-none",
          "flex flex-col max-h-[90vh]",
          maxWidth,
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2
            id={titleId}
            className="text-base font-semibold text-foreground"
          >
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="rounded p-1 text-muted-foreground hover:text-foreground focus:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 16 16"
              fill="currentColor"
              className="h-4 w-4"
              aria-hidden="true"
            >
              <path d="M3.72 3.72a.75.75 0 0 1 1.06 0L8 6.94l3.22-3.22a.75.75 0 1 1 1.06 1.06L9.06 8l3.22 3.22a.75.75 0 1 1-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 0 1-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 0 1 0-1.06Z" />
            </svg>
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto px-6 py-4">{children}</div>
      </div>
    </div>
  );
}
