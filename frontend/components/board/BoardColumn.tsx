"use client";

import { useEffect, useRef, useState } from "react";
import { ApiError } from "@/lib/errors";
import { resolveColumnColor } from "@/lib/columnColor";
import { showError } from "@/lib/toast";
import type { Card, ColumnColor, ColumnWithCards } from "@/lib/types/api";
import type { DragHandlers } from "@/hooks/useDragAndDrop";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { AddCardForm } from "@/components/board/AddCardForm";
import { BoardCard } from "@/components/board/BoardCard";
import { ColumnHeader } from "@/components/board/ColumnHeader";
import { DueDateBadge } from "@/components/board/DueDateBadge";
import { LabelPill } from "@/components/board/LabelPill";

export const COLUMN_HAS_CARDS_MESSAGE =
  "This column still has cards. Move or delete them first.";

export interface BoardColumnProps {
  column: ColumnWithCards;
  /** Rejects with an ApiError when the server refuses. */
  onRename: (columnId: string, name: string) => Promise<void>;
  /** Rejects with a 409 ApiError when the column still has cards. */
  onDelete: (columnId: string) => Promise<void>;
  /** Updates the status color and/or Done flag. Rejects with an ApiError on failure. */
  onUpdate?: (
    columnId: string,
    patch: { color?: ColumnColor | null; is_done?: boolean },
  ) => Promise<void>;
  onAddCard: (columnId: string, title: string, position?: "top") => Promise<void>;
  onOpenCard: (card: Card) => void;
  dragHandlers: DragHandlers;
  draggingCardId: string | null;
  /** Current time, shared by the whole board, used for due date badges. */
  now: Date;
  /**
   * Cards in the column before filtering. Pass it only while filters are
   * active: the header then shows "x of y" and `column.cards` holds the visible cards.
   */
  totalCount?: number;
  /** False while filters are active: no dragging and no drop target. Default true. */
  dragEnabled?: boolean;
  /** Column reorder wiring. Omit to hide the column drag handle. */
  columnReorder?: ColumnReorderProps;
  /** Index of the column in the board's current order; drives the cycling status color. */
  index?: number;
  /** Name of the board this column belongs to. Forwarded to each card for display. */
  boardName?: string;
  /** Called (after user confirms) when the kebab Delete is selected on a card. */
  onDeleteCard?: (card: Card) => Promise<void>;
  /** Called when the kebab Duplicate is selected on a card. */
  onDuplicateCard?: (card: Card) => Promise<void>;
  /**
   * When this number changes and is > 0, opens the bottom AddCardForm.
   * A nonce pattern so the same column can be re-triggered.
   */
  openAddCardSignal?: number;
}

export interface ColumnReorderProps {
  /** Id of the column being dragged, or null. While set, card drop handlers are bypassed. */
  draggingColumnId: string | null;
  onDragStart: (e: React.DragEvent<HTMLElement>, columnId: string) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (e: React.DragEvent<HTMLElement>, targetColumnId: string) => void;
  onMove: (columnId: string, direction: -1 | 1) => void;
}

