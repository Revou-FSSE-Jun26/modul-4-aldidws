import { post } from "@/lib/apiClient";
import { apiPaths } from "@/lib/apiPaths";
import type { LoginResult } from "@/lib/types/api";

export function register(payload: {
  name: string;
  email: string;
  password: string;
}): Promise<{ id: string; email: string }> {
  return post<{ id: string; email: string }>(apiPaths.register(), payload);
}
export function login(email: string, password: string): Promise<LoginResult> {
  return post<LoginResult>(apiPaths.login(), { email, password });
}
