export interface ExampleFixture {
  id: string;
  title: string;
  whatsWrong: string;
  expectedIssues: number;
  htmlPath: string;
  hasRecordedRun: boolean;
}

export const EXAMPLES: ExampleFixture[] = [
  {
    id: "B01",
    title: "Newsletter pop-up traps keyboard focus",
    whatsWrong: "Tab cycles inside the pop-up and cannot reach page content. Escape does not close it.",
    expectedIssues: 7,
    htmlPath: "/fixtures/B01-keyboard-trap.html",
    hasRecordedRun: true,
  },
  {
    id: "B02",
    title: "Dropdown built from a div can't be reached",
    whatsWrong: "The custom select trigger div has no tabindex and cannot receive keyboard focus.",
    expectedIssues: 2,
    htmlPath: "/fixtures/B02-custom-dropdown.html",
    hasRecordedRun: true,
  },
  {
    id: "B03",
    title: "Icon buttons have no names",
    whatsWrong: "Toolbar buttons have SVG icons but no aria-label or accessible names for screen readers.",
    expectedIssues: 2,
    htmlPath: "/fixtures/B03-icon-toolbar.html",
    hasRecordedRun: true,
  },
  {
    id: "B04",
    title: "Focus outline removed",
    whatsWrong: "Global outline:none removes the focus indicator from every interactive element.",
    expectedIssues: 16,
    htmlPath: "/fixtures/B04-outline-reset.html",
    hasRecordedRun: true,
  },
  {
    id: "B05",
    title: "Sticky header hides the focused item",
    whatsWrong: "Links in the article receive focus but are covered by the 64px sticky header.",
    expectedIssues: 1,
    htmlPath: "/fixtures/B05-sticky-header.html",
    hasRecordedRun: true,
  },
  {
    id: "B06",
    title: "Tab order jumps around",
    whatsWrong: "Elements have positive tabindex values that disrupt the natural visual reading order.",
    expectedIssues: 13,
    htmlPath: "/fixtures/B06-positive-tabindex.html",
    hasRecordedRun: true,
  },
  {
    id: "B07",
    title: "Menu opens only on mouse hover",
    whatsWrong: "The mega-menu only opens on mouse hover; keyboard focus on the link does not open it.",
    expectedIssues: 2,
    htmlPath: "/fixtures/B07-mega-menu.html",
    hasRecordedRun: true,
  },
  {
    id: "B09",
    title: "Auto-rotating carousel can't be reached",
    whatsWrong: "The previous slide button has tabindex=-1 and the rotating slides disrupt focus.",
    expectedIssues: 2,
    htmlPath: "/fixtures/B09-carousel.html",
    hasRecordedRun: true,
  },
  {
    id: "B10",
    title: "Tabs don't work with arrow keys",
    whatsWrong: "Tab key moves between tabs instead of arrow keys as required by the ARIA tabs pattern.",
    expectedIssues: 1,
    htmlPath: "/fixtures/B10-tabs-widget.html",
    hasRecordedRun: true,
  },
  {
    id: "B11",
    title: "No skip link on a long menu",
    whatsWrong: "The page has 60 navigation links before main content and no skip link to bypass them.",
    expectedIssues: 1,
    htmlPath: "/fixtures/B11-long-nav.html",
    hasRecordedRun: true,
  },
  {
    id: "B12",
    title: "Several problems on one page",
    whatsWrong: "The comment dialog traps focus, buttons lack labels, and link focus outlines are removed.",
    expectedIssues: 27,
    htmlPath: "/fixtures/B12-mixed.html",
    hasRecordedRun: true,
  },
  {
    id: "C01",
    title: "Clean form (should find nothing)",
    whatsWrong: "Properly structured form controls with visible focus and accessible labels.",
    expectedIssues: 0,
    htmlPath: "/fixtures/C01-clean-form.html",
    hasRecordedRun: true,
  },
  {
    id: "C02",
    title: "Clean article (should find nothing)",
    whatsWrong: "Semantic HTML article with valid landmarks and sequential heading structure.",
    expectedIssues: 0,
    htmlPath: "/fixtures/C02-clean-article.html",
    hasRecordedRun: true,
  },
  {
    id: "C03",
    title: "Clean dialog (should find nothing)",
    whatsWrong: "Accessible modal dialog with initial focus placement, Escape key handling, and focus return.",
    expectedIssues: 0,
    htmlPath: "/fixtures/C03-clean-dialog.html",
    hasRecordedRun: true,
  },
  {
    id: "H01",
    title: "Page that tries to give instructions to the AI (should be ignored)",
    whatsWrong: "Adversarial page injecting prompt instructions into DOM text and attributes; detector catches unnamed button.",
    expectedIssues: 1,
    htmlPath: "/fixtures/H01-injection.html",
    hasRecordedRun: true,
  },
];

export interface CodePreset {
  id: string;
  title: string;
  description: string;
  kind: "html" | "snippet";
  code: string;
}

