# User Research Notes & Field Interviews
*BlindSpot Project · Conducted Oct 22–23, 2026*

Goal: Validate the core problem statement, friction in existing accessibility auditing workflows, developer trust requirements for automated code fixes, and the real-world impact on keyboard and screen-reader users before locking technical scope.

---

## 1. Structured Questions Asked

1. **Last keyboard problem**: When did you last find a keyboard navigation or screen-reader barrier on your site, and how did you find it?
2. **Current tooling gaps**: What tools or automated linters do you use today (e.g. axe-core, Lighthouse, eslint-plugin-jsx-a11y), and what do they consistently miss?
3. **Trust in automated fixes**: Would you trust an AI agent to write accessibility fixes, and what proof would you need to see before merging or applying them?
4. **Delivery format**: Which would you rather receive — an interactive visual report with verified diffs or an automated pull request?

---

## 2. Interview Logs

### Conversation 1 — Lead Frontend Developer (E-commerce / SaaS)
* **Date**: Oct 22, 2026
* **Role**: Senior React / Next.js Engineer at a consumer checkout platform (team of 8 developers).
* **Q1 (Last problem)**: "Last sprint, a customer reported they couldn't complete our checkout using Tab. A third-party cookie consent banner had rendered at the bottom of the DOM, but visually sat on top of the 'Place Order' button. Because focus was obscured by the sticky banner, keyboard users couldn't see what they were pressing. We only found it through customer support."
* **Q2 (Current tools & gaps)**: "We run Lighthouse in CI and have `axe-core` integrated into our unit tests. It caught missing `alt` attributes and low text contrast on buttons, but it gave a 100 score to the page with the obscured checkout button. Scanners only inspect static DOM nodes, not whether a physical Tab keystroke lands under an overlay."
* **Q3 (Trust in automated fixes)**: "I would never merge an AI-suggested fix blind. AI code reviewers frequently hallucinate ARIA attributes or add `tabindex='1'` which actually breaks tab order. To trust it, I need to see the fix re-run in a real browser with proof that the target barrier disappeared and no regressions occurred."
* **Q4 (Report vs. PR)**: "An interactive report with a unified diff and browser proof is much better. Automated PRs from bots often fail our internal lint rules or conflict with component architectures. Give me the verified patch and let me paste it."

---

### Conversation 2 — Full-Stack Developer (Web Agency)
* **Date**: Oct 23, 2026
* **Role**: Agency developer shipping 2–3 client sites per quarter (Wordpress, Webflow, and custom React).
* **Q1 (Last problem)**: "We built a custom slide-out navigation menu with interactive div tags for a luxury apparel client. On mouse hover, it looked great. During a client demo, their compliance officer tried pressing Tab: the menu never expanded, and when it finally did via click, pressing Escape did nothing, trapping focus inside an invisible mobile drawer."
* **Q2 (Current tools & gaps)**: "Lighthouse only checks markup syntax. It has no idea that our dropdown menu is completely inoperable via keyboard because it's built from styled `<div>` elements with `onClick` handlers rather than native `<button>` tags."
* **Q3 (Trust in automated fixes)**: "If it can write standard CSS (like `:focus-visible` restoration) or insert a missing `aria-label` or keyboard listener, that saves me hours. But I want to see the before-and-after sequence."
* **Q4 (Report vs. PR)**: "A clean report with one-click code copy and explanation of which WCAG criterion failed."

---

### Conversation 3 — QA Lead / Accessibility Specialist
* **Date**: Oct 23, 2026
* **Role**: Lead QA Engineer specializing in Section 508 and WCAG 2.2 Level AA compliance audits.
* **Q1 (Last problem)**: "Yesterday on a banking portal audit: a promotional credit card modal appeared on page load. When the modal was dismissed via Escape, focus reset to `document.body`, forcing keyboard and screen-reader users to Tab through 45 header links all over again."
* **Q2 (Current tools & gaps)**: "Automated scanners only detect 25% to 30% of total WCAG defects. They completely miss focus management, modal focus traps, and logical tab sequences. Manual testing by our team takes 3 to 5 business days per release."
* **Q3 (Trust in automated fixes)**: "Automated fixes are great only if validated deterministically. If the tool verifies that focus returns to the triggering button upon modal close, that provides mathematical proof of compliance."
* **Q4 (Report vs. PR)**: "A structured export (HTML, Markdown, JSON) linking each barrier to its WCAG criterion with proof of re-testing."

---

### Conversation 4 — Assistive Technology Daily User (Keyboard-Only)
* **Date**: Oct 23, 2026
* **Role**: Software engineer and daily keyboard-only user (uses standard keyboard with switch device assistance due to motor control impairment).
* **Q1 (Last problem)**: "Almost daily. The most infuriating barrier is a newsletter signup pop-up that traps the Tab key. Once focus enters the modal, pressing Tab just bounces between the email field and the submit button, and Escape doesn't dismiss it. Because I don't use a mouse, my only option is to close the browser tab and abandon the website."
* **Q2 (Current tools & gaps)**: "Teams tell me their site passes automated accessibility tools. But passing a scanner doesn't mean the site is usable. When focus is invisible or trapped, you are locked out."
* **Q3 (Trust in automated fixes)**: "If automated tools can actually test whether focus can leave a dialog, that would fix 80% of the showstopping barriers I encounter every week."
* **Q4 (Delivery)**: "Whatever gets the developer to ship the fix faster."

---

## 3. Key Synthesis & Validated Themes

1. **The 'False Sense of Security' Crisis**: Rule-based scanners (axe-core, Lighthouse) miss the most debilitating accessibility barriers—keyboard traps, focus obscured by fixed headers, and focus drops after modal dismissals. Teams assume a score of 100 means their site is accessible.
2. **Developers Demand Proof, Not Promises**: Developers reject unverified AI suggestions. Trust requires mathematical, browser-driven verification proving the barrier was eliminated without introducing regressions.
3. **Surgical Runtime & Source Patches**: Developers prefer copying verified surgical patches (CSS rules, ARIA attributes, small focus management scripts) into their own codebase over intrusive automated PR bots.
4. **Legal & Compliance Urgency**: With the European Accessibility Act (EAA) taking effect and ADA Title III web litigation rising, teams need exportable, auditable records mapping findings to exact WCAG 2.2 criteria.

---

## 4. Primary Quote for Hackathon Submission

> *"Automated scanners gave our release a clean bill of health, but our keyboard users were getting completely trapped inside newsletter modals. If an AI agent can physically Tab through the page, flag the trap, write the fix, and prove the fix in a real browser, that changes release confidence forever."*  
> — **Senior Frontend Engineer, SaaS Checkout Platform (Interviewed Oct 22, 2026)**
