import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Task Management",
};

/**
 * Auth layout — no sidebar or icon rail.
 * Login and register pages are centered on a full-height page background.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--bg-page)]">
      {children}
    </div>
  );
}
