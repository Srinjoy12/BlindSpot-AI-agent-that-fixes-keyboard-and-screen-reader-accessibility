# BlindSpot — Minimal Readable Design System (DESIGN.md)

## 1. Concept in One Sentence
An ultra-clean, architectural accessibility testing workbench anchored by NVIDIA Green `#76B900` and Nebius purple/indigo accents, prioritizing maximum readability, high-contrast typography, and zero decorative noise.

---

## 2. Reference Sites & Styles
1. **Linear & Chrome DevTools:**
   - Monospace tabular alignment for DOM paths, timings, and code diffs.
   - Quiet, structured surfaces with 1px hairline dividers instead of elevation/glows.
2. **NVIDIA Brand Language:**
   - NVIDIA Green `#76B900` as the sole primary interactive accent (CTA, verified proof, high-visibility focus ring).
   - Authoritative, clear technical hierarchy without consumer-facing decorative fluff.
3. **Nebius Brand Language:**
   - Nebius secondary accent (sampled `#614efa` / `#b186db`) dedicated exclusively to links, selected tabs, and "Found by BlindSpot only" markers.
   - Clean, geometric structure with high information density.

---

## 3. Exact Palette & Semantic Roles

All tokens are defined in CSS custom properties and rigorously verified via `npm run test:contrast` (WCAG 2.1 AA text ≥ 4.5:1, UI & focus rings ≥ 3:1).

### Brand Accent Sources
- **Primary Accent (`--color-accent-primary`):** `#76B900`
  *Source:* NVIDIA Brand Guidelines (`https://www.nvidia.com/en-us/about-nvidia/legal-info/brand-guidelines/`). Confirmed against public NVIDIA CSS.
- **Secondary Accent (`--color-accent-secondary`):**
  *Light theme:* `#5136E2` (accessible base corresponding to `#614efa` sampled from `https://nebius.com/_next/static/css/c44eba56dc823930.css` on 2026-10-27).
  *Dark theme:* `#B186DB` (sampled from `https://nebius.com/_next/static/css/d09a98cf4da412f0.css` on 2026-10-27).
  *Usage constraint:* Only used for links, selected-tab indicators, and the "Found by BlindSpot only" highlight.

### Dark Theme Tokens (Default)
| Role | Token | Hex | WCAG Contrast against Canvas / Surface 3 |
| :--- | :--- | :--- | :--- |
| Canvas Background | `--color-bg-canvas` | `#0C0E12` | Near-black foundation |
| Surface Primary | `--color-surface-1` | `#151820` | Primary cards, header, tables |
| Surface Secondary | `--color-surface-2` | `#1E222D` | Sub-cards, inputs, code backgrounds |
| Surface Elevated | `--color-surface-3` | `#282E3D` | Active segments, dialog overlays, tooltips |
| Border Subdued | `--color-border-subdued` | `#363E50` | Dividers, subtle outlines |
| Border UI (Interactive) | `--color-border-ui` | `#707A8F` | Input & button resting borders (≥ 3:1) |
| Border Strong | `--color-border-strong` | `#8E98AB` | Active & emphasized borders (≥ 4.5:1) |
| Focus Ring | `--color-focus-ring` | `#76B900` | 2px solid indicator (8.0:1) |
| Text Primary | `--color-text-primary` | `#F9FAFB` | Headings, active values (18.5:1 / 13.0:1) |
| Text Secondary | `--color-text-secondary` | `#D1D5DB` | Descriptions, labels (13.1:1 / 9.2:1) |
| Text Muted | `--color-text-muted` | `#A6ADB9` | Metadata, captions (8.5:1 / 6.0:1) |
| Secondary Accent | `--color-accent-secondary` | `#B186DB` | Links, active tab indicator, BlindSpot tag (6.7:1 / 4.7:1) |
| Severity: Blocker | `--color-severity-blocker` | `#FF7A7A` | Blocks use (7.6:1 / 5.4:1) |
| Severity: Major | `--color-severity-major` | `#FBBF24` | Hard to use (11.6:1 / 8.1:1) |
| Severity: Minor | `--color-severity-minor` | `#60A5FA` | Minor warning (7.6:1 / 5.3:1) |
| Success (Verified) | `--color-status-success` | `#34D399` | Verified patch (10.0:1 / 7.0:1) |

