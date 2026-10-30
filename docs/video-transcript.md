# BlindSpot — Demo Video Script & Voice-Over Transcript
**Hackathon Track:** Nebius x NVIDIA Global AI Hackathon (Best Apps & Agents Track)  
**Total Target Duration:** 2:45 (Window: 2:40 – 2:50 | Hard Maximum: 3:00)  
**Target Speaking Pace:** ~148 words per minute (~406 spoken words)  
**Audio Track:** Clean spoken voiceover; optional royalty-free ambient background music at -24 dB (e.g., Kevin MacLeod / Creative Commons Attribution). No third-party logos or trademarks on screen (text-only attributions).

---

## Shot-by-Shot Video Script

| Time | On screen (exact actions) | Voice-over (exact words) |
| :--- | :--- | :--- |
| **0:00 – 0:15**<br>*(15 s)* | **The Hook: The Trapped User**<br>Browser window showing a live e-commerce site with an open modal dialog (`#newsletter-dialog`). A visible focus indicator jumps from email input to Subscribe button to close link. The user presses `Tab` repeatedly; focus cycles endlessly inside the modal without escaping to the page or the checkout button below. The user hits `Escape`; the dialog remains stuck open. Visual key-press badge displays: `[Tab] [Tab] [Tab] [Escape]`. | *"When a newsletter popup opens, a keyboard user can easily get trapped. Pressing Tab loops forever, Escape does nothing, and the main page is unreachable. Static scanners miss this because every tag in the HTML looks valid."* |
| **0:15 – 0:45**<br>*(30 s)* | **The Audit: Headless Crawl & Stepper**<br>Switch to BlindSpot's high-contrast dark theme dashboard (`http://localhost:3000`). Under the **URL** mode in `AuditBar`, select preset `"B01: Newsletter popup — keyboard trap"`. Ensure the checkbox `"Suggest fixes and test them"` is checked. Click the **"Audit URL"** button (or instant replay).<br>The 6-step progress stepper illuminates live:<br>1. *Tab through the page* (Playwright Chromium crawl)<br>2. *Try menus and dialogs* (`Enter`/`Space`/`Escape` pass)<br>3. *Check against known rules* (Detectors D1–D9)<br>4. *Summarise each page state* (Nemotron Nano 30B)<br>5. *Rank and explain the problems* (Nemotron Super 120B)<br>6. *Write and test fixes* (Nemotron Ultra 550B).<br>Stepper collapses to *"Finished in 4.2s"*. The headline displays: *"7 problems found. 1 fix tested and working."* Below it, the axe-core comparison card highlights: *"axe-core found 1 issue. BlindSpot found more that need a keyboard to discover."* | *"BlindSpot audits runtime accessibility in headless Chromium. We run the newsletter trap fixture with fixes enabled. A physical crawler tabs through the page, runs interaction tests, and evaluates nine deterministic detectors. Nemotron Nano summarizes page states, Super ranks issues against WCAG 2.2, and Ultra drafts fixes. axe-core found one static issue, but BlindSpot found the barriers that need a keyboard to discover."* |
| **0:45 – 1:10**<br>*(25 s)* | **Keyboard Path: Deterministic Discovery**<br>Click the **Keyboard Path** tab (`#keyboard-path`). The 2D SVG canvas renders the page wireframe with a polyline trace connecting all focus stops. Drag the scrubber pill sequence through stops 1 to 6. Focus stop 3 (`#subscribe-btn`) lights up with a red barrier badge. The inspector pane reveals: selector `#subscribe-btn`, tag `<button>`, role `button`, bounding box, and zero obscuration. The alert highlights: `D1: Keyboard Trap (WCAG 2.1.2 · Blocker)`. Click the *"Before repair / After repair"* toggle to reveal the clean, freed path. | *"In the Keyboard Path tab, we scrub through every physical Tab stop. BlindSpot records coordinates, computed focus rings, and DOM state at each step. You can see the trap on this two-D canvas: focus enters the modal and cycles endlessly. Detector D1 flagged this because Tab looped and Escape failed to release focus."* |
| **1:10 – 1:35**<br>*(25 s)* | **Fixes & React JSX Toggle: Grounded Verification**<br>Click the **Fixes** tab (`#fixes`). Monospace unified diff view displays Nemotron Ultra's patch: adds an `Escape` key event listener and focus restoration. A security diff linter badge verifies: *"Clean: no fetch, eval, external URLs, or scope creep"*. The green badge confirms: *"Verified in Chromium: 0 regressions"*. Click the patch format segmented control to switch from **"HTML / DOM patch"** to **"React (JSX / TSX)"**. The diff flips into idiomatic React with a `useEffect` hook. A highlighted callout appears: *"React (JSX / TSX): Translated from the verified HTML patch. The browser verified the DOM change, not this JSX."* | *"Under the Fixes tab, Nemotron Ultra writes surgical repairs. Our diff linter rejects risky code like fetch or eval, and Playwright re-crawls the page in a fresh browser to prove the trap is resolved with zero regressions. Each fix includes a React JSX toggle, clearly labelled: the browser verified the DOM change, not this JSX translation."* |
| **1:35 – 2:05**<br>*(30 s)* | **Models & Cost: Tiered Routing & 0-Token Verifier**<br>Click the **Models & Cost** tab (`#models-and-cost`). Top stat slabs show: Estimated Cost ($0.03), Tokens Used (~5,400), Model Calls (3), Duration (4.2s). A callout displays: *"About $0.03 per fix that passed testing"*. Cursor pans across the three Nemotron microchip slabs on Nebius Token Factory: Nano 30B (State digest), Super 120B (Issue analysis), and Ultra 550B (Surgical fixer). Cursor stops and hovers over the **Deterministic Verifier** row in the data table: *"playwright — 0 model tokens (pure code)"*. Briefly pan over the horizontal time breakdown bar (Crawl, axe-core, Models, Verify). | *"The Models & Cost tab provides complete telemetry. Nebius Token Factory enables tiered routing: Nano summarizes states cheaply, Super handles analysis, and Ultra only generates fixes. Notice the Deterministic Verifier card: zero model tokens. Our rule is strict: models propose; the harness decides. If a patch fails the browser re-crawl, it is never marked verified."* |
| **2:05 – 2:30**<br>*(25 s)* | **Montage: Code, Folder, and React Dev Bridge**<br>Quick 3-part montage:<br>1. *Paste code (3s)*: Click "Paste code", select preset "Keyboard trap modal", click "Audit code snippet". Shows instant airgapped result.<br>2. *Open folder (7s)*: Click "Open folder", pick local project directory. Folder action toolbar shows: "Apply all verified fixes", "Revert changes", and safe backup created in `.blindspot/backup/`.<br>3. *Local dev bridge (15s)*: Click "URL + source folder". Enter dev server `http://localhost:5173` and attach `src/` (12 files). Run audit. BlindSpot crawls the live running app and localizes the candidate file: points directly to `src/components/Modal.tsx`. A badge labels it: *"Experimental React Dev Bridge"*. | *"BlindSpot offers four audit modes. You can paste code snippets into an airgapped runner, or open a local folder with automated safety backups and byte-for-byte revert. In our experimental dev bridge, we pair a running local dev server with a source folder, auditing live UI while pointing directly to the originating TSX component."* |
| **2:30 – 2:45**<br>*(15 s)* | **Benchmark Rigor & Close**<br>Screen displays the clean 16-fixture benchmark evaluation scorecard:<br>- 16 benchmark fixtures<br>- 92% recall on seeded barriers (23 of 25)<br>- 23 of 25 fixes verified · 0 regressions<br>- 0 false alarms on 3 clean pages<br>- 100% prompt injection defense passed<br>- axe-core baseline: 1 of 25 seeded barriers caught.<br>Overlay banner in crisp typography: *"Models propose; the deterministic harness decides."*<br>Final card: GitHub repository URL (`github.com/.../blindspot`), MIT License text, text attribution: *"Built with Nebius Token Factory and NVIDIA Nemotron"*. | *"Across sixteen benchmark fixtures, BlindSpot achieved ninety-two percent recall, catching twenty-three of twenty-five seeded barriers with twenty-three of twenty-five fixes verified and zero regressions. Clean pages produced zero false alarms, and our prompt injection defense held. axe-core caught only one seeded barrier. Because we authored the fixtures, recall is optimistic, but the principle holds: models propose, the harness decides. BlindSpot is open source under MIT."* |

