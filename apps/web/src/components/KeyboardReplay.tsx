import React, { useState } from "react";

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
  };
  insideOpenDialog: boolean;
  scrollY: number;
}

interface KeyboardReplayProps {
  stops: FocusStopItem[];
  trapDetected?: boolean;
}

export const KeyboardReplay: React.FC<KeyboardReplayProps> = ({ stops, trapDetected }) => {
  const [selectedIdx, setSelectedIdx] = useState<number>(0);

  if (!stops || stops.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "var(--color-surface-1)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-lg)",
          padding: "24px",
          marginBottom: "20px",
          color: "var(--color-text-muted)",
          textAlign: "center",
          fontSize: "12px",
          fontFamily: "var(--font-mono)",
        }}
      >
        No keyboard trace data loaded. Run an audit to inspect the focus sequence.
      </div>
    );
  }

  const currentStop = stops[Math.min(selectedIdx, stops.length - 1)];

  const handlePrev = () => {
    if (selectedIdx > 0) setSelectedIdx(selectedIdx - 1);
  };

  const handleNext = () => {
    if (selectedIdx < stops.length - 1) setSelectedIdx(selectedIdx + 1);
  };

  const hasVisibleFocus =
    currentStop.focusIndicator.hasOutline ||
    currentStop.focusIndicator.hasBoxShadow ||
    currentStop.focusIndicator.hasBorderChange;

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-lg)",
        padding: "20px",
        marginBottom: "20px",
      }}
    >
      {/* Header & Stepper Controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid var(--color-border-subdued)",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "11px",
              fontWeight: 600,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Keyboard Focus Trace
          </div>
          <div style={{ fontSize: "12px", color: "var(--color-text-secondary)", marginTop: "2px" }}>
            Sequential Tab crawl sequence with deterministic bounding coordinates
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <button
            onClick={handlePrev}
            disabled={selectedIdx === 0}
            aria-label="Previous stop"
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subdued)",
              color: selectedIdx === 0 ? "var(--color-text-muted)" : "var(--color-text-primary)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
            }}
          >
            ← Prev
          </button>
          <span
            style={{
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-secondary)",
              padding: "0 6px",
            }}
          >
            Stop {selectedIdx + 1} / {stops.length}
          </span>
          <button
            onClick={handleNext}
            disabled={selectedIdx === stops.length - 1}
            aria-label="Next stop"
            style={{
              padding: "4px 10px",
              borderRadius: "var(--radius-xs)",
              backgroundColor: "var(--color-surface-2)",
              border: "1px solid var(--color-border-subdued)",
              color: selectedIdx === stops.length - 1 ? "var(--color-text-muted)" : "var(--color-text-primary)",
              fontSize: "11px",
              fontFamily: "var(--font-mono)",
            }}
          >
            Next →
          </button>
        </div>
      </div>

      {/* Scrubber Ribbon */}
      <div
        style={{
          display: "flex",
          gap: "4px",
          overflowX: "auto",
          paddingBottom: "10px",
          marginBottom: "16px",
        }}
        role="tablist"
        aria-label="Keyboard stop timeline"
      >
        {stops.map((s, idx) => {
          const isSelected = idx === selectedIdx;
          const isProblematic = s.obscuredBy || (!s.focusIndicator.hasOutline && !s.focusIndicator.hasBoxShadow);

          return (
            <button
              key={idx}
              role="tab"
              aria-selected={isSelected}
              onClick={() => setSelectedIdx(idx)}
              style={{
                flexShrink: 0,
                padding: "6px 10px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: isSelected
                  ? "var(--color-surface-3)"
                  : "var(--color-surface-2)",
                border: isSelected
                  ? "1px solid var(--color-border-focus)"
                  : isProblematic
                  ? "1px solid var(--color-severity-major-border)"
                  : "1px solid var(--color-border-subdued)",
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                gap: "2px",
                minWidth: "100px",
                textAlign: "left",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  width: "100%",
                  alignItems: "center",
                  fontSize: "10px",
                  fontFamily: "var(--font-mono)",
                  color: isSelected ? "var(--color-border-focus)" : "var(--color-text-muted)",
                }}
              >
                <span>#{String(idx + 1).padStart(2, "0")}</span>
                {s.obscuredBy && <span style={{ color: "var(--color-severity-major)" }}>OBSCURED</span>}
              </div>
              <span
                style={{
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                  color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
                  whiteSpace: "nowrap",
                  overflow: "hidden",
                  textOverflow: "ellipsis",
                  maxWidth: "120px",
                }}
              >
                {s.selector}
              </span>
            </button>
          );
        })}
      </div>

      {/* Inspector Details View */}
      <div
        className="inspector-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.2fr 1fr",
          gap: "14px",
          backgroundColor: "var(--color-surface-2)",
          border: "1px solid var(--color-border-subdued)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
        }}
      >
        {/* DOM Node & Accessibility Node */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "10px" }}>
            <span
              style={{
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                padding: "2px 5px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--color-surface-1)",
                color: "var(--color-border-focus)",
                border: "1px solid var(--color-border-subdued)",
              }}
            >
              STOP #{String(currentStop.index + 1).padStart(2, "0")}
            </span>
            <span
              style={{
                fontSize: "12px",
                fontWeight: 600,
                fontFamily: "var(--font-mono)",
                color: "var(--color-text-primary)",
              }}
            >
              {currentStop.selector}
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
            <div>
              <span style={{ color: "var(--color-text-muted)" }}>Accessible Name: </span>
              {currentStop.accessibleName ? (
                <strong style={{ color: "var(--color-accent-emerald)", fontFamily: "var(--font-mono)" }}>
                  "{currentStop.accessibleName}"
                </strong>
              ) : (
                <span
                  style={{
                    color: "var(--color-severity-blocker)",
                    backgroundColor: "var(--color-severity-blocker-bg)",
                    padding: "1px 5px",
                    borderRadius: "var(--radius-xs)",
                    fontSize: "11px",
                    fontFamily: "var(--font-mono)",
                  }}
                >
                  [ Missing accessible name ]
                </span>
              )}
            </div>

            <div style={{ fontFamily: "var(--font-mono)", fontSize: "11px", color: "var(--color-text-secondary)" }}>
              <span>Role: </span>
              <span style={{ color: "var(--color-text-primary)" }}>{currentStop.role}</span>
              <span style={{ margin: "0 8px", color: "var(--color-border-subdued)" }}>|</span>
              <span>Tag: </span>
              <span style={{ color: "var(--color-text-primary)" }}>&lt;{currentStop.tagName}&gt;</span>
            </div>

            <div style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
              Context:{" "}
              <span style={{ color: currentStop.insideOpenDialog ? "var(--color-accent-emerald)" : "var(--color-text-secondary)" }}>
                {currentStop.insideOpenDialog ? "Active Modal Dialog" : "Document Root"}
              </span>
            </div>
          </div>
        </div>

        {/* Visual Focus Ring & Coordinates */}
        <div
          className="inspector-coords"
          style={{
            borderLeft: "1px solid var(--color-border-subdued)",
            paddingLeft: "14px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <div>
            <div style={{ fontSize: "11px", color: "var(--color-text-muted)", marginBottom: "4px" }}>
              Focus Ring Verification (WCAG 2.4.7)
            </div>
            {hasVisibleFocus ? (
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "var(--color-accent-emerald-subtle)",
                  border: "1px solid var(--color-accent-emerald-border)",
                  color: "var(--color-accent-emerald)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ✓ Visible focus outline confirmed
              </span>
            ) : (
              <span
                style={{
                  display: "inline-block",
                  padding: "2px 6px",
                  borderRadius: "var(--radius-xs)",
                  backgroundColor: "var(--color-severity-blocker-bg)",
                  border: "1px solid var(--color-severity-blocker-border)",
                  color: "var(--color-severity-blocker)",
                  fontSize: "11px",
                  fontFamily: "var(--font-mono)",
                }}
              >
                ✗ No visible focus ring
              </span>
            )}
          </div>

          {currentStop.obscuredBy && (
            <div
              style={{
                marginTop: "6px",
                padding: "4px 8px",
                borderRadius: "var(--radius-xs)",
                backgroundColor: "var(--color-severity-major-bg)",
                border: "1px solid var(--color-severity-major-border)",
                color: "var(--color-severity-major)",
                fontSize: "11px",
                fontFamily: "var(--font-mono)",
              }}
            >
              Obscured by: {currentStop.obscuredBy}
            </div>
          )}

          <div
            style={{
              fontFamily: "var(--font-mono)",
              fontSize: "11px",
              color: "var(--color-text-muted)",
              marginTop: "8px",
            }}
          >
            Box: x={Math.round(currentStop.box.x)} y={Math.round(currentStop.box.y)} w={Math.round(currentStop.box.width)} h={Math.round(currentStop.box.height)} · scroll={Math.round(currentStop.scrollY)}px
          </div>
        </div>
      </div>
    </div>
  );
};
