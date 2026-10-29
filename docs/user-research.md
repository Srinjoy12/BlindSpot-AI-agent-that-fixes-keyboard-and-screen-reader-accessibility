# BlindSpot — User Research & Accessibility Validation Notes

No user interviews were completed before submission.

---

## Real User Interview Notes (Template for Human Input)

<!--
INSTRUCTIONS FOR HUMAN REVIEWER / SUBMITTER:
Fill in this section with real notes from user interviews, usability testing sessions, or testing with disabled/assistive-technology users.
Do NOT invent, draft, or synthesize personas or feedback.
-->

### Interview / Session 1
- **Date:** [YYYY-MM-DD]
- **Participant:** [Anonymous / Role / Identity]
- **Assistive Technology / Modality:** [Screen reader (NVDA, JAWS, VoiceOver) / Keyboard-only / Switch access / Screen magnifier / Other]
- **Test Context / Tasks Attempted:**
  - [Task description]
- **Observed Barriers & Navigation Issues:**
  - [Observation 1]
  - [Observation 2]
- **Direct Quotes:**
  - "[Quote from participant]"
- **Actionable Takeaways:**
  - [Takeaway 1]
  - [Takeaway 2]

---

## Technical Context & Industry Benchmark Data

While direct primary user interviews have not yet been conducted, BlindSpot's problem statement is grounded in published empirical research on automated accessibility scanning limitations:

### 1. WebAIM Million Annual Study (2024)
- **95.9% of home pages** had detectable WCAG 2 failures.
- Across 1 million home pages, automated tools detected an average of **56.8 errors per page**.
- **The Blind Spot**: WebAIM relies on automated DOM-tree rule checking (WAVE / axe-core engines). These engines excel at static token inspection (e.g., missing `alt` attributes, insufficient text contrast ratios, missing form labels). However, they cannot evaluate dynamic user interactions—such as whether pressing `Tab` traps the user inside a modal, whether a sticky banner obscures active focus, or whether dismissing an overlay returns focus to the triggering button.

### 2. UK Government Digital Service (GDS) Audit
The UK Government Digital Service conducted a formal audit comparing leading automated accessibility testing tools against known, manually verified accessibility barriers:
- Automated accessibility testing tools detected **only ~30% to 40%** of total WCAG barriers.
- Over **60% of barrier classes** went undetected by every static scanner tested.
- The highest concentrations of undetected barriers were in:
  1. **Keyboard operability (WCAG 2.1.1 & 2.1.2)**: Cyclic focus traps and controls unreachable via sequential keyboard navigation.
  2. **Focus order and management (WCAG 2.4.3)**: Focus dropped to `document.body` after dialog dismissal, or reading order scrambled by positive tabindexes.
  3. **Focus visibility and obscuration (WCAG 2.4.7 & 2.4.11)**: Global CSS `outline: none` overrides and focused elements hidden behind fixed/sticky viewports.

---

## Scope Transparency & Limitations

- **Chromium AXTree vs. Physical Screen Readers**:
  BlindSpot queries the Chrome DevTools Protocol `Accessibility.getFullAXTree` endpoint to evaluate semantic accessibility tree structure. It does not run physical audio screen readers (such as NVDA, JAWS, or Apple VoiceOver) and cannot evaluate synthesized pronunciation, speech rate, or rotor navigation.
- **Auditing Tool, Not Legal Certification**:
  BlindSpot is an engineering auditing and developer feedback tool. Passing an automated keyboard audit does not constitute legal certification of WCAG compliance.