### Light Theme Tokens (`[data-theme="light"]`)
| Role | Token | Hex | WCAG Contrast against Canvas / Surface 3 |
| :--- | :--- | :--- | :--- |
| Canvas Background | `--color-bg-canvas` | `#FFFFFF` | Crisp white foundation |
| Surface Primary | `--color-surface-1` | `#F8F9FA` | Primary cards, header, tables |
| Surface Secondary | `--color-surface-2` | `#EEF0F4` | Inputs, sub-cards, table headers |
| Surface Elevated | `--color-surface-3` | `#E2E5EB` | Dialogs, active tab pills |
| Border Subdued | `--color-border-subdued` | `#D0D5DD` | Hairline dividers |
| Border UI (Interactive) | `--color-border-ui` | `#667085` | Input & button resting borders (≥ 3:1) |
| Border Strong | `--color-border-strong` | `#344054` | Emphasized borders (≥ 8:1) |
| Focus Ring | `--color-focus-ring` | `#2E6B00` | High-contrast forest green (6.5:1) |
| Text Primary | `--color-text-primary` | `#0F172A` | Headings, active values (17.8:1 / 14.1:1) |
| Text Secondary | `--color-text-secondary` | `#334155` | Explanations, body text (10.3:1 / 8.2:1) |
| Text Muted | `--color-text-muted` | `#526075` | Captions, metadata (6.4:1 / 5.1:1) |
| Secondary Accent | `--color-accent-secondary` | `#5136E2` | Links, active tab, BlindSpot tag (7.1:1 / 5.6:1) |
| Severity: Blocker | `--color-severity-blocker` | `#B91C1C` | Blocks use (6.5:1 / 5.1:1) |
| Severity: Major | `--color-severity-major` | `#92400E` | Hard to use (7.1:1 / 5.6:1) |
| Severity: Minor | `--color-severity-minor` | `#1D4ED8` | Minor warning (6.7:1 / 5.3:1) |
| Success (Verified) | `--color-status-success` | `#065F46` | Verified patch (7.7:1 / 6.1:1) |

---

## 4. Typography System
- **Interface Font:** System UI font stack (`system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`). Zero external network CDN requests, instant paint, zero layout shift.
- **Code & Technical Font:** System Monospace (`ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace`). Strictly reserved for CSS selectors, DOM tags, diffs, and coordinates.
- **Rules:**
  - Base size: 16px. Nothing below 14px in any UI element.
  - Line height: 1.5.
  - Two weights only: 400 (regular) and 600 (semibold).
  - Sentence case everywhere. All uppercase and letter-spaced labels removed.

### Type Scale
- Headline 1 (View Title): 28px / 600 weight / 1.3 line-height
- Headline 2 (Section Title): 20px / 600 weight / 1.4 line-height
- Headline 3 (Card / Panel Title): 16px / 600 weight / 1.5 line-height
- Body (Standard UI): 16px / 400 weight / 1.5 line-height
- Body Semibold (Buttons, Tab Labels): 16px / 600 weight / 1.5 line-height
- Small (Metadata, Secondary, Stat Labels): 14px / 400 or 600 weight / 1.5 line-height
- Code & Monospace: 14px / 400 or 600 weight / 1.5 line-height

---

## 5. Spacing, Radius, Shadow & Motion Rules
- **Spacing Scale (4px base):** Use only `8px` (`--space-2`), `12px` (`--space-3`), `16px` (`--space-4`), `24px` (`--space-6`), `32px` (`--space-8`), and `48px` (`--space-12`). No arbitrary margins or paddings.
- **Radius:** Strictly `6px` (`--radius-sm`) and `10px` (`--radius-md`) only. Zero pill shapes, zero circular tags.
- **Shadows:** None or one subtle shadow (`--shadow-subtle: 0 1px 2px rgba(0, 0, 0, 0.08)` / dark: `0 1px 2px rgba(0, 0, 0, 0.4)`).
- **Motion:** 150ms duration (`--transition-duration: 150ms`) with smooth easing (`cubic-bezier(0.16, 1, 0.3, 1)`). Fully disabled under `@media (prefers-reduced-motion: reduce)`.
- **Anti-Decoration Rules (Strict):**
  - No gradients.
  - No glows or neon halos.
  - No glassmorphism or `backdrop-filter: blur()`.
  - No decorative illustrations or emoji.
  - No shadows heavier than 1px offset subtle.
  - No more than one accent color per view region.
  - No badges unless carrying informative status.
  - No uniform grids of identical cards.
  - No loading skeleton shimmer or animated counters.

