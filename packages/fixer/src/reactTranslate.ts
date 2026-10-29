// packages/fixer/src/reactTranslate.ts — Pure deterministic HTML/DOM to React (JSX/TSX) translation.
// Translates verified HTML, attribute, CSS, and script patches into equivalent idiomatic React patterns.
// Strictly deterministic: no I/O, no network calls, no model calls.
// Returns null whenever unsure — never guesses.

import type { ReactEquivalent } from "@blindspot/ai";

export interface FixTranslationInput {
  patchType?: string;
  body: string;
  rationale?: string;
  targetSelector?: string;
}

export interface TranslationContext {
  detectorId?: string;
  selector?: string;
  domSnippet?: string;
}

/**
 * Parses a CSS style string (e.g. "position:absolute; top:-50px; left:0; background-color:#2563eb")
 * into a React-compatible style object representation string.
 */
function parseStyleStringToJsx(styleStr: string): string | null {
  try {
    const rules = styleStr
      .split(";")
      .map((r) => r.trim())
      .filter(Boolean);
    if (rules.length === 0) return null;

    const entries: string[] = [];
    for (const rule of rules) {
      const colonIdx = rule.indexOf(":");
      if (colonIdx === -1) return null;
      const rawProp = rule.slice(0, colonIdx).trim();
      let rawVal = rule.slice(colonIdx + 1).trim().replace(/!important/g, "").trim();

      // Convert kebab-case property to camelCase (e.g., outline-offset -> outlineOffset)
      const prop = rawProp.replace(/-([a-z])/g, (_, g) => g.toUpperCase());

      // If value is numeric without unit (or 0), use raw number
      if (/^0(?:px)?$/.test(rawVal)) {
        entries.push(`${prop}: 0`);
      } else if (/^\d+$/.test(rawVal)) {
        entries.push(`${prop}: ${rawVal}`);
      } else {
        entries.push(`${prop}: "${rawVal.replace(/"/g, '\\"')}"`);
      }
    }

    return `{\n    ${entries.join(",\n    ")}\n  }`;
  } catch {
    return null;
  }
}

/**
 * Converts standard HTML attributes in an element string to JSX equivalents.
 * Covers tabindex -> tabIndex, class -> className, for -> htmlFor, style string -> object,
 * onclick -> onClick, self-closing tags.
 */
