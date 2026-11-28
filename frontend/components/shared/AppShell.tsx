"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { Sidebar } from "@/components/shared/Sidebar";
import { MobileBottomNav } from "@/components/shared/MobileBottomNav";

const AUTH_PATHS = ["/login", "/register"];
const PAGE_BACKGROUND = "#faf9f6";

export function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAuth = AUTH_PATHS.includes(pathname);

  const [collapsed, setCollapsed] = useState(false);

  if (isAuth) {
    return (
      <div className="flex min-h-dvh w-full items-center justify-center bg-[var(--bg-page)]">
        {children}
      </div>
    );
  }

  return (
    <div
      data-layout
      className="relative flex h-dvh w-full overflow-hidden"
      style={{ backgroundColor: PAGE_BACKGROUND }}
    >
      {/* Sidebar hanya tampil di layar desktop (>= md) */}
      <Sidebar
        collapsed={collapsed}
        onToggle={() => {
          setCollapsed((previous) => !previous);
        }}
      />

      {/* Area Konten Utama */}
      <main
        className={[
          "min-h-0 flex-1 overflow-y-auto pb-[calc(4.75rem+env(safe-area-inset-bottom))] transition-[margin] duration-200 ease-in-out md:pb-0",
          collapsed ? "md:ml-16" : "md:ml-[180px]",
        ].join(" ")}
        style={{ backgroundColor: PAGE_BACKGROUND }}
      >
        <div
          className="min-h-full w-full"
          style={{ backgroundColor: PAGE_BACKGROUND }}
        >
          {children}
        </div>
      </main>

      {/* Bottom Navigation hanya tampil di layar mobile (< md) */}
      <MobileBottomNav />
    </div>
  );
}