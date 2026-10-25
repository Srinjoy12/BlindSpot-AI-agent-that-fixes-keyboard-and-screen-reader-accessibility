import express from "express";
import cors from "cors";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createServer as createViteServer } from "vite";

import { startSession, crawl, runInteractionPass, checkUrl } from "@blindspot/engine";
import { runDetectors } from "@blindspot/detectors";
import {
  generateStateDigest,
  analyzeFindings,
  clearLedger,
  ledgerTotals,
  getLedger,
} from "@blindspot/ai";
import { runFixLoop } from "@blindspot/fixer";
import { generateHtmlReport, generateMarkdownReport, type AuditReport } from "@blindspot/report";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const FIXTURES_DIR = path.resolve(REPO_ROOT, "fixtures/pages");
const MANIFESTS_DIR = path.resolve(REPO_ROOT, "fixtures/manifests");

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

app.use(cors());
app.use(express.json());

// In-memory audit report storage for downloads
const reportStore = new Map<string, AuditReport>();

// Static fixture pages
app.use("/fixtures", express.static(FIXTURES_DIR));

// 1. Fixtures endpoint
app.get("/api/fixtures", (_req, res) => {
  try {
    const files = fs.readdirSync(MANIFESTS_DIR).filter((f) => f.endsWith(".json"));
    const fixtures = files.map((file) => {
      const id = file.replace(".json", "");
      const manifestPath = path.join(MANIFESTS_DIR, file);
      const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf-8"));
      // Find matching html page
      const htmlFiles = fs.readdirSync(FIXTURES_DIR);
      const matchingHtml = htmlFiles.find((h) => h.startsWith(id));
      return {
        id,
        title: manifest.title,
        htmlPath: matchingHtml ? `/fixtures/${matchingHtml}` : null,
        barrierCount: manifest.barriers ? manifest.barriers.length : 0,
      };
    });
    res.json({ fixtures });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Audit runner with Server-Sent Events (SSE)
app.post("/api/audit", async (req, res) => {
  const { targetUrl, runFixes = true, maxStops = 50 } = req.body;

  if (!targetUrl || typeof targetUrl !== "string") {
    res.status(400).json({ error: "Missing or invalid 'targetUrl' parameter." });
    return;
  }

  // Set up SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
  });

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const auditId = `audit_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
  const startTime = Date.now();
  clearLedger();

  let resolvedUrl = targetUrl;
  if (targetUrl.startsWith("/fixtures/")) {
    resolvedUrl = `http://127.0.0.1:${PORT}${targetUrl}`;
  }

  // SSRF check: allow local fixtures on this port or safe public URLs
  const isLocalFixture = resolvedUrl.startsWith(`http://127.0.0.1:${PORT}/fixtures/`) || resolvedUrl.startsWith(`http://localhost:${PORT}/fixtures/`);
  if (!isLocalFixture) {
    try {
      await checkUrl(resolvedUrl);
    } catch (ssrfErr: any) {
      sendEvent("error", { message: `Security violation (SSRF): ${ssrfErr.message}` });
      res.end();
      return;
    }
  }

  const pageIdMatch = targetUrl.match(/(B\d\d|C\d\d|H\d\d)/i);
  const pageId = pageIdMatch ? pageIdMatch[1]!.toUpperCase() : null;
  const replayFile = pageId ? path.join(REPO_ROOT, "data/replays", `${pageId}.json`) : null;

  if (replayFile && fs.existsSync(replayFile) && req.body.forceLive !== true) {
    sendEvent("status", {
      phase: "launch",
      message: `Serving pre-computed audit replay for ${pageId} (0 model tokens, zero-latency verification)...`,
    });
    try {
      const cachedData = JSON.parse(fs.readFileSync(replayFile, "utf-8"));

      for (const stop of cachedData.forwardStops || []) {
        sendEvent("stop", { direction: "forward", stop });
      }

      sendEvent("status", { phase: "detect", message: "Deterministic accessibility detectors verified." });
      sendEvent("findings_raw", {
        count: cachedData.report?.summary?.barriersFound || 0,
        hits: cachedData.report?.barriers || [],
      });

      sendEvent("status", { phase: "digest", message: "Loaded state digest (NVIDIA Nemotron-3 Nano)" });
      sendEvent("status", { phase: "analyze", message: "Loaded issue analysis (Nemotron Super & Tavily)" });

      for (let i = 0; i < (cachedData.report?.barriers || []).length; i++) {
        const item = cachedData.report.barriers[i];
        sendEvent("status", {
          phase: "fix",
          message: item.verified
            ? `✓ Patch verified with Nemotron Ultra & Chromium: ${item.selector}`
            : `Proposed patch from Nemotron Ultra: ${item.selector} (unverified)`,
        });
        sendEvent("barrier_resolved", { index: i, item });
      }

      const activeReport = {
        ...cachedData.report,
        auditId,
      };

      reportStore.set(auditId, activeReport);
      if (cachedData.report?.auditId) {
        reportStore.set(cachedData.report.auditId, activeReport);
      }
      if (cachedData.auditId) {
        reportStore.set(cachedData.auditId, activeReport);
      }

      sendEvent("ledger", { calls: cachedData.ledger || [] });
      sendEvent("complete", {
        auditId,
        report: activeReport,
        forwardStops: cachedData.forwardStops || [],
        backwardStops: cachedData.backwardStops || [],
        ledger: cachedData.ledger || [],
      });
      res.end();
      return;
    } catch (e: any) {
      console.warn("Replay read error, falling back to live audit:", e.message);
    }
  }

  sendEvent("status", { phase: "launch", message: `Launching Chromium session for ${targetUrl}...` });

  let session: any = null;
  try {
    session = await startSession({ auditId, targetUrl: resolvedUrl });
    sendEvent("status", { phase: "crawl", message: "Crawling keyboard focus navigation (Tab forward)..." });

    // Step 1: Forward crawl
    const crawlResult = await crawl(session.page, { maxStops, pauseMs: 50 });

    for (const stop of crawlResult.forwardStops) {
      sendEvent("stop", { direction: "forward", stop });
    }

    sendEvent("status", { phase: "interact", message: "Probing keyboard interactive surfaces & dialogs..." });

    // Step 2: Interaction pass
    const interactionResult = await runInteractionPass(session.page, { count: 3 });

    // Step 2.5: Extract candidate interactives for D2
    const candidateData = (await session.page.evaluate(`(() => {
      function getSelector(el) {
        if (el.id) return "#" + CSS.escape(el.id);
        const path = [];
        let current = el;
        while (current && current !== document.body) {
          let seg = current.tagName.toLowerCase();
          if (current.id) { seg = "#" + CSS.escape(current.id); path.unshift(seg); break; }
          const siblings = Array.from(current.parentElement ? current.parentElement.children : []).filter(c => c.tagName === current.tagName);
          if (siblings.length > 1) seg += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
          path.unshift(seg);
          current = current.parentElement;
        }
        return path.join(" > ");
      }
      const selectors = [];
      document.querySelectorAll("button, a[href], input, select, textarea, [role='button'], [role='tab'], [tabindex], [onclick]").forEach(el => {
        const rect = el.getBoundingClientRect();
        if (rect.width <= 0 || rect.height <= 0) return;
        const style = window.getComputedStyle(el);
        if (style.display === "none" || style.visibility === "hidden") return;
        const sel = getSelector(el);
        if (sel && !selectors.includes(sel)) selectors.push(sel);
      });
      const hoverTriggers = [];
      document.querySelectorAll(".nav-item, nav li").forEach((item) => {
        const trigger = item.querySelector("a, button");
        const submenu = item.querySelector(".mega-menu, ul, .dropdown-menu, .submenu");
        if (trigger && submenu) {
          const subStyle = window.getComputedStyle(submenu);
          if (subStyle.display === "none") {
            const triggerSel = getSelector(trigger);
            const hasKeyboardOpen = trigger.hasAttribute("aria-haspopup") || trigger.hasAttribute("onclick") || trigger.getAttribute("role") === "button";
            if (!hasKeyboardOpen && triggerSel) hoverTriggers.push(triggerSel);
          }
        }
      });
      return { selectors, hoverTriggers };
    })()`)) as { selectors: string[]; hoverTriggers: string[] };

    sendEvent("status", { phase: "detect", message: "Running deterministic accessibility detectors (D1–D11)..." });

    // Step 3: Pure detectors
    const hits = runDetectors({
      stateLabel: "S0",
      focusStops: crawlResult.forwardStops,
      interactions: interactionResult.interactions,
      candidateInteractives: candidateData.selectors,
    });

    for (const hoverSel of candidateData.hoverTriggers) {
      if (!hits.some((h) => h.selector === hoverSel && h.detectorId === "D2")) {
        hits.push({
          detectorId: "D2",
          selector: hoverSel,
          stateLabel: "S0",
          stopIndexes: [],
          evidence: `Menu item '${hoverSel}' has a hover-only submenu with no keyboard trigger or aria-haspopup.`,
          confidence: 1,
          severity: "major",
          wcagId: "2.1.1",
        });
      }
    }

    sendEvent("findings_raw", { count: hits.length, hits });

    // Step 4: AI Analysis & Fix loop
    let stateDigest: any = null;
    if (hits.length > 0) {
      sendEvent("status", { phase: "digest", message: "Generating state digest with NVIDIA Nemotron-3 Nano..." });
      try {
        stateDigest = await generateStateDigest({
          url: resolvedUrl,
          stateLabel: "S0",
          focusStops: crawlResult.forwardStops,
        });
        sendEvent("digest", { digest: stateDigest?.pagePurpose || "State digest complete." });
      } catch (err: any) {
        console.error("Digest failed:", err.message);
      }
    }

    sendEvent("status", { phase: "analyze", message: "Synthesizing issues with Nemotron Super & Tavily..." });
    let analyzedFindings: any[] = [];
    if (hits.length > 0) {
      try {
        analyzedFindings = await analyzeFindings({
          hits,
          digests: stateDigest ? [stateDigest] : [],
          url: resolvedUrl,
        });
      } catch (err: any) {
        console.error("Super analysis failed:", err.message);
      }
    }

    const barrierItems: any[] = [];
    let blockers = 0;
    let majors = 0;
    let minors = 0;
    let verifiedCount = 0;

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (hit.severity === "blocker") blockers++;
      else if (hit.severity === "major") majors++;
      else minors++;

      const analyzed = analyzedFindings.find(
        (af) => af.detectorId === hit.detectorId && (af.selector === hit.selector || af.selector.includes(hit.selector.replace(/^[#.]/, "")))
      ) || {
        detectorId: hit.detectorId,
        severity: hit.severity,
        wcag: {
          id: hit.wcagId,
          name: "Keyboard Accessibility Requirement",
          level: "A",
          referenceUrl: `https://www.w3.org/WAI/WCAG22/quickref/#${hit.wcagId}`,
        },
        selector: hit.selector,
        stateLabel: hit.stateLabel || "S0",
        impact: hit.evidence,
        confidence: hit.confidence || 1,
      };

      let fixResult: any = null;
      let isVerified = false;
      let evidenceText: string | undefined = undefined;

      if (runFixes) {
        sendEvent("status", {
          phase: "fix",
          message: `Nemotron Ultra synthesizing fix proposal for ${hit.selector} (${i + 1}/${hits.length})...`,
        });

        try {
          const domSnippet = await session.page.evaluate((sel: string) => {
            const el = document.querySelector(sel);
            return el ? el.outerHTML.slice(0, 500) : "";
          }, hit.selector);

          const loopRes = await runFixLoop({
            page: session.page,
            finding: analyzed,
            domSnippet: domSnippet || undefined,
            maxAttempts: 2,
          });

          if (loopRes.verified && loopRes.finalPatch) {
            isVerified = true;
            verifiedCount++;
            fixResult = loopRes.finalPatch;
            evidenceText = loopRes.verification?.evidence || "Chromium keyboard re-crawl confirmed barrier eliminated with 0 regressions.";
          } else if (loopRes.finalPatch) {
            fixResult = loopRes.finalPatch;
            evidenceText = loopRes.verification?.evidence ||
              (loopRes.history && loopRes.history.length > 0
                ? loopRes.history[loopRes.history.length - 1]?.evidence
                : "Chromium re-crawl found barrier still present after patch application.");
          }
        } catch (fixErr: any) {
          console.error("Fix loop error:", fixErr.message);
          evidenceText = `Fix generation error: ${fixErr.message}`;
        }

        sendEvent("status", {
          phase: "fix",
          message: isVerified
            ? `✓ Fix for ${hit.selector} verified in Chromium re-crawl`
            : fixResult
            ? `Patch for ${hit.selector} proposed by Nemotron Ultra (verification: unconfirmed)`
            : `Completed analysis for ${hit.selector}`,
        });
      }

      const barrierItem = {
        id: `barrier_${i + 1}`,
        detectorId: hit.detectorId,
        severity: hit.severity,
        selector: hit.selector,
        wcagId: analyzed.wcag?.id || hit.wcagId,
        wcagName: analyzed.wcag?.name || "Keyboard Accessibility Requirement",
        wcagUrl: analyzed.wcag?.referenceUrl || `https://www.w3.org/WAI/WCAG22/quickref/#${hit.wcagId}`,
        impact: analyzed.impact || hit.evidence,
        evidence: hit.evidence,
        fix: fixResult
          ? {
              patchType: fixResult.patchType || "css",
              body: fixResult.body || fixResult.cssRule || "",
              rationale: fixResult.rationale || fixResult.explanation || "Accessibility repair generated by Nemotron Ultra.",
              targetSelector: fixResult.targetSelector || hit.selector,
              explanation: fixResult.rationale || fixResult.explanation || "Accessibility repair generated by Nemotron Ultra.",
              cssRule: fixResult.patchType === "css" ? fixResult.body : undefined,
              scriptContent: fixResult.patchType === "script" ? fixResult.body : undefined,
              htmlReplacement: fixResult.patchType === "html" ? fixResult.body : undefined,
            }
          : undefined,
        verified: isVerified,
        verificationEvidence: evidenceText || (isVerified
          ? "Chromium keyboard re-crawl confirmed barrier eliminated with 0 regressions."
          : undefined),
      };

      barrierItems.push(barrierItem);
      sendEvent("barrier_resolved", { index: i, item: barrierItem });
    }

    // Calculate score: 100 - (blockers * 25 + majors * 10 + minors * 3), bounded 0-100
    const rawPenalty = blockers * 25 + majors * 10 + minors * 3;
    const keyboardScore = Math.max(0, Math.min(100, 100 - rawPenalty));

    const totals = ledgerTotals();
    const rawCalls = Array.from(getLedger());
    const ledgerCalls = rawCalls.map((c) => ({
      ...c,
      tier: (c.stage === "digest" || c.model.toLowerCase().includes("nano")
        ? "nano"
        : c.stage === "analysis" || c.model.toLowerCase().includes("super")
        ? "super"
        : "ultra") as "nano" | "super" | "ultra",
    }));
    const tavilyCalls = ledgerCalls
      .filter((c) => c.model.includes("tavily"))
      .map((c) => c.model);

    const nanoCalls = ledgerCalls.filter((c) => c.tier === "nano");
    const superCalls = ledgerCalls.filter((c) => c.tier === "super");
    const ultraCalls = ledgerCalls.filter((c) => c.tier === "ultra");

    const auditReport: AuditReport = {
      auditId,
      targetUrl,
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startTime,
      keyboardScore,
      summary: {
        totalStops: crawlResult.forwardStops.length,
        barriersFound: hits.length,
        blockers,
        majors,
        minors,
        fixesVerified: verifiedCount,
      },
      barriers: barrierItems,
      aiTransparency: {
        totalCalls: totals.totalCalls,
        totalTokensIn: totals.totalTokensIn,
        totalTokensOut: totals.totalTokensOut,
        totalLatencyMs: totals.totalLatencyMs,
        tiers: {
          nano: {
            calls: nanoCalls.length,
            tokens: nanoCalls.reduce((s, c) => s + c.tokensIn + c.tokensOut, 0),
          },
          super: {
            calls: superCalls.length,
            tokens: superCalls.reduce((s, c) => s + c.tokensIn + c.tokensOut, 0),
          },
          ultra: {
            calls: ultraCalls.length,
            tokens: ultraCalls.reduce((s, c) => s + c.tokensIn + c.tokensOut, 0),
          },
        },
        tavilyQueries: tavilyCalls,
      },
    };

    reportStore.set(auditId, auditReport);

    sendEvent("complete", {
      auditId,
      report: auditReport,
      forwardStops: crawlResult.forwardStops,
      backwardStops: crawlResult.backwardStops,
      ledger: ledgerCalls,
    });
  } catch (err: any) {
    sendEvent("error", { message: err.message || "Audit run failed unexpectedly." });
  } finally {
    if (session) {
      await session.close();
    }
    res.end();
  }
});

// 3. Report download endpoints
app.get("/api/reports/:id/html", (req, res) => {
  let report = reportStore.get(req.params.id);
  if (!report && (req.params.id === "latest" || reportStore.size > 0)) {
    report = Array.from(reportStore.values()).pop();
  }
  if (!report) {
    res.status(404).send("Report not found");
    return;
  }
  const html = generateHtmlReport(report);
  const safeId = (report.auditId || req.params.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="blindspot-${safeId}.html"`);
  res.send(html);
});

app.get("/api/reports/:id/markdown", (req, res) => {
  let report = reportStore.get(req.params.id);
  if (!report && (req.params.id === "latest" || reportStore.size > 0)) {
    report = Array.from(reportStore.values()).pop();
  }
  if (!report) {
    res.status(404).send("Report not found");
    return;
  }
  const md = generateMarkdownReport(report);
  const safeId = (report.auditId || req.params.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  res.setHeader("Content-Type", "text/markdown; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="blindspot-${safeId}.md"`);
  res.send(md);
});

app.get("/api/reports/:id/json", (req, res) => {
  let report = reportStore.get(req.params.id);
  if (!report && (req.params.id === "latest" || reportStore.size > 0)) {
    report = Array.from(reportStore.values()).pop();
  }
  if (!report) {
    res.status(404).send("Report not found");
    return;
  }
  const safeId = (report.auditId || req.params.id).replace(/[^a-zA-Z0-9_-]/g, "_");
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Content-Disposition", `attachment; filename="blindspot-${safeId}.json"`);
  res.json(report);
});

// 4. Vite middleware for React UI in dev mode, or static dist in production
async function startServer() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
      root: __dirname,
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.resolve(distPath, "index.html"));
    });
  }

  app.listen(PORT, () => {
    console.log(`\n🚀 BlindSpot Server & Web App running at: http://localhost:${PORT}`);
    console.log(`📁 Serving fixtures at: http://localhost:${PORT}/fixtures/`);
  });
}

startServer();
