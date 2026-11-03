---
version: alpha
name: "ChessForge"
description: "A focused desktop chess-improvement studio built around the player's own games, analysis and deliberate practice."
colors:
  background: "#101820"
  sidebar: "#131F27"
  surface: "#17242D"
  raised: "#22333C"
  border: "#2A3A43"
  text: "#E8EDE7"
  muted: "#89999E"
  primary: "#B7E36A"
  secondary: "#D58B63"
  danger: "#D87570"
typography:
  sans:
    fontFamily: "'DM Sans', Inter, system-ui, sans-serif"
  display:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
  mono:
    fontFamily: "'DM Mono', ui-monospace, monospace"
rounded:
  sm: "4px"
  DEFAULT: "6px"
  md: "8px"
  lg: "11px"
spacing:
  page-inline: "30px"
  panel-padding: "16px"
  navigation-row: "35px"
components:
  panel: { radius: "8px", border: "1px solid #2A3A43" }
  button: { height: "32px", radius: "6px" }
  input: { height: "29px", radius: "6px" }
  chessboard: { radius: "3px", square-ratio: "1:1" }
---

# ChessForge Design System

## Overview

### Creative North Star
A professional chess analysis desk: the quiet precision of a tournament scoresheet, the legibility of a technical instrument and the tactile focus of a real chessboard. The board and its evaluation rail are the signature visual elements.

### Product context and register
- **Audience and primary job:** Initially one improving rapid player around 1200 Elo; later a multi-user product. Help the player understand recurring mistakes and practise them deliberately.
- **Target market(s) and evidence:** Initial personal use; public product expansion is a future possibility.
- **Locale(s) and language policy:** English first; use locale-aware formatting for dates, times and future user-facing regional preferences.
- **Usage scene:** Desktop application, frequent focused sessions, keyboard and mouse input, information-dense analysis.
- **Register:** Product-first, with restrained chess character.
- **Memorable signature:** Vertical evaluation rail paired with the interactive board and clickable game turning points.
- **Restraint:** Keep charts, labels and panels quiet; do not decorate every card with gradients or glow.
- **Anti-references:** Generic fintech dashboards, neon gamer interfaces, cartoon chess motifs, copied Chess.com/Lichess branding.
- **Token ownership/runtime mapping:** This file documents the approved design intent. Runtime values currently live in `src/styles.css`; keep both in sync when tokens change.

## Colors
Deep blue-charcoal is the working environment. The muted lime accent identifies primary actions, selected squares, recommended moves and positive progress. Copper is reserved for warnings and negative chess events. Red is reserved for destructive or serious error states. Maintain text contrast and never rely on color alone to classify a move.

## Typography
Space Grotesk is reserved for display headings and large metrics. DM Sans carries interface copy. DM Mono is used for chess notation, engine metadata and compact technical labels. Provide system fallbacks because the app must remain legible if external fonts are unavailable.

## Layout
Desktop-first with a collapsible left navigation, compact title bar and scrollable content area. Keep the dashboard scannable and make the analysis board the dominant object on the analysis screen. At narrower desktop widths, stack secondary panels below the board rather than shrinking the board into an unusable size.

## Elevation & Depth
Use tonal separation and thin borders instead of heavy shadows. Reserve a stronger shadow for modal overlays only. No glassmorphism or blurred cards.

## Shapes
Use restrained 4–11px radii. Panels are squared enough to feel like tools; buttons and inputs use consistent 6px corners. The chessboard itself has minimal rounding.

## Components
### Foundational visual states
Interactive controls have hover, focus-visible, pressed and disabled states. Selected navigation uses a muted green surface and lime marker. Loading states must preserve control dimensions.

### Buttons and actions
Primary actions use lime with dark text. Secondary actions use a raised dark surface and visible border. Destructive actions use red and remain visually separated from routine actions.

### Navigation and data display
The sidebar groups navigation by workspace, improvement and insights. Metrics use tabular-looking display numerals. Charts must have labels and text alternatives; rating histories from Chess.com and Lichess remain separate.

### Forms and overlays
Use app-owned dialogs, labelled controls and inline validation. Import supports a file-picker alternative to drag-and-drop. Never use browser alert/confirm/prompt dialogs.

### Iconography
Use Lucide outline icons with consistent 14–18px sizing. Chess piece glyphs are reserved for board positions, not decorative branding.

### Motion
Short 120–180ms transitions for hover and selection. Avoid ambient animation. Respect reduced-motion preferences.

### Content and data visualization
Use direct labels and explain what the data means. Empty states tell the user what action creates useful data. Never imply a weakness has been diagnosed without sufficient games.

## Do's and Don'ts
- **Do:** Show whether data is imported, estimated, sample or unavailable.
- **Do:** Keep engine output distinct from human learning explanations.
- **Don't:** imply the app can assist during live rated games.
- **Don't:** fabricate rating trends, game statistics or analysis results.
