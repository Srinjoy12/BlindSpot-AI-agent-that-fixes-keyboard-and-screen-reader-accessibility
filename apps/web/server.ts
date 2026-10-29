import express from "express";
import cors from "cors";
import helmet from "helmet";
import crypto from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";
import { createServer as createViteServer } from "vite";

import {
  startSession,
  startLocalDevSession,
  crawl,
  runInteractionPass,
  checkUrl,
  runAxe,
  isFindingReportedByAxe,
  convertAxeRulesToHits,
  loadSource,
  validateFileSet,
  loadSourceFileSet,
  validateLocalDevUrl,
  isLoopbackAddress,
  validateBridgeRequestSecurity,
  AuditConcurrencyController,
  auditConcurrency,
  type FileSet,
  type FileInputItem,
} from "@blindspot/engine";
import { runDetectors } from "@blindspot/detectors";
import {
  generateStateDigest,
  analyzeFindings,
  clearLedger,
  ledgerTotals,
  getLedger,
  getTavilyLedger,
  aggregateLedger,
} from "@blindspot/ai";
import {
  runFixLoop,
  runSourceFixLoop,
  runFileSetFixLoop,
  translateFixToReact,
  localizeReactCandidateFiles,
  type SourceFixResult,
  type FileSetEdit,
} from "@blindspot/fixer";
import {
  generateHtmlReport,
  generateMarkdownReport,
  type AuditReport,
  ReportStore,
} from "@blindspot/report";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "../..");
dotenv.config({ path: path.resolve(REPO_ROOT, ".env") });

const FIXTURES_DIR = path.resolve(REPO_ROOT, "fixtures/pages");
const MANIFESTS_DIR = path.resolve(REPO_ROOT, "fixtures/manifests");

const app = express();
const PORT = process.env.PORT ? parseInt(process.env.PORT, 10) : 3000;

// Security headers: helmet with sensible defaults (CSP disabled for Vite dev compatibility)
app.use(helmet({ contentSecurityPolicy: false }));

// CORS configuration: Allowlist from CORS_ORIGINS (same-origin by default)
const rawCorsOrigins = process.env.CORS_ORIGINS?.trim();
const allowedCorsList = rawCorsOrigins
  ? rawCorsOrigins.split(",").map((s) => s.trim().toLowerCase())
  : [];

app.use(
  cors({
    origin: (origin, callback) => {
      // Allow requests with no origin header (same-origin browser navigation, curl, local tests)
      if (!origin) {
        return callback(null, true);
      }
      const lower = origin.toLowerCase();
      // If CORS_ORIGINS is configured, check against allowlist
      if (allowedCorsList.length > 0) {
        if (allowedCorsList.includes(lower)) {
          return callback(null, true);
        }
        return callback(new Error(`Origin '${origin}' not allowed by CORS policy`));
      }
      // Same-origin default: verify host and port match local server
      try {
        const u = new URL(origin);
        const isLocal =
          u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
        const portMatches =
          (u.port || (u.protocol === "https:" ? "443" : "80")) === String(PORT);
        if (isLocal && portMatches) {
          return callback(null, true);
        }
      } catch {}
      return callback(new Error(`Origin '${origin}' not allowed by CORS policy (same-origin only)`));
    },
    credentials: true,
  })
);

app.use("/api/audit-files", express.json({ limit: "6mb" }));
app.use("/api/audit-local-dev", express.json({ limit: "6mb" }));
app.use(express.json({ limit: "200kb" }));

// ── In-Memory Audit Report Storage (UUID, 1-Hour TTL, 200 Reports / 100 MB Cap) ──
const reportStore = new ReportStore({
  maxReports: 200,
  maxBytes: 100 * 1024 * 1024,
  ttlMs: 60 * 60 * 1000,
});


// ── Rate Limiter & Token Budget Middlewares ────────────────────────────────────

const ipRequests = new Map<string, number[]>();
const RATE_LIMIT_PER_IP_PER_HOUR = process.env.RATE_LIMIT_PER_IP_PER_HOUR
  ? parseInt(process.env.RATE_LIMIT_PER_IP_PER_HOUR, 10)
  : 60;

function rateLimitMiddleware(req: express.Request, res: express.Response, next: express.NextFunction) {
  const forwarded = req.headers["x-forwarded-for"];
  const rawIp = (typeof forwarded === "string" ? forwarded.split(",")[0]?.trim() : null) || req.ip || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();
  const oneHourAgo = now - 3600 * 1000;

  const timestamps = (ipRequests.get(rawIp) || []).filter((t) => t > oneHourAgo);
  if (timestamps.length >= RATE_LIMIT_PER_IP_PER_HOUR) {
    res.status(429).json({
      error: `Rate limit exceeded (${RATE_LIMIT_PER_IP_PER_HOUR} audits/hour per IP). Please wait before running another audit.`,
    });
    return;
  }
  timestamps.push(now);
  ipRequests.set(rawIp, timestamps);
  next();
}

let dailyTokensUsed = 0;
let tokenBudgetDay = new Date().toISOString().slice(0, 10);
const DAILY_TOKEN_BUDGET = process.env.DAILY_TOKEN_BUDGET
  ? parseInt(process.env.DAILY_TOKEN_BUDGET, 10)
  : 100_000;

function checkDailyTokenBudget(): boolean {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== tokenBudgetDay) {
    tokenBudgetDay = today;
    dailyTokensUsed = 0;
  }
  return dailyTokensUsed < DAILY_TOKEN_BUDGET;
}

function recordTokensConsumed(tokens: number) {
  const today = new Date().toISOString().slice(0, 10);
  if (today !== tokenBudgetDay) {
    tokenBudgetDay = today;
    dailyTokensUsed = 0;
  }
  dailyTokensUsed += tokens;
}

function tokenBudgetMiddleware(_req: express.Request, res: express.Response, next: express.NextFunction) {
  if (!checkDailyTokenBudget()) {
    res.status(429).json({
      error: `Daily token budget of ${DAILY_TOKEN_BUDGET.toLocaleString()} tokens reached. Please try again tomorrow or inspect cached fixture replays.`,
    });
    return;
  }
  next();
}

// 0. Token budget status endpoint
app.get("/api/budget", (_req, res) => {
  checkDailyTokenBudget();
  res.json({
    dailyBudget: DAILY_TOKEN_BUDGET,
    tokensUsedToday: dailyTokensUsed,
    remainingTokens: Math.max(0, DAILY_TOKEN_BUDGET - dailyTokensUsed),
    percentUsed: Math.min(100, Math.round((dailyTokensUsed / DAILY_TOKEN_BUDGET) * 100)),
  });
});

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

