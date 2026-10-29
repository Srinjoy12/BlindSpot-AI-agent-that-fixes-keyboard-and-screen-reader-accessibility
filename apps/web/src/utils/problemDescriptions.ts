import type { BarrierItem } from "../components/BarrierList.js";

export interface ProblemDetailInfo {
  plainTitle: string;
  keyboardSteps: string[];
  whoItAffects: string;
  evidence: string;
  tavilyGuidanceUrl: string;
  tavilyGuidanceLabel: string;
  isFallback: boolean;
  fallbackNotice: string;
}

/**
 * Derives a human-friendly plain English description and reproduction steps
 * for any detected keyboard or accessibility barrier.
 *
 * Goal: A first-time user who has never heard of WCAG can read the title
 * and explain in one sentence what is wrong and what the fix does.
 */
export function getProblemDetail(barrier: BarrierItem): ProblemDetailInfo {
  const sel = barrier.selector.toLowerCase();
  const ev = (barrier.evidence || "").toLowerCase();
  const imp = barrier.impact || "";

  // 1. Determine plain-language title
  let plainTitle = "";

  if (barrier.detectorId.startsWith("AXE-")) {
    const axeRule = barrier.detectorId.replace(/^AXE-/, "");
    if (axeRule === "color-contrast") {
      plainTitle = "Text contrast is too low against its background";
    } else if (axeRule === "heading-order") {
      plainTitle = "Heading levels skip or are structured out of order";
    } else if (axeRule === "label-content-name-mismatch") {
      plainTitle = "Visible text does not match element's accessible name";
    } else if (axeRule === "link-in-text-block") {
      plainTitle = "Link in body text relies solely on color without an underline";
    } else if (axeRule === "region" || axeRule === "landmark-one-main") {
      plainTitle = "Page content is not contained within landmark regions";
    } else if (axeRule === "image-alt") {
      plainTitle = "Image is missing descriptive alternative text (alt)";
    } else if (axeRule === "button-name") {
      plainTitle = "Button is missing an accessible label or name";
    } else if (axeRule === "link-name") {
      plainTitle = "Link has no readable text or accessible label";
    } else if (axeRule === "html-has-lang") {
      plainTitle = "Page HTML tag is missing a language attribute";
    } else if (axeRule === "document-title") {
      plainTitle = "Web page has no title element";
    } else {
      const words = axeRule.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
      plainTitle = `${words} accessibility issue on ${barrier.selector}`;
    }
  } else if (barrier.detectorId === "D1") {
    if (sel.includes("cookie") || sel.includes("banner")) {
      plainTitle = "Focus gets stuck in the cookie banner";
    } else if (sel.includes("dialog") || sel.includes("modal")) {
      plainTitle = "Focus gets stuck in the modal dialog";
    } else {
      plainTitle = `Focus gets stuck in ${barrier.selector}`;
    }
  } else if (barrier.detectorId === "D2") {
    if (sel.includes("button") || sel.includes("btn")) {
      plainTitle = "Clickable button is skipped during keyboard navigation";
    } else if (sel.includes("a") || sel.includes("link")) {
      plainTitle = "Link cannot be reached using the Tab key";
    } else {
      plainTitle = "Interactive control is skipped during keyboard navigation";
    }
  } else if (barrier.detectorId === "D3") {
    plainTitle = "Focus outline is invisible when tabbing to this element";
  } else if (barrier.detectorId === "D4") {
    plainTitle = "Tab order jumps unexpectedly across the page";
  } else if (barrier.detectorId === "D5") {
    plainTitle = "Focused element is covered by a floating banner or overlay";
  } else if (barrier.detectorId === "D6") {
    plainTitle = "Interactive control has no name for screen readers";
  } else if (barrier.detectorId === "D7") {
    plainTitle = "Non-standard tab index disrupts natural keyboard flow";
  } else if (barrier.detectorId === "D8") {
    if (ev.includes("lost to document.body") || ev.includes("focus was lost")) {
      plainTitle = "Focus is lost to the page root when closing dialog or banner";
    } else if (ev.includes("escape does not close")) {
      plainTitle = "Pressing Escape does not close the dialog or banner";
    } else if (ev.includes("not automatically placed") || ev.includes("background element")) {
      plainTitle = "Focus is not placed into the banner when it opens";
    } else {
      plainTitle = "Focus order is broken around modal dialog or banner";
    }
  } else if (barrier.detectorId === "D9") {
    plainTitle = "Page is missing a skip-to-content shortcut link";
  } else {
    // Fallback based on WCAG name or detector
    if (barrier.wcagId === "2.1.2") {
      plainTitle = "Keyboard trap prevents focus from exiting element";
    } else if (barrier.wcagId === "2.4.7") {
      plainTitle = "Missing focus outline when element receives focus";
    } else if (barrier.wcagId === "2.4.3") {
      plainTitle = "Focus order does not follow logical page reading sequence";
    } else if (barrier.wcagId === "4.1.2") {
      plainTitle = "Control is missing an accessible name or label";
    } else {
      plainTitle = `${barrier.wcagName} issue on ${barrier.selector}`;
    }
  }

  // 2. Keyboard reproduction steps ("What happens")
  let keyboardSteps: string[] = [];

  if (barrier.detectorId.startsWith("AXE-")) {
    const axeRule = barrier.detectorId.replace(/^AXE-/, "");
    if (axeRule === "color-contrast") {
      keyboardSteps = [
        `1. Locate '${barrier.selector}' visually on the page or navigate to it using Tab.`,
        "2. The text contrast ratio fails the WCAG 4.5:1 minimum threshold against its background color.",
      ];
    } else if (axeRule === "heading-order") {
      keyboardSteps = [
        "1. Navigate between page headings using screen reader shortcut key (H key).",
        `2. Heading level on '${barrier.selector}' jumps out of order (e.g. H2 to H4), breaking document outline.`,
      ];
    } else if (axeRule === "label-content-name-mismatch") {
      keyboardSteps = [
        `1. Inspect '${barrier.selector}' visible text vs. its programmatic accessible name.`,
        "2. The visible label does not match the element's aria-label, preventing speech navigation commands.",
      ];
    } else if (axeRule === "link-in-text-block") {
      keyboardSteps = [
        `1. Locate link '${barrier.selector}' within its surrounding body text paragraph.`,
        "2. The link has no underline or distinct border, so its link status is conveyed solely by color.",
      ];
    } else if (axeRule === "region" || axeRule === "landmark-one-main") {
      keyboardSteps = [
        "1. Open screen reader landmark navigation rotor (VoiceOver Cmd+U or NVDA Insert+F7).",
        `2. Element '${barrier.selector}' sits outside of landmark regions (<main>, <nav>, <header>, etc.).`,
      ];
    } else {
      keyboardSteps = [
        `1. Navigate to '${barrier.selector}' using standard keyboard or screen reader.`,
        `2. Rule '${axeRule}' violated: fails WCAG ${barrier.wcagId} (${barrier.wcagName}).`,
      ];
    }
  } else if (barrier.detectorId === "D1") {
    keyboardSteps = [
      "1. Press Tab repeatedly until keyboard focus reaches this element.",
      "2. Press Tab or Shift+Tab again: focus cannot exit and remains trapped.",
    ];
  } else if (barrier.detectorId === "D2") {
    keyboardSteps = [
      "1. Press Tab repeatedly from the top of the webpage.",
      `2. Notice that focus jumps over '${barrier.selector}', making it impossible to trigger without a mouse.`,
    ];
  } else if (barrier.detectorId === "D3") {
    keyboardSteps = [
      "1. Press Tab until this element receives keyboard focus.",
      "2. Observe the screen: no visible outline or highlight appears, so sighted keyboard users cannot tell where they are.",
    ];
  } else if (barrier.detectorId === "D4") {
    keyboardSteps = [
      "1. Press Tab through preceding items on the page.",
      "2. Notice focus suddenly jumps to a distant or unexpected section instead of following the reading order.",
    ];
  } else if (barrier.detectorId === "D5") {
    keyboardSteps = [
      "1. Press Tab to move focus to this element.",
      "2. Notice that the focused element is hidden behind a sticky header, modal, or floating banner.",
    ];
  } else if (barrier.detectorId === "D6") {
    keyboardSteps = [
      "1. Tab to this control with a screen reader active.",
      "2. The screen reader announces only the role (like 'button') without any label explaining what it does.",
    ];
  } else if (barrier.detectorId === "D7") {
    keyboardSteps = [
      "1. Press Tab from the top of the webpage.",
      "2. A hardcoded positive tabindex forces keyboard focus out of natural DOM order.",
    ];
  } else if (barrier.detectorId === "D8") {
    if (ev.includes("lost to document.body") || ev.includes("focus was lost")) {
      keyboardSteps = [
        "1. Tab into the banner or modal dialog and activate the dismiss button.",
        "2. Focus resets to the very top of document.body instead of returning to the button that opened it or the next logical element.",
      ];
    } else if (ev.includes("escape does not close")) {
      keyboardSteps = [
        "1. Open or navigate into the banner or dialog.",
        "2. Press the Escape key: the dialog remains on screen and focus is not restored.",
      ];
    } else {
      keyboardSteps = [
        "1. Load the webpage with the banner or dialog visible.",
        "2. Press Tab: background elements receive focus first instead of focus moving directly into the interactive banner.",
      ];
    }
  } else if (barrier.detectorId === "D9") {
    keyboardSteps = [
      "1. Press Tab as the first action after loading the webpage.",
      "2. No 'Skip to main content' link appears, forcing keyboard users to tab through all repetitive navigation links on every page load.",
    ];
  } else {
    keyboardSteps = [
      `1. Press Tab through the page to reach '${barrier.selector}'.`,
      `2. Keyboard behavior fails criterion WCAG ${barrier.wcagId} (${barrier.wcagName}).`,
    ];
  }

  // 3. Who it affects (Super model impact, max 2-3 sentences)
  let whoItAffects = "";
  if (imp) {
    // If it has fallback prefix, strip or simplify it
    let cleaned = imp.replace(
      /^Users navigating with keyboard or assistive technology cannot properly interact with [^:]+:\s*/i,
      ""
    );
    // Split into sentences and take up to 2-3
    const sentences = cleaned.match(/[^.!?]+[.!?]+/g) || [cleaned];
    whoItAffects = sentences.slice(0, 3).join(" ").trim();
  }

  if (!whoItAffects) {
    if (barrier.detectorId.startsWith("AXE-")) {
      const axeRule = barrier.detectorId.replace(/^AXE-/, "");
      if (axeRule === "color-contrast") {
        whoItAffects =
          "People with low vision or color vision deficiencies cannot read the text comfortably, especially in bright ambient lighting or on low-contrast displays.";
      } else if (axeRule === "heading-order") {
        whoItAffects =
          "Screen reader users relying on heading structure to skim page contents receive a confusing mental model of document hierarchy.";
      } else if (axeRule === "label-content-name-mismatch") {
        whoItAffects =
          "Users operating with speech control software say the visible words on the screen to activate buttons, but the browser fails to trigger the control.";
      } else if (axeRule === "link-in-text-block") {
        whoItAffects =
          "Users with color blindness or low vision cannot distinguish links from standard text without hovering a mouse cursor.";
      } else if (axeRule === "region" || axeRule === "landmark-one-main") {
        whoItAffects =
          "Screen reader users cannot quickly jump past headers and sidebars to reach the main page content.";
      } else {
        whoItAffects =
          "People using screen readers or assistive technology cannot properly perceive or interact with this element.";
      }
    } else if (barrier.detectorId === "D1") {
      whoItAffects =
        "People navigating with keyboards or switches are completely trapped and unable to interact with any other part of the page. Screen reader users cannot move past this section.";
    } else if (barrier.detectorId === "D3") {
      whoItAffects =
        "Sighted keyboard navigators, including people with motor disabilities, cannot tell which link or button is currently focused. This forces users to guess before pressing Enter.";
    } else if (barrier.detectorId === "D8") {
      whoItAffects =
        "Keyboard and screen reader users lose their place on the page when dismissing overlays. They are forced to re-navigate the entire page from the beginning.";
    } else {
      whoItAffects =
        "People using keyboards, screen readers, or assistive technology cannot efficiently navigate or activate this control, disrupting their workflow.";
    }
  }

  // 4. Deterministic fallback check (true when AI analysis call failed/timed out and rule-based fallback was used)
  const isFallback = imp.startsWith(
    "Users navigating with keyboard or assistive technology cannot properly interact with"
  );

  const fallbackNotice =
    "Deterministic fallback used: AI model call failed or timed out; barrier classified with deterministic rule engine.";

  // 5. Tavily / WCAG guidance source
  const tavilyGuidanceUrl =
    barrier.wcagUrl || `https://www.w3.org/WAI/WCAG22/quickref/#${barrier.wcagId}`;
  const tavilyGuidanceLabel = `W3C Guidance: WCAG ${barrier.wcagId} ${barrier.wcagName}`;

  return {
    plainTitle,
    keyboardSteps,
    whoItAffects,
    evidence: barrier.evidence || "Deterministic keyboard crawl detected this barrier during sequential interaction.",
    tavilyGuidanceUrl,
    tavilyGuidanceLabel,
    isFallback,
    fallbackNotice,
  };
}
