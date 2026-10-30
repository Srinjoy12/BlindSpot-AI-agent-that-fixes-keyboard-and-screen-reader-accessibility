# BlindSpot — Limitations & Responsible Use
*Transparency & Technical Boundaries · 2026*

## 1. What BlindSpot Is and Is Not

BlindSpot is an autonomous developer agent designed to catch, repair, and verify keyboard navigation barriers and accessibility tree defects in web interfaces.

### What BlindSpot Does:
- Drives a real Chromium browser using keyboard emulation (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
- Records physical focus stops, bounding boxes, visual focus indicator changes, and element obscuration.
- Evaluates 9 deterministic and heuristic detectors (D1–D9) against WCAG 2.2 Level A and AA criteria.
- Employs three tiered NVIDIA Nemotron models (Nano, Super, Ultra) hosted on Nebius Token Factory to digest page states, analyze human impact, and generate surgical patches.
- Re-runs the keyboard test in a fresh browser session to mathematically prove that the barrier is gone and no regressions were introduced.

### What BlindSpot Does NOT Do:
1. **Does Not Run Real Screen Reader Audio Software**: BlindSpot inspects the Chromium Accessibility Tree (CDP `Accessibility.getFullAXTree`), which is the exact data structure assistive technologies consume. However, it does not execute audio synthesizers or proprietary screen reader engines like NVDA, JAWS, or Apple VoiceOver.
2. **Does Not Guarantee Legal WCAG Certification**: BlindSpot is an engineering auditing tool, not a legal compliance certification body. Passing a BlindSpot audit does not guarantee immunity from accessibility lawsuits under the ADA or the European Accessibility Act.
3. **No Multi-Page Authenticated Crawling in MVP**: The current engine is scoped to single URL audits. Authenticated flows behind OAuth/passwords, multi-step checkout funnels, and enterprise intranet pages are not crawled.
4. **No Native Mobile Apps or PDFs**: BlindSpot only audits HTML/SVG web interfaces rendered in Chromium. Mobile native apps (iOS/Android) and static PDF documents are out of scope.
5. **No Automated Git Commits to Strangers' Repos**: BlindSpot delivers verified unified diffs and CSS/DOM runtime snippets. It never modifies user codebases without explicit developer action.
6. **React / Framework Support via Local Dev Bridge**: While the static "Open project folder" mode is designed for static entry points without a build step, modern component frameworks (React, Vite, Next.js) are supported through the **URL + Source Folder (Local Dev Server Bridge)** mode. In this workflow, BlindSpot audits your running local dev server (e.g. `http://localhost:5173`) and cross-references runtime accessibility barriers with attached source files (`src/`). BlindSpot localizes responsible `.tsx` components and provides idiomatic JSX translations. Important boundaries:
   - **Verification boundary**: While runtime DOM/HTML/CSS patches are strictly verified by re-crawling the browser, `.tsx` source code translations are deterministic suggestions produced via heuristic regex/string scoring and are not compiled or verified inside your project's bundler build pipeline.
   - **Isolation boundary**: The bridge operates strictly on loopback (`localhost`/`127.0.0.1`); all third-party origins and cross-port redirects are blocked. BlindSpot's own port (3000) is refused to prevent self-audit recursion loops.

---

## 2. Known Failure Cases & Edge Cases

Documenting boundaries and failure modes is a core engineering principle:
- **Airgapped External CDN & Font Blocking**:
  - In Project Folder mode and Local Dev Server Bridge mode, the sandbox blocks all outgoing network requests to external third-party origins (e.g. Google Fonts, Adobe Typekit, external CDN scripts, analytics) to maintain isolation and prevent SSRF / egress leaks.
  - Sites that rely on third-party fonts or remote stylesheets will fall back to system fonts or local CSS, which may cause layout, metrics, or rendering to differ slightly from production environments.
- **Local Dev Server Bridge Boundaries**:
  - Works only when the BlindSpot server runs on the same physical host as the local dev server.
  - If running in Docker, `localhost` resolves to the container environment unless host networking (`--network host`) is configured.
  - In this mode, verification is performed strictly on the runtime DOM patch. Source-level JSX/TSX files are identified via heuristic regex/string scoring rather than full AST compilation/matching and are not built/re-compiled; JSX snippets are provided as unverified suggestions.
  - **Testing Scope Disclosure**: The Local Dev Server Bridge was tested and verified end-to-end against a mock local dev server serving `fixtures/react-demo` (via `scripts/test-local-dev-bridge-e2e.ts`) rather than a live long-running Vite HMR dev server process.
- **Canvas and WebGL Elements**: Custom controls rendered purely inside HTML5 `<canvas>` or WebGL shaders without fallback ARIA DOM subtrees are invisible to the focus crawler.
- **Custom Faux-Focus Widgets**: Single-page apps that capture keyboard events and manually paint CSS classes onto container divs without updating `document.activeElement` may report unreachable controls.
- **Lazy-Loaded Content Beyond Scroll Depth**: Elements that only mount into the DOM after infinite scrolling beyond viewport limits may not be captured in the initial 150-stop crawl.
- **Benchmark Team Recall Bias**: Fixtures and detectors were written by the same team, so recall on them is optimistic.
- **Code Mode Verified-Diff Rate (52.9%) & Complex Component Rewrites**:
  In an earlier automated code mode evaluation run across 16 fixtures (`npm run bench:code`, whose raw output was not retained as a tracked artifact; `artifacts/benchmark_code_mode.json` is a smoke-run output), 18 of 34 attempted fixes were fully verified in airgapped Chromium. Fixes failed verification in fixtures B01, B02, B06, B07, B08, B09, B10, and B11 for two primary engineering reasons:
  1. *Diff Linter Threshold Rejections*: BlindSpot's diff linter strictly rejects patches that exceed size or blast-radius limits (`fix too large, not applied`). Complex widgets like B01 (modal trap script rewrite), B07 (mega menu keyboard handler), and B10 (tablist roving tabindex) tempt LLMs to rewrite entire blocks rather than surgical single-line patches.
  2. *Secondary Regression Detection*: Under our strict Rule 6 verification harness, a fix is marked `unverified` if the primary barrier was resolved but ANY new Blocker or Major regression was introduced. For example, in B08 (cookie banner) and B09 (carousel), the model eliminated the hover/focus barrier but inadvertently introduced tab order or focus-restoration defects on adjacent buttons. We intentionally refuse to count "partial" or buggy fixes as verified.

---

## 3. BlindSpot UI Self-Audit

As required by our engineering manifesto: *an accessibility tool with an inaccessible interface loses all credibility*.

Before freezing the build, BlindSpot ran its own audit engine and verification suite against its own running UI (`http://localhost:3000`), testing both the initial empty state and the tabbed results dashboard:

### Automated Crawler & Detector Findings:
- **axe-core Baseline Audit**: 0 violations reported (version 4.14.0).
- **Physical Keyboard Stops**: 14 forward focus stops captured across interactive controls; 36 backward stops.
- **Detector D2 (Unreachable Control) Finding on WAI-ARIA Tabs**:
  When BlindSpot's sequential forward `Tab`-only crawler audits the tabbed dashboard, detector D2 flags unselected tab buttons (`#blindspot-results-tab-*`) as unreachable. This is an honest and known limitation of sequential Tab crawling:
  - Following the official W3C WAI-ARIA Tabs Design Pattern, tabs use a **roving tabindex**: the currently active tab has `tabIndex={0}`, while all inactive tabs have `tabIndex={-1}`.
  - A keyboard user presses `Tab` to enter the active tab, and uses `ArrowLeft` / `ArrowRight` (or `Home` / `End`) to navigate between tabs.
  - Because BlindSpot's initial forward pass presses `Tab` rather than arrow keys within tablists, it correctly observes that inactive tabs cannot be reached via `Tab` alone.
  - This finding demonstrates why detector D2 is sensitive to custom navigation patterns, and serves as an important engineering reminder that roving tabindex widgets require arrow key emulation to evaluate reachability accurately.

### Interactive Accessibility Verification (WCAG 2.2 AA):
1. **Keyboard Operability**:
   - 100% of controls (URL input, code textarea, format radios, mode segments, example dropdown, theme toggle, step toggles, and results tabs) are fully operable via keyboard without a mouse.
   - SegmentedControl and Results Tabs support arrow key navigation (`ArrowLeft`, `ArrowRight`, `Home`, `End`) with automatic focus transfer.
   - Code diff containers and data tables have `tabIndex={0}`, `role="region"`, and accessible names so keyboard users can scroll wide content using arrow keys.
2. **Focus Indicators (WCAG 2.4.7 & 2.4.11)**:
   - High-visibility focus ring: `2px solid var(--color-focus-ring)` with `2px` offset on all interactive elements.
   - Contrast: Dark theme focus ring (#76B900) achieves 8.71:1 contrast; Light theme focus ring (#2E6B00) achieves 7.14:1 contrast (exceeding the 3:1 WCAG requirement).
   - No focus indicators are obscured by headers or modals.
3. **Semantic Hierarchy & Landmarks**:
   - Exactly one `<h1>` per view ("Autonomous Accessibility Engine").
   - Strict heading hierarchy (`h1` → `h2` → `h3`) with zero skipped levels.
   - Semantic landmarks: `<header role="banner">`, `<main id="main-content">`, `<footer role="contentinfo">`, `<nav aria-label="Main navigation">`.
   - Skip to main content link (`.skip-link`) positioned at top of DOM.
4. **Form Controls & Labelling**:
   - Every input, select, and textarea has a visible `<label>` or explicit `aria-label`.
   - Live character counter and airgap warning linked via `aria-describedby`.
5. **Live Progress Announcements**:
   - Progress stepper contains an `aria-live="polite"` region announcing each step sequentially: `"Step X of 6: [Step Name]"` and `"Audit complete: Finished in X.X s"`.
6. **No Keyboard Traps**:
   - Verified zero keyboard traps across all states. Focus flows forward and backward without obstruction.
   - Modals trap focus intentionally while open, close on `Escape`, and return focus to the trigger button.
7. **Prefers-Reduced-Motion**:
   - Full support for `@media (prefers-reduced-motion: reduce)` in `index.css`: all animations and transitions are clamped to 0.01ms.
8. **Zoom to 200% & Responsive Reflow**:
   - Tested at 1440, 1024, 768, and 390 px viewports, as well as 200% zoom (simulated at 640px).
   - Zero horizontal page scroll (`document.documentElement.scrollWidth <= document.documentElement.clientWidth`).
   - Tables scroll inside their container with visible focus rings.
   - Tab bar scrolls horizontally with touch momentum on small screens.
9. **Contrast Validation**:
   - Automated contrast test (`npm run test:contrast`): 114/114 assertions passed across both dark and light palettes. Primary text achieves 19.5:1 contrast ratio.

---

## 4. Responsible Use & Ethics

- **Respect for Disabled Users**: BlindSpot is built to empower developers to fix barriers; it does not pretend to speak on behalf of disabled individuals or replace manual usability testing by people with disabilities.
- **Safe Testing Policy**: Non-gallery URLs require a user attestation confirming ownership or authorized testing permission. BlindSpot will never be used to publicly shame, rank, or exploit third-party sites.
