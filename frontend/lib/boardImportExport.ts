import type { BoardDetail, CardLabel } from "@/lib/types/api";

/** Shape of the exported JSON. No ids, no order fields, no secrets. */
export interface ExportedBoard {
  board: {
    name: string;
    columns: ExportedColumn[];
  };
}

export interface ExportedColumn {
  name: string;
  color: string | null;
  is_done: boolean;
  cards: ExportedCard[];
}

export interface ExportedCard {
  title: string;
  description: string | null;
  priority: string | null;
  due_date: string | null;
  labels: { name: string; color: string }[];
}

/**
 * Serialises board state to the import/export JSON shape.
 * Does not include ids, order fields, timestamps, or other internal fields.
 */
export function exportBoard(board: BoardDetail): string {
  const exported: ExportedBoard = {
    board: {
      name: board.name,
      columns: [...board.columns]
        .sort((a, b) => a.position - b.position)
        .map((col) => ({
          name: col.name,
          color: col.color,
          is_done: col.is_done,
          cards: [...col.cards]
            .sort((a, b) => a.order - b.order)
            .map((card) => ({
              title: card.title,
              description: card.description,
              priority: card.priority,
              due_date: card.due_date,
              labels: card.labels.map((l: CardLabel) => ({
                name: l.name,
                color: l.color,
              })),
            })),
        })),
    },
  };
  return JSON.stringify(exported, null, 2);
}

export interface ValidatedImport {
  valid: true;
  data: ExportedBoard;
}

export interface InvalidImport {
  valid: false;
  error: string;
}

export type ImportResult = ValidatedImport | InvalidImport;

/**
 * Validates the parsed JSON from an import file.
 * Unknown/extra fields are allowed.
 * Returns `{ valid: true, data }` or `{ valid: false, error }`.
 */
export function validateImport(json: unknown): ImportResult {
  if (json === null || typeof json !== "object" || Array.isArray(json)) {
    return { valid: false, error: "Invalid file: expected a JSON object." };
  }

  const root = json as Record<string, unknown>;

  if (!("board" in root) || root.board === null || typeof root.board !== "object" || Array.isArray(root.board)) {
    return { valid: false, error: "Invalid file: missing 'board' object." };
  }

  const board = root.board as Record<string, unknown>;

  if (!("columns" in board) || !Array.isArray(board.columns)) {
    return { valid: false, error: "Invalid file: 'board.columns' must be an array." };
  }

  const columns = board.columns as unknown[];

  for (let ci = 0; ci < columns.length; ci++) {
    const col = columns[ci];
    if (col === null || typeof col !== "object" || Array.isArray(col)) {
      return {
        valid: false,
        error: `Invalid file: column at index ${ci} must be an object.`,
      };
    }

    const colObj = col as Record<string, unknown>;

    if (typeof colObj.name !== "string") {
      return {
        valid: false,
        error: `Invalid file: each column must have a name (string). Column ${ci} is missing or has a non-string name.`,
      };
    }

    if ("cards" in colObj && colObj.cards !== undefined) {
      if (!Array.isArray(colObj.cards)) {
        return {
          valid: false,
          error: `Invalid file: 'cards' in column "${colObj.name}" must be an array.`,
        };
      }

      const cards = colObj.cards as unknown[];

      for (let ki = 0; ki < cards.length; ki++) {
        const card = cards[ki];
        if (card === null || typeof card !== "object" || Array.isArray(card)) {
          return {
            valid: false,
            error: `Invalid file: card at index ${ki} in column "${colObj.name}" must be an object.`,
          };
        }

        const cardObj = card as Record<string, unknown>;

        if (typeof cardObj.title !== "string") {
          return {
            valid: false,
            error: `Invalid file: each card must have a title (string). Card ${ki} in column "${colObj.name}" is missing or has a non-string title.`,
          };
        }
      }
    }
  }

  // Build a normalised copy so callers get typed data.
  const data: ExportedBoard = {
    board: {
      name: typeof board.name === "string" ? board.name : "",
      columns: (board.columns as Record<string, unknown>[]).map((col) => ({
        name: col.name as string,
        color: (col.color as string | null | undefined) ?? null,
        is_done: Boolean(col.is_done),
        cards: Array.isArray(col.cards)
          ? (col.cards as Record<string, unknown>[]).map((card) => ({
              title: card.title as string,
              description: typeof card.description === "string" ? card.description : null,
              priority: typeof card.priority === "string" ? card.priority : null,
              due_date: typeof card.due_date === "string" ? card.due_date : null,
              labels: Array.isArray(card.labels)
                ? (card.labels as Record<string, unknown>[])
                    .filter(
                      (l) => typeof l.name === "string" && typeof l.color === "string",
                    )
                    .map((l) => ({ name: l.name as string, color: l.color as string }))
                : [],
            }))
          : [],
      })),
    },
  };

  return { valid: true, data };
}