/** One Kanban column: header, draggable cards, add-card form, delete confirmation. */
export function BoardColumn({
  column,
  onRename,
  onDelete,
  onUpdate,
  onAddCard,
  onOpenCard,
  dragHandlers,
  draggingCardId,
  now,
  totalCount,
  dragEnabled = true,
  columnReorder,
  index = 0,
  boardName,
  onDeleteCard,
  onDuplicateCard,
  openAddCardSignal = 0,
}: BoardColumnProps) {
  const [error, setError] = useState<string | null>(null);
  const [isAdding, setIsAdding] = useState(false);
  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);
  const [isAddingTop, setIsAddingTop] = useState(false);
  const [isSubmittingTopCard, setIsSubmittingTopCard] = useState(false);
  const [topCardError, setTopCardError] = useState<string | null>(null);
  const addTopButtonRef = useRef<HTMLButtonElement>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  // Card kebab menu state
  const [confirmingCardDelete, setConfirmingCardDelete] = useState<Card | null>(null);
  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [duplicatingCardId, setDuplicatingCardId] = useState<string | null>(null);
  // Height of the dragging card's DOM element, used to size the ghost placeholder.
  const [placeholderHeight, setPlaceholderHeight] = useState<number | null>(null);

  // External signal from the board header to open the bottom AddCardForm.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (openAddCardSignal > 0) setIsAdding(true);
  }, [openAddCardSignal]);

  const cards = [...column.cards].sort((a, b) => a.order - b.order);
  // While a column is being dragged, card drag/drop handlers must not run.
  const columnDragActive = columnReorder?.draggingColumnId != null;
  const cardDnd = dragEnabled && !columnDragActive;

  async function handleRename(name: string) {
    setError(null);
    try {
      await onRename(column.id, name);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not rename the column.");
    }
  }

  /** Await-then-update: the parent state changes only after the server accepts. */
  async function handleUpdate(patch: { color?: ColumnColor | null; is_done?: boolean }) {
    if (!onUpdate || isUpdating) return;
    setIsUpdating(true);
    try {
      await onUpdate(column.id, patch);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not update the column.");
    } finally {
      setIsUpdating(false);
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

  async function handleAddTopCard(title: string) {
    setIsSubmittingTopCard(true);
    setTopCardError(null);
    try {
      await onAddCard(column.id, title, "top");
      setIsAddingTop(false);
      addTopButtonRef.current?.focus();
    } catch (err: unknown) {
      setTopCardError(err instanceof Error ? err.message : "Could not add the card.");
    } finally {
      setIsSubmittingTopCard(false);
    }
  }

  async function handleConfirmCardDelete() {
    if (!confirmingCardDelete || !onDeleteCard) return;
    setIsDeletingCard(true);
    try {
      await onDeleteCard(confirmingCardDelete);
      setConfirmingCardDelete(null);
    } catch (err: unknown) {
      showError(err instanceof Error ? err.message : "Could not delete the card.");
    } finally {
      setIsDeletingCard(false);
    }
  }

  async function handleDuplicateCard(card: Card) {
    if (!onDuplicateCard) return;
    setDuplicatingCardId(card.id);
    try {
      await onDuplicateCard(card);
    } catch {
      // Errors (e.g. label-failure) are handled by the parent caller; swallow here
      // so the unhandled-rejection does not bubble through the void-called handler.
    } finally {
      setDuplicatingCardId(null);
    }
  }

  return (
    <section
      role="listitem"
      aria-label={column.name}
      data-column-id={column.id}
      data-status={resolveColumnColor(column.color, index)}
      className="flex w-[85vw] max-w-[260px] min-w-[210px] shrink-0 snap-start flex-col gap-2 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--bg-column)] p-2 sm:w-[210px]"
      onDragOver={
        columnDragActive ? columnReorder?.onDragOver : cardDnd ? dragHandlers.onDragOver : undefined
      }
      onDrop={
        columnDragActive
          ? (e) => columnReorder?.onDrop(e, column.id)
          : cardDnd
            ? (e) => dragHandlers.onDrop(e, column.id, null)
            : undefined
      }
    >
      {/* Colored accent bar along the top edge of the column */}
      <span aria-hidden="true" className="col-accent-bar -mx-2 -mt-2 mb-0 h-[3px] rounded-t-xl" />
      <ColumnHeader
        title={column.name}
        cardCount={cards.length}
        visibleCount={totalCount !== undefined ? cards.length : undefined}
        totalCount={totalCount}
        status={resolveColumnColor(column.color, index)}
        onRename={(name) => void handleRename(name)}
        onColumnDelete={() => setConfirmingDelete(true)}
        color={column.color}
        isDone={column.is_done}
        actionsDisabled={isUpdating}
        onAddTask={() => setIsAddingTop(true)}
        addTaskButtonRef={addTopButtonRef}
        onColorChange={onUpdate && ((color) => void handleUpdate({ color }))}
        onDoneChange={onUpdate && ((isDone) => void handleUpdate({ is_done: isDone }))}
        reorder={
          columnReorder && {
            columnId: column.id,
            onDragStart: (e) => columnReorder.onDragStart(e, column.id),
            onDragEnd: columnReorder.onDragEnd,
            onMove: (direction) => columnReorder.onMove(column.id, direction),
          }
        }
      />
      {error && (
        <p role="alert" className="text-xs text-[var(--accent-red)]">
          {error}
        </p>
      )}
      {isAddingTop && (
        <AddCardForm
          onCardCreate={(title) => void handleAddTopCard(title)}
          onCancel={() => {
            setIsAddingTop(false);
            setTopCardError(null);
            addTopButtonRef.current?.focus();
          }}
          isSubmitting={isSubmittingTopCard}
          errorMessage={topCardError}
        />
      )}
      {cards.length === 0 ? (
        (totalCount ?? 0) === 0 && (
          <p className="px-1 text-xs text-[var(--text-muted)]">No tasks</p>
        )
      ) : (
        <ul className="flex list-none flex-col gap-2 p-0">
          {cards.map((card) =>
            draggingCardId === card.id ? (
              <li
                key={card.id}
                data-placeholder="true"
                aria-hidden="true"
                style={{ height: `${placeholderHeight ?? 60}px` }}
                onDrop={(e) => { e.preventDefault(); e.stopPropagation(); }}
                onDragOver={(e) => { e.preventDefault(); }}
              />
            ) : (
              <li
                key={card.id}
                draggable={dragEnabled && (card.can_move ?? true) || undefined}
                onDragStart={dragEnabled && (card.can_move ?? true) ? (e) => {
                  // Measure card height for the placeholder
                  const liEl = e.currentTarget as HTMLElement;
                  const height = liEl.getBoundingClientRect().height;
                  setPlaceholderHeight(height);

                  // Build a tilted clone as the drag image
                  const articleEl = liEl.querySelector("article");
                  if (articleEl) {
                    const clone = articleEl.cloneNode(true) as HTMLElement;
                    clone.classList.add("drag-tilt-clone");
                    clone.style.width = `${articleEl.offsetWidth}px`;
                    document.body.appendChild(clone);
                    e.dataTransfer.setDragImage(clone, articleEl.offsetWidth / 2, 20);
                    // Remove after the browser captures the image
                    requestAnimationFrame(() => { clone.remove(); });
                  }

                  dragHandlers.onDragStart(e, card.id);
                } : undefined}
                onDragEnd={dragEnabled && (card.can_move ?? true) ? (e) => {
                  setPlaceholderHeight(null);
                  dragHandlers.onDragEnd(e);
                } : undefined}
                onDragOver={cardDnd ? dragHandlers.onDragOver : undefined}
                onDrop={cardDnd ? (e) => dragHandlers.onDrop(e, column.id, card.id) : undefined}
              >
                <BoardCard
                  title={card.title}
                  priority={card.priority ?? undefined}
                  boardName={boardName}
                  isDoneColumn={column.is_done ?? false}
                  meta={
                    card.labels.length > 0 || card.due_date ? (
                      <div className="flex flex-wrap items-center gap-1">
                        {card.labels.map((label) => (
                          <LabelPill key={label.id} name={label.name} color={label.color} />
                        ))}
                        {card.due_date && <DueDateBadge dueDate={card.due_date} now={now} />}
                      </div>
                    ) : undefined
                  }
                  onCardClick={() => onOpenCard(card)}
                  onCardMenu={
                    onDeleteCard || onDuplicateCard
                      ? {
                          onEdit: () => onOpenCard(card),
                          onDuplicate: () => void handleDuplicateCard(card),
                          onDelete: () => setConfirmingCardDelete(card),
                          isDuplicating: duplicatingCardId === card.id,
                        }
                      : undefined
                  }
                />
              </li>
            ),
          )}
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
      <BaseModal
        isOpen={confirmingCardDelete !== null}
        onClose={() => {
          if (!isDeletingCard) setConfirmingCardDelete(null);
        }}
        title={`Delete card "${confirmingCardDelete?.title ?? ""}"?`}
        maxWidth="max-w-sm"
      >
        <div className="flex justify-end gap-2">
          <BaseButton variant="secondary" onClick={() => setConfirmingCardDelete(null)}>
            Cancel
          </BaseButton>
          <BaseButton
            variant="destructive"
            disabled={isDeletingCard}
            onClick={() => void handleConfirmCardDelete()}
          >
            Confirm delete
          </BaseButton>
        </div>
      </BaseModal>
    </section>
  );
}
