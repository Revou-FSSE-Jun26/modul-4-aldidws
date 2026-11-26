import type { ReactNode } from "react";

export const ANIMATION_DURATION_MS = 200;
export const SIDEBAR_COLLAPSED_KEY = "sidebar-collapsed";
export const SIDEBAR_SECTIONS_KEY = "sidebar-sections";

export interface NavLinkDef {
  label: string;
  href: string;
  icon: ReactNode;
}
