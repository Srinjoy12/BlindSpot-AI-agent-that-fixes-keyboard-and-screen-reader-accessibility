import React, { useState, useEffect } from "react";
import { Header } from "./components/Header.js";
import { AuditBar } from "./components/AuditBar.js";
import { PhaseStepper, type AuditPhase } from "./components/PhaseStepper.js";
import { ScoreGauge } from "./components/ScoreGauge.js";
import { KeyboardReplay, type FocusStopItem } from "./components/KeyboardReplay.js";
import { BarrierList, type BarrierItem } from "./components/BarrierList.js";
import { DiffModal } from "./components/DiffModal.js";
import { LedgerDrawer, type LedgerCall } from "./components/LedgerDrawer.js";
import { ExportBar } from "./components/ExportBar.js";

export const App: React.FC = () => {
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [currentPhase, setCurrentPhase] = useState<AuditPhase>("idle");
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [fixtures, setFixtures] = useState<Array<{ id: string; title: string; htmlPath: string | null; barrierCount: number }>>([]);
  
  const [forwardStops, setForwardStops] = useState<FocusStopItem[]>([]);
  const [barriers, setBarriers] = useState<BarrierItem[]>([]);
  const [ledger, setLedger] = useState<LedgerCall[]>([]);
  const [report, setReport] = useState<any>(null);
  const [selectedDiffBarrier, setSelectedDiffBarrier] = useState<BarrierItem | null>(null);

  // Fetch fixture presets on load
  useEffect(() => {
    fetch("/api/fixtures")
      .then((res) => res.json())
      .then((data) => {
        if (data.fixtures) setFixtures(data.fixtures);
      })
      .catch((err) => console.error("Could not fetch fixtures:", err));
  }, []);

  const handleStartAudit = async (targetUrl: string, runFixes: boolean) => {
    setIsRunning(true);
    setCurrentPhase("launch");
    setStatusMessage("Starting Chromium audit session...");
    setForwardStops([]);
    setBarriers([]);
    setLedger([]);
    setReport(null);

    try {
      const response = await fetch("/api/audit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetUrl, runFixes, maxStops: 50 }),
      });

      if (!response.body) {
        throw new Error("ReadableStream not supported on this browser.");
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

            if (eventName === "status") {
              setCurrentPhase(eventData.phase);
              setStatusMessage(eventData.message);
            } else if (eventName === "stop") {
              setForwardStops((prev) => [...prev, eventData.stop]);
            } else if (eventName === "barrier_resolved") {
              setBarriers((prev) => [...prev, eventData.item]);
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
              setCurrentPhase("complete");
              setStatusMessage("Audit & verified fix generation completed successfully.");
            } else if (eventName === "error") {
              setCurrentPhase("error");
              setStatusMessage(eventData.message || "Audit failed.");
            }
          }
        }
      }
    } catch (err: any) {
      setCurrentPhase("error");
      setStatusMessage(err.message || "Network error while connecting to audit server.");
    } finally {
      setIsRunning(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", backgroundColor: "var(--color-bg-canvas)" }}>
      <Header />

      <main style={{ flex: "1 0 auto", maxWidth: "1240px", width: "100%", margin: "0 auto", padding: "24px 20px 48px" }}>
        {/* Audit Input Hero Bar */}
        <AuditBar
          onStartAudit={handleStartAudit}
          isRunning={isRunning}
          fixtures={fixtures}
        />

        {/* Real-time Telemetry Pipeline */}
        <PhaseStepper
          currentPhase={currentPhase}
          statusMessage={statusMessage}
        />

        {/* Results Dashboard */}
        {report && (
          <>
            <ScoreGauge
              score={report.keyboardScore}
              totalStops={report.summary.totalStops}
              blockers={report.summary.blockers}
              majors={report.summary.majors}
              minors={report.summary.minors}
              fixesVerified={report.summary.fixesVerified}
              durationMs={report.durationMs}
            />

            <KeyboardReplay stops={forwardStops} />

            <BarrierList
              barriers={barriers}
              onOpenDiff={(b) => setSelectedDiffBarrier(b)}
            />

            <ExportBar auditId={report.auditId} report={report} />

            <LedgerDrawer ledger={ledger} />
          </>
        )}

        {/* Diff Inspection Modal */}
        <DiffModal
          barrier={selectedDiffBarrier}
          onClose={() => setSelectedDiffBarrier(null)}
        />
      </main>

      <footer
        style={{
          borderTop: "1px solid var(--color-border-subdued)",
          backgroundColor: "var(--color-surface-1)",
          padding: "20px 24px",
          textAlign: "center",
          fontSize: "11px",
          color: "var(--color-text-muted)",
          fontFamily: "var(--font-mono)",
        }}
      >
        <p>
          BlindSpot · Nebius × NVIDIA Global AI Hackathon (Best Apps & Agents Track)
        </p>
        <p style={{ marginTop: "4px", color: "var(--color-text-secondary)" }}>
          NVIDIA Nemotron-3 (Nano · Super · Ultra) on Token Factory with Playwright deterministic Chromium verification
        </p>
      </footer>
    </div>
  );
};
