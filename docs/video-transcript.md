# BlindSpot — Demo Video Script & Voice-Over Transcript
*Track: Best Apps and Agents · Duration: 2 minutes 45 seconds*

---

### [0:00 – 0:15] The Problem & The 30-Second Aha Moment
**Visual**: Screen opens on a realistic website featuring a newsletter modal dialog. A visible focus ring loops relentlessly between the email input and the subscribe button. Focus never escapes to the main page or the checkout button.
**Voice-over**:
> "This newsletter pop-up has a keyboard trap. If you navigate by keyboard, switch device, or screen reader, you are trapped here forever. You can never reach the checkout button. And automated scanners miss this completely, because to a static code scanner, every element in the HTML looks perfectly valid."

---

### [0:15 – 0:35] Introducing BlindSpot
**Visual**: Switch to BlindSpot’s high-contrast dark dashboard. The presenter clicks **'Try a broken page'**, selecting the Newsletter Trap fixture. The real-time audit starts immediately.
**Voice-over**:
> "Meet BlindSpot. BlindSpot is an AI agent that tabs through your web application in a real browser, finds the barriers automated scanners miss, writes the fix, and proves the fix works. Within seconds, BlindSpot identifies the trap, maps it to WCAG 2.1.2, and highlights the exact cyclical focus path on screen."

---

### [0:35 – 1:05] The Fix and Browser Verification Loop
**Visual**: The user clicks the **'Fix with Nemotron Ultra'** button. A clean surgical code diff appears in the patch viewer. A green checklist ticks: *Patch Applied*, *Re-running Keyboard Crawl*, *Zero Regressions*.
**Voice-over**:
> "NVIDIA Nemotron Ultra, running on Nebius Token Factory, writes the surgical fix—a lightweight Escape key listener and focus manager. But unlike generic AI code assistants, BlindSpot does not trust the model’s word. It applies the patch in a fresh Chromium browser, re-runs the exact same keyboard test, and mathematically proves the barrier is gone. Only verified fixes earn the green badge."

---

### [1:05 – 1:40] AI Architecture & Model Routing
**Visual**: The presenter opens the **NVIDIA Token Factory Ledger** drawer in the dashboard header. A live table displays timestamps, latencies, token counts, and model tiers. A graphic highlights the three-tier routing.
**Voice-over**:
> "Under the hood, BlindSpot uses a three-tier model routing architecture powered by Nebius Token Factory:
> Nemotron-3 Nano digests the raw accessibility tree and landmarks.
> Nemotron-3 Super merges detector hits and explains real-world human impact, grounded by live Tavily searches for exact WCAG 2.2 guidance.
> Nemotron-3 Ultra writes the repair.
> And most importantly: our verdicts are 100% deterministic code. A model never decides whether a barrier exists or whether a fix passed."

---

### [1:40 – 2:10] Real-World Coverage, React Dev Bridge & Benchmark Rigor
**Visual**: Scrolling through the Results view showing the interactive **Keyboard Replay scrubber**, the **WCAG criterion tags**, export options (HTML report, Markdown, JSON), and switching between **HTML/DOM** and **React JSX** patch formats. Demonstrating the **URL + Source Folder local dev bridge** auditing a local React Vite app.
**Voice-over**:
> "BlindSpot audits live URLs, static folders, and local React dev servers via our loopback bridge—mapping barriers directly to your .tsx components with idiomatic React JSX fixes.
> We tested BlindSpot across a 16-page benchmark suite covering keyboard traps, obscured focus under sticky headers, hover-only mega menus, and missing accessible names.
> On our clean control pages, BlindSpot produced zero false alarms.
> And when tested against a hostile prompt injection designed to deceive the AI, our delimiter guardrails held firm."

---

### [2:10 – 2:35] Limitations & Accessible UI
**Visual**: Presenter clicks the **Limitations** link in the navigation bar.
**Voice-over**:
> "We believe in honest engineering. BlindSpot reads the browser's accessibility tree, but it does not replace real human screen-reader testing. And to prove our commitment to the craft, BlindSpot audits itself: our interface is 100% keyboard-navigable with high-contrast focus rings and zero blockers."

---

### [2:35 – 2:45] Call to Action & Conclusion
**Visual**: Start screen showing the live demo URL, the GitHub MIT repo badge, and the Try a Broken Page button.
**Voice-over**:
> "BlindSpot is free, open source under the MIT license, and running live on a Nebius Serverless Endpoint. Try a broken page right now—no login required. Thank you."
