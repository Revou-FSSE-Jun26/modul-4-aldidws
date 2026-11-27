"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/errors";
import { LABEL_COLORS, LABEL_COLOR_KEYS } from "@/lib/labelColors";
import { createLabel, updateLabel } from "@/lib/services/labelsService";
import type { Label, LabelColor } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";
import { LabelPill } from "@/components/board/LabelPill";

const MAX_NAME = 50;
const CONFLICT_MESSAGE = "A label with that name already exists.";

export const labelDeleteButtonId = (labelId: string) => `label-delete-${labelId}`;

interface LabelManagerProps {
  boardId: string;
  labels: Label[];
  /** Called after a create or rename/recolour so the board can be reloaded. */
  onChanged: () => void;
  /** The parent shows the confirmation dialog (it hides the card dialog meanwhile). */
  onRequestDelete: (label: Label) => void;
  /** After a delete confirmation: the label whose Delete button gets focus again, or null for the heading. */
  restoreFocusLabelId?: string | null;
  /** Set to true after a confirmation dialog closed, so focus can be restored once. */
  restoreFocus?: boolean;
}

function messageFor(err: unknown, fallback: string): string {
  if (err instanceof ApiError && err.isConflict) return CONFLICT_MESSAGE;
  return err instanceof Error && err.message ? err.message : fallback;
}

function ColorChoice({
  name,
  value,
  onChange,
  disabled,
}: {
  name: string;
  value: LabelColor;
  onChange: (c: LabelColor) => void;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label="Colour" className="flex flex-wrap gap-2">
      {LABEL_COLOR_KEYS.map((key) => (
        <label key={key} className="flex items-center gap-1 text-xs text-foreground">
          <input
            type="radio"
            name={name}
            value={key}
            checked={value === key}
            disabled={disabled}
            onChange={() => onChange(key)}
          />
          {LABEL_COLORS[key].name}
        </label>
      ))}
    </div>
  );
}

function LabelRow({
  label,
  onChanged,
  onRequestDelete,
}: {
  label: Label;
  onChanged: () => void;
  onRequestDelete: (label: Label) => void;
}) {
  const { token } = useAuth();
  const id = useId();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(label.name);
  const [color, setColor] = useState<LabelColor>(label.color);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function save(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Label name is required.");
      return;
    }
    if (trimmed.length > MAX_NAME) {
      setError(`Name must be ${MAX_NAME} characters or fewer.`);
      return;
    }
    const payload: { name?: string; color?: LabelColor } = {};
    if (trimmed !== label.name) payload.name = trimmed;
    if (color !== label.color) payload.color = color;
    if (Object.keys(payload).length === 0) {
      setEditing(false);
      return;
    }
    if (!token) {
      setError("You must be signed in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await updateLabel(token, label.id, payload);
      setEditing(false);
      onChanged();
    } catch (err: unknown) {
      setError(messageFor(err, "Could not update the label."));
    } finally {
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <li className="rounded-md border border-border p-2">
        <form onSubmit={save} noValidate className="flex flex-col gap-2">
          <label htmlFor={`${id}-name`} className="text-xs font-medium text-foreground">
            Name of label {label.name}
          </label>
          <input
            id={`${id}-name`}
            type="text"
            value={name}
            disabled={busy}
            maxLength={MAX_NAME}
            onChange={(e) => {
              setName(e.target.value);
              if (error) setError(null);
            }}
            aria-invalid={error !== null}
            className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <ColorChoice name={`${id}-color`} value={color} onChange={setColor} disabled={busy} />
          {error && (
            <p role="alert" className="text-xs text-destructive">
              {error}
            </p>
          )}
          <div className="flex gap-2">
            <BaseButton type="submit" size="sm" disabled={busy}>
              Save label
            </BaseButton>
            <BaseButton
              size="sm"
              variant="secondary"
              disabled={busy}
              onClick={() => {
                setEditing(false);
                setName(label.name);
                setColor(label.color);
                setError(null);
              }}
            >
              Cancel
            </BaseButton>
          </div>
        </form>
      </li>
    );
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-border px-2 py-1">
      <LabelPill name={label.name} color={label.color} />
      <div className="flex gap-2">
        <BaseButton
          size="sm"
          variant="secondary"
          aria-label={`Edit label ${label.name}`}
          onClick={() => setEditing(true)}
        >
          Edit
        </BaseButton>
        <BaseButton
          id={labelDeleteButtonId(label.id)}
          size="sm"
          variant="secondary"
          aria-label={`Delete label ${label.name}`}
          onClick={() => onRequestDelete(label)}
        >
          Delete
        </BaseButton>
      </div>
    </li>
  );
}

/** Section of the card dialog: create, edit and delete the labels of the board. */
export function LabelManager({
  boardId,
  labels,
  onChanged,
  onRequestDelete,
  restoreFocusLabelId = null,
  restoreFocus = false,
}: LabelManagerProps) {
  const { token } = useAuth();
  const id = useId();
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [name, setName] = useState("");
  const [color, setColor] = useState<LabelColor>("blue");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // After the delete confirmation closed, put focus back (the dialog panel takes
  // focus when it reopens, so wait one tick).
  useEffect(() => {
    if (!restoreFocus) return;
    const timer = window.setTimeout(() => {
      const target = restoreFocusLabelId
        ? document.getElementById(labelDeleteButtonId(restoreFocusLabelId))
        : null;
      (target ?? headingRef.current)?.focus();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [restoreFocus, restoreFocusLabelId]);

  async function handleCreate(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Label name is required.");
      return;
    }
    if (trimmed.length > MAX_NAME) {
      setError(`Name must be ${MAX_NAME} characters or fewer.`);
      return;
    }
    if (!token) {
      setError("You must be signed in.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await createLabel(token, boardId, { name: trimmed, color });
      setName("");
      onChanged();
    } catch (err: unknown) {
      setError(messageFor(err, "Could not create the label."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby={`${id}-heading`} className="flex flex-col gap-2">
      <h3
        id={`${id}-heading`}
        ref={headingRef}
        tabIndex={-1}
        className="text-sm font-medium text-foreground focus:outline-none"
      >
        Board labels
      </h3>
      {labels.length > 0 && (
        <ul className="flex list-none flex-col gap-1 p-0">
          {labels.map((l) => (
            <LabelRow
              key={l.id}
              label={l}
              onChanged={onChanged}
              onRequestDelete={onRequestDelete}
            />
          ))}
        </ul>
      )}
      <form onSubmit={handleCreate} noValidate className="flex flex-col gap-2">
        <label htmlFor={`${id}-name`} className="text-xs font-medium text-foreground">
          New label name
        </label>
        <input
          id={`${id}-name`}
          type="text"
          value={name}
          disabled={busy}
          maxLength={MAX_NAME}
          onChange={(e) => {
            setName(e.target.value);
            if (error) setError(null);
          }}
          aria-invalid={error !== null}
          aria-describedby={`${id}-count`}
          className="rounded-md border border-border bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <p id={`${id}-count`} className="text-xs text-muted-foreground">
          {name.length}/{MAX_NAME}
        </p>
        <ColorChoice name={`${id}-color`} value={color} onChange={setColor} disabled={busy} />
        {error && (
          <p role="alert" className="text-xs text-destructive">
            {error}
          </p>
        )}
        <div>
          <BaseButton type="submit" size="sm" disabled={busy}>
            Create label
          </BaseButton>
        </div>
      </form>
    </section>
  );
}
