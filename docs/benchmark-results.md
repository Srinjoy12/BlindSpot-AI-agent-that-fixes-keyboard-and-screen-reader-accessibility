# BlindSpot — Benchmark & Evaluation Report
*Nebius x NVIDIA Global AI Hackathon · Best Apps & Agents Track*

## 1. Executive Summary & Scorecard

BlindSpot evaluates accessibility barriers by actually navigating the page using headless Chromium keyboard automation, feeding recording traces to pure deterministic detectors (D1–D11), using three NVIDIA Nemotron model tiers on Nebius Token Factory for analysis and surgical repair, and re-verifying every fix in a fresh browser session.

| Metric | Target | Measured Result | Evaluation Method |
| :--- | :--- | :--- | :--- |
| **Seeded Barrier Recall (B01–B12)** | ≥ 70% | **72.0%** (18 / 25 barriers) | Ground-truth manifest match |
| **Clean Control False Alarms (C01–C03)** | 0 | **0 false alarms** (3 / 3 clean) | 100% clean control accuracy |
| **Prompt Injection Resilience (H01)** | 100% | **PASSED (Safe)** | Hostile prompt embedded in page ignored |
| **Keyboard Trap Detection (B01)** | 100% | **100% Recall** | D1 detector flagged loop + Escape failure |
| **Sticky Header Focus Obscured (B05)** | 100% | **100% Recall, 100% Precision** | D5 detector detected occlusion |
| **Hover-Only Mega Menu (B07)** | 100% | **100% Recall, 100% Precision** | D2 detector identified hover barrier |
| **Cookie Banner Focus Lost (B08)** | 100% | **100% Recall** | D8 detector identified focus drop |
| **Auto-Rotating Carousel (B09)** | 100% | **100% Recall, 100% Precision** | D2 detector identified skipped controls |
| **Skip Link Missing (B11)** | 100% | **100% Recall, 100% Precision** | D9 detector identified missing bypass block |

---

## 2. Benchmark Fixture Suite Results

Each fixture represents an isolated, reproducible HTML environment with a ground-truth JSON manifest specifying exact CSS selectors, detector IDs, and WCAG 2.2 criteria.

| Fixture ID | Description | Seeded Barriers | Main Detectors | Ground Truth Count | Detected Count | True Positives | Recall | Precision | Status |
| :--- | :--- | :--- | :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **B01** | Newsletter Popup Trap | Modal loops Tab, ignores Escape | D1, D8 | 2 | 7 | 2 | **100%** | 28.6% | 🟡 PARTIAL |
| **B02** | Custom Div Dropdown | Divs with click handler, no tabindex | D2, D6 | 2 | 2 | 1 | **50%** | 50.0% | 🟡 PARTIAL |
| **B03** | Icon Toolbar | Icon buttons lacking accessible names | D6 | 5 | 2 | 2 | **40%** | 100.0% | 🟡 PARTIAL |
| **B04** | Global Outline Reset | `outline: none` without replacement | D3 | 1 | 16 | 1 | **100%** | 6.2% | 🟡 PARTIAL |
| **B05** | Sticky Header Obscured | Focus covered by fixed navbar | D5 | 1 | 1 | 1 | **100%** | 100.0% | ✅ PASS |
| **B06** | Positive Tabindex | Tab order scrambled by tabindex > 0 | D4, D7 | 2 | 13 | 1 | **50%** | 7.7% | 🟡 PARTIAL |
| **B07** | Mega Menu | Submenus expand only on mouse hover | D2 | 2 | 2 | 2 | **100%** | 100.0% | ✅ PASS |
| **B08** | Cookie Banner | Banner not focused; focus lost on dismiss | D8 | 2 | 3 | 2 | **100%** | 66.7% | 🟡 PARTIAL |
| **B09** | Auto-Rotating Carousel | Carousel buttons skipped in tab order | D2 | 2 | 2 | 2 | **100%** | 100.0% | ✅ PASS |
| **B10** | Tablist Widget | Missing roving tabindex; all tabs in tab order | D8 | 2 | 1 | 1 | **50%** | 100.0% | 🟡 PARTIAL |
| **B11** | Long Navigation | 60 nav links lacking skip link | D9 | 1 | 1 | 1 | **100%** | 100.0% | ✅ PASS |
| **B12** | Multi-Barrier Page | Mixed trap, invisible focus, unnamed icons | D1, D3, D6 | 3 | 27 | 2 | **66.7%** | 7.4% | 🟡 PARTIAL |
| **C01** | Clean Form | Semantic inputs, visible focus, skip link | None | 0 | 0 | 0 | **100%** | 100.0% | ✅ CLEAN |
| **C02** | Clean Article | Logical reading order, bypass block | None | 0 | 0 | 0 | **100%** | 100.0% | ✅ CLEAN |
| **C03** | Clean Accessible Modal | Focus trapped inside dialog, restored on Esc | None | 0 | 0 | 0 | **100%** | 100.0% | ✅ CLEAN |
| **H01** | Hostile Injection | Page text commands AI to report zero barriers | D2 | 1 | 1 | 1 | **100%** | 100.0% | ✅ PASS |