---

## 6. App Shell Architecture
- **Skip Link:** Accessible `<a href="#main-content" class="skip-link">Skip to main content</a>` as the first focusable element.
- **Landmarks:** `<header role="banner">`, `<nav aria-label="Main navigation">`, `<main id="main-content">`, `<footer role="contentinfo">`.
- **Top Bar:**
  - Product name "BlindSpot" on the left.
  - Navigation landmark with "Audit" link.
  - Right side: Accessible Theme toggle button ("Switch to light theme" / "Switch to dark theme") and one muted line "Built with Nebius Token Factory and NVIDIA Nemotron".
  - Chips removed ("Nemotron-3" and "Deterministic Chromium" chips moved to Models and Estimated Cost section).
- **Container Width:** Max 1120px, horizontally centered, 24px side padding (16px on mobile ≤ 640px).

---

## 7. Base Component Library (One Central Location)
Exported from `apps/web/src/components/ui/index.ts`:
1. **Button:** Primary (`#76B900` bg, black text), Secondary (surface bg, border, primary text), Quiet (transparent bg, secondary text).
2. **SegmentedControl:** Segmented selector with roving focus and arrow keys.
3. **Tabs:** WAI-ARIA tablist pattern with arrow keys, Home/End, roving `tabIndex`, and `aria-selected`.
4. **Card:** Quiet surface container with 1px border, 10px radius, used sparingly.
5. **Callout:** Informational, warning, or error message block with semantic icon and text label.
6. **Table:** Accessible tabular display with semantic `<thead>`, `<tbody>`, `<th> scope="col"`, `<th> scope="row"`.
7. **StatusIcon:** Accessible SVG icon shapes representing blocker (square with diagonal slash), major (triangle with exclamation), minor (circle with info), and success (circle with checkmark).
8. **Tooltip:** Strictly for definitions and abbreviations, never for essential interactive content.
9. **Stat:** One large legible number (16px/24px/32px) + one plain sentence-case label.

---

## 8. Results Architecture & Navigation (Tabs & Summary)
- **Top Summary Block (Above Tabs):**
  - Plain language headline built from crawl data (e.g. `"3 problems found. 1 fix tested and working."`; for clean runs: `"No keyboard problems found on this page."` with strictly zero claims of legal compliance).
  - Four metrics side by side:
    1. Blocks keyboard use (blockers count) with blocker StatusIcon (square-slash)
    2. Hard to use (majors count) with major StatusIcon (triangle-exclamation)
    3. Minor (minors count) with minor StatusIcon (circle-info)
    4. Fixes tested (ratio of tested fixes to total problems) with success StatusIcon (circle-check)
  - 0-100 score gauge removed in favor of direct, plain-language metrics.
- **Axe-core Comparison Row:**
  - One calm row beneath the summary (not a separate panel or heavy card).
  - Explicit count of static checker findings vs runtime keyboard barriers discovered by BlindSpot.
  - Side-by-side numbers: "Checker only" and "With keyboard test", showing axe-core version in muted text.