export const CODE_PRESETS: CodePreset[] = [
  {
    id: "modal-trap",
    title: "Modal dialog keyboard trap",
    description: "Modal dialog without initial focus or escape handler that traps Tab navigation",
    kind: "snippet",
    code: `<div class="modal-backdrop">
  <div role="dialog" aria-modal="true" aria-labelledby="dialog-title" class="modal-dialog">
    <h2 id="dialog-title">Subscribe to Newsletter</h2>
    <p>Get weekly accessibility tips and engineering updates.</p>
    <label for="newsletter-email">Email Address</label>
    <input type="email" id="newsletter-email" placeholder="alex@company.com" />
    <button type="button" id="newsletter-submit">Subscribe Now</button>
  </div>
</div>`,
  },
  {
    id: "unnamed-buttons",
    title: "Toolbar buttons without accessible names",
    description: "Toolbar buttons with SVGs but no text or aria-label for screen readers",
    kind: "snippet",
    code: `<div class="toolbar" role="toolbar" aria-label="Editor formatting tools">
  <button type="button" class="tool-btn" id="btn-bold">
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M15.6 10.79c.97-.67 1.65-1.77 1.65-2.79 0-2.26-1.75-4-4-4H7v14h7.04c2.09 0 3.71-1.7 3.71-3.79 0-1.52-.86-2.82-2.15-3.42zM10 6.5h3c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5h-3v-3zm3.5 9H10v-3h3.5c.83 0 1.5.67 1.5 1.5s-.67 1.5-1.5 1.5z"/></svg>
  </button>
  <button type="button" class="tool-btn" id="btn-italic">
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M10 4v3h2.21l-3.42 8H6v3h8v-3h-2.21l3.42-8H18V4z"/></svg>
  </button>
  <button type="button" class="tool-btn" id="btn-trash">
    <svg width="18" height="18" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"/></svg>
  </button>
</div>`,
  },
  {
    id: "outline-removed",
    title: "Global outline:none reset",
    description: "Stylesheet removes focus indicator from every interactive element",
    kind: "html",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Focus Outline Removed Example</title>
  <style>
    * { outline: none !important; }
    body { font-family: system-ui, sans-serif; padding: 32px; background: #0f141c; color: #f0f4fc; }
    .btn { display: inline-block; padding: 10px 20px; margin: 8px; border-radius: 6px; background: #1c2433; color: #fff; text-decoration: none; border: 1px solid #2a374d; }
  </style>
</head>
<body>
  <main>
    <h1>Project Settings</h1>
    <p>Try navigating through the controls using the Tab key.</p>
    <a href="#save" class="btn">Save Changes</a>
    <button type="button" class="btn">Cancel</button>
    <a href="#docs" class="btn">Documentation</a>
  </main>
</body>
</html>`,
  },
  {
    id: "custom-div-dropdown",
    title: "Div-based dropdown missing tabindex",
    description: "Custom select trigger built from a div cannot receive keyboard focus",
    kind: "snippet",
    code: `<div class="select-container">
  <label id="region-label">Select Deployment Region</label>
  <div id="region-trigger" class="custom-select-trigger">
    <span>US-East (N. Virginia)</span>
  </div>
  <ul class="dropdown-list" role="listbox" aria-labelledby="region-label">
    <li role="option">US-East (N. Virginia)</li>
    <li role="option">US-West (Oregon)</li>
    <li role="option">EU-Central (Frankfurt)</li>
  </ul>
</div>`,
  },
  {
    id: "clean-accessible-form",
    title: "Clean accessible form (zero barriers)",
    description: "Properly labeled controls, visible focus outlines, and semantic HTML",
    kind: "html",
    code: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Accessible Account Preferences</title>
  <style>
    body { font-family: system-ui, sans-serif; padding: 32px; background: #0f141c; color: #f0f4fc; }
    :focus-visible { outline: 2px solid #76B900; outline-offset: 2px; }
    label { display: block; margin-top: 16px; font-weight: 600; font-size: 14px; }
    input, select, button { margin-top: 6px; padding: 8px 12px; border-radius: 4px; border: 1px solid #2a374d; background: #1c2433; color: #fff; font-size: 14px; }
    button { cursor: pointer; background: #76B900; color: #000; font-weight: 600; margin-top: 20px; border: none; }
  </style>
</head>
<body>
  <main>
    <h1>Account Preferences</h1>
    <form>
      <label for="username">Username</label>
      <input type="text" id="username" name="username" required autocomplete="username" />
      <label for="theme-select">Interface Theme</label>
      <select id="theme-select" name="theme">
        <option value="system">System Default</option>
        <option value="dark">Dark Theme</option>
        <option value="high-contrast">High Contrast</option>
      </select>
      <button type="submit">Save Preferences</button>
    </form>
  </main>
</body>
</html>`,
  },
];

