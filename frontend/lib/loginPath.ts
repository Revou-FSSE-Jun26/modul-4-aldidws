/** Login URL that returns the user to `pathname` afterwards (plain /login for "/"). */
export function loginPath(pathname: string | null | undefined): string {
  return pathname && pathname !== "/"
    ? `/login?next=${encodeURIComponent(pathname)}`
    : "/login";
}
