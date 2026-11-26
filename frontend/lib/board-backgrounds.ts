/**
 * Board background gradient presets.
 * Colors are referenced by CSS variables keyed on data-board-bg="<id>".
 */
export const BOARD_BACKGROUNDS = [
  {
    id: "mint",
    name: "Mint",
    light: { from: "#BEEFD9", to: "#D3F1F2" },
  },
  {
    id: "teal",
    name: "Teal",
    light: { from: "#BFE6EC", to: "#DDF3F5" },
  },
  {
    id: "forest",
    name: "Forest",
    light: { from: "#C9EBD4", to: "#E3F5E8" },
  },
  {
    id: "lagoon",
    name: "Lagoon",
    light: { from: "#BDEAF0", to: "#D6F5EC" },
  },
  {
    id: "sage",
    name: "Sage",
    light: { from: "#D5E4DD", to: "#EAF2EE" },
  },
  {
    id: "midnight",
    name: "Midnight",
    light: { from: "#C4DEE0", to: "#DDF0EA" },
  },
] as const;

export type BoardBgId = (typeof BOARD_BACKGROUNDS)[number]["id"];
export const DEFAULT_BG_ID: BoardBgId = "mint";
