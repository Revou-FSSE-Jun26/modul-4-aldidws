"use client";

import { useId, useState } from "react";
import { BaseButton } from "@/components/shared/BaseButton";
import { DUE_INPUT_MAX, DUE_INPUT_MIN, isoToLocalInput, localInputToIso } from "@/lib/dueDate";

interface DueDateFieldProps {
  /** Current due date as a UTC ISO string, or null. */
  value: string | null;
  /** Rejects when the server refuses; the field shows the message and keeps the input. */
  onSave: (iso: string) => Promise<void>;
  onRemove: () => Promise<void>;
}

/**
 * Labelled datetime-local input with "Save due date" and "Remove due date".
 * The input is in browser local time; the saved value is converted to UTC.
 * Remount with a new `key` when the saved value changes from outside.
 */
export function DueDateField({ value, onSave, onRemove }: DueDateFieldProps) {
  const inputId = useId();
  const errorId = `${inputId}-error`;
  const savedLocal = isoToLocalInput(value);
  const [local, setLocal] = useState(savedLocal);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const iso = localInputToIso(local);
  const isUnchanged = local === savedLocal;

  async function run(action: () => Promise<void>, fallback: string) {
    setBusy(true);
    setError(null);
    try {
      await action();
    } catch (err: unknown) {
      setError(err instanceof Error && err.message ? err.message : fallback);
    } finally {
      setBusy(false);
    }
  }

  function handleSave() {
    if (!iso) {
      setError("Enter a valid date and time between the years 2000 and 2100.");
      return;
    }
    void run(() => onSave(iso), "Could not save the due date.");
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={inputId} className="text-sm font-medium text-foreground">
        Due date
      </label>
      <input
        id={inputId}
        type="datetime-local"
        value={local}
        min={DUE_INPUT_MIN}
        max={DUE_INPUT_MAX}
        disabled={busy}
        aria-invalid={error !== null}
        aria-describedby={error ? errorId : undefined}
        onChange={(e) => {
          setLocal(e.target.value);
          if (error) setError(null);
        }}
        className="rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
      />
      {error && (
        <p id={errorId} role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <BaseButton
          variant="secondary"
          disabled={busy || local === "" || isUnchanged}
          onClick={handleSave}
        >
          Save due date
        </BaseButton>
        <BaseButton
          variant="secondary"
          disabled={busy || value === null}
          onClick={() => void run(onRemove, "Could not remove the due date.")}
        >
          Remove due date
        </BaseButton>
      </div>
    </div>
  );
}