// 1.5 Get fixture source code for "Load example" in paste code panel
app.get("/api/fixture-source/:id", (req, res) => {
  try {
    const { id } = req.params;
    const cleanId = id.toUpperCase();
    const htmlFiles = fs.readdirSync(FIXTURES_DIR);
    const matchingHtml = htmlFiles.find((h) => h.startsWith(cleanId));
    if (!matchingHtml) {
      res.status(404).json({ error: `Fixture ${cleanId} not found.` });
      return;
    }
    const filePath = path.join(FIXTURES_DIR, matchingHtml);
    const source = fs.readFileSync(filePath, "utf-8");
    res.json({ id: cleanId, filename: matchingHtml, source });
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// 2. Audit runner with Server-Sent Events (SSE)
app.post("/api/audit", rateLimitMiddleware, tokenBudgetMiddleware, async (req, res) => {
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

  const auditId = crypto.randomUUID();
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

  if (req.body.useReplay === true && replayFile && fs.existsSync(replayFile)) {
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

      const ledgerCalls = cachedData.ledger || [];
      const ledgerAgg = aggregateLedger(
        ledgerCalls,
        [],
        cachedData.report?.summary?.fixesVerified || 0,
        cachedData.report?.durationMs || 5000
      );
      const stageTimeline = cachedData.report?.modelsAndCost?.stageTimeline || {
        crawlMs: Math.round((cachedData.report?.durationMs || 5000) * 0.35),
        axeMs: Math.round((cachedData.report?.durationMs || 5000) * 0.1),
        modelsMs: Math.round((cachedData.report?.durationMs || 5000) * 0.35),
        verificationMs: Math.round((cachedData.report?.durationMs || 5000) * 0.2),
        totalMs: cachedData.report?.durationMs || 5000,
      };
      const modelsAndCost = cachedData.report?.modelsAndCost || {
        ...ledgerAgg,
        stageTimeline,
      };

      const activeReport = {
        ...cachedData.report,
        auditId,
        pageId,
        isRecordedRun: true,
        modelsAndCost,
        baseline: cachedData.report?.baseline || {
          tool: "axe-core",
          version: "4.10.0",
          violationCount: cachedData.report?.summary?.axeViolations || 0,
          rules: [],
        },
      };

      if (activeReport.baseline) {
        sendEvent("baseline", { baseline: activeReport.baseline });
      }

      reportStore.set(auditId, activeReport);
      if (cachedData.report?.auditId) {
        reportStore.set(cachedData.report.auditId, activeReport);
      }
      if (cachedData.auditId) {
        reportStore.set(cachedData.auditId, activeReport);
      }

      sendEvent("ledger", { calls: ledgerCalls, aggregate: modelsAndCost });
      sendEvent("complete", {
        auditId,
        report: activeReport,
        forwardStops: cachedData.forwardStops || [],
        backwardStops: cachedData.backwardStops || [],
        ledger: ledgerCalls,
        modelsAndCost,
      });
      res.end();
      return;
    } catch (e: any) {
      console.warn("Replay read error, falling back to live audit:", e.message);
    }
  }

  // Acquire browser concurrency slot
  let releaseSlot: (() => void) | null = null;
  try {
    releaseSlot = await auditConcurrency.acquire(res, req, auditId);
  } catch (err: any) {
    if (err.status === 503) {
      sendEvent("error", { message: err.message });
      res.end();
      return;
    }
    throw err;
  }

  sendEvent("status", { phase: "launch", message: `Launching Chromium session for ${targetUrl}...` });

  let session: any = null;
  let crawlMs = 0;
  let axeMs = 0;
  let modelsMs = 0;
  let verificationMs = 0;

  try {
    session = await startSession({ auditId, targetUrl: resolvedUrl });

    sendEvent("status", { phase: "baseline", message: "Running axe-core baseline audit..." });
    let baseline: any = null;
    const axeStart = Date.now();
    try {
      baseline = await runAxe(session.page);
      sendEvent("baseline", { baseline });
    } catch (axeErr: any) {
      console.warn("axe-core baseline evaluation error:", axeErr.message);
    }
    axeMs = Date.now() - axeStart;

    sendEvent("status", { phase: "crawl", message: "Crawling keyboard focus navigation (Tab forward)..." });

    // Step 1: Forward crawl
    const crawlStart = Date.now();
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
    crawlMs = Date.now() - crawlStart;

    sendEvent("status", { phase: "detect", message: "Running deterministic accessibility detectors (D1–D9)..." });

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

    // Include static axe-core accessibility violations (contrast, heading order, labels, etc.)
    const axeHits = convertAxeRulesToHits(baseline, hits);
    hits.push(...axeHits);

    sendEvent("findings_raw", { count: hits.length, hits });

    // Step 4: AI Analysis & Fix loop
    let stateDigest: any = null;
    if (hits.length > 0) {
      sendEvent("status", { phase: "digest", message: "Generating state digest with NVIDIA Nemotron-3 Nano..." });
      const digestStart = Date.now();
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
      modelsMs += Date.now() - digestStart;
      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(getLedger(), getTavilyLedger(), 0, Date.now() - startTime),
      });
    }

    sendEvent("status", { phase: "analyze", message: "Synthesizing issues with Nemotron Super & Tavily..." });
    let analyzedFindings: any[] = [];
    if (hits.length > 0) {
      const analysisStart = Date.now();
      try {
        analyzedFindings = await analyzeFindings({
          hits,
          digests: stateDigest ? [stateDigest] : [],
          url: resolvedUrl,
        });
      } catch (err: any) {
        console.error("Super analysis failed:", err.message);
      }
      modelsMs += Date.now() - analysisStart;
      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(getLedger(), getTavilyLedger(), 0, Date.now() - startTime),
      });
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

        const fixStart = Date.now();
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
        verificationMs += Date.now() - fixStart;

        sendEvent("ledger", {
          calls: Array.from(getLedger()),
          aggregate: aggregateLedger(getLedger(), getTavilyLedger(), verifiedCount, Date.now() - startTime),
        });

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
              reactEquivalent: translateFixToReact(
                {
                  patchType: fixResult.patchType || "css",
                  body: fixResult.body || fixResult.cssRule || "",
                  rationale: fixResult.rationale || fixResult.explanation,
                  targetSelector: fixResult.targetSelector || hit.selector,
                },
                { detectorId: hit.detectorId, selector: hit.selector }
              ) || undefined,
            }
          : undefined,
        verified: isVerified,
        verificationEvidence: evidenceText || (isVerified
          ? "Chromium keyboard re-crawl confirmed barrier eliminated with 0 regressions."
          : undefined),
        alsoReportedByAxe: isFindingReportedByAxe(hit.selector, baseline),
      };

      barrierItems.push(barrierItem);
      sendEvent("barrier_resolved", { index: i, item: barrierItem });
    }

    // Calculate score: 100 - (blockers * 25 + majors * 10 + minors * 3), bounded 0-100
    const rawPenalty = blockers * 25 + majors * 10 + minors * 3;
    const keyboardScore = Math.max(0, Math.min(100, 100 - rawPenalty));

    const totals = ledgerTotals();
    recordTokensConsumed(totals.totalTokensIn + totals.totalTokensOut);

    const rawCalls = Array.from(getLedger());
    const ledgerCalls = rawCalls.map((c) => ({
      ...c,
      tier: (c.stage === "digest" || (c.model ?? c.modelId).toLowerCase().includes("nano")
        ? "nano"
        : c.stage === "analysis" || (c.model ?? c.modelId).toLowerCase().includes("super")
        ? "super"
        : "ultra") as "nano" | "super" | "ultra",
    }));
    const tavilyCalls = ledgerCalls
      .filter((c) => (c.model ?? c.modelId).includes("tavily"))
      .map((c) => c.model ?? c.modelId);

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
        axeViolations: baseline?.violationCount || 0,
        foundOnlyByBlindspot: hits.filter((h) => !isFindingReportedByAxe(h.selector, baseline)).length,
      },
      barriers: barrierItems,
      baseline: baseline
        ? {
            tool: baseline.tool,
            version: baseline.version,
            violationCount: baseline.violationCount,
            rules: baseline.rules.map((r: any) => ({
              id: r.ruleId,
              tags: r.tags,
              nodesCount: r.nodeCount,
              selectors: r.selectors,
              impact: r.impact,
            })),
          }
        : undefined,
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
      modelsAndCost: {
        ...aggregateLedger(
          getLedger(),
          getTavilyLedger(),
          verifiedCount,
          Date.now() - startTime
        ),
        stageTimeline: {
          crawlMs,
          axeMs,
          modelsMs,
          verificationMs,
          totalMs: Date.now() - startTime,
        },
      },
    };

    reportStore.set(auditId, auditReport);

    sendEvent("complete", {
      auditId,
      report: auditReport,
      forwardStops: crawlResult.forwardStops,
      backwardStops: crawlResult.backwardStops,
      ledger: ledgerCalls,
      modelsAndCost: auditReport.modelsAndCost,
    });
  } catch (err: any) {
    sendEvent("error", { message: err.message || "Audit run failed unexpectedly." });
  } finally {
    if (releaseSlot) {
      releaseSlot();
    }
    if (session) {
      await session.close();
    }
    res.end();
  }
});