function convertHtmlToJsx(html: string): { jsx: string; notes: string[] } | null {
  if (!html || !html.trim()) return null;

  const notes: string[] = [];
  let jsx = html.trim();

  // 1. tabindex -> tabIndex={0} or {-1}
  if (/tabindex=["']?(-?\d+)["']?/i.test(jsx)) {
    jsx = jsx.replace(/tabindex=["']?(-?\d+)["']?/gi, (_, val) => `tabIndex={${val}}`);
    notes.push("Converted 'tabindex' attribute to React camelCase 'tabIndex={number}'.");
  }

  // 2. class -> className
  if (/\bclass=["']([^"']*)["']/i.test(jsx)) {
    jsx = jsx.replace(/\bclass=["']([^"']*)["']/gi, 'className="$1"');
    notes.push("Converted 'class' attribute to React 'className'.");
  }

  // 3. for -> htmlFor
  if (/\bfor=["']([^"']*)["']/i.test(jsx)) {
    jsx = jsx.replace(/\bfor=["']([^"']*)["']/gi, 'htmlFor="$1"');
    notes.push("Converted 'for' attribute to React 'htmlFor'.");
  }

  // 4. onclick -> onClick
  if (/\bonclick=["']([^"']*)["']/i.test(jsx)) {
    jsx = jsx.replace(/\bonclick=["']([^"']*)["']/gi, 'onClick={() => { /* $1 */ }}');
    notes.push("Converted 'onclick' attribute to React 'onClick' handler.");
  }

  // 5. onkeydown -> onKeyDown
  if (/\bonkeydown=["']([^"']*)["']/i.test(jsx)) {
    jsx = jsx.replace(/\bonkeydown=["']([^"']*)["']/gi, 'onKeyDown={(e) => { /* $1 */ }}');
    notes.push("Converted 'onkeydown' attribute to React 'onKeyDown' handler.");
  }

  // 6. style string -> style object
  const styleMatch = jsx.match(/\bstyle=["']([^"']+)["']/i);
  if (styleMatch && styleMatch[1]) {
    const jsxStyle = parseStyleStringToJsx(styleMatch[1]);
    if (jsxStyle) {
      jsx = jsx.replace(/\bstyle=["'][^"']+["']/i, `style={${jsxStyle}}`);
      notes.push("Converted inline style string to React style object.");
    }
  }

  // 7. Ensure void elements are self-closing (e.g. <input>, <img>, <br>, <hr>)
  jsx = jsx.replace(/<(input|img|br|hr|meta|link)([^>]*[^/])>/gi, "<$1$2 />");

  return { jsx, notes };
}

/**
 * Deterministically translates a verified fix into its React (JSX/TSX) equivalent.
 * Returns null if the fix cannot be unambiguously mapped.
 */
export function translateFixToReact(
  fix: FixTranslationInput,
  context?: TranslationContext
): ReactEquivalent | null {
  if (!fix || !fix.body) return null;

  const rawBody = fix.body.trim();
  const patchType = (fix.patchType || "").toLowerCase();
  const detectorId = context?.detectorId || "";

  // ─── Case 1: D9 Skip Link & Target Main Container ───────────────────────────
  if (
    detectorId === "D9" ||
    (patchType === "html" && (rawBody.includes("skip-link") || rawBody.includes("#main")))
  ) {
    const code = `// 1. Skip Link Component (mount as the very first element in your App / Layout):
<a
  href="#main-content"
  className="skip-link"
  style={{
    position: "absolute",
    top: "-9999px",
    left: 0,
    padding: "8px 16px",
    backgroundColor: "#000000",
    color: "#ffffff",
    zIndex: 9999,
  }}
  onFocus={(e) => {
    e.currentTarget.style.top = "0";
  }}
  onBlur={(e) => {
    e.currentTarget.style.top = "-9999px";
  }}
>
  Skip to main content
</a>

// 2. Target <main> container:
<main id="main-content" tabIndex={-1} style={{ outline: "none" }}>
  {/* Main page content goes here */}
</main>`;

    return {
      code,
      notes: [
        "Skip link must be the very first focusable element rendered in the DOM.",
        "Target container requires tabIndex={-1} to allow programmatic focus without adding it to the tab order.",
      ],
      source: "deterministic",
    };
  }

  // ─── Case 2: Escape key listener (D1 Keyboard Trap or keydown Escape handler)
  if (
    detectorId === "D1" ||
    rawBody.includes("Escape") ||
    rawBody.includes("e.key === 'Escape'") ||
    rawBody.includes('e.key === "Escape"')
  ) {
    const code = `// Option A: Dialog component with window Escape listener & automatic cleanup
useEffect(() => {
  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      onClose();
    }
  };
  window.addEventListener("keydown", handleKeyDown);
  return () => window.removeEventListener("keydown", handleKeyDown);
}, [onClose]);

// Option B: Inline onKeyDown handler on modal container
<div
  role="dialog"
  aria-modal="true"
  tabIndex={-1}
  onKeyDown={(e) => {
    if (e.key === "Escape") {
      e.stopPropagation();
      onClose();
    }
  }}
>
  {/* Dialog content */}
</div>`;

    return {
      code,
      notes: [
        "Use a useEffect hook to bind the keydown listener and guarantee removal on unmount.",
        "Alternatively, attach onKeyDown directly to the modal wrapper if it retains focus.",
      ],
      source: "deterministic",
    };
  }

  // ─── Case 3: Focus return to trigger element (D8 Dialog Focus Management) ───
  if (
    detectorId === "D8" &&
    (rawBody.includes("focus()") || rawBody.includes("activeElement") || rawBody.includes("dialog"))
  ) {
    const code = `const triggerRef = useRef<HTMLButtonElement | null>(null);
const [isOpen, setIsOpen] = useState(false);

const handleOpen = () => {
  setIsOpen(true);
};

const handleClose = () => {
  setIsOpen(false);
  // Return focus to trigger button upon modal dismissal
  triggerRef.current?.focus();
};

return (
  <>
    <button ref={triggerRef} type="button" onClick={handleOpen}>
      Open Dialog
    </button>
    {isOpen && <DialogModal onClose={handleClose} />}
  </>
);`;

    return {
      code,
      notes: [
        "Store a ref to the triggering element with useRef.",
        "Explicitly invoke triggerRef.current?.focus() when the modal closes or unmounts.",
      ],
      source: "deterministic",
    };
  }

  // ─── Case 4: D2 Unreachable control / Div-as-button ──────────────────────────
  if (
    detectorId === "D2" &&
    (rawBody.includes("tabindex") || rawBody.includes("role=\"button\"") || rawBody.includes("button"))
  ) {
    // If the HTML patch replaces it with a button:
    if (rawBody.startsWith("<button") || rawBody.includes("<button")) {
      const converted = convertHtmlToJsx(rawBody);
      if (converted) {
        return {
          code: converted.jsx,
          notes: [
            ...converted.notes,
            "Native <button> elements natively support keyboard focus, Enter/Space activation, and screen reader announcements.",
          ],
          source: "deterministic",
        };
      }
    }

    const code = `// Recommended: Use semantic <button type="button">
<button
  type="button"
  className="btn"
  onClick={handleClick}
>
  Button Label
</button>

// If retaining <div> element is strictly required:
<div
  role="button"
  tabIndex={0}
  onClick={handleClick}
  onKeyDown={(e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      handleClick();
    }
  }}
>
  Button Label
</div>`;

    return {
      code,
      notes: [
        "Native <button type='button'> is preferred over custom <div> buttons.",
        "Custom div buttons require role='button', tabIndex={0}, and an onKeyDown handler supporting Enter and Space keys.",
      ],
      source: "deterministic",
    };
  }

  // ─── Case 5: Attribute patch (tabindex, aria-label, etc.) ───────────────────
  if (patchType === "attribute" || /^(tabindex|aria-label|role)=/i.test(rawBody)) {
    // 5a. tabindex="0" or "-1"
    const tabMatch = rawBody.match(/tabindex=["']?(-?\d+)["']?/i);
    if (tabMatch && tabMatch[1]) {
      const val = parseInt(tabMatch[1], 10);
      return {
        code: `tabIndex={${val}}`,
        notes: [
          `Add tabIndex={${val}} prop to the target JSX element.`,
          val === 0 ? "Puts the element in sequential keyboard navigation order." : "Makes element focusable programmatically but not via sequential Tab key.",
        ],
        source: "deterministic",
      };
    }

    // 5b. aria-label="..."
    const ariaMatch = rawBody.match(/aria-label=["']([^"']+)["']/i);
    if (ariaMatch && ariaMatch[1]) {
      const label = ariaMatch[1];
      return {
        code: `aria-label="${label.replace(/"/g, '\\"')}"`,
        notes: [
          `Add aria-label="${label}" prop to provide an accessible name for assistive technology.`,
        ],
        source: "deterministic",
      };
    }

    // 5c. role="..."
    const roleMatch = rawBody.match(/role=["']([^"']+)["']/i);
    if (roleMatch && roleMatch[1]) {
      return {
        code: `role="${roleMatch[1]}"`,
        notes: [`Add role="${roleMatch[1]}" prop to communicate widget semantics.`],
        source: "deterministic",
      };
    }
  }

  // ─── Case 6: HTML snippet patch (e.g. <button ...> or <a ...>) ─────────────
  if (patchType === "html" || rawBody.startsWith("<")) {
    const converted = convertHtmlToJsx(rawBody);
    if (converted) {
      return {
        code: converted.jsx,
        notes: converted.notes.length > 0 ? converted.notes : ["Translated HTML markup to React JSX."],
        source: "deterministic",
      };
    }
  }

  // ─── Case 7: CSS focus indicator patch ─────────────────────────────────────
  if (patchType === "css" && (rawBody.includes(":focus") || rawBody.includes(":focus-visible"))) {
    // Extract outline and outline-offset rules if present
    const outlineMatch = rawBody.match(/outline:\s*([^;!]+)/i);
    const offsetMatch = rawBody.match(/outline-offset:\s*([^;!]+)/i);

    if (outlineMatch && outlineMatch[1]) {
      const outline = outlineMatch[1].trim();
      const offset = offsetMatch && offsetMatch[1] ? offsetMatch[1].trim() : "2px";

      const code = `// Option 1: In CSS / CSS Modules (Recommended for focus-visible states)
.focusable-element:focus-visible {
  outline: ${outline};
  outline-offset: ${offset};
}

// Option 2: In Tailwind CSS
className="focus-visible:outline focus-visible:outline-2 focus-visible:outline-blue-600 focus-visible:outline-offset-2"

// Option 3: Inline style for active focus state
style={{
  outline: "${outline}",
  outlineOffset: "${offset}",
}}`;

      return {
        code,
        notes: [
          "Recommended to implement in CSS / CSS Modules with :focus-visible so keyboard users see the indicator without mouse-click outlines.",
          "Ensure outline meets the minimum 3:1 contrast ratio against the surrounding background.",
        ],
        source: "deterministic",
      };
    }
  }

  // ─── Default: Unsure -> return null. Never guess. ───────────────────────────
  return null;
}
