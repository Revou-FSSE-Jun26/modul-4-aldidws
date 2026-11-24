/**
 * Initials for an avatar: first letter of up to two words of the name,
 * falling back to the first letter of the email local-part. Uses Array.from
 * so astral characters (emoji) are never split into lone surrogates.
 */
export function getInitials(name: string | null | undefined, email: string): string {
  const words = (name ?? "").trim().split(/\s+/).filter(Boolean);
  if (words.length > 0) {
    return words
      .slice(0, 2)
      .map((w) => Array.from(w)[0])
      .join("")
      .toUpperCase();
  }
  const local = email.split("@")[0]?.trim() ?? "";
  return (Array.from(local)[0] ?? "").toUpperCase();
}