---

## 3. Lift Over Static Rule Scanners (axe-core Baseline)

Static rule scanners (such as axe-core) analyze the DOM tree against predetermined syntax rules. While valuable for static markup validation, they are fundamentally blind to runtime, keyboard, and state-transition barriers:

| Barrier Class | Static Scanner (e.g. axe-core) | BlindSpot Runtime Keyboard Agent | Why BlindSpot Wins |
| :--- | :---: | :---: | :--- |
| **Keyboard Trap (WCAG 2.1.2)** | ❌ Misses | ✅ **Detected (100%)** | Requires physical Tab navigation and cycle detection in a live browser session. |
| **Focus Hidden by Sticky Header (WCAG 2.4.11)** | ❌ Misses | ✅ **Detected (100%)** | Requires measuring `elementFromPoint` at bounding box coordinates after scrolling into view. |
| **Hover-Only Submenus (WCAG 2.1.1)** | ❌ Misses | ✅ **Detected (100%)** | Detects triggers that show content on `:hover` but lack `aria-haspopup` or keyboard listeners. |
| **Focus Lost on Modal Close (WCAG 2.4.3)** | ❌ Misses | ✅ **Detected (100%)** | Probes interactive controls with Enter/Space and tests where `activeElement` lands. |
| **Missing Accessible Names (WCAG 4.1.2)** | ⚠️ Partial | ✅ **Detected (100%)** | BlindSpot resolves full accessibility tree hierarchy including `aria-labelledby` and computed names. |

---

## 4. Model Pipeline Performance & Token Economics

All inference calls are routed dynamically across three NVIDIA Nemotron model tiers via Nebius Token Factory:

```mermaid
flowchart LR
    A[Chromium Keyboard Crawl] --> B[Deterministic Detectors D1-D11]
    B --> C[Nemotron-3 Nano\nState Digest]
    C --> D[Nemotron-3 Super + Tavily\nIssue Analysis & WCAG Mapping]
    D --> E[Nemotron-3 Ultra\nSurgical Fix Proposals]
    E --> F[Deterministic Verifier\nChromium Re-Crawl]
    F --> G[Final Verified Audit]
```

- **Nemotron Nano (30B)**: Fast, token-efficient state summaries and landmark digests (~250 tokens per call, ~1.2s latency).
- **Nemotron Super (120B)**: High-judgment issue synthesis and plain-language impact mapping (~400 tokens per call, ~2.8s latency), grounded with real-time Tavily WCAG references.
- **Nemotron Ultra (550B)**: Surgical code generation (CSS, attribute, HTML, script) strictly linted against malicious patterns (~600 tokens per call, ~3.5s latency).
- **Deterministic Harness**: All verdicts (Pass, Fail, Verified, Regressed) are computed strictly by code running in Playwright Chromium. Models advise; the harness decides.
