---
inclusion: fileMatch
fileMatchPattern: "{app,components,styles}/**/*.{tsx,ts,css}"
---

# design_ui.md — Kanban Board UI Specification

> **Instruction to the AI implementing this:** Restyle the existing Next.js kanban board so it matches the reference screenshot (a clean, light, "Swift CRM"-style SaaS dashboard with a Kanban view). Replace the default Next.js theme completely. Keep all existing functionality (columns, cards, drag and drop, data model); change only layout, styling and components described here. Do not invent new features. Use the design tokens below, and use the BMW-inspired palette in section 2 as the color theme.

---

## 1. Overall Look & Feel

- Light, airy, high-whitespace SaaS UI. Soft gray page background, white floating panels, thin 1px borders, very subtle shadows.
- Rounded corners everywhere (panels 16px, cards 10–12px, buttons and inputs 8px, pills 6px).
- Typography: **Inter** (fallback: system-ui, sans-serif). Small, dense, legible text (12–14px). Semibold for titles, regular gray for metadata.
- Icons: outline style, 16–18px, 1.5px stroke (use `lucide-react`).
- Motion: 120–150ms ease-out on hover, focus and drag. No bouncy animations.

---

## 2. Design Tokens

Define these as CSS variables in `app/globals.css` and map them into the Tailwind config (if Tailwind is used).

```css
:root {
  /* Surfaces */
  --bg-page:        #E8EBF0;  /* outer page background */
  --bg-panel:       #FFFFFF;  /* main content panel, sidebar, cards */
  --bg-column:      #F1F2F4;  /* kanban column container */
  --bg-hover:       #F5F6F8;
  --bg-input:       #F6F7F9;

  /* Borders */
  --border:         #E4E6EB;
  --border-strong:  #D5D8DE;

  /* Text */
  --text-primary:   #14161A;
  --text-secondary: #5B6270;
  --text-muted:     #8B92A0;

  /* Brand (BMW-inspired blue, replaces the screenshot's bright blue) */
  --brand:          #1C69D4;  /* primary buttons, active nav marker */
  --brand-hover:    #0653B6;
  --brand-soft:     #E8F1FC;  /* soft-blue buttons (e.g. "Ask AI") */
  --brand-light:    #81C4FF;  /* highlights, focus ring */

  /* BMW M accents */
  --accent-red:     #E7222E;
  --accent-navy:    #0A1F44;

  /* Column / status pill colors */
  --pill-gray:      #8E949E;  /* e.g. Leads / Backlog */
  --pill-blue:      #1C69D4;  /* e.g. Discovery / In Progress */
  --pill-orange:    #F4802B;  /* e.g. Demo / Review */
  --pill-green:     #2FAE66;  /* e.g. Won / Done */

  /* Priority bars */
  --prio-high:      #E7222E;
  --prio-medium:    #F5A623;
  --prio-low:       #9AA3B2;

  /* Shape */
  --radius-panel:   16px;
  --radius-card:    12px;
  --radius-ctrl:    8px;
  --radius-pill:    6px;

  /* Shadow */
  --shadow-card:    0 1px 2px rgba(16,24,40,.06), 0 1px 3px rgba(16,24,40,.04);
  --shadow-drag:    0 12px 24px rgba(16,24,40,.18);
  --shadow-panel:   0 1px 3px rgba(16,24,40,.05);
}
```

**Type scale**

| Use | Size / Weight |
|---|---|
| Page title ("Deals" → board name) | 14px / 600 |
| Card company/project name | 14px / 600 |
| Card title | 13px / 400, `--text-secondary` |
| Meta (amount, date) | 12–13px / 500 and 400, `--text-muted` |
| Sidebar item | 14px / 500 |
| Button | 13px / 500 |
| Pill label | 12px / 600, white |

---

## 3. Page Layout (desktop ≥ 1280px)

```
┌──────┬───────────────┬──────────────────────────────────────────────┐
│ Icon │  Sidebar      │  Header (title + icon buttons)               │
│ rail │  (workspace,  ├──────────────────────────────────────────────┤
│ 56px │   nav,        │  Toolbar (search, actions, primary button)   │
│      │   favorites)  ├──────────────────────────────────────────────┤
│      │   ~215px      │  View tabs                 Filter Sort Group │
│      │               ├──────────────────────────────────────────────┤
│      │               │  Board: horizontally scrolling columns       │
└──────┴───────────────┴──────────────────────────────────────────────┘
```

