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
  login: () => "/api/auth/login",
  register: () => "/api/auth/register",

  me: () => "/api/users/me",

  boards: () => "/api/boards",
  board: (boardId: string) => `/api/boards/${enc(boardId)}`,
  boardColumns: (boardId: string) => `/api/boards/${enc(boardId)}/columns`,

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

  cardComments: (cardId: string) => `/api/cards/${enc(cardId)}/comments`,
  comment: (commentId: string) => `/api/comments/${enc(commentId)}`,

  notifications: () => "/api/notifications",
  notificationRead: (id: string) => `/api/notifications/${enc(id)}/read`,
};
