// axTree.ts — captures the Chrome DevTools Protocol accessibility tree for a page.
// Returns the full AX tree as a structured JSON object.

import type { Page, CDPSession } from "playwright";

export interface AXNode {
  nodeId: string;
  role?: { type: string; value: string };
  name?: { type: string; value: string };
  description?: { type: string; value: string };
  value?: { type: string; value: string };
  properties?: Array<{ name: string; value: { type: string; value: unknown } }>;
  childIds?: string[];
  backendDOMNodeId?: number;
  ignored?: boolean;
  ignoredReasons?: Array<{ name: string; value: { type: string; value: unknown } }>;
}

export interface AXTreeSnapshot {
  nodes: AXNode[];
  capturedAt: string;
}

/** Captures the full accessibility tree via the Chrome DevTools Protocol. */
export async function captureAxTree(page: Page): Promise<AXTreeSnapshot> {
  let cdp: CDPSession | null = null;

  try {
    cdp = await page.context().newCDPSession(page);
    await cdp.send("Accessibility.enable");

    const result = await cdp.send("Accessibility.getFullAXTree") as { nodes: AXNode[] };

    return {
      nodes: result.nodes,
      capturedAt: new Date().toISOString(),
    };
  } finally {
    if (cdp) {
      try {
        await cdp.detach();
      } catch {
        // Ignore detach errors
      }
    }
  }
}

/** Extracts a flat list of interactive nodes from an AX tree snapshot. */
export function getInteractiveNodes(snapshot: AXTreeSnapshot): AXNode[] {
  const interactiveRoles = new Set([
    "button", "link", "checkbox", "radio", "textbox", "combobox",
    "listbox", "menuitem", "menuitemcheckbox", "menuitemradio",
    "option", "slider", "spinbutton", "switch", "tab", "treeitem",
    "searchbox", "columnheader", "rowheader", "grid", "gridcell",
    "scrollbar", "separator",
  ]);

  return snapshot.nodes.filter((node) => {
    if (node.ignored) return false;
    const role = node.role?.value ?? "";
    return interactiveRoles.has(role);
  });
}
