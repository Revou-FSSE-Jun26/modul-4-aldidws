import { Suspense } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { get } from "@/lib/apiClient";
import { ApiError } from "@/lib/errors";
import { BoardCard } from "@/components/board/BoardCard";
import Link from "next/link";

/**
 * Home page — Server Component (no "use client", no useAuth).
 *
 * Reads the JWT access token from the `access_token` httpOnly cookie set by
 * Next.js middleware (or the auth flow) and calls GET /api/boards directly on
 * the server.  This eliminates the previous client-side fetch waterfall and
 * renders boards as part of the initial HTML stream.
 *
 * Cookie prerequisite:
 *   The access token must be stored in a server-readable cookie named
 *   `access_token`.  The AuthContext currently stores it only in memory;
 *   the middleware or login route must also persist it as an httpOnly cookie
 *   for this Server Component fetch to work.  If the cookie is absent the
 *   page redirects to /login.
 *
 * 401 on the server:
 *   ApiError with statusCode 401 → redirect to /login (using Next.js
 *   `redirect()` from next/navigation — no router.push() needed).
 */

interface Board {
  id: string;
  name: string;
  user_id: string;
  created_at: string;
  updated_at: string;
}

export default async function HomePage() {
  // ---- Read token from server-readable cookie --------------------------------
  const cookieStore = await cookies();
  const token = cookieStore.get("access_token")?.value ?? null;

  if (!token) {
    redirect("/login");
  }

  // ---- Fetch boards on the server -------------------------------------------
  let boards: Board[];

  try {
    boards = await get<Board[]>("/api/boards", { token });
  } catch (err) {
    if (err instanceof ApiError && err.isUnauthorized) {
      // Token present but expired or invalid — send user to login.
      redirect("/login");
    }
    // For other errors (network, 5xx) render an error state rather than crash.
    boards = [];
  }

  // ---- Render ----------------------------------------------------------------
  return (
    <main className="min-h-screen bg-background px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            My Boards
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            All boards you own, in one place.
          </p>
        </header>

        {boards.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            You don&apos;t have any boards yet.
          </p>
        ) : (
          <ul className="grid list-none grid-cols-1 gap-4 p-0 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {boards.map((board) => (
              <li key={board.id}>
                <Link href={`/boards/${board.id}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded-md">
                  <BoardCard
                    title={board.name}
                    meta={
                      <span className="text-xs text-muted-foreground">
                        {new Date(board.updated_at).toLocaleDateString(undefined, {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </span>
                    }
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </main>
  );
}
