
"use client";

import {
  useId,
  useRef,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";

import { useAuth } from "@/context/AuthContext";
import { createBoard } from "@/lib/services/boardsService";
import { ApiError } from "@/lib/errors";
import type { Board } from "@/lib/types/api";
import { BaseButton } from "@/components/shared/BaseButton";

const MAX_NAME_LENGTH = 100;

export interface CreateBoardFormProps {
  onCreated: (board: Board) => void;
  trigger?: ReactNode;
  triggerClassName?: string;
}

export function CreateBoardForm({
  onCreated,
  trigger,
  triggerClassName,
}: CreateBoardFormProps) {
  const { token } = useAuth();

  const inputId = useId();
  const errorId = `${inputId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);

  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [status, setStatus] = useState("");

  function openForm() {
    setError(null);
    setStatus("");
    setIsOpen(true);
  }

  function closeForm() {
    if (isSubmitting) return;

    setIsOpen(false);
    setName("");
    setError(null);
  }

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();

    const trimmed = name.trim();

    if (!trimmed) {
      setError("Board name is required.");
      inputRef.current?.focus();
      return;
    }

    if (trimmed.length > MAX_NAME_LENGTH) {
      setError(
        `Board name must be ${MAX_NAME_LENGTH} characters or fewer.`,
      );
      return;
    }

    if (!token) {
      setError("You must be signed in to create a board.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const board = await createBoard(token, trimmed);

      onCreated(board);
      setName("");
      setIsOpen(false);
      setStatus("Board created");
    } catch (err: unknown) {
      const fieldError =
        err instanceof ApiError
          ? err.details?.name?.[0]
          : undefined;

      setError(
        fieldError ??
          (err instanceof Error
            ? err.message
            : "Could not create the board."),
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full">
      <p
        role="status"
        aria-live="polite"
        className="sr-only"
      >
        {status}
      </p>

      {isOpen ? (
        <form
          onSubmit={handleSubmit}
          noValidate
          className="flex w-full min-w-0 flex-col gap-3"
          onClick={(e) => e.stopPropagation()}
        >
          <label
            htmlFor={inputId}
            className="text-sm font-medium text-[#24483D]"
          >
            Board name
          </label>

          <input
            id={inputId}
            ref={inputRef}
            type="text"
            value={name}
            autoFocus
            maxLength={MAX_NAME_LENGTH}
            disabled={isSubmitting}
            onChange={(e) => {
              setName(e.target.value);

              if (error) {
                setError(null);
              }
            }}
            aria-invalid={error !== null}
            aria-describedby={error ? errorId : undefined}
            className="w-full rounded-lg border border-[#D9DED0] bg-white px-3 py-2 text-sm text-[#24483D] outline-none transition placeholder:text-[#A0A69A] focus:border-[#526B57] focus:ring-2 focus:ring-[#526B57]/15 disabled:opacity-50"
            placeholder="Enter board name"
          />

          {error && (
            <p
              id={errorId}
              role="alert"
              className="text-xs text-destructive"
            >
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-2">
            <BaseButton
              type="submit"
              disabled={isSubmitting}
              className="!border-[#24483D] !bg-[#24483D] !text-white hover:!bg-[#345C4D]"
            >
              {isSubmitting ? "Creating…" : "Create"}
            </BaseButton>

            <BaseButton
              type="button"
              variant="secondary"
              disabled={isSubmitting}
              onClick={closeForm}
            >
              Cancel
            </BaseButton>
          </div>
        </form>
      ) : trigger ? (
        <div
          role="button"
          tabIndex={0}
          aria-label="Create a new board"
          onClick={openForm}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              openForm();
            }
          }}
          className={triggerClassName}
        >
          {trigger}
        </div>
      ) : (
        <BaseButton
          type="button"
          onClick={openForm}
          className="!border-[#24483D] !bg-[#24483D] !text-white hover:!bg-[#345C4D]"
        >
          Create board
        </BaseButton>
      )}
    </div>
  );
}