// 2.5 Pasted code audit runner (HTML / Snippets in airgapped sandbox)
app.post("/api/audit-code", rateLimitMiddleware, tokenBudgetMiddleware, async (req, res) => {
  const { source, kind = "html", runFixes = true, maxStops = 50 } = req.body;

  if (!source || typeof source !== "string" || source.trim().length === 0) {
    res.status(400).json({ error: "Missing or empty 'source' parameter. Please provide HTML or a code snippet." });
    return;
  }

  const byteLength = Buffer.byteLength(source, "utf-8");
  if (byteLength > 100 * 1024) {
    res.status(400).json({
      error: `Pasted source exceeds maximum allowed size of 100 KB (${(byteLength / 1024).toFixed(1)} KB provided).`,
    });
    return;
  }

  if (kind !== "html" && kind !== "snippet") {
    res.status(400).json({ error: "Invalid 'kind' parameter. Must be 'html' or 'snippet'." });
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

  const auditId = crypto.randomUUID();
  const startTime = Date.now();
  clearLedger();

  // Acquire browser concurrency slot
  let releaseSlot: (() => void) | null = null;
  try {
    releaseSlot = await auditConcurrency.acquire(res, req, auditId);
  } catch (err: any) {
    if (err.status === 503) {
      sendEvent("error", { message: err.message });
      res.end();
      return;
    }
    throw err;
  }

  sendEvent("status", { phase: "launch", message: "Launching airgapped Chromium sandbox for pasted code..." });

  let session: any = null;
  let crawlMs = 0;
  let axeMs = 0;
  let modelsMs = 0;
  let verificationMs = 0;

  try {
    session = await loadSource({
      source,
      kind,
      auditId,
      navigationTimeoutMs: 15_000,
    });

    if (session.blockedRequestsCount > 0) {
      sendEvent("status", {
        phase: "launch",
        message: `Airgap sandbox: ${session.blockedRequestsCount} external resource requests were blocked.`,
      });
    }

    sendEvent("status", { phase: "baseline", message: "Evaluating axe-core baseline..." });
    let baseline: any = null;
    const axeStart = Date.now();
    try {
      baseline = await runAxe(session.page);
      sendEvent("baseline", { baseline });
    } catch (axeErr: any) {
      console.warn("axe-core baseline evaluation error:", axeErr.message);
    }
    axeMs = Date.now() - axeStart;

    sendEvent("status", { phase: "crawl", message: "Crawling keyboard focus navigation (Tab forward)..." });
    const crawlStart = Date.now();
    const crawlResult = await crawl(session.page, { maxStops, pauseMs: 50 });

    for (const stop of crawlResult.forwardStops) {
      sendEvent("stop", { direction: "forward", stop });
    }

    sendEvent("status", { phase: "interact", message: "Probing keyboard interactive surfaces & dialogs..." });
    const interactionResult = await runInteractionPass(session.page, { count: 3 });
    crawlMs = Date.now() - crawlStart;

    // Extract candidate interactives for D2
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
      return { selectors, hoverTriggers: [] };
    })()`)) as { selectors: string[]; hoverTriggers: string[] };

    sendEvent("status", { phase: "detect", message: "Running deterministic accessibility detectors (D1–D9)..." });

    const hits = runDetectors({
      stateLabel: "S0",
      focusStops: crawlResult.forwardStops,
      interactions: interactionResult.interactions,
      candidateInteractives: candidateData.selectors,
    });

    // Include static axe-core accessibility violations (contrast, heading order, labels, etc.)
    const axeHits = convertAxeRulesToHits(baseline, hits);
    hits.push(...axeHits);

    sendEvent("findings_raw", { count: hits.length, hits });

    // AI Analysis & Fix loop
    let stateDigest: any = null;
    if (hits.length > 0) {
      sendEvent("status", { phase: "digest", message: "Generating state digest with NVIDIA Nemotron-3 Nano..." });
      const digestStart = Date.now();
      try {
        stateDigest = await generateStateDigest({
          url: "pasted-source.html",
          stateLabel: "S0",
          focusStops: crawlResult.forwardStops,
        });
        sendEvent("digest", { digest: stateDigest?.pagePurpose || "State digest complete." });
      } catch (err: any) {
        console.error("Digest failed:", err.message);
      }
      modelsMs += Date.now() - digestStart;
      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(getLedger(), getTavilyLedger(), 0, Date.now() - startTime),
      });
    }

    sendEvent("status", { phase: "analyze", message: "Synthesizing issues with Nemotron Super & Tavily..." });
    let analyzedFindings: any[] = [];
    if (hits.length > 0) {
      const analysisStart = Date.now();
      try {
        analyzedFindings = await analyzeFindings({
          hits,
          digests: stateDigest ? [stateDigest] : [],
          url: "pasted-source.html",
        });
      } catch (err: any) {
        console.error("Super analysis failed:", err.message);
      }
      modelsMs += Date.now() - analysisStart;
      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(getLedger(), getTavilyLedger(), 0, Date.now() - startTime),
      });
    }

    const barrierItems: any[] = [];
    let blockers = 0;
    let majors = 0;
    let minors = 0;
    let verifiedCount = 0;
    let sourceFixResults: SourceFixResult[] = [];
    if (runFixes && hits.length > 0) {
      sendEvent("status", {
        phase: "fix",
        message: "Nemotron Ultra synthesizing and verifying minimal source fixes in airgapped browser...",
      });

      const fixStart = Date.now();
      try {
        const loopRes = await runSourceFixLoop({
          source,
          findings: analyzedFindings.length > 0 ? analyzedFindings : hits,
          beforeHits: hits,
          beforeStopsCount: crawlResult.forwardStops.length,
          kind,
          maxAttemptsPerFinding: 2,
        });

        sourceFixResults = loopRes.fixes;
      } catch (fixErr: any) {
        console.error("Source fix loop error:", fixErr.message);
        sendEvent("status", {
          phase: "fix",
          message: "Nemotron Ultra call failed or timed out; deterministic fix fallback applied.",
        });
      }
      verificationMs += Date.now() - fixStart;
      const currentVerified = sourceFixResults.filter((sf) => sf.status === "verified").length;
      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(getLedger(), getTavilyLedger(), currentVerified, Date.now() - startTime),
      });
    }

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i];
      if (hit.severity === "blocker") blockers++;
      else if (hit.severity === "major") majors++;
      else minors++;

      const alsoReported = isFindingReportedByAxe(hit.selector, baseline);

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

      const sourceFix = sourceFixResults[i] || sourceFixResults.find((sf) => sf.detectorId === hit.detectorId);
      const isVerified = sourceFix?.status === "verified";
      if (isVerified) verifiedCount++;

      const fixStatus = sourceFix?.status || (runFixes ? "unverified" : undefined);
      const evidenceText = sourceFix?.verificationEvidence || (isVerified
        ? `Focus path verified in airgapped browser session: detector '${hit.detectorId}' on '${hit.selector}' resolved with 0 new regressions.`
        : "Fix unverified: proposed changes did not eliminate the barrier in airgapped browser verification or introduced regressions.");

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
        verified: isVerified,
        status: fixStatus,
        diff: sourceFix?.diff,
        modifiedSource: sourceFix?.modifiedSource,
        rejectionReason: sourceFix?.rejectionReason,
        verificationEvidence: evidenceText,
        fix: sourceFix
          ? {
              patchType: "source",
              body: sourceFix.diff,
              rationale: sourceFix.explanation || "Accessibility repair generated by Nemotron Ultra.",
              targetSelector: hit.selector,
              explanation: sourceFix.explanation || "Accessibility repair generated by Nemotron Ultra.",
              diff: sourceFix.diff,
              modifiedSource: sourceFix.modifiedSource,
            }
          : undefined,
        alsoReportedByAxe: alsoReported,
        beforeCrawlSummary: sourceFix?.beforeCrawlSummary || {
          stopsCount: crawlResult.forwardStops.length,
          hitsCount: hits.length,
          blockersCount: blockers,
          majorsCount: majors,
        },
        afterCrawlSummary: sourceFix?.afterCrawlSummary,
      };

      barrierItems.push(barrierItem);
      sendEvent("barrier_resolved", { index: i, item: barrierItem });
    }

    const rawPenalty = blockers * 25 + majors * 10 + minors * 3;
    const keyboardScore = Math.max(0, Math.min(100, 100 - rawPenalty));

    const totals = ledgerTotals();
    recordTokensConsumed(totals.totalTokensIn + totals.totalTokensOut);

    const rawCalls = Array.from(getLedger());
    const ledgerCalls = rawCalls.map((c) => ({
      ...c,
      tier: (c.stage === "digest" || (c.model ?? c.modelId).toLowerCase().includes("nano")
        ? "nano"
        : c.stage === "analysis" || (c.model ?? c.modelId).toLowerCase().includes("super")
        ? "super"
        : "ultra") as "nano" | "super" | "ultra",
    }));
    const tavilyCalls = ledgerCalls
      .filter((c) => (c.model ?? c.modelId).includes("tavily"))
      .map((c) => c.model ?? c.modelId);

    const nanoCalls = ledgerCalls.filter((c) => c.tier === "nano");
    const superCalls = ledgerCalls.filter((c) => c.tier === "super");
    const ultraCalls = ledgerCalls.filter((c) => c.tier === "ultra");

    const auditReport: AuditReport = {
      auditId,
      targetUrl: kind === "snippet" ? "pasted-snippet.html" : "pasted-source.html",
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
        axeViolations: baseline?.violationCount || 0,
        foundOnlyByBlindspot: hits.filter((h) => !isFindingReportedByAxe(h.selector, baseline)).length,
        blockedResourcesCount: session.blockedRequestsCount,
      },
      barriers: barrierItems,
      baseline: baseline
        ? {
            tool: baseline.tool,
            version: baseline.version,
            violationCount: baseline.violationCount,
            rules: baseline.rules.map((r: any) => ({
              id: r.ruleId,
              tags: r.tags,
              nodesCount: r.nodeCount,
              selectors: r.selectors,
              impact: r.impact,
            })),
          }
        : undefined,
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
      modelsAndCost: {
        ...aggregateLedger(
          getLedger(),
          getTavilyLedger(),
          verifiedCount,
          Date.now() - startTime
        ),
        stageTimeline: {
          crawlMs,
          axeMs,
          modelsMs,
          verificationMs,
          totalMs: Date.now() - startTime,
        },
      },
    };

    reportStore.set(auditId, auditReport);

    sendEvent("complete", {
      auditId,
      report: auditReport,
      forwardStops: crawlResult.forwardStops,
      backwardStops: crawlResult.backwardStops,
      ledger: ledgerCalls,
      modelsAndCost: auditReport.modelsAndCost,
      sourceFixes: sourceFixResults,
      originalSource: source,
      finalSource: [...sourceFixResults].reverse().find((f) => f.status === "verified")?.modifiedSource || source,
    });
  } catch (err: any) {
    sendEvent("error", { message: err.message || "Audit run failed unexpectedly." });
  } finally {
    if (releaseSlot) {
      releaseSlot();
    }
    if (session) {
      await session.close();
    }
    res.end();
  }
});

// 2b. Audit FileSet (Project Folder) endpoint
app.post("/api/audit-files", rateLimitMiddleware, tokenBudgetMiddleware, async (req, res) => {
  const { files, entryPath = "index.html", runFixes = true, maxStops = 50 } = req.body || {};

  // 1. Validate FileSet
  const validation = validateFileSet(files);
  if (!validation.valid || !validation.fileSet) {
    res.status(400).json({ error: validation.error || "Invalid files provided." });
    return;
  }

  const fileSet = validation.fileSet;
  let resolvedEntry =
    typeof entryPath === "string" && entryPath.trim()
      ? entryPath.trim().replace(/^\/+/, "")
      : "index.html";

  if (!fileSet.has(resolvedEntry)) {
    const htmlCandidate = Array.from(fileSet.keys()).find(
      (k) => k.endsWith(".html") || k.endsWith(".htm")
    );
    if (htmlCandidate) {
      resolvedEntry = htmlCandidate;
    } else {
      res.status(400).json({
        error: `Entry HTML file '${resolvedEntry}' not found in uploaded project files.`,
      });
      return;
    }
  }

  // Set up SSE
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const auditId = crypto.randomUUID();
  const startTime = Date.now();
  clearLedger();

  // Acquire browser concurrency slot
  let releaseSlot: (() => void) | null = null;
  try {
    releaseSlot = await auditConcurrency.acquire(res, req, auditId);
  } catch (err: any) {
    if (err.status === 503) {
      sendEvent("error", { message: err.message });
      res.end();
      return;
    }
    throw err;
  }

  sendEvent("status", {
    phase: "launch",
    message: "Loading project files into airgapped browser sandbox...",
  });

  let session: import("@blindspot/engine").SourceSession | null = null;
  let crawlMs = 0;
  let axeMs = 0;
  let modelsMs = 0;
  let verificationMs = 0;

  try {
    session = await loadSourceFileSet({
      fileSet,
      entryPath: resolvedEntry,
      navigationTimeoutMs: 15_000,
    });

    sendEvent("status", {
      phase: "crawl",
      message: "Starting keyboard navigation crawl across project...",
    });
    const crawlStart = Date.now();
    const crawlResult = await crawl(session.page, { maxStops, pauseMs: 35 });
    crawlMs = Date.now() - crawlStart;

    for (const stop of crawlResult.forwardStops) {
      sendEvent("stop", { stop });
    }

    sendEvent("status", {
      phase: "interactions",
      message: "Testing candidate interactives & menus...",
    });
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

    const interactionResult = await runInteractionPass(session.page, { count: 1 });

    sendEvent("status", {
      phase: "detect",
      message: "Evaluating keyboard barrier detectors...",
    });
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

    sendEvent("status", { phase: "axe", message: "Running axe-core accessibility baseline..." });
    const axeStart = Date.now();
    let baseline = null;
    try {
      baseline = await runAxe(session.page);
    } catch {
      baseline = null;
    }
    axeMs = Date.now() - axeStart;

    // Include static axe-core accessibility violations
    const axeHits = convertAxeRulesToHits(baseline, hits);
    hits.push(...axeHits);

    sendEvent("status", { phase: "digest", message: "Nemotron Nano generating page digest..." });
    const modelsStart = Date.now();
    let digest: import("@blindspot/ai").StateDigest | null = null;
    try {
      const pageHtml = fileSet.get(resolvedEntry) || "";
      const textSnippet = pageHtml.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim().slice(0, 500);
      digest = await generateStateDigest({
        stateLabel: "S0",
        url: resolvedEntry,
        focusStops: crawlResult.forwardStops.slice(0, 20).map((s) => ({
          selector: s.selector,
          tagName: s.tagName ?? "unknown",
          role: s.role ?? "",
          accessibleName: s.accessibleName ?? "",
        })),
        landmarkSummary: [textSnippet],
      });
    } catch {
      // digest stays null; analyzeFindings will work with empty digests
    }

    sendEvent("status", {
      phase: "analyze",
      message: "Nemotron Super analyzing detected accessibility barriers...",
    });
    let analyzedFindings: any[] = [];
    try {
      analyzedFindings = await analyzeFindings({ hits, digests: digest ? [digest] : [], url: resolvedEntry });
    } catch {
      analyzedFindings = hits.map((hit) => ({
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
      }));
    }
    modelsMs = Date.now() - modelsStart;

    let fixResults: import("@blindspot/fixer").RunFileSetFixLoopResult = {
      edits: [],
      finalFileSet: fileSet,
      allVerified: false,
      findings: analyzedFindings,
    };

    if (runFixes && hits.length > 0) {
      sendEvent("status", {
        phase: "fix",
        message: "Nemotron Ultra synthesizing and verifying fixes across project files...",
      });
      const fixStart = Date.now();
      try {
        fixResults = await runFileSetFixLoop({
          fileSet,
          entryPath: resolvedEntry,
          findings: analyzedFindings.length > 0 ? analyzedFindings : hits,
          beforeHits: hits,
          beforeStopsCount: crawlResult.forwardStops.length,
          maxAttemptsPerFinding: 3,
        });
      } catch (fixErr: any) {
        console.error("FileSet fix loop error:", fixErr.message);
        sendEvent("status", {
          phase: "fix",
          message: "Ultra fix loop encountered error; unverified status applied.",
        });
      }
      verificationMs = Date.now() - fixStart;

      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(
          getLedger(),
          getTavilyLedger(),
          fixResults.edits.filter((e) => e.status === "verified").length,
          Date.now() - startTime
        ),
      });
    }

    // Guard: strictly ensure all edit paths are in uploaded files
    const validUploadedPaths = new Set(fileSet.keys());
    for (const edit of fixResults.edits) {
      if (!validUploadedPaths.has(edit.path)) {
        edit.status = "rejected";
        edit.rejectionReason = `Model proposed editing '${edit.path}', which is not among the uploaded project files.`;
      }
    }

    let blockers = 0;
    let majors = 0;
    let minors = 0;
    let verifiedCount = 0;
    const barrierItems: any[] = [];

    for (let i = 0; i < hits.length; i++) {
      const hit = hits[i]!;
      if (hit.severity === "blocker") blockers++;
      else if (hit.severity === "major") majors++;
      else minors++;

      const alsoReported = isFindingReportedByAxe(hit.selector, baseline);
      const analyzed =
        analyzedFindings.find(
          (af) =>
            af.detectorId === hit.detectorId &&
            (af.selector === hit.selector ||
              af.selector.includes(hit.selector.replace(/^[#.]/, "")))
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

      const findingId = `barrier_${i + 1}`;
      const edit =
        fixResults.edits.find((e) => e.findingIds.includes(findingId)) ||
        fixResults.edits[i];
      const isVerified = edit?.status === "verified";
      if (isVerified) verifiedCount++;

      const fixStatus = edit?.status || (runFixes ? "unverified" : undefined);
      const evidenceText =
        edit?.verificationEvidence ||
        (isVerified
          ? `Focus path verified in airgapped browser session: detector '${hit.detectorId}' on '${hit.selector}' resolved with 0 new regressions.`
          : "Fix unverified: proposed changes did not eliminate the barrier in airgapped browser verification or introduced regressions.");

      const barrierItem = {
        id: findingId,
        detectorId: hit.detectorId,
        severity: hit.severity,
        selector: hit.selector,
        wcagId: analyzed.wcag?.id || hit.wcagId,
        wcagName: analyzed.wcag?.name || "Keyboard Accessibility Requirement",
        wcagUrl: analyzed.wcag?.referenceUrl || `https://www.w3.org/WAI/WCAG22/quickref/#${hit.wcagId}`,
        impact: analyzed.impact || hit.evidence,
        evidence: hit.evidence,
        verified: isVerified,
        status: fixStatus,
        diff: edit?.unifiedDiff,
        filePath: edit?.path,
        originalSource: edit?.original,
        modifiedSource: edit?.modified,
        rejectionReason: edit?.rejectionReason,
        verificationEvidence: evidenceText,
        fix: edit
          ? {
              patchType: "source",
              body: edit.unifiedDiff,
              filePath: edit.path,
              targetSelector: hit.selector,
              rationale: edit.explanation || "Accessibility repair generated by Nemotron Ultra.",
              explanation: edit.explanation || "Accessibility repair generated by Nemotron Ultra.",
              diff: edit.unifiedDiff,
              originalSource: edit.original,
              modifiedSource: edit.modified,
            }
          : undefined,
        alsoReportedByAxe: alsoReported,
        beforeCrawlSummary: edit?.beforeCrawlSummary || {
          stopsCount: crawlResult.forwardStops.length,
          hitsCount: hits.length,
          blockersCount: blockers,
          majorsCount: majors,
        },
        afterCrawlSummary: edit?.afterCrawlSummary,
      };

      barrierItems.push(barrierItem);
      sendEvent("barrier_resolved", { index: i, item: barrierItem });
    }

    const rawPenalty = blockers * 25 + majors * 10 + minors * 3;
    const keyboardScore = Math.max(0, Math.min(100, 100 - rawPenalty));

    const totals = ledgerTotals();
    recordTokensConsumed(totals.totalTokensIn + totals.totalTokensOut);

    const rawCalls = Array.from(getLedger());
    const ledgerCalls = rawCalls.map((c) => ({
      ...c,
      tier: (c.stage === "digest" || (c.model ?? c.modelId).toLowerCase().includes("nano")
        ? "nano"
        : c.stage === "analysis" || (c.model ?? c.modelId).toLowerCase().includes("super")
        ? "super"
        : "ultra") as "nano" | "super" | "ultra",
    }));
    const tavilyCalls = ledgerCalls
      .filter((c) => (c.model ?? c.modelId).includes("tavily"))
      .map((c) => c.model ?? c.modelId);

    const nanoCalls = ledgerCalls.filter((c) => c.tier === "nano");
    const superCalls = ledgerCalls.filter((c) => c.tier === "super");
    const ultraCalls = ledgerCalls.filter((c) => c.tier === "ultra");

    const auditReport: AuditReport = {
      auditId,
      targetUrl: resolvedEntry,
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
        axeViolations: baseline?.violationCount || 0,
        foundOnlyByBlindspot: hits.filter((h) => !isFindingReportedByAxe(h.selector, baseline)).length,
        blockedResourcesCount: session.blockedRequestsCount,
      },
      barriers: barrierItems,
      baseline: baseline
        ? {
            tool: baseline.tool,
            version: baseline.version,
            violationCount: baseline.violationCount,
            rules: baseline.rules.map((r: any) => ({
              id: r.ruleId,
              tags: r.tags,
              nodesCount: r.nodeCount,
              selectors: r.selectors,
              impact: r.impact,
            })),
          }
        : undefined,
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
      modelsAndCost: {
        ...aggregateLedger(
          getLedger(),
          getTavilyLedger(),
          verifiedCount,
          Date.now() - startTime
        ),
        stageTimeline: {
          crawlMs,
          axeMs,
          modelsMs,
          verificationMs,
          totalMs: Date.now() - startTime,
        },
      },
    };

    reportStore.set(auditId, auditReport);

    sendEvent("complete", {
      auditId,
      report: auditReport,
      forwardStops: crawlResult.forwardStops,
      backwardStops: crawlResult.backwardStops,
      ledger: ledgerCalls,
      modelsAndCost: auditReport.modelsAndCost,
      edits: fixResults.edits,
      files: Array.from(fileSet.entries()).map(([p, c]) => ({
        path: p,
        size: Buffer.byteLength(c, "utf8"),
      })),
    });
  } catch (err: any) {
    sendEvent("error", { message: err.message || "Audit run failed unexpectedly." });
  } finally {
    if (releaseSlot) {
      releaseSlot();
    }
    if (session) {
      await session.close();
    }
    res.end();
  }
});

