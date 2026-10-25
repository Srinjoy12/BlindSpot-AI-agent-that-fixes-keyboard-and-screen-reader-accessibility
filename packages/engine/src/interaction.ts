// interaction.ts — discovers interactive triggers and tests keyboard interaction.
// Tests Enter/Space, Escape, and focus management after opening/closing widgets.

import type { Page } from "playwright";
import type { InteractionRecord } from "./types.js";

const MAX_INTERACTIONS = 10;

// Selectors for elements that may open a surface (menu, dialog, etc.)
const TRIGGER_SELECTOR = [
  '[role="button"]',
  'button',
  '[role="menuitem"]',
  '[aria-haspopup]',
  '[aria-expanded]',
  '[role="tab"]',
  '[role="combobox"]',
  'details > summary',
  '[aria-controls]',
].join(", ");

export interface InteractionPassResult {
  interactions: InteractionRecord[];
  newStates: string[]; // state labels for states opened during interaction
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/** Finds up to MAX_INTERACTIONS trigger elements and tests keyboard interaction. */
export async function runInteractionPass(
  page: Page,
  stateCounter: { count: number }
): Promise<InteractionPassResult> {
  const triggers = await page.locator(TRIGGER_SELECTOR).all();
  const interactions: InteractionRecord[] = [];
  const newStates: string[] = [];

  const tested = new Set<string>();

  for (const trigger of triggers.slice(0, MAX_INTERACTIONS)) {
    let selector: string;
    try {
      selector = await trigger.evaluate((el: Element) => {
        if ((el as HTMLElement).id) return "#" + CSS.escape((el as HTMLElement).id);
        return el.tagName.toLowerCase();
      });
    } catch {
      continue;
    }

    if (tested.has(selector)) continue;
    tested.add(selector);

    // Capture DOM state before interaction
    const domBefore = await page.evaluate(() => document.body.innerHTML.length);

    try {
      await trigger.focus();
      await sleep(80);

      // Try Enter first
      await page.keyboard.press("Enter");
      await sleep(300);

      const domAfterEnter = await page.evaluate(() => document.body.innerHTML.length);
      let dominated = domAfterEnter !== domBefore;

      let domAfterSpace: number | undefined;
      // If Enter did nothing, try Space
      if (!dominated) {
        await page.keyboard.press("Space");
        await sleep(300);
        domAfterSpace = await page.evaluate(() => document.body.innerHTML.length);
        dominated = domAfterSpace !== domBefore;
      }

      if (!dominated) continue; // Trigger didn't open or dismiss anything

      // If DOM shrank, the interaction dismissed or closed a surface
      if (domAfterEnter < domBefore || (domAfterSpace !== undefined && domAfterSpace < domBefore)) {
        const focusLost = await page.evaluate(() => document.activeElement === document.body || !document.activeElement);
        interactions.push({
          triggerSelector: selector,
          triggerKey: "Enter",
          escapeClosed: false,
          focusReturnedToTrigger: false,
          focusMovedIntoSurface: false,
          focusLostAfterClose: focusLost,
        });
        continue;
      }

      // Record new state
      const stateLabel = `S${stateCounter.count++}`;
      newStates.push(stateLabel);

      // Check focus moved into the new surface
      const focusInfo = await page.evaluate(() => {
        const el = document.activeElement;
        if (!el || el === document.body) return { moved: false, selector: "body" };
        return { moved: true, selector: el.tagName.toLowerCase() };
      });

      const focusMovedIntoSurface = focusInfo.moved;

      // Try Escape to close
      await page.keyboard.press("Escape");
      await sleep(300);

      const domAfterEscape = await page.evaluate(() => document.body.innerHTML.length);
      const escapeClosed = Math.abs(domAfterEscape - domBefore) < 100 && Math.abs(domAfterEscape - domAfterEnter) > 20;

      // Check focus returned to trigger
      const focusAfterClose = await page.evaluate((sel: string) => {
        const el = document.activeElement;
        if (!el) return false;
        if (el === document.body) return false;
        return el.matches(sel);
      }, selector);

      // Check if focus was lost (landed on body)
      const focusLostAfterClose = await page.evaluate(() => {
        return document.activeElement === document.body;
      });

      interactions.push({
        triggerSelector: selector,
        triggerKey: "Enter",
        openedState: stateLabel,
        escapeClosed,
        focusReturnedToTrigger: focusAfterClose,
        focusMovedIntoSurface,
        focusLostAfterClose,
      });
    } catch {
      // Skip triggers that throw (e.g., detached elements)
    }
  }

  return { interactions, newStates };
}
