// apply.ts — safely injects patches into a Playwright page.
// Supports CSS, attribute changes, HTML insertions, and scoped keyboard scripts.

import type { Page } from "playwright";
import type { FixProposal } from "@blindspot/ai";
import { lintPatch } from "@blindspot/ai";

export async function applyPatch(page: Page, patch: FixProposal): Promise<{ applied: boolean; error?: string }> {
  // Enforce security linting before anything touches the browser
  const lint = lintPatch(patch);
  if (!lint.valid) {
    return { applied: false, error: lint.reason ?? "Security policy violation" };
  }

  try {
    switch (patch.patchType) {
      case "css": {
        await page.addStyleTag({ content: patch.body });
        break;
      }

      case "attribute": {
        // Parse attribute e.g. 'aria-label="Submit form"' or 'tabindex="0"'
        const match = patch.body.match(/^([a-zA-Z0-9_-]+)=["']?([^"']*)["']?$/);
        if (match) {
          const attrName = match[1]!;
          const attrVal = match[2]!;
          const target = patch.targetSelector || "*";
          await page.evaluate(
            ({ sel, name, val }) => {
              const elements = document.querySelectorAll(sel);
              elements.forEach((el) => el.setAttribute(name, val));
            },
            { sel: target, name: attrName, val: attrVal }
          );
        } else {
          // Fallback: evaluate attribute assignment
          await page.evaluate(
            ({ sel, body }) => {
              const el = document.querySelector(sel);
              if (el) {
                const parts = body.split("=");
                if (parts.length >= 2) {
                  const key = parts[0]!.trim();
                  const val = parts.slice(1).join("=").replace(/^["']|["']$/g, "").trim();
                  el.setAttribute(key, val);
                }
              }
            },
            { sel: patch.targetSelector || "body", body: patch.body }
          );
        }
        break;
      }

      case "html": {
        const target = patch.targetSelector || "body";
        await page.evaluate(
          ({ sel, html }) => {
            const el = document.querySelector(sel);
            if (el) {
              el.insertAdjacentHTML("afterbegin", html);
            }
          },
          { sel: target, html: patch.body }
        );
        break;
      }

      case "script": {
        await page.evaluate((scriptContent) => {
          const scriptEl = document.createElement("script");
          scriptEl.textContent = scriptContent;
          document.body.appendChild(scriptEl);
        }, patch.body);
        break;
      }
    }

    return { applied: true };
  } catch (err) {
    return {
      applied: false,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}