---

## Production Recording Notes (Per Section)

- **Section 1 (0:00 – 0:15):**  
  - *Setup:* Launch local fixture `http://localhost:3000/fixtures/B01-keyboard-trap.html`.
  - *Action:* Press physical keys `Tab` x3, then `Escape`, then `Tab` x2. Ensure a keyboard visualizer (e.g., KeyCastr on macOS) is active in the bottom-left corner so keystrokes are visible.
  - *Goal:* Establish the user frustration in 15 seconds without words of blame or exaggerated drama.

- **Section 2 (0:15 – 0:45):**  
  - *Setup:* Navigate to `http://localhost:3000/#overview`. Dark theme active (`#theme-toggle-button`).
  - *Action:* Click the *Presets* dropdown (`#examples-select-dropdown`), select `B01: Newsletter popup — keyboard trap`. Ensure `#enable-ultra-fix-checkbox` ("Suggest fixes and test them") is checked.
  - *Execution:* Click `Audit URL` (or select instant replay to guarantee zero latency jitter). Keep recording centered on the 6-phase stepper as each stage illuminates, then settle on the headline card and the axe-core comparison callout.

- **Section 3 (0:45 – 1:10):**  
  - *Setup:* Click navigation tab `#keyboard-path`.
  - *Action:* Drag mouse smoothly across the focus stop scrubber (stops 1 through 6). Pause on stop 3 (`#subscribe-btn`) where the red barrier badge and cycloid focus loop appear.
  - *Action:* Toggle the "Before repair / After repair" button to show how the repaired focus path cleanly moves through the page controls.

