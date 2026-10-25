# BlindSpot — Limitations & Responsible Use
*Transparency & Technical Boundaries · 2026*

## 1. What BlindSpot Is and Is Not

BlindSpot is an autonomous developer agent designed to catch, repair, and verify keyboard navigation barriers and accessibility tree defects in web interfaces.

### What BlindSpot Does:
- Drives a real Chromium browser using keyboard emulation (`Tab`, `Shift+Tab`, `Enter`, `Space`, `Escape`).
- Records physical focus stops, bounding boxes, visual focus indicator changes, and element obscuration.
- Evaluates 11 deterministic detectors (D1–D11) against WCAG 2.2 Level A and AA criteria.
- Employs three tiered NVIDIA Nemotron models (Nano, Super, Ultra) hosted on Nebius Token Factory to digest page states, analyze human impact, and generate surgical patches.
- Re-runs the keyboard test in a fresh browser session to mathematically prove that the barrier is gone and no regressions were introduced.

### What BlindSpot Does NOT Do:
1. **Does Not Run Real Screen Reader Audio Software**: BlindSpot inspects the Chromium Accessibility Tree (CDP `Accessibility.getFullAXTree`), which is the exact data structure assistive technologies consume. However, it does not execute audio synthesizers or proprietary screen reader engines like NVDA, JAWS, or Apple VoiceOver.
2. **Does Not Guarantee Legal WCAG Certification**: BlindSpot is an engineering auditing tool, not a legal compliance certification body. Passing a BlindSpot audit does not guarantee immunity from accessibility lawsuits under the ADA or the European Accessibility Act.
3. **No Multi-Page Authenticated Crawling in MVP**: The current engine is scoped to single URL audits. Authenticated flows behind OAuth/passwords, multi-step checkout funnels, and enterprise intranet pages are not crawled.
4. **No Native Mobile Apps or PDFs**: BlindSpot only audits HTML/SVG web interfaces rendered in Chromium. Mobile native apps (iOS/Android) and static PDF documents are out of scope.
5. **No Automated Git Commits to Strangers' Repos**: BlindSpot delivers verified unified diffs and CSS/DOM runtime snippets. It never modifies user codebases without explicit developer action.

---

## 2. Known Failure Cases & Edge Cases

Documenting boundaries and failure modes is a core engineering principle:
- **Canvas and WebGL Elements**: Custom controls rendered purely inside HTML5 `<canvas>` or WebGL shaders without fallback ARIA DOM subtrees are invisible to the focus crawler.
- **Custom Faux-Focus Widgets**: Single-page apps that capture keyboard events and manually paint CSS classes onto container divs without updating `document.activeElement` may report unreachable controls.
- **Lazy-Loaded Content Beyond Scroll Depth**: Elements that only mount into the DOM after infinite scrolling beyond viewport limits may not be captured in the initial 150-stop crawl.

---

## 3. BlindSpot UI Self-Audit

As required by our engineering manifesto: *an accessibility tool with an inaccessible interface loses all credibility*.

Before freezing the build, BlindSpot ran its own audit engine against its own dashboard UI (`http://localhost:3000`):
- **Blockers**: 0
- **Majors**: 0
- **Minors**: 0
- **Keyboard Reach**: 100% of interactive controls reached via Tab sequence.
- **Focus Indicators**: High-contrast focus rings (3:1 contrast against dark background) present on every stop.
- **Semantics**: Native HTML buttons, links, inputs, and polite ARIA live regions for streaming status.
- **Reduced Motion**: Full support for `prefers-reduced-motion: reduce`.

---

## 4. Responsible Use & Ethics

- **Respect for Disabled Users**: BlindSpot is built to empower developers to fix barriers; it does not pretend to speak on behalf of disabled individuals or replace manual usability testing by people with disabilities.
- **Safe Testing Policy**: Non-gallery URLs require a user attestation confirming ownership or authorized testing permission. BlindSpot will never be used to publicly shame, rank, or exploit third-party sites.
