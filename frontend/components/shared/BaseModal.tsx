"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";

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
  /** Optional short description, linked with `aria-describedby`. */
  description?: string;
}

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  description,
}: BaseModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const reactId = useId();
  const titleId = `${reactId}-title`;
  const descriptionId = `${reactId}-description`;
  const openerRef = useRef<HTMLElement | null>(null);

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

  // Close on Escape; keep Tab and Shift+Tab inside the panel
  useEffect(() => {
    if (!isOpen) return;

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      if (e.key !== "Tab") return;

      const panel = dialogRef.current;
      if (!panel) return;
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (items.length === 0) {
        e.preventDefault();
        panel.focus();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      } else if (active instanceof Node && !panel.contains(active)) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  // Focus the dialog panel when it opens; give focus back to the opener on close
  useEffect(() => {
    if (!isOpen) return;
    openerRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    dialogRef.current?.focus();
    return () => {
      const opener = openerRef.current;
      if (opener && document.contains(opener)) opener.focus();
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      {/* Panel — stop backdrop click from bubbling through the panel */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descriptionId : undefined}
        tabIndex={-1}
        className={[
          "relative w-full rounded-lg bg-background shadow-xl",
          "focus:outline-none",
          "flex flex-col max-h-[90dvh]",
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
          {/* Plain <button> kept on purpose: BaseModal is itself a base
              component and this is its built-in compact close control. */}
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
        <div className="overflow-y-auto px-6 py-4">
          {description && (
            <p id={descriptionId} className="mb-3 text-sm text-muted-foreground">
              {description}
            </p>
          )}
          {children}
        </div>
      </div>
    </div>
  );
}