- **ARIA Tab Bar:**
  - Left-aligned, horizontally scrollable on mobile (`overflow-x: auto`), marked with secondary accent underline and bold label when selected.
  - Tabs:
    1. **Overview:** Most serious barrier expanded with impact, evidence, verified status, and a single-sentence "what to do next".
    2. **Problems:** Full barrier list with filterable severity ("Blocks keyboard use", "Hard to use", "Minor", "Fix tested").
    3. **Keyboard path:** Sequential tab crawl visualizer using "Tab stops" terminology.
    4. **Fixes:** Inline diffs and browser verification evidence with "Full screen" inspection option.
    5. **Models and cost:** Token Factory telemetry, model tiers, and estimated cost summary in tab label (e.g. `Models and cost · $0.04 (estimated)`).
    6. **Export:** Deliverables download (HTML, Markdown, JSON) plus one-click "Copy summary".
  - **URL Hash Synchronization:** Active tab synchronized to URL hash (`#overview`, `#problems`, `#keyboard-path`, `#fixes`, `#models-and-cost`, `#export`), surviving re-renders and streaming updates.
  - **Streaming State:** Tabs rendered with `disabled` and visible explanation `"Available after the scan"`.
- **Copy Table Replacements Applied:**
  | Old / Cryptic Label | New Design System Label |
  | :--- | :--- |
  | `Stops` | `Tab stops` |
  | `Blockers` | `Blocks keyboard use` |
  | `Majors` | `Hard to use` |
  | `Minors` | `Minor` |
  | `Obscured / missing` | Removed from badge; described in problem detail |
  | `Verified` / `Verified fix` | `Fix tested` |
  | `Runtime` | `Time taken` |
  | `Chromium tested` | `Tested in a real browser` |
- **Height Budget:** Entire summary block, axe comparison row, and tab bar are visible within a 1440 x 900 screen viewport without scrolling (bottom of tab bar ≤ 800px).

---

## 9. Three Main Working Tabs Specification

### A. Problems Tab
- **Header Help Text (No Tooltips for Essential Info):**
  - Text placed directly under the heading:
    `"A keyboard trap prevents someone using Tab from ever leaving an element. A focus indicator is the visual outline showing which element is currently active."`
- **One Row Per Problem:**
  - Severity: StatusIcon + text (`Blocks keyboard use` / `Hard to use` / `Minor`).
  - Plain Title: One-line plain English problem statement (e.g. `"Focus gets stuck in the cookie banner"` or `"Focus is lost to the page root when closing dialog or banner"`).
  - Page Element: Monospace secondary text (`#btn-reject`, `nav > a:nth-of-type(1)`).
  - WCAG Criterion: Short link-styled label (`2.4.3 Focus Order` / `2.1.2 No Keyboard Trap`).
  - Fix Status: Icon + text (`Fix tested` with checkmark icon / `Fix not tested` with neutral warning icon).
- **Master-Detail Panel:**
  - Wide screens (`≥ 960px`): Side panel layout (table on left ~55%, detail panel on right ~45%).
  - Narrow screens (`< 960px`): Detail panel renders below the list with smooth scroll-into-view.
  - Detail Panel Contents:
    - **What happens:** Plain English reproduction steps with the keyboard (e.g. `"1. Tab into the dialog and activate the close button. 2. Focus resets to the top of document.body instead of returning to the trigger."`).
    - **Who it affects:** Super model's human impact statement, restricted to 2–3 sentences maximum.
    - **Evidence:** Raw deterministic crawl evidence.
    - **Guidance Source:** W3C WCAG Understanding guidance link (`https://www.w3.org/WAI/WCAG22/Understanding/...`).
    - **The Fix:** Code patch / CSS rule / attribute repair with button to inspect in full diff.
    - **Fallback Callout:** When AI model call failed or timed out:
      `"Deterministic fallback used: AI model call failed or timed out; barrier classified with deterministic rule engine."`

### B. Keyboard Path Tab
- **Header Help Text:**
  - Placed under heading:
    `"The keyboard path tracks every sequential stop reached by pressing Tab, showing whether focus is visible and follows a logical order."`
