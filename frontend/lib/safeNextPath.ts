/**
 * Returns `next` only when it is a same-origin relative path; otherwise "/".
 * Rejects absolute URLs, protocol-relative URLs ("//host"), backslashes and
 * anything with a scheme.
 */
export function safeNextPath(next: string | null | undefined): string {
  if (!next) return "/";
  if (!next.startsWith("/")) return "/";
  if (next.startsWith("//")) return "/";
  if (next.includes("\\")) return "/";
  // A ":" before the first "/" is impossible once we require a leading "/",
  // but control characters can still be used to smuggle other targets.
  if (/[\u0000-\u001f]/.test(next)) return "/";
  return next;
}
