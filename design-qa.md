# Connections design QA

## Evidence

- Source visual truth: Lovable project `9d202662-7e16-4edf-816f-2cfb76a8cc95`, route `/connections`, commit `873395585f80d09ad9aa2f8de13f9fd1e195f662`.
- Product-shell source capture: `.codex-lovable-connections-reference.png` (`1920 × 1080`, 1× density).
- Selected Connections-state reference: `C:\Users\awbostwick\.codex\generated_images\01a02556-5f38-7d12-b3ed-8d5a9db60a7f\exec-7dd271ce-e0dd-4730-9597-05177f2bd9cc.png` (`1672 × 941`, 1× density), derived from the Lovable `/connections` source with the Add MCP popover open.
- Implementation route: `/workspace/integrations`.
- Desktop implementation captures:
  - `design-qa-artifacts/connections-branded-desktop.png` (`1904 × 1528` rendered capture with all 14 provider marks visible).
  - `design-qa-artifacts/connections-branded-popover.png` (`1905 × 1072` viewport capture with the branded MCP catalog open).
- Responsive implementation captures:
  - `design-qa-artifacts/connections-branded-mobile.png` (`375 × 812` rendered viewport after browser chrome/scrollbar normalization).
  - `design-qa-artifacts/connections-branded-mobile-popover.png` (`375 × 812` rendered viewport after browser chrome/scrollbar normalization).
- Combined comparison input: `design-qa-artifacts/connections-branded-reference-comparison.png` (`1920 × 596`). The reference and implementation were normalized to equal `960 × 540` panels below a shared evidence header and inspected together.
- Tested browser viewport overrides: `1920 × 1080` desktop and `390 × 844` responsive; the browser capture surface excludes scrollbar width.
- Compared state: authenticated Connections page with `Add new MCP` open, `All` selected, empty search, and Logos visible.

## Full-view comparison evidence

Passed. The implementation retains the Lovable screen's essential hierarchy: product shell, compact route label, Connections title, connection-count summary, primary Add MCP action, repeated provider cards, and an anchored catalog panel. The production Workspace intentionally applies its established midnight, brass, and teal color system instead of the Lovable prototype's light canvas. The dark treatment is consistent with the rest of the Workspace and preserves contrast, typography hierarchy, and action prominence.

The implementation displays 14 truthful catalog entries instead of copying the prototype's smaller mock list. Seven entries have local QA metadata and seven remain catalog-only; no provider secrets, tokens, or production account details are rendered.

## Focused-region comparison evidence

Passed. The Add MCP panel follows the selected Lovable structure: title and close control, search field, horizontal category filters, two-column provider options on desktop, compact state actions, and an explicit selection detail area. At the responsive breakpoint it becomes a fixed, internally scrollable panel with single-column provider options. Search and category controls remain reachable without horizontal page overflow.

## Findings

- No P0, P1, or P2 visual discrepancies remain.
- Intentional product adaptation: light Lovable canvas → established Workspace dark command-center theme.
- Intentional content adaptation: prototype-only provider states → persisted local metadata plus clearly labeled catalog-only states.

## Required fidelity surfaces

- Fonts and typography: passed; serif display headings and compact operational labels align with the Workspace shell and preserve the Lovable hierarchy.
- Spacing and layout rhythm: passed at desktop and responsive breakpoints; cards, header actions, panel padding, and scroll regions remain aligned and uncropped.
- Colors and visual tokens: passed; midnight surfaces, teal edges/icons, brass primary action, and semantic state colors are consistent and legible.
- Image quality and asset fidelity: passed; Logos, Gmail, Slack, Google Calendar, Monday.com, LinkedIn, Google Drive, Firecrawl, Canva, and YouVersion use verified local brand assets, while ChatGPT, Claude, GitHub, and PowerPoint use crisp vector brand marks. All raster assets returned HTTP 200 locally with nonzero intrinsic dimensions, and the page makes no runtime calls to third-party icon hosts.
- Copy and content: passed; all 14 catalog entries are visible, Logos is prominent, and connection-state and Ministry-boundary language are explicit.

## Primary interactions and console

- Passed: Add MCP opens and automatically focuses `Search MCPs`.
- Passed: search for Logos, Faith category filtering, and Logos selection detail.
- Passed: Escape closes the panel and returns focus to `Add new MCP`.
- Passed: clicking outside closes the panel.
- Passed: all 14 cards are present on desktop and responsive layouts; offscreen responsive cards render as they enter the viewport.
- Passed: mobile panel search and all seven category controls are present; the category row is horizontally scrollable.
- Console: one Next.js development-only CSP warning reports that `eval()` is unavailable for React development debugging. The warning states that React does not use `eval()` in production, and the production build completed successfully. No application/runtime error was observed.

## Comparison history

- Initial pass: blocked because Chrome was not connected.
- Final branded pass: Chrome connected; authenticated desktop, open-popover, interaction, and responsive states captured after all provider marks loaded, then compared with the selected reference in one normalized side-by-side image.
- Visual fix completed after the first branded capture: the generic ChatGPT glyph was replaced by the recognizable OpenAI knot mark. The follow-up capture passed.

## Follow-up polish

None required for the requested Connections and Add MCP scope.

final result: passed
