"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Plus } from "lucide-react";
import { useAuth } from "@/context/AuthContext";
import { ApiError } from "@/lib/errors";
import { resolveColumnColor } from "@/lib/columnColor";
import { listComments } from "@/lib/services/commentsService";
import { showError } from "@/lib/toast";
import type { Card, ColumnColor, ColumnWithCards } from "@/lib/types/api";
import type { DragHandlers } from "@/hooks/useDragAndDrop";
import { BaseButton } from "@/components/shared/BaseButton";
import { BaseModal } from "@/components/shared/BaseModal";
import { AddCardForm } from "@/components/board/AddCardForm";
import { BoardCard } from "@/components/board/BoardCard";
import { ColumnHeader } from "@/components/board/ColumnHeader";

export const COLUMN_HAS_CARDS_MESSAGE =
  "This column still has cards. Move or delete them first.";

const COLUMN_SURFACE: Record<ColumnColor, string> = {
  gray: "bg-[#ECEEE9] border-[#DFE2DA]",
  blue: "bg-[#D8EAF8] border-[#C7DFF1]",
  orange: "bg-[#F9E8B5] border-[#F0DFA7]",
  green: "bg-[#D9EBCF] border-[#C9E1BF]",
  red: "bg-[#EADCF5] border-[#DDCBEF]",
};

const LABEL_STRIP_COLORS: Record<string, string> = {
  blue: "bg-blue-500",
  sky: "bg-sky-400",
  graphite: "bg-slate-600",
  silver: "bg-gray-300",
  red: "bg-red-500",
  orange: "bg-orange-400",
  green: "bg-emerald-500",
  purple: "bg-purple-500",
};

const INTERACTIVE_TARGET_SELECTOR = [
  "button",
  "a",
  "input",
  "textarea",
  "select",
  '[role="menu"]',
  '[role="menuitem"]',
  '[role="dialog"]',
  "[data-no-column-drag]",
].join(", ");

function formatShortDueDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso.slice(5, 10);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function getInlineCommentsCount(card: Card): number | undefined {
  const raw = card as unknown as Record<string, unknown>;
  if (typeof raw.comments_count === "number") return raw.comments_count;
  if (typeof raw.comment_count === "number") return raw.comment_count;
  if (Array.isArray(raw.comments)) return raw.comments.length;
  return undefined;
}

export interface BoardColumnProps {
  column: ColumnWithCards;
  onRename: (columnId: string, name: string) => Promise<void>;
  onDelete: (columnId: string) => Promise<void>;
  onUpdate?: (
    columnId: string,
    patch: { color?: ColumnColor | null; is_done?: boolean },
  ) => Promise<void>;
  onAddCard: (
    columnId: string,
    title: string,
    position?: "top",
  ) => Promise<void>;
  onOpenCard: (card: Card) => void;
  dragHandlers: DragHandlers;
  draggingCardId: string | null;
  now: Date;
  totalCount?: number;
  dragEnabled?: boolean;
  columnReorder?: ColumnReorderProps;
  index?: number;
  boardName?: string;
  onDeleteCard?: (card: Card) => Promise<void>;
  onDuplicateCard?: (card: Card) => Promise<void>;
  showAddCard?: boolean;
  onAddCardCancel?: () => void;
}

export interface ColumnReorderProps {
  draggingColumnId: string | null;
  onDragStart: (
    e: React.DragEvent<HTMLElement>,
    columnId: string,
  ) => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent<HTMLElement>) => void;
  onDrop: (
    e: React.DragEvent<HTMLElement>,
    targetColumnId: string,
  ) => void;
  onMove: (columnId: string, direction: -1 | 1) => void;
}

