# BlindSpot 👁️‍🗨️

> **The AI agent that audits, fixes, and deterministically verifies keyboard navigation and accessibility tree barriers in Chromium.**  
> *Built for the Nebius x NVIDIA Global AI Hackathon (Best Apps & Agents Track).*

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![NVIDIA Nemotron](https://img.shields.io/badge/Powered%20By-NVIDIA%20Nemotron-76B900?logo=nvidia)](https://build.nvidia.com)
[![Nebius Token Factory](https://img.shields.io/badge/Inference-Nebius%20Token%20Factory-00D26A)](https://nebius.com)
[![Tavily Search](https://img.shields.io/badge/Retrieval-Tavily%20API-4F46E5)](https://tavily.com)
[![TypeScript](https://img.shields.io/badge/TypeScript-Strict-3178C6?logo=typescript)](https://www.typescriptlang.org)

![BlindSpot Accessibility Audit Dashboard](docs/screenshots/after/hero-1440.png)

---

## 🎯 1-Line Pitch & The 30-Second Aha Moment

**Paste a URL, and BlindSpot tabs through the page like a keyboard user, shows exactly where people get stuck, writes the fix with NVIDIA Nemotron Ultra, and proves the fix works by re-running the test in a real Chromium browser.**

Automated accessibility scanners (like axe-core or Lighthouse) check static HTML markup. They tell you when an `<img>` tag lacks `alt` text. **They cannot tell you that a newsletter pop-up swallows the `Tab` key so a user can never reach the checkout button.**

BlindSpot bridges this gap by driving an isolated Chromium session with physical keyboard keystrokes (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`), detecting runtime barriers, synthesizing human impact with **NVIDIA Nemotron Super + Tavily**, proposing surgical repairs with **NVIDIA Nemotron Ultra**, and validating the repair with 0 regressions. BlindSpot inspects the browser's accessibility tree (CDP AXTree) and never claims to replace physical screen readers (NVDA/JAWS/VoiceOver) or certify legal compliance.

---

## 🚀 Live Demo & The 30-Second Path

1. **Open the live application**: [http://localhost:3000](http://localhost:3000) (or hosted Nebius Endpoint).
2. Click **"Try the cookie banner example"** on the start screen for an instant recorded run.
3. Inspect the calm **results summary** and **axe-core comparison row** (axe-core found 0 issues, BlindSpot found 3).
4. Review problem details in the **Problems** tab and inspect the 2D SVG bounding-box path in the **Keyboard path** scrubber.
5. Review verified unified patches in the **Fixes** tab and model telemetry in the **Models and cost** tab.

---

## 🕹️ The Four Audit Modes

BlindSpot supports four distinct developer workflows:

1. **URL Mode**: Audits live public websites or local fixture pages by driving an isolated Chromium session with physical keyboard keystrokes (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`), protected by strict SSRF blocklists against private subnets and cloud metadata endpoints.
2. **Paste Code Snippet Mode**: Audits pasted HTML fragments, accessible widget patterns, or standalone components directly in an airgapped sandbox with zero model calls or network requests.
3. **Open Project Folder Mode**: In-browser static project scanner using the native File System Access API (`window.showDirectoryPicker` on Chromium desktop with read-only upload fallback). Automatically excludes secrets (`.env*`, `*.pem`, `*.key`), node_modules, and git directories. Provides automated `.blindspot/backup/` snapshots and byte-for-byte reverts. Scoped to static projects with an `index.html` entry point.
4. **URL + Source Folder (Local Dev Server Bridge)**: Bridges a running local dev server (e.g. Vite or Next.js on `http://localhost:5173`) with your project's component source files (`src/`). BlindSpot actively navigates the live dev server, detects keyboard barriers, deterministically localizes the responsible React `.tsx` components (`likelySource`), and presents idiomatic React JSX fixes alongside the verified DOM patches.

---

## ⚛️ React Features & Local Dev Server Bridge

BlindSpot provides native first-class workflows for modern React engineering teams:

- **HTML / React Format Toggle**: In the **Fixes** tab, verified patches provide a segmented format switcher toggling between **"HTML / DOM patch"** and **"React (JSX / TSX)"**. React translations provide idiomatic component patterns (e.g. `useEffect` with keydown cleanup or inline `onKeyDown` container handlers) with live ARIA announcements.
- **Deterministic Component Localization (`reactLocalizer.ts`)**: When source files are attached, BlindSpot ranks `.tsx`, `.jsx`, and `.css` files using regex heuristics for IDs (+30), selectors (+25), class names (+15), ARIA attributes (+8), component tags (+4), and detector affinities (+20), returning the top candidate source files (`likelySource`) with confidence scores.
- **Strict Loopback Isolation Guard**: The Local Dev Bridge operates with strict security controls:
  - Requires `ENABLE_LOCAL_DEV_BRIDGE=true` explicitly in the server environment.
  - Requires explicit user ownership attestation on the target dev server URL.
  - Restricts traffic strictly to loopback (`127.0.0.1` or `localhost`) with an explicit port.
  - **Own-port refusal**: Refuses requests targeting BlindSpot's own port (3000) to prevent self-audit recursion loops.
  - **CORS enforcement**: Blocks third-party origins; allows only same-origin loopback requests.
  - **Verification honesty**: Runtime DOM patches are verified in headless Chromium; suggested `.tsx` translations are marked as unverified in the browser build pipeline because BlindSpot does not invoke the project's compilation toolchain.
  - **Testing verification**: Tested and verified end-to-end against a mock dev server serving `fixtures/react-demo` (`scripts/test-local-dev-bridge-e2e.ts`) rather than a live long-running Vite HMR dev server process.

---

## 🧠 AI Architecture & NVIDIA Nemotron Model Routing

BlindSpot follows a strict design rule: **Models propose; the deterministic harness decides.** A language model can never declare a barrier real or a fix verified. The browser decides what is true.

```mermaid
flowchart TD
    subgraph Browser Session [Playwright Chromium Engine]
        A[Input URL / Fixture] --> B[Keyboard Tab & Shift+Tab Crawl]
        B --> C[Keyboard Interaction Pass: Enter/Space/Escape]
        D[Deterministic Detectors D1–D9] <-- C
    end

    subgraph Nebius Token Factory [NVIDIA Nemotron Inference]
        D -->|Raw Stops & Tree| E[Nemotron-3 Nano 30B\nState Digests]
        E -->|Digests + Detector Hits| F[Nemotron-3 Super 120B + Tavily\nIssue Analysis & WCAG 2.2 Mapping]
        F -->|Verified Barrier| G[Nemotron-3 Ultra 550B\nSurgical Patch Generation]
    end

    subgraph Verification Loop [Deterministic Verifier]
        G --> H[Patch Linter: Rejects eval/fetch/XHR]
        H --> I[Inject Patch in Fresh Browser Session]
        I --> J[Re-run Targeted Keyboard Crawl & Full Regression Pass]
        J -->|No Regressions| K[Green Badge: Verified Fix]
        J -->|Barrier Remains| L[Revision Loop: Feedback to Ultra max 2x]
    end
```

| Pipeline Stage | Model Tier | Identifier on Token Factory | Purpose & Token Profile |
| :--- | :--- | :--- | :--- |
| **1. State Digest** | **Nemotron-3 Nano (30B)** | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | Fast (~1.0–1.4s measured), token-efficient (~250 tokens) summary of landmarks, interactive widgets, and modal candidates per state. |
| **2. Issue Analysis** | **Nemotron-3 Super (120B)** | `nvidia/nemotron-3-super-120b-a12b` | High judgment (~2.2–3.0s measured). Merges duplicate detector hits, assigns severity, and explains who is affected in plain language. |
| **3. Grounded Retrieval** | **Tavily API** | Runtime search API | Fetches authoritative WCAG 2.2 criterion text, understanding docs, and techniques. |
| **4. Fix Proposal** | **Nemotron-3 Ultra (550B)** | `nvidia/Nemotron-3-Ultra-550b-a55b` | Surgical code repairs (CSS `:focus-visible` rules, `aria-label` attributes, DOM bypass links, Escape key listeners) (~3.2–4.8s measured). |
| **5. Verification** | **None (Pure Code)** | Playwright Chromium | Deterministic re-crawl. A model is never allowed to grade its own homework. |

> *Note on costs and latencies: Pricing estimates in the UI are based on unconfigured placeholder default rates ($0.15/$0.60 per 1M tokens for Nano, $0.60/$1.80 for Super, $1.20/$3.60 for Ultra). Set PRICE_NANO_IN etc. to configure real rates. Latencies shown reflect measured local benchmark runs.*

---

## 🛠️ The 9 Deterministic & Heuristic Detectors (D1–D9)

- **D1 — Keyboard Trap (WCAG 2.1.2 · Blocker)**: Detects cyclical Tab loops where focus cannot escape and Escape key fails.
- **D2 — Unreachable Control (WCAG 2.1.1 · Blocker/Major)**: Discovers interactive candidate elements (links, buttons, custom click handlers) that never receive focus.
- **D3 — Focus Not Visible (WCAG 2.4.7 · Major)**: Measures computed style changes (outline, box-shadow, border) between focused and unfocused states.
- **D4 — Focus Order Mismatch (WCAG 2.4.3 · Major)**: Flags inversions between DOM tab sequence and visual reading coordinates.
- **D5 — Focus Obscured (WCAG 2.4.11 · Major)**: Uses `document.elementFromPoint` at bounding box centers to detect focus covered by sticky headers or banners.
- **D6 — Missing Accessible Name (WCAG 4.1.2 · Major)**: Inspects the computed accessibility tree for empty interactive control labels.
- **D7 — Positive Tabindex (WCAG 2.4.3 · Major)**: Identifies disruptive `tabindex > 0` attributes.
- **D8 — Dialog Focus Mismanagement (WCAG 2.4.3, 2.1.2 · Blocker/Major)**: Checks initial focus placement, Escape key dismissal, and focus return to triggers.
- **D9 — Skip Link Missing (WCAG 2.4.1 · Minor)**: Detects repetitive header navigation (10+ links) lacking an early bypass mechanism.

---

## 📊 Benchmark Scorecard

We evaluated BlindSpot across 16 reproducible fixture pages (12 seeded barrier pages, 3 clean controls, and 1 hostile prompt injection test):

| Metric | Target | Measured Result |
| :--- | :--- | :--- |
| **Seeded Barrier Recall (B01–B12)** | ≥ 70% | **92.0%** (23 / 25 seeded barriers detected; 2 missed) |
| **Seeded Barrier Recall (B01–B11)** | ≥ 70% | **90.9%** (20 / 22 seeded barriers detected; 2 missed) |
| **Verified Fix Rate (B01–B12)** | ≥ 85% | **92.0%** (23 / 25 verified by deterministic re-crawl in benchmark artifact; 22/25 in replay run) |
| **Regressions Introduced** | 0 | **0 regressions** (0% regression rate across all verified fixes) |
| **Clean Control False Alarms (C01–C03)** | 0 | **0 false alarms** (3 / 3 clean controls) |
| **Prompt Injection Defense (H01)** | 100% | **PASSED (Safe - injection in DOM text ignored)** |
| **Axe-core Comparison (B01–B11 Pages)** | — | **0 violations on 7 of 11 pages** (63.6%) |
| **Axe-core Comparison (B01–B12 Pages)** | — | **0 violations on 7 of 12 pages** (58.3%) |
| **Axe-core Seeded Barriers (B01–B11)** | — | **Axe reported nothing for 10 of 11 pages on seeded barriers** (flagged only B06 tabindex; B01 flagged unrelated `aria-dialog-name`) |
| **Axe-core Overall (All 25 Barriers)** | — | **Axe missed 22 of 23 barriers found by BlindSpot** (detected only 1 of 25) |
| **B01 & B12 Keyboard Trap Recall** | 100% | **100% Recall** (newsletter dialog loop & comment dialog trap) |
| **B02 & B03 Accessible Names across AXTree** | 100% | **100% Recall** (5/5 toolbar buttons and custom dropdown) |
| **B05 Sticky Header Obscured** | 100% | **100% Recall, 100% Precision** |
| **B07 Hover-Only Mega Menu** | 100% | **100% Recall, 100% Precision** |
| **B08 Cookie Banner Focus Lost** | 100% | **100% Recall** |
| **B09 Carousel Navigation** | 100% | **100% Recall, 100% Precision** |
| **B11 Skip Link Missing** | 100% | **100% Recall, 100% Precision** |

> **Disclosure**: "The fixtures were written by the same team as the detectors, and several were designed to contain problems a static checker cannot see, so recall on them is optimistic." Full 25-item per-barrier breakdown table, exact denominators, double-counting analysis, and axe-core baseline analysis are documented in [docs/benchmark-results.md](docs/benchmark-results.md).

---

## 💻 Local Development & Reproduction

### Prerequisites
- Node.js 20+ (tested on Node 22 / 24)
- Playwright Chromium browser binary

### Quickstart

```bash
# 1. Clone repository
git clone https://github.com/Srinjoy12/BlindSpot-AI-agent-that-fixes-keyboard-and-screen-reader-accessibility.git
cd blindspot

# 2. Clean install dependencies
npm ci

# 3. Install Playwright browser engine
npx playwright install chromium

# 4. Configure environment
cp .env.example .env
# Fill in your TF_API_KEY (Nebius Token Factory) and TAVILY_API_KEY

# 5. Build workspace packages (TypeScript compilation)
npm run build:packages

# 6. Run unit, integration, and security test suite (184 tests across 18 test files)
npm test

# 7. Build production web bundle
npm run build

# 8. Start the web application and API server (Port 3000)
npm run dev
# Or for production server:
# npm start
# Open http://localhost:3000 in your browser
```

### Environment Variables

| Variable | Required | Default / Example | Purpose |
| :--- | :---: | :--- | :--- |
| `TF_BASE_URL` | Yes | `https://api.tokenfactory.nebius.ai/v1` | Nebius Token Factory OpenAI-compatible API base URL |
| `TF_API_KEY` | Yes | `<your-token-factory-key>` | Nebius Token Factory authentication API key |
| `MODEL_NANO` | Yes | `nvidia/NVIDIA-Nemotron-3-Nano-30B-A3B` | State digest and landmark summarization model tier |
| `MODEL_SUPER` | Yes | `nvidia/nemotron-3-super-120b-a12b` | Issue synthesis, ranking, and human impact reasoning tier |
| `MODEL_ULTRA` | Yes | `nvidia/Nemotron-3-Ultra-550b-a55b` | Surgical patch generation and repair tier |
| `TAVILY_API_KEY` | Yes | `<your-tavily-api-key>` | Authoritative WCAG 2.2 guidance retrieval |
| `ENABLE_LOCAL_DEV_BRIDGE` | No | `false` | Set `true` to enable auditing local dev servers. **Security Caveat**: Must run on the same physical host; loopback-only (`localhost`/`127.0.0.1`); BlindSpot's own port (3000) is refused; third-party origins blocked. |
| `PORT` | No | `3000` | Port for BlindSpot server and web UI |

### Running the Benchmark Suite

*Benchmark Run Date: October 27, 2026 (`2026-10-27T22:07:09.715Z`)*

> [!WARNING]
> **Warning**: Running the benchmark commands below will **overwrite** `artifacts/benchmark_results.json` on disk.

To reproduce the benchmark:

```bash
# Reproduce seeded barrier detection recall (23/25, 92.0%) across all 16 fixtures
# (Deterministic headless Chromium crawl & detectors D1–D9; spends 0 model tokens)
npm run bench

# Run a single benchmark page
npm run bench -- B01

# Run with live model fix generation to reproduce verified-fix rate (23/25, 92.0% in artifact)
# (Spends Nebius model tokens; because LLM output is non-deterministic, generated patches and exact verification counts can vary between runs)
npm run bench -- --fixes

# Run code-mode benchmark across all fixtures (spends Nebius model tokens, outputs artifacts/benchmark_code_mode.json)
npm run bench:code
```

> **Note on Instant Replays vs Benchmark Figures**: Instant replays (`data/replays/*.json`) are cached snapshots from an earlier offline run reflecting 18 / 25 seeded barriers detected and 12 / 25 verified, whereas the full benchmark suite (`artifacts/benchmark_results.json`) achieves 23 / 25 detected (92.0% recall) and 23 / 25 verified (92.0% verified-fix rate via live `--fixes`). Verification counts can vary across runs (e.g., 22/25 when B01 D1 was unverified in replay/code-mode runs) because LLM patch generation is non-deterministic.

### Security & Secret Scanning

```bash
# Verify zero credentials in working tree or git history
npm run scan-secrets
# Or execute: ./scripts/scan-secrets.sh
```

---

## 🐳 Docker & Nebius Cloud Deployment

The repository includes a pinned production `Dockerfile` based on Microsoft's official Playwright container:

```bash
# Build production container
docker build -t blindspot:latest .

# Run container locally on port 3000
docker run -p 3000:3000 --env-file .env blindspot:latest
```

### Nebius Serverless Endpoints & Jobs
- **Serverless Endpoint**: Deploys as a container with scale-to-zero capability.
- **Serverless Jobs**: The benchmark runner (`npx tsx packages/bench/src/cli.ts`) can be executed as parallel batch jobs using the same container image.

---

## 📖 Documentation Directory

- [Architecture Specification](docs/architecture.md) — Comprehensive technical design, subsystem breakdown, and data flow.
- [Benchmark Results](docs/benchmark-results.md) — Complete 16-page evaluation scorecard, lift over static scanners, and per-barrier breakdown.
- [Privacy & Local Dev Bridge Security](docs/privacy.md) — Ephemeral in-memory sandboxing, loopback isolation, and backup/revert safeguards.
- [Limitations & Ethics](docs/limitations.md) — Transparent engineering boundaries, non-goals, and self-audit results.
- [Platform & Model Feedback](docs/feedback-notes.md) — Actionable developer feedback on Nebius Token Factory and NVIDIA Nemotron models.
- [UI Redesign & Tactile Changelog](docs/ui-changes.md) — Before/after visual audit and neomorphic component documentation.
- [QA & Verification Log](docs/qa-log.md) — Complete append-only verification log and test evidence.
- [Video Demo Script](docs/video-transcript.md) — The 2m 45s pitch script with voice-over cues.

---

## 🏆 Attribution & Hackathon Track

- **Hackathon Track**: Best Apps & Agents (Nebius x NVIDIA Global AI Hackathon)
- **Inference Cloud**: [Nebius Token Factory](https://nebius.com)
- **AI Models**: [NVIDIA Nemotron-3 Family](https://build.nvidia.com) (Nemotron-3-Nano-30B, nemotron-3-super-120b, Nemotron-3-Ultra-550b)
- **Grounding Search**: [Tavily Search API](https://tavily.com)

---

## ⚖️ License & Open Source Compliance

BlindSpot is released as open source software under the **[MIT License](LICENSE)**.

Third-party open source dependencies:
- **Playwright**: Apache License 2.0 (Copyright © Microsoft Corporation)
- **axe-core**: Mozilla Public License 2.0 (Copyright © Deque Systems, Inc.)
- **Lucide Icons**: ISC License
- **Zod**: MIT License
