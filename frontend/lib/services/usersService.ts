import { get, patch } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { User } from "@/lib/types/api";

export function getMe(token: string): Promise<User> {
  return get<User>(apiPaths.me(), { token });
}

export function updateProfile(
  token: string,
  payload: { name?: string; timezone?: string },
): Promise<User> {
  return patch<User>(apiPaths.me(), payload, { token });
}
