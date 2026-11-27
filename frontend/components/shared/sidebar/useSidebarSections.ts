import { useEffect, useState } from "react";
import { SIDEBAR_SECTIONS_KEY } from "./constants";
import { writeLocalStorage } from "./utils";

interface SidebarSections {
  favorites: boolean;
  projects: boolean;
}

interface UseSidebarSectionsReturn {
  openSections: SidebarSections;
  toggleSection: (section: keyof SidebarSections) => void;
  isClient: boolean;
}

/**
 * Hook for managing sidebar section open/closed state with localStorage persistence.
 * Returns isClient flag to handle hydration safely.
 */
export function useSidebarSections(): UseSidebarSectionsReturn {
  const [isClient, setIsClient] = useState(false);
  const [openSections, setOpenSections] = useState<SidebarSections>({
    favorites: true,
    projects: true,
  });

  // Hydrate from localStorage once on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = window.localStorage.getItem(SIDEBAR_SECTIONS_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Partial<SidebarSections>;
          // eslint-disable-next-line react-hooks/set-state-in-effect -- Initial hydration from localStorage is intentional
          setOpenSections({
            favorites: parsed.favorites !== false,
            projects: parsed.projects !== false,
          });
        } catch {
          // Keep default state
        }
      }
      setIsClient(true);
    }
  }, []);

  function toggleSection(section: keyof SidebarSections) {
    setOpenSections((prev) => {
      const next = { ...prev, [section]: !prev[section] };
      writeLocalStorage(SIDEBAR_SECTIONS_KEY, JSON.stringify(next));
      return next;
    });
  }

  return { openSections, toggleSection, isClient };
}
