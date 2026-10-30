import React, { useState, useEffect, useRef } from "react";
import { Button } from "./ui/Button.js";
import { StatusIcon } from "./ui/StatusIcon.js";
import type { BarrierItem } from "./BarrierList.js";

export interface FocusStopItem {
  index: number;
  selector: string;
  tagName: string;
  role: string;
  accessibleName: string;
  box: { x: number; y: number; width: number; height: number };
  inViewport: boolean;
  obscuredBy: string | null;
  focusIndicator: {
    hasOutline: boolean;
    hasBoxShadow: boolean;
    hasBorderChange: boolean;
    hasBackgroundChange: boolean;
    outlineWidth?: number;
    outlineColor?: string;
  };
  insideOpenDialog: boolean;
  scrollY: number;
}

interface KeyboardReplayProps {
  stops: FocusStopItem[];
  afterStops?: FocusStopItem[];
  barriers?: BarrierItem[];
  trapDetected?: boolean;
}

export const KeyboardReplay: React.FC<KeyboardReplayProps> = ({
  stops,
  afterStops,
  barriers = [],
  trapDetected,
}) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const [runMode, setRunMode] = useState<"before" | "after">("before");
  const scrubberContainerRef = useRef<HTMLDivElement>(null);

  // If afterStops is not directly passed but barriers contain afterStops
  const resolvedAfterStops =
    afterStops && afterStops.length > 0
      ? afterStops
      : barriers.find((b) => b.afterStops && b.afterStops.length > 0)?.afterStops || null;

  // Active stops based on Before / After toggle
  const activeStops = runMode === "after" && resolvedAfterStops ? resolvedAfterStops : stops;

  // Reset selected index if stops change or out of range
  useEffect(() => {
    if (selectedIdx >= activeStops.length) {
      setSelectedIdx(Math.max(0, activeStops.length - 1));
    }
  }, [activeStops.length, selectedIdx]);

  // Arrow key navigation on the scrubber
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.max(0, prev - 1));
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      setSelectedIdx((prev) => Math.min(activeStops.length - 1, prev + 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setSelectedIdx(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setSelectedIdx(activeStops.length - 1);
    }
  };

  if (!stops || stops.length === 0) {
    return (
      <div
        className="neo-extruded"
        style={{
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-8)",
          marginBottom: "var(--space-6)",
          color: "var(--color-text-muted)",
          textAlign: "center",
          fontSize: "var(--font-size-base)",
        }}
      >
        No keyboard trace data loaded. Run an audit to inspect the focus sequence.
      </div>
    );
  }

  const currentStop = activeStops[Math.min(selectedIdx, activeStops.length - 1)] || activeStops[0];
  const nextStop =
    selectedIdx < activeStops.length - 1 ? activeStops[selectedIdx + 1] : null;

  const handlePrev = () => {
    if (selectedIdx > 0) setSelectedIdx(selectedIdx - 1);
  };

  const handleNext = () => {
    if (selectedIdx < activeStops.length - 1) setSelectedIdx(selectedIdx + 1);
  };

  const hasVisibleFocus = Boolean(
    currentStop?.focusIndicator?.hasOutline ||
      currentStop?.focusIndicator?.hasBoxShadow ||
      currentStop?.focusIndicator?.hasBorderChange
  );

  // Check if current stop is associated with a barrier
  const matchingBarrier = barriers.find(
    (b) =>
      b.selector === currentStop.selector ||
      (currentStop.selector && b.selector.includes(currentStop.selector))
  );

  const isStopProblematic = Boolean(
    matchingBarrier ||
      currentStop.obscuredBy ||
      (!hasVisibleFocus && currentStop.tagName !== "body")
  );

  // Derive human-readable element name
  const elementDescription =
    currentStop.accessibleName
      ? `${currentStop.accessibleName} (${currentStop.tagName.toLowerCase()})`
      : currentStop.selector;

  let nextActionSentence = "";
  if (nextStop) {
    const nextDesc = nextStop.accessibleName
      ? `"${nextStop.accessibleName}"`
      : nextStop.selector;
    nextActionSentence = `Next Tab goes to Step ${nextStop.index + 1} (${nextDesc}).`;
  } else {
    if (trapDetected || matchingBarrier?.detectorId === "D1") {
      nextActionSentence = "Next Tab cannot exit: keyboard trap prevents leaving this element.";
    } else {
      nextActionSentence = "Next Tab wraps back to Step 1 or exits the page.";
    }
  }

  const stepSummarySentence = `Step ${currentStop.index + 1}: ${elementDescription}. ${
    hasVisibleFocus ? "Focus is visible." : "Focus is not visible (missing focus ring)."
  } ${nextActionSentence}`;

  // SVG bounding-box coordinate computation
  const svgWidth = 840;
  const svgHeight = 440;
  const maxX = Math.max(...activeStops.map((s) => (s.box.x || 0) + (s.box.width || 100)), 800);
  const maxY = Math.max(...activeStops.map((s) => (s.box.y || 0) + (s.box.height || 50)), 500);

  const scaleX = (x: number) => Math.max(20, Math.min(svgWidth - 60, (x / maxX) * (svgWidth - 80) + 40));
  const scaleY = (y: number) => Math.max(30, Math.min(svgHeight - 40, (y / maxY) * (svgHeight - 80) + 40));

  return (
    <div
      className="neo-extruded"
      style={{
        borderRadius: "var(--radius-xl)",
        padding: "var(--space-6)",
        marginBottom: "var(--space-6)",
      }}
    >
      {/* Header with Help Text & Before/After Toggle */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginBottom: "var(--space-4)",
          paddingBottom: "var(--space-4)",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div>
          <h2
            style={{
              fontSize: "var(--font-size-xl)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              margin: "0 0 6px 0",
            }}
          >
            Keyboard path
          </h2>
          <p
            style={{
              fontSize: "var(--font-size-base)",
              color: "var(--color-text-secondary)",
              margin: 0,
              lineHeight: 1.5,
            }}
          >
            The keyboard path tracks every sequential stop reached by pressing Tab, showing whether focus is visible and follows a logical order.
          </p>
        </div>

        {/* Before / After run toggle */}
        {resolvedAfterStops && (
          <div
            role="group"
            aria-label="Crawl run comparison"
            className="neo-sunken"
            style={{
              display: "flex",
              gap: "4px",
              padding: "4px",
              borderRadius: "var(--radius-full)",
              alignItems: "center",
            }}
          >
            <button
              onClick={() => {
                setRunMode("before");
                setSelectedIdx(0);
              }}
              className="neo-pill"
              aria-selected={runMode === "before"}
              style={{
                padding: "6px 14px",
                fontSize: "var(--font-size-sm)",
                fontWeight: runMode === "before" ? 600 : 400,
                color: runMode === "before" ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              }}
            >
              Original run ({stops.length} stops)
            </button>
            <button
              onClick={() => {
                setRunMode("after");
                setSelectedIdx(0);
              }}
              className="neo-pill"
              aria-selected={runMode === "after"}
              style={{
                padding: "6px 14px",
                fontSize: "var(--font-size-sm)",
                fontWeight: runMode === "after" ? 600 : 400,
                backgroundColor: runMode === "after" ? "var(--color-accent-primary)" : undefined,
                color: runMode === "after" ? "#FFFFFF" : "var(--color-text-secondary)",
              }}
            >
              ✓ After fix ({resolvedAfterStops.length} stops)
            </button>
          </div>
        )}
      </div>

      {/* Stepper Controls: Previous / Next & Counter */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          marginBottom: "var(--space-3)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-3)" }}>
          <Button
            variant="secondary"
            size="sm"
            onClick={handlePrev}
            disabled={selectedIdx === 0}
            title="Previous tab stop"
          >
            ← Previous
          </Button>

          <span
            className="neo-pill"
            style={{
              fontSize: "var(--font-size-sm)",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-primary)",
              fontWeight: 600,
              padding: "6px 14px",
            }}
          >
            Tab stop {selectedIdx + 1} of {activeStops.length}
          </span>

          <Button
            variant="secondary"
            size="sm"
            onClick={handleNext}
            disabled={selectedIdx === activeStops.length - 1}
            title="Next tab stop"
          >
            Next →
          </Button>
        </div>

        <div style={{ fontSize: "var(--font-size-sm)", color: "var(--color-text-muted)" }}>
          Use <kbd style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--neo-sunken-bg)", border: "1px solid var(--color-border-subdued)" }}>←</kbd> and <kbd style={{ padding: "2px 6px", borderRadius: "4px", backgroundColor: "var(--neo-sunken-bg)", border: "1px solid var(--color-border-subdued)" }}>→</kbd> keys to step through
        </div>
      </div>

      {/* Scrubber Ribbon: Inset Well with Raised Pill Buttons */}
      <div
        ref={scrubberContainerRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        role="region"
        aria-label="Keyboard tab stop timeline. Use left and right arrow keys to navigate."
        className="neo-sunken"
        style={{
          display: "flex",
          gap: "var(--space-2)",
          overflowX: "auto",
          padding: "var(--space-3)",
          borderRadius: "var(--radius-lg)",
          marginBottom: "var(--space-4)",
          outline: "none",
        }}
      >
        {activeStops.map((s, idx) => {
          const isSelected = idx === selectedIdx;
          const stopBarrier = barriers.find(
            (b) => b.selector === s.selector || (s.selector && b.selector.includes(s.selector))
          );
          const hasIssue = Boolean(
            stopBarrier || s.obscuredBy || (!s?.focusIndicator?.hasOutline && !s?.focusIndicator?.hasBoxShadow)
          );

          return (
            <button
              key={idx}
              onClick={() => setSelectedIdx(idx)}
              aria-label={`Tab stop ${idx + 1}: ${s.accessibleName || s.selector}${hasIssue ? " (Problem detected)" : ""}`}
              className={isSelected ? "neo-extruded" : "neo-pill"}
              style={{
                flexShrink: 0,
                padding: "8px 12px",
                borderRadius: "var(--radius-md)",
                backgroundColor: isSelected ? "var(--neo-extruded-bg)" : "var(--neo-pill-bg)",
                boxShadow: isSelected ? "var(--neo-extruded-shadow)" : "var(--neo-pill-shadow)",
                border: isSelected
                  ? "2px solid var(--color-focus-ring)"
                  : hasIssue
                  ? "1px solid var(--color-severity-blocker)"
                  : "1px solid var(--color-border-subdued)",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "4px",
                minWidth: "130px",
                textAlign: "left",
                cursor: "pointer",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                  fontWeight: isSelected ? 600 : 400,
                  color: isSelected ? "var(--color-text-primary)" : "var(--color-text-muted)",
                }}
              >
                <span>#{idx + 1}</span>
                {hasIssue && (
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px",
                      color: "var(--color-severity-blocker)",
                      fontSize: "12px",
                      fontWeight: 600,
                    }}
                  >
                    <StatusIcon status="blocker" size={12} />
                    <span>Problem</span>
                  </span>
                )}
              </div>

              <span
                style={{
                  fontSize: "var(--font-size-sm)",
                  fontFamily: "var(--font-mono)",
                  color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "120px",
                }}
              >
                {s.accessibleName || s.selector}
              </span>
            </button>
          );
        })}
      </div>

      {/* Step Narrative Note */}
      <div
        style={{
          fontSize: "var(--font-size-base)",
          fontWeight: 600,
          color: "var(--color-text-primary)",
          marginBottom: "var(--space-4)",
          lineHeight: 1.5,
        }}
      >
        {stepSummarySentence}
      </div>

      {/* Visual SVG Canvas Framed Inside an Extruded Bevel Viewport Frame */}
      <div
        className="neo-extruded"
        style={{
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-4)",
          overflowX: "auto",
          border: "1px solid var(--color-border-ui)",
        }}
      >
        <div
          style={{
            fontSize: "var(--font-size-sm)",
            color: "var(--color-text-muted)",
            marginBottom: "var(--space-3)",
            display: "flex",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontWeight: 600, color: "var(--color-text-secondary)" }}>Tactile Viewport Coordinate Map</span>
          <span style={{ fontFamily: "var(--font-mono)" }}>{activeStops.length} stops mapped</span>
        </div>

        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          style={{
            width: "100%",
            height: "auto",
            maxHeight: "380px",
            backgroundColor: "var(--neo-sunken-bg)",
            borderRadius: "var(--radius-lg)",
            border: "var(--neo-sunken-border)",
            boxShadow: "var(--neo-sunken-shadow)",
          }}
          role="img"
          aria-label="Interactive 2D path map showing sequential tab stops across viewport coordinates"
        >
          {/* Path lines connecting stops */}
          {activeStops.map((s, idx) => {
            if (idx === activeStops.length - 1) return null;
            const next = activeStops[idx + 1];
            const x1 = scaleX(s.box.x + s.box.width / 2);
            const y1 = scaleY(s.box.y + s.box.height / 2);
            const x2 = scaleX(next.box.x + next.box.width / 2);
            const y2 = scaleY(next.box.y + next.box.height / 2);

            const isPast = idx < selectedIdx;
            return (
              <line
                key={`line-${idx}`}
                x1={x1}
                y1={y1}
                x2={x2}
                y2={y2}
                stroke={isPast ? "var(--color-accent-secondary)" : "var(--color-border-ui)"}
                strokeWidth={isPast ? "2.5" : "1.5"}
                strokeDasharray={isPast ? "none" : "4,4"}
                opacity={isPast ? 0.95 : 0.45}
              />
            );
          })}

          {/* Stop nodes */}
          {activeStops.map((s, idx) => {
            const isSelected = idx === selectedIdx;
            const cx = scaleX(s.box.x + s.box.width / 2);
            const cy = scaleY(s.box.y + s.box.height / 2);
            const stopBarrier = barriers.find(
              (b) => b.selector === s.selector || (s.selector && b.selector.includes(s.selector))
            );
            const isBarrier = Boolean(stopBarrier);

            return (
              <g
                key={`node-${idx}`}
                onClick={() => setSelectedIdx(idx)}
                style={{ cursor: "pointer" }}
              >
                {/* Active Focus Node: Dual-Ring Sky Blue / Lime Green Glowing Marker */}
                {isSelected && (
                  <>
                    {/* Outer glowing Sky Blue halo ring */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={22}
                      fill="none"
                      stroke="#0EA5E9"
                      strokeWidth={3}
                      strokeOpacity={0.7}
                      style={{ filter: "drop-shadow(0 0 6px #0EA5E9)" }}
                    />
                    {/* Inner glowing Lime Green ring */}
                    <circle
                      cx={cx}
                      cy={cy}
                      r={16}
                      fill="none"
                      stroke="#A3E635"
                      strokeWidth={2}
                      strokeDasharray="2,2"
                    />
                  </>
                )}

                {/* Main node circle */}
                <circle
                  cx={cx}
                  cy={cy}
                  r={12}
                  fill={
                    isSelected
                      ? "#1B5E3B"
                      : isBarrier
                      ? "var(--color-severity-blocker)"
                      : "var(--neo-extruded-bg)"
                  }
                  stroke={isSelected ? "#A3E635" : "var(--color-border-ui)"}
                  strokeWidth={2}
                />

                {/* Step number label */}
                <text
                  x={cx}
                  y={cy + 4}
                  textAnchor="middle"
                  fill={isSelected ? "#FFFFFF" : "var(--color-text-primary)"}
                  fontSize="11"
                  fontFamily="var(--font-mono)"
                  fontWeight="700"
                >
                  {idx + 1}
                </text>

                {/* Barrier indicator flag */}
                {isBarrier && (
                  <text
                    x={cx}
                    y={cy - 16}
                    textAnchor="middle"
                    fill="var(--color-severity-blocker)"
                    fontSize="10"
                    fontWeight="700"
                    fontFamily="system-ui, sans-serif"
                  >
                    ⚠ Barrier
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
    </div>
  );
};
