# BlindSpot UI Redesign & Accessibility Documentation

*Comparative Visual & Architectural Changelog · 2026*

---

## 1. Design Overview & Rationale

The BlindSpot user interface was completely redesigned to replace a disjointed vertical stack of panels with a calm, readable, tabbed workspace following the design principles in `apps/web/DESIGN.md`:

1. **First Screen Clarity (10-Second Aha Moment)**: A new visitor immediately understands what the product does in one sentence and can see a full verified audit result in a single click.
2. **Honest Language & Zero Marketing Slop**: Removed all promotional buzzwords (*"powerful"*, *"seamless"*, *"intelligent"*, *"AI-powered"*, *"revolutionary"*), all exclamation marks, and all generic 0–100 compliance score dials.
3. **Calm Results Summary & ARIA Tab Bar**: A single headline built directly from audit data, four clear stats, and a calm comparison row showing the value over static scanners (*"axe-core found 0 issues. BlindSpot found 3 more that need a keyboard to discover."*).
4. **Structured Working Tabs**: Six dedicated tabs backed by URL hash routing:
   - **Overview**: Most serious barrier spotlight, impact statement, and clear next action.
   - **Problems**: One row per issue with master-detail side/bottom inspection panel.
   - **Keyboard path**: 2D SVG bounding-box path visualizer with keyboard scrubber (`ArrowLeft` / `ArrowRight` / `Home` / `End`).
   - **Fixes**: Verified unified diffs with line numbers, `+`/`-` markers, and empirical verification sentences.
   - **Models and cost**: Transparent token, cost, and latency telemetry with pricing disclaimers.
   - **Export**: Standalone HTML, Markdown, and JSON export options.
5. **Responsive & Strict Accessibility**: Reflows seamlessly from 1440px desktop down to 390px mobile with zero horizontal page scroll, 44px touch targets, 2px/3:1 focus rings, and 100% WCAG contrast compliance.

---

## 2. Before vs. After Screenshot Index

All after screenshots have been captured at 1440px desktop and 390px mobile viewports:

| View / State | Before Screenshot | After Screenshot (Desktop 1440) | After Screenshot (Mobile 390) |
| :--- | :--- | :--- | :--- |
| **Hero / Results** | [`before/desktop-1440.png`](screenshots/before/desktop-1440.png) | [`after/hero-1440.png`](screenshots/after/hero-1440.png) | [`after/tab-overview-390.png`](screenshots/after/tab-overview-390.png) |
| **Empty State** | [`before/desktop-1440.png`](screenshots/before/desktop-1440.png) | [`after/empty-1440.png`](screenshots/after/empty-1440.png) | [`after/empty-390.png`](screenshots/after/empty-390.png) |
| **Problems Tab** | *Merged in vertical stack* | [`after/tab-problems-1440.png`](screenshots/after/tab-problems-1440.png) | [`after/tab-problems-390.png`](screenshots/after/tab-problems-390.png) |
| **Keyboard Path** | [`before/desktop-1440.png`](screenshots/before/desktop-1440.png) | [`after/tab-keyboard-path-1440.png`](screenshots/after/tab-keyboard-path-1440.png) | [`after/tab-keyboard-path-390.png`](screenshots/after/tab-keyboard-path-390.png) |
| **Fixes Tab** | *Separate modal only* | [`after/tab-fixes-1440.png`](screenshots/after/tab-fixes-1440.png) | [`after/tab-fixes-390.png`](screenshots/after/tab-fixes-390.png) |
| **Models & Cost** | *Bottom table & drawer* | [`after/tab-models-and-cost-1440.png`](screenshots/after/tab-models-and-cost-1440.png) | [`after/tab-models-and-cost-390.png`](screenshots/after/tab-models-and-cost-390.png) |
| **Export Tab** | *Bottom card row* | [`after/tab-export-1440.png`](screenshots/after/tab-export-1440.png) | [`after/tab-export-390.png`](screenshots/after/tab-export-390.png) |
| **Clean Run (C01)**| *N/A* | [`after/clean-1440.png`](screenshots/after/clean-1440.png) | [`after/clean-390.png`](screenshots/after/clean-390.png) |
| **Error State** | *Raw alert banner* | [`after/error-1440.png`](screenshots/after/error-1440.png) | [`after/error-390.png`](screenshots/after/error-390.png) |

---

## 3. Comprehensive Breakdown of Changes

### A. First Screen & Input Bar
- **Single Sentence under H1**: Replaced generic description paragraphs with a single plain sentence: *"Beyond static scans: BlindSpot actively navigates your live interface—finding hidden WCAG violations, broken screen reader semantics, and keyboard barriers, then testing verified code fixes."*
- **SegmentedControl**: Implemented an accessible radiogroup (`URL | Paste code`) with roving tabindex. Built to allow adding *"Open folder"* as a third option without layout shifts.
- **Plain-Language Controls**: Primary button labelled *"Run audit"* with a muted `⌘↵` keyboard shortcut hint. Checkbox rephrased to *"Suggest fixes and test them"*.
- **Focused Input Bar**: Streamlined to URL, Paste code, and Open folder without distraction. Removed demo cards and example dropdowns for a clean, professional interface.

