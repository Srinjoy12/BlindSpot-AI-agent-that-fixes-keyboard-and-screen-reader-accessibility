import React from "react";

interface ScoreGaugeProps {
  score: number;
  totalStops: number;
  blockers: number;
  majors: number;
  minors: number;
  fixesVerified: number;
  durationMs: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  totalStops,
  blockers,
  majors,
  minors,
  fixesVerified,
  durationMs,
}) => {
  const getScoreColor = () => {
    if (score >= 90) return "var(--color-accent-emerald)";
    if (score >= 70) return "var(--color-severity-major)";
    return "var(--color-severity-blocker)";
  };

  const getScoreRating = () => {
    if (score >= 90) return "EXEMPLARY";
    if (score >= 70) return "ACCEPTABLE";
    if (score >= 50) return "NEEDS WORK";
    return "CRITICAL BARRIERS";
  };

  const scoreColor = getScoreColor();

  return (
    <div
      style={{
        backgroundColor: "var(--color-surface-1)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-lg)",
        marginBottom: "20px",
        overflow: "hidden",
      }}
    >
      <div
        className="score-grid"
        style={{
          display: "grid",
          gridTemplateColumns: "1.4fr repeat(5, 1fr)",
        }}
      >
        {/* Metric 1: Overall Score */}
        <div
          className="score-card score-hero"
          style={{
            padding: "18px 20px",
            borderRight: "1px solid var(--color-border-subdued)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
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
            Accessibility Score
          </div>

          <div style={{ display: "flex", alignItems: "baseline", gap: "6px", margin: "8px 0 6px" }}>
            <span
              style={{
                fontSize: "36px",
                fontWeight: 700,
                fontFamily: "var(--font-mono)",
                color: scoreColor,
                lineHeight: 1,
              }}
            >
              {score}
            </span>
            <span
              style={{
                fontSize: "13px",
                color: "var(--color-text-muted)",
                fontFamily: "var(--font-mono)",
              }}
            >
              / 100
            </span>
            <span
              style={{
                marginLeft: "auto",
                fontSize: "10px",
                fontFamily: "var(--font-mono)",
                fontWeight: 700,
                padding: "2px 6px",
                borderRadius: "var(--radius-xs)",
                border: `1px solid ${scoreColor}`,
                color: scoreColor,
                letterSpacing: "0.04em",
              }}
            >
              {getScoreRating()}
            </span>
          </div>

          <div
            style={{
              fontSize: "11px",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            Runtime: {(durationMs / 1000).toFixed(1)}s
          </div>
        </div>

        {/* Metric 2: Total Stops */}
        <div
          className="score-card"
          style={{
            padding: "18px 16px",
            borderRight: "1px solid var(--color-border-subdued)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            Stops
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: "var(--color-text-primary)",
              margin: "6px 0 4px",
            }}
          >
            {totalStops}
          </div>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Tab sequence</span>
        </div>

        {/* Metric 3: Blockers */}
        <div
          className="score-card"
          style={{
            padding: "18px 16px",
            borderRight: "1px solid var(--color-border-subdued)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            Blockers
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: blockers > 0 ? "var(--color-severity-blocker)" : "var(--color-text-primary)",
              margin: "6px 0 4px",
            }}
          >
            {blockers}
          </div>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Traps & locks</span>
        </div>

        {/* Metric 4: Majors */}
        <div
          className="score-card"
          style={{
            padding: "18px 16px",
            borderRight: "1px solid var(--color-border-subdued)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            Majors
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: majors > 0 ? "var(--color-severity-major)" : "var(--color-text-primary)",
              margin: "6px 0 4px",
            }}
          >
            {majors}
          </div>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Obscured / missing</span>
        </div>

        {/* Metric 5: Minors */}
        <div
          className="score-card"
          style={{
            padding: "18px 16px",
            borderRight: "1px solid var(--color-border-subdued)",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            Minors
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: minors > 0 ? "var(--color-severity-minor)" : "var(--color-text-primary)",
              margin: "6px 0 4px",
            }}
          >
            {minors}
          </div>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>Low contrast</span>
        </div>

        {/* Metric 6: Verified Fixes */}
        <div
          className="score-card"
          style={{
            padding: "18px 16px",
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
          }}
        >
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontFamily: "var(--font-mono)" }}>
            Verified
          </span>
          <div
            style={{
              fontSize: "24px",
              fontWeight: 700,
              fontFamily: "var(--font-mono)",
              color: fixesVerified > 0 ? "var(--color-accent-emerald)" : "var(--color-text-muted)",
              margin: "6px 0 4px",
            }}
          >
            {fixesVerified}
            <span style={{ fontSize: "13px", fontWeight: 400, color: "var(--color-text-muted)", marginLeft: "4px" }}>
              / {blockers + majors + minors}
            </span>
          </div>
          <span style={{ fontSize: "11px", color: "var(--color-text-muted)" }}>
            {fixesVerified > 0 ? "Chromium tested" : "Needs verification"}
          </span>
        </div>
      </div>
    </div>
  );
};