- Page background `--bg-page`. The whole app sits on it with ~16px outer padding.
- **Icon rail** (far left): 56px wide, vertical stack of 32×32 rounded-8px app icons (active one has a soft background ring), a `+` button below, with space for footer elements.
- **Sidebar**: white panel, `--radius-panel`, ~215px wide, separated from the main panel by 12px gap.
- **Main panel**: white, `--radius-panel`, flex-1, with internal sections separated by 1px `--border` dividers. The board area scrolls horizontally; the page itself does not.

---

## 4. Components

### 4.1 Sidebar

1. **Workspace header**: 36px rounded-10px brand-blue logo tile (white glyph), app name (14px/600) with subtitle (12px muted), and a collapse chevron button (`«`) on the right.
2. **Team switcher card**: bordered white card, radius 12px. Top row: small logo, tiny muted label ("Mesh") above bold team name ("Product Team"), chevron-down at the right. Bottom row: three icon+number stats (members, tasks, projects) in muted gray, 12px.
3. **Primary nav list**: icon (18px) + label, 40px row height, radius 8px, 12px horizontal padding.
   - Active item: white background, 1px border, subtle shadow, and a 3px `--brand` marker on the left edge.
   - Hover: `--bg-hover`.
4. **Collapsible sections** ("Favorites", "Projects"): header row with chevron, label, and `…` and `+` icon buttons on the right. Children are indented 24px; favorites show a small orange star on the right.
5. **Footer links** (Integrations, Settings, Help Center): same row style; Settings and Help Center have a right chevron.
6. **User row** pinned to the bottom: 32px circular avatar, name (13px/600), email (12px muted), chevron-down.

### 4.2 Header Row

- Left: 16px icon + page title (e.g. board name).
- Right: three 36×36 bordered icon buttons (search, share, notifications), radius 8px.
- Height ~56px, bottom border `--border`.

### 4.3 Toolbar Row

- Left: **search input**, 180–240px, height 36px, `--bg-input`, 1px border, radius 8px, search icon, placeholder "Search deals" → use "Search tasks".
- Right (in order):
  - **Ask AI** — soft-blue button: `--brand-soft` background, `--brand` text, 1px `--brand-light` border, sparkle icon. Omit if the app has no AI feature.
  - **Settings** — white, bordered, gear icon.
  - **Imports / Export** — white, bordered split button with a dropdown chevron separated by a divider.
  - **Add New** — **primary**: `--brand` background, white text, plus icon, split button with a chevron on the right separated by a 1px translucent-white divider. Height 36px. Hover `--brand-hover`.

### 4.3.1 View Tabs and View Controls Row

- Left: **segmented control** on a `--bg-input` rounded track: `List`, `Kanban`, `Timeline` with 14px icons. The active segment is white with a subtle border and shadow and full-opacity text; inactive segments are muted gray.
- Right: three bordered white buttons — **Filter** (funnel icon), **Sort** (arrows icon), **Group** (loading-dots icon + chevron). Height 36px.

### 4.4 Kanban Board

- Container: horizontal flex, 16px gap, 16px padding, `overflow-x: auto`.
- **Column container**: width **~210px (min 210 / max 260)**, background `--bg-column`, radius 12px, padding 8px, 1px `--border`. Cards are stacked with 8px gap. Column height fits content, and the column body scrolls vertically if it exceeds the viewport.
- **Column header** (inside the container, above cards, 36px tall):
  - Drag handle (six-dot grip, muted) on the far left.
  - **Status pill**: colored background (see tokens), white 12px/600 text, padding 2px 8px, radius 6px.
  - **Count badge**: white rounded-6px box with the number, 12px.
  - Right side: `…` (column menu) and `+` (add card) icon buttons, muted, 24px hit area.
- **Column pill colors:** first column gray, second blue, third orange, last green. If there are more columns, cycle through gray → blue → orange → green → red (`--accent-red`).

### 4.5 Task Card

White card, `--radius-card`, 1px `--border`, `--shadow-card`, padding 12px, internal vertical gap 8px.

```
┌──────────────────────────────────┐
│ [logo] Project / Label       ··· │  ← row 1: 16px icon, 14px/600 name, kebab menu on right
│ Task title text                  │  ← row 2: 13px, secondary color (wraps to 2 lines max)
│ USD-style meta  •  Mar 6, 2025   │  ← row 3: bold value + muted dot + muted date
│ ──────────────────────────────── │  ← 1px divider
│ [▮▮▮] [ Tag chip ]               │  ← footer: priority icon + outlined tag chip
└──────────────────────────────────┘
```

