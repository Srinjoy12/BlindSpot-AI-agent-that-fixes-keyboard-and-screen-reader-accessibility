import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { AuditBar } from "./components/AuditBar.js";
import { PhaseStepper, type AuditPhase } from "./components/PhaseStepper.js";
import { KeyboardReplay, type FocusStopItem } from "./components/KeyboardReplay.js";
import { BarrierList, type BarrierItem } from "./components/BarrierList.js";
import { DiffModal } from "./components/DiffModal.js";
import { ModelsAndCostPanel } from "./components/ModelsAndCostPanel.js";
import { ResultsSummary } from "./components/ResultsSummary.js";
import { OverviewTab } from "./components/OverviewTab.js";
import { FixesInlineView } from "./components/FixesInlineView.js";
import { ExportTab } from "./components/ExportTab.js";
import { Tabs, type TabItem } from "./components/ui/Tabs.js";
import { Button } from "./components/ui/Button.js";
import { StatusIcon } from "./components/ui/StatusIcon.js";
import { FolderActionToolbar } from "./project-folder/FolderActionToolbar.js";
import { getFolderCapabilities, walkDirectoryHandle } from "./project-folder/fsWalk.js";
import type { FolderProjectFile } from "./project-folder/types.js";

type LedgerCall = any;

export const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentPhase, setCurrentPhase] = useState<AuditPhase>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [isRateLimited, setIsRateLimited] = useState<boolean>(false);
  const [runFixesEnabled, setRunFixesEnabled] = useState<boolean>(true);

  const [forwardStops, setForwardStops] = useState<FocusStopItem[]>([]);
  const [barriers, setBarriers] = useState<BarrierItem[]>([]);
  const [ledger, setLedger] = useState<LedgerCall[]>([]);
  const [modelsAndCost, setModelsAndCost] = useState<any>(null);
  const [report, setReport] = useState<any>(null);
  const [selectedDiffBarrier, setSelectedDiffBarrier] = useState<BarrierItem | null>(null);
  const [isFolderMode, setIsFolderMode] = useState<boolean>(false);
  const [folderDirectoryHandle, setFolderDirectoryHandle] = useState<any | null>(null);
  const [folderName, setFolderName] = useState<string>("");
  const [folderFiles, setFolderFiles] = useState<FolderProjectFile[]>([]);
  const [folderEntryPath, setFolderEntryPath] = useState<string>("index.html");
  const [folderEdits, setFolderEdits] = useState<any[]>([]);
  const [inMemoryOriginals, setInMemoryOriginals] = useState<Map<string, string>>(new Map());

  // Tab navigation state backed by URL hash
  const VALID_TABS = ["overview", "problems", "keyboard-path", "fixes", "models-and-cost", "export"] as const;
  type TabId = (typeof VALID_TABS)[number];

  const getTabFromHash = (): TabId => {
    if (typeof window !== "undefined") {
      const hash = window.location.hash.replace(/^#/, "");
      if (VALID_TABS.includes(hash as TabId)) {
        return hash as TabId;
      }
    }
    return "overview";
  };

  const [activeTabId, setActiveTabId] = useState<TabId>(getTabFromHash);

  const handleTabChange = (tabId: string) => {
    if (VALID_TABS.includes(tabId as TabId)) {
      setActiveTabId(tabId as TabId);
      if (typeof window !== "undefined") {
        window.history.replaceState(null, "", `#${tabId}`);
      }
    }
  };

  useEffect(() => {
    const onHashChange = () => {
      setActiveTabId(getTabFromHash());
    };
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  // Theme state: dark is default, toggleable, preserves user preference
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window !== "undefined") {
      const saved = localStorage.getItem("blindspot-theme");
      if (saved === "light" || saved === "dark") return saved;
    }
    return "dark";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("blindspot-theme", theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme((prev) => (prev === "dark" ? "light" : "dark"));
  };

  const sanitizeErrorMessage = (msg: string): string => {
    if (!msg) return "An error occurred while running the audit.";
    // Never show stack traces or internal filenames
    const firstLine = msg.split("\n")[0] || "";
    return firstLine.replace(/^Error:\s*/i, "").replace(/at\s+.*$/, "").trim() || "Audit could not be completed.";
  };

  const handleStartAudit = async (
    target: string,
    runFixes: boolean,
    isSourceCode = false,
    kind: "html" | "snippet" = "html"
  ) => {
    setIsRunning(true);
    setIsFolderMode(false);
    setIsRateLimited(false);
    setRunFixesEnabled(runFixes);
    setCurrentPhase("launch");
    setStatusMessage(isSourceCode ? "Scanning code..." : "Connecting...");
    setForwardStops([]);
    setBarriers([]);
    setLedger([]);
    setModelsAndCost(null);
    setReport(null);

    try {
      const endpoint = isSourceCode ? "/api/audit-code" : "/api/audit";
      const payload = isSourceCode
        ? { source: target, kind, runFixes, maxStops: 50 }
        : { targetUrl: target, runFixes, maxStops: 50 };

      const response = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setIsRateLimited(true);
          throw new Error("Hourly scan limit reached (60 audits per hour). Cached fixture replays remain available.");
        }
        if (response.status === 503) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || "Server busy: audit queue is full (maximum 10 waiting). Please try again shortly.");
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Browser stream connection failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;
          const matchEvent = block.match(/^event: (.*)$/m);
          const matchData = block.match(/^data: (.*)$/m);

          if (matchEvent && matchData) {
            const eventName = matchEvent[1].trim();
            const eventData = JSON.parse(matchData[1]);

            if (eventName === "queued") {
              const ahead = eventData.aheadCount ?? (eventData.position - 1);
              const queueMsg =
                ahead === 0
                  ? "Waiting: your audit will begin momentarily"
                  : `Waiting: ${ahead} audit${ahead === 1 ? "" : "s"} ahead of yours`;
              setStatusMessage(queueMsg);
            } else if (eventName === "status") {
              setCurrentPhase(eventData.phase);
              if (eventData.phase !== "complete") {
                setStatusMessage(eventData.message);
              }
            } else if (eventName === "stop") {
              setForwardStops((prev) => [...prev, eventData.stop]);
            } else if (eventName === "barrier_resolved") {
              setBarriers((prev) => [...prev, eventData.item]);
            } else if (eventName === "ledger") {
              if (eventData.calls) setLedger(eventData.calls);
              if (eventData.aggregate) setModelsAndCost(eventData.aggregate);
            } else if (eventName === "complete") {
              const finalReport = eventData.report || (eventData.summary ? eventData : null);
              setReport(finalReport);
              if (eventData.forwardStops) {
                setForwardStops(eventData.forwardStops);
              }
              if (finalReport?.barriers) {
                setBarriers(finalReport.barriers);
              }
              setLedger(eventData.ledger || []);
              if (eventData.modelsAndCost) {
                setModelsAndCost(eventData.modelsAndCost);
              } else if (finalReport?.modelsAndCost) {
                setModelsAndCost(finalReport.modelsAndCost);
              }
              setCurrentPhase("complete");
              setStatusMessage("");
            } else if (eventName === "error") {
              setCurrentPhase("error");
              const safeMsg = sanitizeErrorMessage(eventData.message);
              setStatusMessage(safeMsg);
            }
          }
        }
      }
    } catch (err: any) {
      setCurrentPhase("error");
      const safeMsg = sanitizeErrorMessage(err.message);
      setStatusMessage(safeMsg);
    } finally {
      setIsRunning(false);
    }
  };

  const handleStartFolderAudit = async (
    files: FolderProjectFile[],
    entryPath: string,
    dirHandle: any | null,
    name: string
  ) => {
    setIsRunning(true);
    setIsFolderMode(true);
    setFolderDirectoryHandle(dirHandle);
    setFolderName(name);
    setFolderFiles(files);
    setFolderEntryPath(entryPath);
    const originals = new Map<string, string>();
    for (const f of files) {
      originals.set(f.path, f.content);
    }
    setInMemoryOriginals(originals);
    setIsRateLimited(false);
    setRunFixesEnabled(true);
    setCurrentPhase("launch");
    setStatusMessage(`Loading ${files.length} project files into airgapped sandbox...`);
    setForwardStops([]);
    setBarriers([]);
    setLedger([]);
    setModelsAndCost(null);
    setReport(null);
    setFolderEdits([]);

    try {
      const response = await fetch("/api/audit-files", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          files: files.map((f) => ({ path: f.path, content: f.content })),
          entryPath,
          runFixes: true,
          maxStops: 50,
        }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          setIsRateLimited(true);
          throw new Error("Hourly scan limit reached (60 audits per hour).");
        }
        if (response.status === 503) {
          const errJson = await response.json().catch(() => ({}));
          throw new Error(errJson.error || "Server busy: audit queue is full (maximum 10 waiting). Please try again shortly.");
        }
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || `Server returned status ${response.status}`);
      }

      if (!response.body) {
        throw new Error("Browser stream connection failed.");
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const block of lines) {
          if (!block.trim()) continue;
          const matchEvent = block.match(/^event: (.*)$/m);
          const matchData = block.match(/^data: (.*)$/m);

          if (matchEvent && matchData) {
            const eventName = matchEvent[1].trim();
            const eventData = JSON.parse(matchData[1]);

            if (eventName === "queued") {
              const ahead = eventData.aheadCount ?? (eventData.position - 1);
              const queueMsg =
                ahead === 0
                  ? "Waiting: your audit will begin momentarily"
                  : `Waiting: ${ahead} audit${ahead === 1 ? "" : "s"} ahead of yours`;
              setStatusMessage(queueMsg);
            } else if (eventName === "status") {
              setCurrentPhase(eventData.phase);
              if (eventData.phase !== "complete") {
                setStatusMessage(eventData.message);
              }
            } else if (eventName === "stop") {
              setForwardStops((prev) => [...prev, eventData.stop]);
            } else if (eventName === "barrier_resolved") {
              setBarriers((prev) => [...prev, eventData.item]);
            } else if (eventName === "ledger") {
              if (eventData.calls) setLedger(eventData.calls);
              if (eventData.aggregate) setModelsAndCost(eventData.aggregate);
            } else if (eventName === "complete") {
              const finalReport = eventData.report || (eventData.summary ? eventData : null);
              setReport(finalReport);
              if (eventData.forwardStops) {
                setForwardStops(eventData.forwardStops);
              }
              if (finalReport?.barriers) {
                setBarriers(finalReport.barriers);
              }
              setLedger(eventData.ledger || []);
              if (eventData.modelsAndCost) {
                setModelsAndCost(eventData.modelsAndCost);
              } else if (finalReport?.modelsAndCost) {
                setModelsAndCost(finalReport.modelsAndCost);
              }
              if (eventData.edits) {
                setFolderEdits(eventData.edits);
              }
              setCurrentPhase("complete");
              setStatusMessage("");
            } else if (eventName === "error") {
              setCurrentPhase("error");
              const safeMsg = sanitizeErrorMessage(eventData.message);
              setStatusMessage(safeMsg);
            }
          }
        }
      }
    } catch (err: any) {
      setCurrentPhase("error");
      const safeMsg = sanitizeErrorMessage(err.message);
      setStatusMessage(safeMsg);
    } finally {
      setIsRunning(false);
    }
  };

  const handleRescanFolder = async () => {
    if (!folderDirectoryHandle) return;
    try {
      setStatusMessage("Re-scanning folder from disk...");
      const walkResult = await walkDirectoryHandle(folderDirectoryHandle);
      if (walkResult.length === 0) {
        throw new Error("No files found in folder upon re-scan.");
      }
      await handleStartFolderAudit(
        walkResult,
        folderEntryPath || "index.html",
        folderDirectoryHandle,
        folderName
      );
    } catch (err: any) {
      setStatusMessage(err.message || "Failed to re-scan folder.");
    }
  };

  // Cost string calculation for Models and cost tab label summary
  const costValue =
    modelsAndCost?.totalEstimatedCostUsd ??
    report?.modelsAndCost?.totalEstimatedCostUsd ??
    report?.summary?.totalEstimatedCostUsd;

  const costSublabel =
    costValue !== null && costValue !== undefined
      ? `· $${costValue.toFixed(2)} (estimated)`
      : report
        ? "· $0.00 (estimated)"
        : undefined;

  // Tabs definition
  const tabs: TabItem[] = [
    {
      id: "overview",
      label: "Overview",
      disabled: isRunning && !report,
      disabledReason: "Available after the scan",
      content: (
        <OverviewTab
          barriers={barriers}
          onSelectTab={handleTabChange}
          onOpenDiff={(b) => setSelectedDiffBarrier(b)}
        />
      ),
    },
    {
      id: "problems",
      label: "Problems",
      badge: report ? barriers.length : undefined,
      disabled: isRunning && !report,
      disabledReason: "Available after the scan",
      content: (
        <BarrierList
          barriers={barriers}
          onOpenDiff={(b) => setSelectedDiffBarrier(b)}
        />
      ),
    },
    {
      id: "keyboard-path",
      label: "Keyboard path",
      badge: report && forwardStops.length > 0 ? forwardStops.length : undefined,
      disabled: isRunning && !report,
      disabledReason: "Available after the scan",
      content: (
        <KeyboardReplay
          stops={forwardStops}
          barriers={barriers}
          trapDetected={barriers.some((b) => b.detectorId === "D1")}
        />
      ),
    },
    {
      id: "fixes",
      label: "Fixes",
      badge: report ? barriers.filter((b) => b.fix || b.diff || b.modifiedSource).length : undefined,
      disabled: isRunning && !report,
      disabledReason: "Available after the scan",
      content: (
        <FixesInlineView
          barriers={barriers}
          onOpenFullScreen={(b) => setSelectedDiffBarrier(b)}
          isSourceMode={Boolean(isFolderMode || report?.targetUrl?.includes("code") || barriers.some((b) => b.modifiedSource))}
        />
      ),
    },
    {
      id: "models-and-cost",
      label: "Models and cost",
      sublabel: costSublabel,
      disabled: isRunning && !report && ledger.length === 0,
      disabledReason: "Available after the scan",
      content: (
        <ModelsAndCostPanel
          ledger={ledger}
          modelsAndCost={modelsAndCost || report?.modelsAndCost}
          durationMs={report?.durationMs}
          fixesVerified={report?.summary?.fixesVerified ?? barriers.filter((b) => b.verified).length}
          isLive={isRunning && !report}
          isRecordedRun={Boolean(
            report?.isRecordedRun ||
            report?.auditId?.startsWith("replay_") ||
            report?.pageId ||
            report?.targetUrl?.includes("/fixtures/")
          )}
        />
      ),
    },
    {
      id: "export",
      label: "Export",
      disabled: isRunning && !report,
      disabledReason: "Available after the scan",
      content: <ExportTab auditId={report?.auditId} report={report} />,
    },
  ];

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        backgroundColor: "var(--color-bg-canvas)",
        color: "var(--color-text-primary)",
      }}
    >
      {/* Skip to Content Landmark */}
      <a href="#main-content" className="skip-link">
        Skip to main content
      </a>

      {/* Header Landmark */}
      <Header theme={theme} onToggleTheme={toggleTheme} />

      {/* Main Landmark with 1120px max width and 24px padding */}
      <main
        id="main-content"
        className="app-container"
        style={{
          flex: "1 0 auto",
          paddingBottom: "var(--space-12)",
        }}
      >
        {/* Single H1 per view */}
        <h1
          style={{
            fontSize: "var(--font-size-2xl)",
            fontWeight: 600,
            marginBottom: "var(--space-2)",
            color: "var(--color-text-primary)",
          }}
        >
          Accessibility audit
        </h1>

        {/* Single sentence under h1: explains itself in 10 seconds. No second paragraph. */}
        <p
          style={{
            fontSize: "var(--font-size-base)",
            color: "var(--color-text-secondary)",
            marginBottom: "var(--space-4)",
            lineHeight: 1.5,
          }}
        >
          BlindSpot presses Tab through your page like a keyboard user, finds where it breaks, and tests a fix.
        </p>

        {/* Audit Input Hero Card */}
        <AuditBar
          onStartAudit={handleStartAudit}
          onStartFolderAudit={handleStartFolderAudit}
          isRunning={isRunning}
        />

        {/* Progress Stepper: Compact horizontal stepper with plain-English steps */}
        <PhaseStepper
          currentPhase={currentPhase}
          statusMessage={statusMessage}
          durationMs={report?.durationMs}
          runFixes={runFixesEnabled}
        />

        {/* Error State Card with One Next Action */}
        {currentPhase === "error" && (
          <div
            id="blindspot-error-card"
            style={{
              backgroundColor: "var(--color-surface-1)",
              border: "1px solid var(--color-severity-blocker)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-4)",
              marginBottom: "var(--space-4)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "var(--space-3)",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "var(--space-3)" }}>
              <StatusIcon status="error" size={20} />
              <div>
                <strong style={{ display: "block", color: "var(--color-text-primary)", marginBottom: "2px" }}>
                  {isRateLimited ? "Hourly rate limit reached" : "Audit stopped"}
                </strong>
                <span style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-secondary)" }}>
                  {statusMessage || "Could not complete the audit. Check the URL and try again."}
                </span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "var(--space-2)" }}>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setCurrentPhase("idle")}
              >
                Clear
              </Button>
            </div>
          </div>
        )}

        {/* Empty State: Explains itself with 1-click next action */}
        {!isRunning && !report && currentPhase === "idle" && (
          <div
            style={{
              backgroundColor: "var(--color-surface-1)",
              border: "1px dashed var(--color-border-ui)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-6) var(--space-4)",
              textAlign: "center",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "var(--space-3)",
              marginTop: "var(--space-4)",
            }}
          >
            <p
              style={{
                fontSize: "var(--font-size-base)",
                color: "var(--color-text-secondary)",
                margin: 0,
                maxWidth: "540px",
                lineHeight: 1.5,
              }}
            >
              No audit running. Enter a URL, paste code, or open a project folder above to scan for keyboard navigation and accessibility tree barriers.
            </p>
          </div>
        )}

        {/* Live Streaming State: Show tab bar with disabled tabs */}
        {isRunning && !report && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <Tabs
              idPrefix="blindspot-streaming"
              tabs={tabs}
              activeTabId={activeTabId === "models-and-cost" && ledger.length > 0 ? "models-and-cost" : "overview"}
              onChange={handleTabChange}
              ariaLabel="Audit results sections (scan in progress)"
            />
          </div>
        )}

        {/* Results Dashboard: Clear Summary + ARIA Tab Bar */}
        {report && (
          <div style={{ marginTop: "var(--space-4)" }}>
            <ResultsSummary
              barriers={barriers}
              fixesVerified={report.summary?.fixesVerified ?? barriers.filter((b) => b.verified).length}
              baseline={report.baseline}
              durationMs={report.durationMs}
              blockedResourcesCount={report.summary?.blockedResourcesCount}
            />

            {/* Project Folder Actions Toolbar */}
            {isFolderMode && (
              <FolderActionToolbar
                directoryHandle={folderDirectoryHandle}
                capabilities={getFolderCapabilities()}
                edits={folderEdits}
                inMemoryOriginals={inMemoryOriginals}
                onRescanFolder={handleRescanFolder}
                folderName={folderName}
              />
            )}

            <Tabs
              idPrefix="blindspot-results"
              tabs={tabs}
              activeTabId={activeTabId}
              onChange={handleTabChange}
              ariaLabel="Audit results sections"
            />
          </div>
        )}

        {/* Diff Inspection Modal */}
        <DiffModal
          barrier={selectedDiffBarrier}
          forwardStops={forwardStops}
          onClose={() => setSelectedDiffBarrier(null)}
        />
      </main>

      {/* Footer Landmark */}
      <footer
        role="contentinfo"
        style={{
          borderTop: "1px solid var(--color-border-subdued)",
          backgroundColor: "var(--color-surface-1)",
          padding: "var(--space-6) var(--space-4)",
          textAlign: "center",
          fontSize: "var(--font-size-sm)",
          color: "var(--color-text-muted)",
        }}
      >
        <div className="app-container" style={{ padding: 0 }}>
          <p>
            BlindSpot · Built with Nebius Token Factory and NVIDIA Nemotron
          </p>
        </div>
      </footer>
    </div>
  );
};