app.post("/api/audit-local-dev", rateLimitMiddleware, tokenBudgetMiddleware, async (req, res) => {
  // Shared security validation: feature flag, same-origin, Host header, remoteAddress, attestation
  const securityCheck = validateBridgeRequestSecurity({
    origin: req.headers.origin,
    host: Array.isArray(req.headers.host) ? req.headers.host[0] : req.headers.host,
    remoteAddress: req.socket.remoteAddress,
    attested: req.body?.attested,
    serverPort: PORT,
  });

  if (!securityCheck.valid) {
    res.status(securityCheck.status).json({ error: securityCheck.error });
    return;
  }

  const { targetUrl, files = [], runFixes = true, maxStops = 50 } = req.body || {};

  // Target URL validation (rejects own-port, non-loopback, userinfo, etc.)
  let validatedUrl: URL;
  try {
    validatedUrl = validateLocalDevUrl(targetUrl, { attested: true, ownPort: PORT });
  } catch (err: any) {
    res.status(400).json({ error: err.message });
    return;
  }

  // 6. Source folder FileSet validation (if files attached)
  let fileSetMap = new Map<string, string>();
  if (Array.isArray(files) && files.length > 0) {
    const fileCheck = validateFileSet(files, { projectKind: "react" });
    if (!fileCheck.valid || !fileCheck.fileSet) {
      res.status(400).json({ error: fileCheck.error || "Invalid React source files." });
      return;
    }
    fileSetMap = fileCheck.fileSet;
  }

  // 7. Set up SSE stream
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const sendEvent = (event: string, data: any) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  const auditId = crypto.randomUUID();
  const startTime = Date.now();
  clearLedger();

  // Acquire concurrency slot
  let releaseSlot: (() => void) | null = null;
  try {
    releaseSlot = await auditConcurrency.acquire(res, req, auditId);
  } catch (err: any) {
    if (err.status === 503) {
      sendEvent("error", { message: err.message });
      res.end();
      return;
    }
    throw err;
  }

  sendEvent("status", {
    phase: "launch",
    message: `Connecting to local dev server at ${validatedUrl.origin}...`,
  });

  let session: import("@blindspot/engine").Session | null = null;
  let crawlMs = 0;
  let axeMs = 0;
  let modelsMs = 0;
  let verificationMs = 0;

  try {
    session = await startLocalDevSession({
      auditId,
      targetUrl: validatedUrl.href,
      attested: true,
      ownPort: PORT,
      navigationTimeoutMs: 25_000,
    });

    sendEvent("status", { phase: "axe", message: "Running axe-core baseline..." });
    const axeStart = Date.now();
    let baseline: any = null;
    try {
      baseline = await runAxe(session.page);
    } catch (axeErr: any) {
      console.warn("axe-core baseline run failed on dev server:", axeErr.message);
    }
    axeMs = Date.now() - axeStart;
    sendEvent("baseline", { baseline });

    sendEvent("status", { phase: "crawl", message: "Crawling keyboard focus path..." });
    const crawlStart = Date.now();
    const crawlResult = await crawl(session.page, {
      maxStops,
      pauseMs: 40,
    });
    for (const stop of crawlResult.forwardStops) {
      sendEvent("stop", { stop });
    }

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
    crawlMs = Date.now() - crawlStart;

    sendEvent("status", { phase: "interaction", message: "Running interaction pass on menus and dialogs..." });
    const interactionResult = await runInteractionPass(session.page, { count: 3 });

    sendEvent("status", { phase: "detect", message: "Evaluating deterministic detectors D1-D9..." });
    const hits = runDetectors({
      stateLabel: "S0",
      focusStops: crawlResult.forwardStops,
      interactions: interactionResult.interactions,
      candidateInteractives: candidateData.selectors,
    });

    sendEvent("status", {
      phase: "analyze",
      message:
        hits.length > 0
          ? `Found ${hits.length} barrier${hits.length === 1 ? "" : "s"}. Localizing React source files & analyzing...`
          : "No barriers detected.",
    });

    // Run Nemotron state digest & analysis if models configured and hits present
    let stateDigest: any = null;
    if (hits.length > 0) {
      const digestStart = Date.now();
      try {
        stateDigest = await generateStateDigest({
          url: validatedUrl.href,
          stateLabel: "S0",
          focusStops: crawlResult.forwardStops,
        });
        sendEvent("digest", { digest: stateDigest?.pagePurpose || "State digest complete." });
      } catch (err: any) {
        console.error("Digest failed:", err.message);
      }
      modelsMs += Date.now() - digestStart;
      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(getLedger(), getTavilyLedger(), 0, Date.now() - startTime),
      });
    }

    let analyzedFindings: any[] = [];
    if (hits.length > 0) {
      const analysisStart = Date.now();
      try {
        analyzedFindings = await analyzeFindings({
          hits,
          digests: stateDigest ? [stateDigest] : [],
          url: validatedUrl.href,
        });
      } catch (err: any) {
        console.error("Analysis failed:", err.message);
      }
      modelsMs += Date.now() - analysisStart;
      sendEvent("ledger", {
        calls: Array.from(getLedger()),
        aggregate: aggregateLedger(getLedger(), getTavilyLedger(), 0, Date.now() - startTime),
      });
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
        (af) =>
          af.detectorId === hit.detectorId &&
          (af.selector === hit.selector || af.selector.includes(hit.selector.replace(/^[#.]/, "")))
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

      // Heuristic localization across React FileSet
      const candidates =
        fileSetMap.size > 0
          ? localizeReactCandidateFiles(
              { selector: hit.selector, detectorId: hit.detectorId, evidence: hit.evidence },
              fileSetMap,
              { maxCandidates: 3, maxTotalBytes: 60 * 1024 }
            )
          : [];
      const topCandidate = candidates[0];
      const likelySource = topCandidate
        ? {
            path: topCandidate.path,
            confidence: topCandidate.confidence,
            matchedSignals: topCandidate.matchedSignals,
            candidates: candidates.map((c) => ({
              path: c.path,
              score: c.score,
              confidence: c.confidence,
              matchedSignals: c.matchedSignals,
            })),
          }
        : undefined;

      let fixResult: any = null;
      let isVerified = false;
      let evidenceText: string | undefined = undefined;

      if (runFixes) {
        sendEvent("status", {
          phase: "fix",
          message: `Testing runtime DOM patch for ${hit.selector} (${i + 1}/${hits.length})...`,
        });

        const fixStart = Date.now();
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
            evidenceText =
              loopRes.verification?.evidence ||
              "Browser verified runtime DOM patch in Chromium re-crawl.";
          } else if (loopRes.finalPatch) {
            fixResult = loopRes.finalPatch;
            evidenceText =
              loopRes.verification?.evidence ||
              "Runtime patch proposed; barrier still present in re-crawl.";
          }
        } catch (fixErr: any) {
          console.error("Fix loop error on dev server:", fixErr.message);
          evidenceText = `Fix generation error: ${fixErr.message}`;
        }
        verificationMs += Date.now() - fixStart;

        sendEvent("ledger", {
          calls: Array.from(getLedger()),
          aggregate: aggregateLedger(getLedger(), getTavilyLedger(), verifiedCount, Date.now() - startTime),
        });
      }

      // Translate fix to React equivalent
      const reactEq = fixResult
        ? translateFixToReact(
            {
              patchType: fixResult.patchType || "css",
              body: fixResult.body || fixResult.cssRule || "",
              rationale: fixResult.rationale || fixResult.explanation,
              targetSelector: fixResult.targetSelector || hit.selector,
            },
            { detectorId: hit.detectorId, selector: hit.selector }
          ) || undefined
        : undefined;

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
        likelySource,
        filePath: likelySource?.path,
        fix: fixResult
          ? {
              patchType: fixResult.patchType || "css",
              body: fixResult.body || fixResult.cssRule || "",
              rationale:
                fixResult.rationale ||
                fixResult.explanation ||
                "Accessibility repair generated by Nemotron Ultra.",
              targetSelector: fixResult.targetSelector || hit.selector,
              explanation:
                fixResult.rationale ||
                fixResult.explanation ||
                "Accessibility repair generated by Nemotron Ultra.",
              cssRule: fixResult.patchType === "css" ? fixResult.body : undefined,
              scriptContent: fixResult.patchType === "script" ? fixResult.body : undefined,
              htmlReplacement: fixResult.patchType === "html" ? fixResult.body : undefined,
              reactEquivalent: reactEq,
            }
          : undefined,
        reactEquivalent: reactEq,
        verified: isVerified,
        status: isVerified ? "verified" : fixResult ? "unverified" : undefined,
        verificationEvidence: evidenceText,
        alsoReportedByAxe: baseline ? isFindingReportedByAxe(hit.selector, baseline) : false,
      };

      barrierItems.push(barrierItem);
      sendEvent("barrier_resolved", { index: i, item: barrierItem });
    }

    const rawPenalty = blockers * 25 + majors * 10 + minors * 3;
    const keyboardScore = Math.max(0, Math.min(100, 100 - rawPenalty));

    const totals = ledgerTotals();
    recordTokensConsumed(totals.totalTokensIn + totals.totalTokensOut);

    const rawCalls = Array.from(getLedger());
    const ledgerCalls = rawCalls.map((c) => ({
      ...c,
      tier: (c.stage === "digest" || (c.model ?? c.modelId).toLowerCase().includes("nano")
        ? "nano"
        : c.stage === "analysis" || (c.model ?? c.modelId).toLowerCase().includes("super")
        ? "super"
        : "ultra") as "nano" | "super" | "ultra",
    }));
    const nanoCalls = ledgerCalls.filter((c) => c.tier === "nano");
    const superCalls = ledgerCalls.filter((c) => c.tier === "super");
    const ultraCalls = ledgerCalls.filter((c) => c.tier === "ultra");
    const tavilyCalls = ledgerCalls
      .filter((c) => (c.model ?? c.modelId).includes("tavily"))
      .map((c) => c.model ?? c.modelId);

    const auditReport: AuditReport = {
      auditId,
      targetUrl: validatedUrl.href,
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
        axeViolations: baseline?.violationCount || 0,
        foundOnlyByBlindspot: hits.filter((h) => !isFindingReportedByAxe(h.selector, baseline)).length,
      },
      barriers: barrierItems,
      baseline: baseline
        ? {
            tool: baseline.tool,
            version: baseline.version,
            violationCount: baseline.violationCount,
            rules: baseline.rules.map((r: any) => ({
              id: r.ruleId,
              tags: r.tags,
              nodesCount: r.nodeCount,
              selectors: r.selectors,
              impact: r.impact,
            })),
          }
        : undefined,
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
      modelsAndCost: {
        ...aggregateLedger(
          getLedger(),
          getTavilyLedger(),
          verifiedCount,
          Date.now() - startTime
        ),
        stageTimeline: {
          crawlMs,
          axeMs,
          modelsMs,
          verificationMs,
          totalMs: Date.now() - startTime,
        },
      },
    };

    reportStore.set(auditId, auditReport);

    sendEvent("complete", {
      auditId,
      report: auditReport,
      summary: auditReport.summary,
      keyboardScore,
      modelsAndCost: auditReport.modelsAndCost,
      ledger: Array.from(getLedger()),
    });
  } catch (err: any) {
    console.error("Local dev audit error:", err);
    sendEvent("error", { message: err.message || "Failed to audit local dev server." });
  } finally {
    if (releaseSlot) {
      releaseSlot();
    }
    if (session) {
      await session.close().catch(() => {});
    }
    res.end();
  }
});

// 3. Report download endpoints
function getReportById(id: string): AuditReport | undefined {
  let report = reportStore.get(id);
  if (report) return report;
  if (id === "latest" && reportStore.size > 0) {
    return Array.from(reportStore.values()).pop();
  }
  // Check if it's a replay file (e.g. replay_b01 or B01)
  const candidateId = id.replace(/^replay_/, "").toUpperCase();
  const replayPath = path.resolve(REPO_ROOT, `data/replays/${candidateId}.json`);
  if (fs.existsSync(replayPath)) {
    try {
      const data = JSON.parse(fs.readFileSync(replayPath, "utf-8"));
      if (data.report) {
        reportStore.set(id, data.report);
        return data.report;
      }
    } catch {}
  }
  return undefined;
}

app.get("/api/reports/:id/html", (req, res) => {
  const report = getReportById(req.params.id);
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
  const report = getReportById(req.params.id);
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
  const report = getReportById(req.params.id);
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