- **Row 1**: small colored/brand icon (16×16, radius 4px) for the project or assignee, then project name. The kebab `···` shows on the right (always visible, muted).
- **Row 2**: task title.
- **Row 3**: primary meta value in 13px/500 `--text-primary`, a `•` separator in `--text-muted`, then the due date formatted `Mon D, YYYY` in 12px muted.
- **Divider**: 1px `--border`, full width of the card.
- **Footer**:
  - **Priority indicator**: 28×28 bordered square (radius 8px) containing a 3-bar mini chart icon. Fill bars by priority: High = 3 bars `--prio-high`, Medium = 2 bars `--prio-medium`, Low = 1 bar `--prio-low` (the remaining bars light gray).
  - **Tag/label chip**: white, 1px `--border-strong`, radius 8px, padding 4px 10px, 13px text, `--text-primary`.
- **Hover**: border becomes `--border-strong`, shadow slightly stronger.
- **Dragging**: card lifts with `--shadow-drag`, rotates 2°, opacity 0.95; the origin slot shows a dashed `--border-strong` placeholder at the same height.
- **Done cards**: title text with `line-through` and `--text-muted`.

### 4.6 Empty / Overflow States

- Empty column: dashed 1px `--border-strong` placeholder, radius 12px, centered muted text "No tasks".
- The last visible card may be clipped by the viewport bottom with a soft white fade (optional).

---

## 5. Data Mapping (from this CRM reference to the kanban app)

Adapt labels only; keep the visual structure.

| Reference | Kanban app |
|---|---|
| Deals (page title) | Board name |
| Column name pill (Leads, Discovery, Demo, Won) | Column / list name (e.g. Backlog, In Progress, Review, Done) |
| Company name + logo | Project name or assignee + small icon/avatar |
| Deal subtitle ("Follow up to Ryan") | Task title |
| Amount ("USD $5,000") | Primary meta field (e.g. assignee, estimate) — omit the row if the data does not exist |
| Date (Feb 25, 2025) | Due date |
| Bar icon in footer | Priority |
| Tag chip ("Ads Production") | Label / tag |
| "Add New" button | New task / new column |

---

## 6. Interaction Details

- **Add New** opens the existing create-task flow (modal or inline). The chevron opens a menu: New Task, New Column.
- **Column `+`** adds a card at the top of that column.
- **Drag handle** on the column header reorders columns; cards can be dragged between columns (keep the existing DnD library).
- **Search** filters cards live across all columns (case-insensitive).
- **Filter / Sort / Group** open popovers (white, radius 12px, `--shadow-drag`, 1px border).
- **Focus**: 2px `--brand-light` ring with 2px offset on all interactive elements. Keyboard operable throughout.

---

## 7. Responsive Behavior

- **≥ 1280px**: full layout as described.
- **768–1279px**: icon rail stays, sidebar collapses to icons only (56px), toolbar buttons keep icons and hide labels except "Add New".
- **< 768px**: hide the rail and sidebar behind a hamburger. Header and toolbar stack. Columns become horizontally scrollable at ~85% viewport width with scroll snapping.

---

## 9. Implementation Notes

- Stack: Next.js (App Router), TypeScript, Tailwind CSS with the tokens above, `lucide-react` for icons, `next/font` for Inter.
- **Light theme only** — dark mode has been removed. The sidebar no longer contains a theme toggle.
- Remove the default Next.js starter styles and page content.
- Suggested structure: `components/layout/{IconRail,Sidebar,Header,Toolbar}.tsx`, `components/board/{Board,Column,ColumnHeader,TaskCard,PriorityIcon}.tsx`, `styles/tokens.css`.
- Do not hard-code colors in components; reference tokens only.

## 10. Acceptance Checklist

- [ ] Background, panel, column and card colors match the tokens; no default Next.js styling remains.
- [ ] Layout has icon rail, sidebar, header, toolbar, view tabs and board as in section 3.
- [ ] Column headers show a drag handle, a colored pill, a count badge, `…` and `+`.
- [ ] Cards show project row, title, meta row, divider, priority icon and tag chip.
- [ ] Primary button is BMW blue; hover, focus, drag and done states work.
- [ ] Text contrast meets WCAG AA; all controls are keyboard accessible.
- [ ] Layout holds at 1440px, 1024px and 390px widths.
