"use client";

import { useState } from "react";
import { ApiError } from "@/lib/errors";
import type { Card, ColumnWithCards } from "@/lib/types/api";
import type { DragHandlers } from "@/hooks/useDragAndDrop";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { AddCardForm } from "@/components/board/AddCardForm";
import { BoardCard } from "@/components/board/BoardCard";
import { ColumnHeader } from "@/components/board/ColumnHeader";

export const COLUMN_HAS_CARDS_MESSAGE =
  "This column still has cards. Move or delete them first.";

export interface BoardColumnProps {
  column: ColumnWithCards;
  /** Rejects with an ApiError when the server refuses. */
  onRename: (columnId: string, name: string) => Promise<void>;
  /** Rejects with a 409 ApiError when the column still has cards. */
  onDelete: (columnId: string) => Promise<void>;
  onAddCard: (columnId: string, title: string) => Promise<void>;
  onOpenCard: (card: Card) => void;
  dragHandlers: DragHandlers;
  draggingCardId: string | null;
}

/** One Kanban column: header, draggable cards, add-card form, delete confirmation. */
export function BoardColumn({
  column,
  onRename,
  onDelete,
  onAddCard,
  onOpenCard,
  dragHandlers,
  draggingCardId,
}: BoardColumnProps) {
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  const cards = [...column.cards].sort((a, b) => a.order - b.order);

  async function handleRename(name: string) {
    setError(null);
    try {
      await onRename(column.id, name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not rename the column.");
    }
  }

  async function handleConfirmDelete() {
    setIsDeleting(true);
    setError(null);
    try {
      await onDelete(column.id);
    } catch (err: unknown) {
      setConfirmingDelete(false);
      setError(
        err instanceof ApiError && err.isConflict
          ? COLUMN_HAS_CARDS_MESSAGE
          : err instanceof Error
            ? err.message
            : "Could not delete the column.",
      );
      setIsDeleting(false);
    }
  }

  async function handleAddCard(title: string) {
    setIsSubmittingCard(true);
    setCardError(null);
    try {
      await onAddCard(column.id, title);
      setIsAdding(false);
    } catch (err: unknown) {
      setCardError(err instanceof Error ? err.message : "Could not add the card.");
    } finally {
      setIsSubmittingCard(false);
    }
  }

  return (
    <section
      role="listitem"
      aria-label={column.name}
      className="flex w-[85vw] max-w-xs shrink-0 snap-start flex-col gap-2 rounded-lg border border-border bg-muted/30 p-3 sm:w-72"
      onDragOver={dragHandlers.onDragOver}
      onDrop={(e) => dragHandlers.onDrop(e, column.id, null)}
    >
      <ColumnHeader
        title={column.name}
        cardCount={cards.length}
        onRename={(name) => void handleRename(name)}
        onColumnDelete={() => setConfirmingDelete(true)}
      />

      {error && (
        <p role="alert" className="text-xs text-destructive">
          {error}
        </p>
      )}

      {cards.length === 0 ? (
        <p className="px-1 text-xs text-muted-foreground">No cards in this column.</p>
      ) : (
        <ul className="flex list-none flex-col gap-2 p-0">
          {cards.map((card) => (
            <li
              key={card.id}
              draggable
              onDragStart={(e) => dragHandlers.onDragStart(e, card.id)}
              onDragEnd={dragHandlers.onDragEnd}
              onDragOver={dragHandlers.onDragOver}
              onDrop={(e) => dragHandlers.onDrop(e, column.id, card.id)}
              className={draggingCardId === card.id ? "opacity-50" : undefined}
            >
              <BoardCard title={card.title} onCardClick={() => onOpenCard(card)} />
            </li>
          ))}
        </ul>
      )}

      {isAdding ? (
        <AddCardForm
          onCardCreate={(title) => void handleAddCard(title)}
          onCancel={() => {
            setIsAdding(false);
            setCardError(null);
          }}
          isSubmitting={isSubmittingCard}
          errorMessage={cardError}
        />
      ) : (
        <BaseButton
          variant="secondary"
          size="sm"
          onClick={() => setIsAdding(true)}
          aria-label={`Add card to ${column.name}`}
        >
          Add card
        </BaseButton>
      )}

      <BaseModal
        isOpen={confirmingDelete}
        onClose={() => {
          if (!isDeleting) setConfirmingDelete(false);
        }}
        title={`Delete column "${column.name}"?`}
        maxWidth="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <BaseButton variant="secondary" onClick={() => setConfirmingDelete(false)}>
            Cancel
          </BaseButton>
          <BaseButton
            variant="destructive"
            disabled={isDeleting}
            onClick={() => void handleConfirmDelete()}
          >
            Confirm delete
          </BaseButton>
        </div>
      </BaseModal>
    </section>
  );
}