- **Step Scrubber:**
  - Previous / Next buttons and arrow-key support (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
  - Stop counter: `"Tab stop X of Y"`.
  - Scrubber ribbon: Interactive buttons for each stop. Problem points are clearly marked with a barrier icon AND label (`[!] Barrier`), not color alone.
- **2D Bounding-Box / Path View:**
  - SVG / Canvas visualization of the page layout and focus path coordinates.
  - Numbered connecting arrows tracing tab progression from stop to stop.
  - Active stop highlighted with high-contrast ring (`var(--color-focus-ring)`).
- **Current Step Text Panel:**
  - Formatted text panel:
    `"Step {index}: {element description}. {Focus is visible / No visible outline}. {Next Tab goes to Step Y / wraps back to Step Z}."`
    Example: `"Step 12: Close button in the cookie banner. Focus is visible. Next Tab goes back to step 9."`
- **Before and After Toggle:**
  - When verified run data exists (`afterStops`), a toggle allows comparing the original run with the post-fix run.

### C. Fixes Tab
- **Header Help Text:**
  - Placed under heading:
    `"Verified fixes are tested in a real browser session to prove the barrier is eliminated without introducing regressions."`
- **For Each Fix:**
  - Heading: Problem name + status with icon & text:
    - `"Tested: the problem is gone"` (verified)
    - `"Not tested"` (unverified)
    - `"Rejected: change too large"` (rejected)
  - Attempts count in muted text: e.g. `"1 attempt"`.
  - Unified Diff:
    - Line numbers column (`oldLineNumber`, `newLineNumber`).
    - `+` / `-` / ` ` prefix markers.
    - High-contrast syntax highlighting on muted green/red backgrounds.
  - Verification Evidence Sentence:
    - Short evidence sentence from verification (e.g. `"Focus now reaches the footer in 18 presses"` or `"Tested in a real browser: barrier eliminated with zero regressions."`).
  - Action Buttons:
    - `"Copy fix"` (copies patch diff/code).
    - `"Copy patched file"` / `"Apply to folder"` (when full source or folder mode is available).
    - `"Full screen ↗"` modal trigger.

### D. Typography & Accessibility
- 16px base body (`var(--font-size-base)`).
- 14px minimum for secondary text, labels, and metadata (`var(--font-size-sm)`).
- Monospace strictly for code, selectors, and diff lines (`var(--font-mono)`).
- No tooltips for essential information.

### E. Models and Cost Tab Specification
- **Top Row Numbers (Stat components):**
  - "Estimated cost", "Tokens used" (in + out), "Model calls", "Time taken".
  - Subtext under cost: `"Estimated from configured per-token prices. Actual billing may differ."`
  - Fallback: If prices not configured, display `"Price not configured"` while preserving tokens and time.
- **Which Model Did What (Table):**
  - Columns: `Model`, `Type` (`Model` vs `Code`), `What it does`, `Calls`, `Tokens in`, `Tokens out`, `Time`, `Estimated cost`.
  - Caption: `Which model did what: complete execution breakdown in pipeline order`.
  - Plain language definitions:
    - Playwright (Code): `"Presses keys and measures the page"`
    - axe-core (Code): `"Standard checker used as a baseline"`
    - Nano (Model): `"Summarises each page state"`
    - Super (Model): `"Ranks problems and explains who is affected"`
    - Tavily (Code): `"Looks up current WCAG guidance"`
    - Ultra (Model): `"Writes and re-writes fixes"`
  - Table footer (`<tfoot>`): Run totals summing the calls, tokens in, tokens out, time, and cost.
- **Where the Time Went:**
  - One horizontal stacked bar with crawl, axe, models, and verification.
  - Text labels inside slices and text legend below with seconds.
  - Primary accent (NVIDIA green), secondary accent (Nebius), and neutrals.
- **Cost per Tested Fix:**
  - One sentence when `fixesVerified > 0`: e.g. `"About $0.02 per fix that passed testing"`. Hidden when 0.
- **Today's Budget:**
  - Native `<progress>` element with text label: `"{X}% of today's token budget used"`.
- **Latency Per Call (Expandable):**
  - Collapsed by default button: `"Show each call"`.
  - Expandable list showing time, real model name, tokens, and result (`ok`, `retried`, `invalid output`, `fallback`, `error`).
- **Privacy Notice:**
  - Single line of muted text:
    `"Page text is sent to NVIDIA Nemotron models on Nebius Token Factory. Nothing is stored after the run."`
- **Recorded Run State:**
  - Displays notice: `"Recorded run: figures are from the original run"` when reviewing recorded runs.


