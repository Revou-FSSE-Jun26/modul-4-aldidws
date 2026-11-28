/**
 * One function per backend route. Card routes live under /api/v1,
 * everything else under /api.
 */

function qs(params: Record<string, string | number | boolean | undefined>): string {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== "") search.set(key, String(value));
  }
  const text = search.toString();
  return text ? `?${text}` : "";
}

const enc = encodeURIComponent;

export const apiPaths = {
  boardPage: (boardId: string) => `/boards/${enc(boardId)}`,

  login: () => "/api/auth/login",
  register: () => "/api/auth/register",

  me: () => "/api/users/me",
  workspaceSummary: () => "/api/users/me/summary",

  boards: () => "/api/boards",
  board: (boardId: string) => `/api/boards/${enc(boardId)}`,
  boardColumns: (boardId: string) => `/api/boards/${enc(boardId)}/columns`,

  reorderColumns: (boardId: string) => `/api/boards/${enc(boardId)}/columns/reorder`,
  column: (columnId: string) => `/api/columns/${enc(columnId)}`,

  columnCards: (columnId: string) => `/api/v1/columns/${enc(columnId)}/cards`,
  cards: (params: {
    search?: string;
    board_id?: string;
    mine?: boolean;
    page?: number;
    per_page?: number;
  } = {}) => `/api/v1/cards${qs(params)}`,
  card: (cardId: string) => `/api/v1/cards/${enc(cardId)}`,
  cardPosition: (cardId: string) => `/api/v1/cards/${enc(cardId)}/position`,

  boardLabels: (boardId: string) => `/api/boards/${enc(boardId)}/labels`,
  boardMembers: (boardId: string) => `/api/boards/${enc(boardId)}/members`,
  boardMember: (boardId: string, userId: string) =>
    `/api/boards/${enc(boardId)}/members/${enc(userId)}`,
  label: (labelId: string) => `/api/labels/${enc(labelId)}`,
  cardLabels: (cardId: string) => `/api/v1/cards/${enc(cardId)}/labels`,
  cardAssignees: (cardId: string) => `/api/v1/cards/${enc(cardId)}/assignees`,
  cardComments: (cardId: string) => `/api/cards/${enc(cardId)}/comments`,
  comment: (commentId: string) => `/api/comments/${enc(commentId)}`,

  notifications: () => "/api/notifications",
  notificationRead: (id: string) => `/api/notifications/${enc(id)}/read`,
};