export function BoardColumn({
  column,
  onRename,
  onDelete,
  onUpdate,
  onAddCard,
  onOpenCard,
  dragHandlers,
  draggingCardId,
  totalCount,
  dragEnabled = true,
  columnReorder,
  index = 0,
  onDeleteCard,
  onDuplicateCard,
  showAddCard = false,
  onAddCardCancel,
}: BoardColumnProps) {
  const { token } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [fetchedCommentCounts, setFetchedCommentCounts] = useState<
    Record<string, number>
  >({});

  const [isAddingLocal, setIsAddingLocal] = useState(false);
  const isAdding = showAddCard || isAddingLocal;

  const [isSubmittingCard, setIsSubmittingCard] = useState(false);
  const [cardError, setCardError] = useState<string | null>(null);

  const [isAddingTop, setIsAddingTop] = useState(false);
  const [isSubmittingTopCard, setIsSubmittingTopCard] = useState(false);
  const [topCardError, setTopCardError] = useState<string | null>(null);

  const addTopButtonRef = useRef<HTMLButtonElement>(null);
  const sectionRef = useRef<HTMLElement>(null);
  const allowColumnDragRef = useRef(false);

  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  const [confirmingCardDelete, setConfirmingCardDelete] =
    useState<Card | null>(null);

  const [isDeletingCard, setIsDeletingCard] = useState(false);
  const [duplicatingCardId, setDuplicatingCardId] =
    useState<string | null>(null);

  const [isColumnDropTarget, setIsColumnDropTarget] = useState(false);

  const status = resolveColumnColor(column.color, index);
  const isDoneColumn = Boolean(column.is_done);

  const cards = [...column.cards].sort(
    (a, b) => a.order - b.order,
  );

  // Fetch comment counts for cards in this column when backend doesn't include them
  const cardIdsSignature = column.cards.map((c) => c.id).join(",");
  useEffect(() => {
    if (!token || column.cards.length === 0) return;
    let cancelled = false;

    const missingCards = column.cards.filter(
      (c) => getInlineCommentsCount(c) === undefined,
    );
    if (missingCards.length === 0) return;

    Promise.all(
      missingCards.map(async (c) => {
        try {
          const items = await listComments(token, c.id);
          return [c.id, items.length] as const;
        } catch {
          return null;
        }
      }),
    ).then((results) => {
      if (cancelled) return;
      const next: Record<string, number> = {};
      for (const entry of results) {
        if (entry) next[entry[0]] = entry[1];
      }
      if (Object.keys(next).length > 0) {
        setFetchedCommentCounts((prev) => ({ ...prev, ...next }));
      }
    });

    return () => {
      cancelled = true;
    };
  }, [token, cardIdsSignature, column.cards]);

  // Listen to live comment changes dispatched from CardDetailModal
  useEffect(() => {
    function handleCommentCountEvent(e: Event) {
      const custom = e as CustomEvent<{ cardId?: string; count?: number }>;
      const { cardId, count } = custom.detail ?? {};
      if (typeof cardId === "string" && typeof count === "number") {
        setFetchedCommentCounts((prev) => ({ ...prev, [cardId]: count }));
      }
    }

    window.addEventListener("revotask:card-comments-changed", handleCommentCountEvent);
    return () => {
      window.removeEventListener(
        "revotask:card-comments-changed",
        handleCommentCountEvent,
      );
    };
  }, []);

  const draggingColumnId = columnReorder?.draggingColumnId ?? null;
  const isDraggingThisColumn = draggingColumnId === column.id;
  const columnDragActive = draggingColumnId != null;
  const canDragColumn = Boolean(columnReorder) && draggingCardId == null;

  const cardDnd = dragEnabled && !columnDragActive;

  function isInteractiveTarget(target: EventTarget | null): boolean {
    if (!(target instanceof Element)) return false;
    return Boolean(target.closest(INTERACTIVE_TARGET_SELECTOR));
  }

  function handleColumnMouseDown(e: React.MouseEvent<HTMLElement>) {
    if (!canDragColumn || e.button !== 0) {
      allowColumnDragRef.current = false;
      return;
    }
    allowColumnDragRef.current = !isInteractiveTarget(e.target);
  }

  function handleColumnDragStartWithTilt(
    e: React.DragEvent<HTMLElement>,
    columnId: string,
  ) {
    if (!canDragColumn) {
      e.preventDefault();
      return;
    }
    const startedFromBlankArea =
      allowColumnDragRef.current || !isInteractiveTarget(e.target);
    allowColumnDragRef.current = false;
    if (!startedFromBlankArea) {
      e.preventDefault();
      return;
    }

    columnReorder?.onDragStart(e, columnId);
  }

  function handleColumnDragEndWithReset() {
    allowColumnDragRef.current = false;
    setIsColumnDropTarget(false);
    columnReorder?.onDragEnd();
  }

  async function handleRename(name: string) {
    setError(null);

    try {
      await onRename(column.id, name);
    } catch (err: unknown) {
      setError(
        err instanceof Error
          ? err.message
          : "Could not rename the column.",
      );
    }
  }

  async function handleUpdate(
    patch: { color?: ColumnColor | null; is_done?: boolean },
  ) {
    if (!onUpdate || isUpdating) return;

    setIsUpdating(true);

    try {
      await onUpdate(column.id, patch);
    } catch (err: unknown) {
      showError(
        err instanceof Error
          ? err.message
          : "Could not update the column.",
      );
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

      setIsAddingLocal(false);

      if (showAddCard) {
        onAddCardCancel?.();
      }
    } catch (err: unknown) {
      setCardError(
        err instanceof Error
          ? err.message
          : "Could not add the card.",
      );
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
      setTopCardError(
        err instanceof Error
          ? err.message
          : "Could not add the card.",
      );
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
      showError(
        err instanceof Error
          ? err.message
          : "Could not delete the card.",
      );
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
      // Error handled by parent.
    } finally {
      setDuplicatingCardId(null);
    }
  }

  return (
    <section
      ref={sectionRef}
      role="listitem"
      aria-label={column.name}
      data-column-id={column.id}
      data-status={status}
      data-done={isDoneColumn ? "true" : undefined}
      data-dragging={isDraggingThisColumn ? "true" : undefined}
      draggable={canDragColumn || undefined}
      onMouseDown={handleColumnMouseDown}
      onDragStart={
        canDragColumn
          ? (e) => handleColumnDragStartWithTilt(e, column.id)
          : undefined
      }
      onDragEnd={canDragColumn ? handleColumnDragEndWithReset : undefined}
      className={[
        "flex w-[84vw] min-w-[264px] max-w-[304px] sm:w-[292px] sm:min-w-[280px]",
        "shrink-0 snap-start flex-col",
        "overflow-hidden rounded-xl border",
        COLUMN_SURFACE[status],
        isDoneColumn ? "ring-1 ring-[#4E7A5E]/35" : "",
        "shadow-[0_1px_3px_rgba(31,51,40,0.04)]",
        "transition-all duration-150",
        canDragColumn ? "cursor-grab active:cursor-grabbing" : "",
        isDraggingThisColumn
          ? "opacity-90 ring-2 ring-[#7E9E8B] shadow-[0_10px_24px_rgba(22,43,34,0.14)]"
          : isColumnDropTarget && columnDragActive
            ? "ring-2 ring-[#526D5C] ring-offset-1"
            : "",
      ].join(" ")}
      onDragEnter={
        columnDragActive && !isDraggingThisColumn
          ? (e) => {
              e.preventDefault();
              setIsColumnDropTarget(true);
            }
          : undefined
      }
      onDragOver={
        columnDragActive
          ? (e) => {
              if (!isDraggingThisColumn) {
                setIsColumnDropTarget(true);
              }
              columnReorder?.onDragOver(e);
            }
          : cardDnd
            ? dragHandlers.onDragOver
            : undefined
      }
      onDragLeave={
        columnDragActive
          ? (e) => {
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) {
                setIsColumnDropTarget(false);
              }
            }
          : undefined
      }
      onDrop={
        columnDragActive
          ? (e) => {
              setIsColumnDropTarget(false);
              columnReorder?.onDrop(e, column.id);
            }
          : cardDnd
            ? (e) => dragHandlers.onDrop(e, column.id, null)
            : undefined
      }
    >
      {/* Column header */}
      <div className="px-3 pb-2.5 pt-3 sm:px-3.5">
        <ColumnHeader
          title={column.name}
          cardCount={cards.length}
          visibleCount={
            totalCount !== undefined ? cards.length : undefined
          }
          totalCount={totalCount}
          status={status}
          onRename={(name) => void handleRename(name)}
          onColumnDelete={() => setConfirmingDelete(true)}
          color={column.color}
          isDone={isDoneColumn}
          actionsDisabled={isUpdating}
          onAddTask={() => setIsAddingTop(true)}
          addTaskButtonRef={addTopButtonRef}
          onColorChange={
            onUpdate &&
            ((color) => void handleUpdate({ color }))
          }
          onDoneChange={
            onUpdate &&
            ((isDone) => void handleUpdate({ is_done: isDone }))
          }
          reorder={
            columnReorder
              ? {
                  columnId: column.id,
                  onDragStart: handleColumnDragStartWithTilt,
                  onDragEnd: handleColumnDragEndWithReset,
                  onMove: (direction) =>
                    columnReorder.onMove(column.id, direction),
                }
              : undefined
          }
        />

        {onUpdate && (
          <div className="mt-2 flex items-center justify-between gap-2">
            <button
              type="button"
              disabled={isUpdating}
              aria-pressed={isDoneColumn}
              onClick={() => void handleUpdate({ is_done: !isDoneColumn })}
              className={[
                "inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-2.5 py-1.5 text-[11px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50 sm:px-2 sm:py-1 sm:text-[10px]",
                isDoneColumn
                  ? "border-[#2D6A4F]/30 bg-[#E3F1E8] text-[#1D4E38] hover:bg-[#D5E9DC]"
                  : "border-black/10 bg-white/65 text-[#4E6356] hover:bg-white hover:text-[#162B22]",
              ].join(" ")}
            >
              <CheckCircle2
                size={12}
                strokeWidth={2}
                className={isDoneColumn ? "text-[#2D6A4F]" : "text-[#6E7A73]"}
                aria-hidden="true"
              />
              <span>
                {isDoneColumn ? "Done column" : "Mark as done column"}
              </span>
            </button>

            {isDoneColumn && (
              <span className="rounded bg-[#2D6A4F]/12 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-[#1D4E38]">
                Done
              </span>
            )}
          </div>
        )}
      </div>

      {/* Cards */}
      <div className="flex flex-1 flex-col gap-2.5 px-2 pb-3 sm:px-2.5">
        {error && (
          <p
            role="alert"
            className="rounded-lg bg-white/70 px-2.5 py-2 text-xs text-[#B34F48]"
          >
            {error}
          </p>
        )}

        {/* Add card to top */}
        {isAddingTop && (
          <div data-no-column-drag="true">
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
          </div>
        )}

        {cards.length === 0 ? (
          (totalCount ?? 0) === 0 && (
            <p className="py-6 text-center text-xs text-[#718078]">
              No tasks yet
            </p>
          )
        ) : (
          <ul className="flex list-none flex-col gap-2 p-0">
            {cards.map((card) => {
              const isDraggingThisCard = draggingCardId === card.id;
              const canDragCard = dragEnabled && (card.can_move ?? true);
              const hasLabels = Boolean(card.labels && card.labels.length > 0);
              const commentCount =
                fetchedCommentCounts[card.id] ?? getInlineCommentsCount(card);

              return (
                <li
                  key={card.id}
                  data-no-column-drag="true"
                  draggable={canDragCard || undefined}
                  className={[
                    "group/markdown rounded-xl transition-colors",
                    isDraggingThisCard
                      ? "opacity-90 ring-2 ring-[#7E9E8B] shadow-[0_10px_24px_rgba(22,43,34,0.14)]"
                      : "hover:bg-white/35",
                  ].join(" ")}
                  onDragStart={
                    canDragCard
                      ? (e) => {
                          e.stopPropagation();
                          allowColumnDragRef.current = false;
                          dragHandlers.onDragStart(e, card.id);
                        }
                      : undefined
                  }
                  onDragEnd={
                    canDragCard
                      ? (e) => {
                          e.stopPropagation();
                          dragHandlers.onDragEnd(e);
                        }
                      : undefined
                  }
                  onDragOver={cardDnd ? dragHandlers.onDragOver : undefined}
                  onDrop={
                    cardDnd
                      ? (e) => dragHandlers.onDrop(e, column.id, card.id)
                      : undefined
                  }
                >
                  <BoardCard
                    title={card.title}
                    description={card.description}
                    priority={card.priority ?? undefined}
                    dueDateLabel={
                      card.due_date ? formatShortDueDate(card.due_date) : null
                    }
                    commentsCount={commentCount}
                    isDragging={isDraggingThisCard}
                    isDoneColumn={isDoneColumn}
                    meta={
                      hasLabels ? (
                        <div className="flex flex-wrap items-center gap-1.5">
                          {card.labels?.map((label) => (
                            <span
                              key={label.id}
                              title={label.name}
                              aria-label={label.name}
                              className={`block h-1.5 w-8 rounded-full transition-opacity group-hover/markdown:opacity-95 ${
                                LABEL_STRIP_COLORS[label.color] ?? "bg-slate-500"
                              }`}
                            />
                          ))}
                        </div>
                      ) : undefined
                    }
                    onCardClick={() => onOpenCard(card)}
                    onCardMenu={
                      onDeleteCard || onDuplicateCard
                        ? {
                            onEdit: () => onOpenCard(card),
                            onDuplicate: () =>
                              void handleDuplicateCard(card),
                            onDelete: () =>
                              setConfirmingCardDelete(card),
                            isDuplicating:
                              duplicatingCardId === card.id,
                          }
                        : undefined
                    }
                  />
                </li>
              );
            })}
          </ul>
        )}

        {/* Add task at bottom */}
        {isAdding ? (
          <div data-no-column-drag="true">
            <AddCardForm
              onCardCreate={(title) => void handleAddCard(title)}
              onCancel={() => {
                setIsAddingLocal(false);
                setCardError(null);

                if (showAddCard) {
                  onAddCardCancel?.();
                }
              }}
              isSubmitting={isSubmittingCard}
              errorMessage={cardError}
            />
          </div>
        ) : (
          <button
            type="button"
            onClick={() => setIsAddingLocal(true)}
            aria-label={`Add card to ${column.name}`}
            className="flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-lg px-2.5 py-2.5 text-left text-xs font-medium text-[#526D5C] transition-colors hover:bg-white/40 hover:text-[#244438] sm:min-h-0 sm:px-2 sm:py-2 sm:text-[11px]"
          >
            <Plus size={14} strokeWidth={2} aria-hidden="true" />
            <span>Add a card</span>
          </button>
        )}
      </div>

      {/* Delete column modal */}
      <BaseModal
        isOpen={confirmingDelete}
        onClose={() => {
          if (!isDeleting) setConfirmingDelete(false);
        }}
        title={`Delete column "${column.name}"?`}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <BaseButton
            variant="secondary"
            disabled={isDeleting}
            onClick={() => setConfirmingDelete(false)}
          >
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

      {/* Delete card modal */}
      <BaseModal
        isOpen={confirmingCardDelete !== null}
        onClose={() => {
          if (!isDeletingCard) {
            setConfirmingCardDelete(null);
          }
        }}
        title={`Delete card "${confirmingCardDelete?.title ?? ""}"?`}
        maxWidth="max-w-sm"
      >
        <div className="flex flex-wrap justify-end gap-2">
          <BaseButton
            variant="secondary"
            disabled={isDeletingCard}
            onClick={() => setConfirmingCardDelete(null)}
          >
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