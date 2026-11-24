import { getWithMeta, patch } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { ApiNotification } from "@/lib/types/api";

export interface NotificationList {
  items: ApiNotification[];
  unreadCount: number;
}

export async function listNotifications(token: string): Promise<NotificationList> {
  const { data, meta } = await getWithMeta<ApiNotification[]>(apiPaths.notifications(), { token });
  const unreadCount = meta?.unread_count ?? data.filter((n) => !n.is_read).length;
  return { items: data, unreadCount };
}

export function markNotificationRead(token: string, id: string): Promise<ApiNotification> {
  return patch<ApiNotification>(apiPaths.notificationRead(id), {}, { token });
}