- **Section 4 (1:10 – 1:35):**  
  - *Setup:* Click navigation tab `#fixes`.
  - *Action:* Scroll into the diff viewer for `#newsletter-dialog`. Point cursor to the green unified diff additions (`keydown` listener for `Escape`).
  - *Action:* Click the `Patch format` segmented control option: `React (JSX / TSX)`. Point cursor to the green callout box emphasizing that the browser verified the DOM patch, not the JSX translation.

- **Section 5 (1:35 – 2:05):**  
  - *Setup:* Click navigation tab `#models-and-cost`.
  - *Action:* Smoothly pan across the 4 top metric slabs ($0.03 cost, ~5.4k tokens, 3 calls, 4.2s).
  - *Action:* Point to the 3 Nemotron cards (Nano, Super, Ultra), and hold the cursor on the `Deterministic Verifier: 0 model tokens` table row. Briefly hover over the horizontal stage breakdown bar.

- **Section 6 (2:05 – 2:30):**  
  - *Setup & Cuts:*
    1. Click `Paste code` pill, choose preset "Keyboard trap modal", click "Audit code snippet" (3s).
    2. Click `Open folder`, show `FolderActionToolbar` with "Apply all", "Revert changes", and backup directory (7s).
    3. Click `URL + source folder`, input `http://localhost:5173`, click `Attach source folder (src/)`, show indexed files, click Run, and zoom into candidate localization: `src/components/Modal.tsx` (15s).

- **Section 7 (2:30 – 2:45):**  
  - *Setup:* Switch to benchmark summary scorecard or Export tab.
  - *Visual:* Clean 1080p slide / card with the exact 16-fixture metrics. Display the core axiom *"Models propose; the deterministic harness decides."* in clean sans-serif type. End on the repo link and MIT license line. Fade out at 2:45.

---

## Recording Checklist

- [ ] **Resolution & Scaling:** Display resolution set to 1920x1080 (1080p) at 60 fps. Browser zoom set to 110%–125% for high legibility.
- [ ] **Clean Environment:** Hide browser bookmarks bar, extension icons, URL autocomplete history, and macOS dock. Disable all system and messaging notifications (Do Not Disturb enabled).
- [ ] **Theme:** BlindSpot high-contrast dark theme enabled throughout the entire recording.
- [ ] **Cursor & Keystrokes:** Smooth cursor movement with subtle circular cursor highlight enabled (e.g., CleanShot X / ScreenFlow). Real-time on-screen keyboard press overlay enabled (especially for the hook's `Tab` and `Escape` sequence).
- [ ] **Audio Setup:** External cardioid/condenser microphone with pop filter. Record in quiet room. Level normalized to -14 LUFS, voice-over centered between -12 dB and -6 dB peaks. Background music (if any) ducked to -24 dB beneath voice.
- [ ] **Strict Visual Branding:** No third-party trademarks or proprietary logos on screen (no Chrome icons, no GitHub octopus logos). Text attribution only in header: *"Built with Nebius Token Factory and NVIDIA Nemotron"*.
- [ ] **Timing Check:** Rehearse speaking along with the screen recording. Hard stop at 2:45 (must stay within 2:40 – 2:50 window, never exceeding 3:00).

---

## Submission & Upload Checklist

- [ ] **Platform & Privacy:** Upload to YouTube with visibility set strictly to **Public** (or **Unlisted** if explicitly allowed by hackathon rules; Public is safest to avoid permission issues).
- [ ] **Duration Check:** Confirmed video playback duration is strictly under 3:00 (e.g., 2:45).
- [ ] **Video Title:** `BlindSpot — Deterministic Accessibility Agent (Nebius x NVIDIA AI Hackathon)`
- [ ] **Video Description:**
  - One-sentence pitch: *"BlindSpot is an AI developer agent that audits, repairs, and deterministically verifies keyboard and accessibility-tree barriers in a real headless browser."*
  - Track: *Best Apps & Agents (Nebius x NVIDIA Global AI Hackathon)*
  - Core Axiom: *"Models propose; the deterministic harness decides."*
  - GitHub Repository Link (Public repository with MIT License).
  - Model stack credits: NVIDIA Nemotron-3 Nano 30B, Super 120B, and Ultra 550B hosted on Nebius Token Factory.
- [ ] **Captions (Accessibility Requirement):** Upload verified English `.srt` closed-captions file matching the exact transcript. Do not rely solely on auto-generated captions.
- [ ] **Thumbnail:** High-contrast 1080p frame showing the BlindSpot dashboard with the Keyboard Path tracer and the headline *"Models Propose; The Harness Decides"*.