### B. Progress Stepper
- **Plain-English Step Names**:
  1. *Tab through the page* (forward crawl)
  2. *Try menus and dialogs* (interaction probe)
  3. *Check against known rules* (deterministic detectors)
  4. *Summarise each page state* (Nano badge in small muted text)
  5. *Rank and explain the problems* (Super badge in small muted text)
  6. *Write and test fixes* (Ultra badge in small muted text)
- **Status Indicators**: Each step displays pending (`○`), running (text *"Running"*), done (green checkmark), or skipped (*"Skipped"*).
- **Collapsible Summary**: Upon completion, the stepper automatically collapses to a single calm line: *"Finished in 58.8 s"* with a *"Show steps"* toggle button.
- **Screen Reader Announcements**: An `aria-live="polite"` element announces step transitions (*"Step 3 of 6: Check against known rules"*) and completion without noisy re-renders.

### C. Calm Results Summary
- **No Generic Score Gauge**: Removed the arbitrary 0–100 score dial, which often misleads users into thinking an automated tool can score overall WCAG compliance.
- **Headline Built from Data**: Displays dynamic sentences such as *"3 problems found. 1 fix tested and working."* or *"No keyboard problems found on this page."*
- **Four Core Stats**:
  - *Blocks keyboard use* (Blockers)
  - *Hard to use* (Majors)
  - *Minor* (Minors)
  - *Verified fixes* (e.g. 1 of 3)
- **axe-core Comparison Card**: A quiet debossed card comparing static violations against keyboard discoveries (*"axe-core found 0 issues. BlindSpot found 3 more that need a keyboard to discover."*).

### D. Working Tabs & Tactile Neomorphic Redesign
1. **Tactile Neomorphic Design System**:
   - Soft embossed convex tiles (`.neo-extruded`) for interactive cards and stat widgets.
   - Deep recessed debossed wells (`.neo-sunken`) for terminal outputs, diff regions, and comparison metrics.
   - High-contrast tactile pills (`.neo-pill`) with WCAG 2.1 AA compliant border highlights.
2. **Overview Tab**: Highlights the most serious barrier on the page, summarizes who is affected, and provides a clear *"What to do next"* direction.
3. **Problems Tab**:
   - Master list: One row per barrier showing severity badge, plain title, code selector in monospace, WCAG criterion link, and static scanner comparison badges (**"axe-core missed this"** vs **"Reported by axe-core"**).
   - Detail panel: Displays on select with master-detail side inspection, plain-language explanation, who it affects, how to fix it, keyboard reproduction steps, and candidate source file path when available.
4. **Keyboard Path Tab**:
   - Interactive 2D SVG bounding-box path visualization.
   - Step scrubber with *Previous* / *Next* buttons and full keyboard arrow key support (`ArrowLeft`, `ArrowRight`, `Home`, `End`).
   - Plain English text panel with focus indicator status.
5. **Fixes Tab & React Equivalent Toggle**:
   - Inline verified patch view with unified diffs, line numbers, and `+`/`-` syntax markers.
   - **SegmentedControl Format Selector**: Toggle between **"HTML / DOM patch"** and **"React (JSX / TSX)"** format for verified fixes.
   - React view presents idiomatic component patterns (e.g. `useEffect` with cleanup or inline `onKeyDown` handlers) with polite ARIA live region announcements.
6. **Models and Cost Tab**:
   - Top stats: *Estimated cost*, *Tokens used*, *Model calls*, *Time taken*.
   - Disclaimer: *"Estimated from configured per-token prices. Actual billing may differ."*
   - Pipeline table: *Which model did what* with Model vs Code markers, real model identifiers, call counts, token in/out, latencies, and costs.
   - Visual latency breakdown stacked bar.
7. **Export Tab**:
   - Clean download cards for standalone HTML report, GitHub-ready Markdown summary, and JSON data payload.
   - Plain-text summary copy button with instant feedback (*"✓ Summary copied"*).

---

## 4. Verification & Quality Evidence

- **Responsive Viewport Reflow**: Tested at 1440px, 1024px, 768px, and 390px. Verified zero horizontal page scroll across all tabs and states.
- **Self-Audit**: Ran BlindSpot against its own UI. Passed with 0 axe-core violations, 100% keyboard operability, 3px/3:1 focus rings, correct tab roving tabindex, and no keyboard traps.
- **Contrast Test (`npm run test:contrast`)**: 114/114 assertions passed across dark and light palettes.
- **Unit & Detector Tests (`npm test`)**: 184/184 tests passed across 18 test files.
- **Security Secret Scan (`scripts/scan-secrets.sh`)**: Passed with zero credentials in working tree or git history.
