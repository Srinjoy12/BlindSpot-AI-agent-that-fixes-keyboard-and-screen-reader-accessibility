# BlindSpot — Modern Minimalist Design Specification (DESIGN.md)

## 1. Concept & Direction
**Concept in one sentence:** An obsidian-toned, architectural developer workbench for browser accessibility engineering, inspired by Chrome DevTools and Linear, delivering deterministic keyboard traces and verified code patches with zero decorative ornament, zero pill shapes, and razor-sharp typographic hierarchy.

**Aesthetic Principles:**
- **Zero Pill Shapes:** Every badge, button, tag, and container uses crisp rectangular geometry with refined micro-radii (2px–4px) or architecturally sharp edges.
- **Zero AI-Slop Ornamentation:** No sparkles, no neon cyan halos, no floating glow shadows, no robot chips, no emojis. Only functional, clean technical symbols and typography.
- **Surface Contrast over Blur/Glow:** Hierarchy is expressed through discrete surface tone steps (`#0B0E14` → `#111620` → `#171D2A`) and razor-thin 1px borders (`#232B3B`), never blurry glassmorphism or colored drop shadows.
- **True Accessibility Workbench:** High-contrast text (AAA ≥ 15:1 for body, AA ≥ 6:1 for metadata), 2px solid focus rings with 2px offset, and clean keyboard ergonomics.

---

## 2. References & Influences
1. **Chrome DevTools & Playwright Trace Viewer:** Continuous timeline scrubber, coordinate inspector, accessible tree node inspection, and Monaco-style code diffs.
2. **Linear & Raycast:** Hairline grid borders, muted technical metadata, monospace tabular figures for performance metrics, and instant responsive interactions.
3. **GitHub CLI / Vercel Developer Experience:** Monochrome precision, single functional emerald accent (`#10B981`) for verified proofs, and dense, usable diagnostic matrices.

---

## 3. Exact Color Palette
Every color has a strict role and token name:

| Role | Token Variable | Hex Value | Function |
| :--- | :--- | :--- | :--- |
| **Canvas Background** | `--color-bg-canvas` | `#0B0E14` | Matte deep dark slate foundation |
| **Surface Primary** | `--color-surface-1` | `#111620` | Primary workbench panels and cards |
| **Surface Secondary** | `--color-surface-2` | `#171D2A` | Sub-cards, input fields, code viewports |
| **Surface Elevated** | `--color-surface-3` | `#1E2536` | Modals, active states, hover items |
| **Border Subdued** | `--color-border-subdued` | `#232B3B` | Structural hairline dividers |
| **Border Strong** | `--color-border-strong` | `#333F54` | Active borders and headers |
| **Border Focus** | `--color-border-focus` | `#3B82F6` | High-visibility focus indicator (WCAG 2.4.7) |
| **Text Primary** | `--color-text-primary` | `#F3F4F6` | Main headers and active values (15.5:1) |
| **Text Secondary** | `--color-text-secondary` | `#9CA3AF` | Labels and explanatory descriptions |
| **Text Muted** | `--color-text-muted` | `#6B7280` | Metadata and secondary counters |
| **Proof Accent (Verified)** | `--color-accent-emerald` | `#10B981` | Passing audits and verified patch proof |
| **Severity: Blocker** | `--color-severity-blocker` | `#EF4444` | Traps, missing names, unreachables |
| **Severity: Major** | `--color-severity-major` | `#F59E0B` | Obscured elements, missing focus rings |
| **Severity: Minor** | `--color-severity-minor` | `#60A5FA` | Secondary label & structure warnings |

---

## 4. Typography System
- **Interface Font:** `Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif`
- **Technical & Code Font:** `JetBrains Mono, Menlo, Consolas, monospace` (strictly for CSS selectors, DOM tags, coordinates, and timings)

### Scale & Hierarchy
- **App Brand:** 15px / 600 weight / tracking -0.01em
- **Section Heading:** 13px / 600 weight / uppercase / tracking 0.06em (`--color-text-muted`)
- **Metric Value:** 32px / 700 weight / tabular-nums
- **Body & Inspector Text:** 13px / 1.5 line-height / 400 weight
- **Code & Metadata:** 12px / 1.4 line-height / 500 weight (`JetBrains Mono`)

---

## 5. Spacing, Geometry & Shadows
- **Strictly No Pill Shapes:**
  - Micro-badges / tags: `border-radius: 2px`
  - Inputs & buttons: `border-radius: 4px`
  - Workbench cards & dialogs: `border-radius: 6px`
- **Zero Glow Shadows:** No `box-shadow` with bright colors or ambient glow.
  - Surface depth is achieved solely via surface tones (`#111620` vs `#171D2A`) and 1px borders.
  - Modal overlay: `0 16px 36px -4px rgba(0, 0, 0, 0.7)` (neutral black shadow only).

---

## 6. Component Architecture & Views
1. **Header:** Clean wordmark, quiet technical version tag (`v1.0`), model status, and live connection indicator without floating pills.
2. **Audit Workbench (Input Bar):**
   - Clean, high-contrast URL field with subtle prefix icon.
   - Ownership attestation indicator.
   - Quick fixture presets rendered as crisp, rectangular toggle chips.
   - Solid "Audit & Verify" button with keyboard shortcut (`⌘⏎`).
3. **Execution Telemetry (Pipeline Stepper):**
   - Clean horizontal progress ribbon with discrete numbered stages.
4. **Score & Diagnostic Ribbon:**
   - Unified metric card with large score (`80/100`), status rating, audit duration, and a clean tabular breakdown of Stops, Blockers, Majors, Minors, and Verified Fixes.
5. **Interactive Keyboard Trace Scrubber (Signature Component):**
   - Horizontal sequence timeline with stop numbers and element selectors.
   - Dedicated inspection panel with accessible name, tag/role, focus ring visibility check, bounding box, and scroll position.
6. **Barrier Matrix:**
   - Clean diagnostic list with square severity tags (`BLOCKER`, `MAJOR`, `MINOR`), WCAG criterion link, DOM selector, and a direct button to inspect the verified fix.
7. **Unified Diff Modal:**
   - Monaco/GitHub style side-by-side or unified code patch viewer with syntax highlighting and copy button.
8. **Model Ledger:**
   - Tabular telemetry breakdown of Nemotron Nano, Super, Ultra calls, tokens, and latency.
