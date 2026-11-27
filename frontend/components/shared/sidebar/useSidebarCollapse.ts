import { useEffect, useState } from "react";
import { SIDEBAR_COLLAPSED_KEY } from "./constants";
import { writeLocalStorage } from "./utils";

interface UseSidebarCollapseReturn {
  collapsed: boolean;
  toggleCollapsed: () => void;
  isClient: boolean;
}

/**
 * Hook for managing sidebar collapsed state with localStorage persistence.
 * Returns isClient flag to handle hydration safely.
 */
export function useSidebarCollapse(): UseSidebarCollapseReturn {
  const [isClient, setIsClient] = useState(false);
  const [collapsed, setCollapsed] = useState<boolean>(false);

  // Hydrate from localStorage once on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SIDEBAR_COLLAPSED_KEY);
      if (stored === "true") {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial hydration from localStorage is intentional
        setCollapsed(true);
      }
      setIsClient(true);
    }
  }, []);

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      writeLocalStorage(SIDEBAR_COLLAPSED_KEY, String(next));
      return next;
    });
  }

  return { collapsed, toggleCollapsed, isClient };
}
