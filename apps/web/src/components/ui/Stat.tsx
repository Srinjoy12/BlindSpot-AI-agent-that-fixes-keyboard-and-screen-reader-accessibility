import React from "react";

interface StatProps {
  value: string | number;
  label: string;
  unit?: string;
  secondaryText?: string;
  valueColor?: string;
  size?: "md" | "lg";
  className?: string;
  style?: React.CSSProperties;
}

export const Stat: React.FC<StatProps> = ({
  value,
  label,
  unit,
  secondaryText,
  valueColor = "var(--color-text-primary)",
  size = "md",
  className = "",
  style = {},
}) => {
  const isLarge = size === "lg";

  return (
    <div
      className={`ui-stat ${className}`}
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "4px",
        ...style,
      }}
    >
      <div
        style={{
          fontSize: "14px",
          color: "var(--color-text-secondary)",
          fontWeight: 400,
          lineHeight: 1.4,
        }}
      >
        {label}
      </div>

      <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
        <span
          style={{
            fontSize: isLarge ? "32px" : "24px",
            fontWeight: 600,
            fontFamily: "var(--font-mono)",
            fontVariantNumeric: "tabular-nums",
            color: valueColor,
            lineHeight: 1.2,
          }}
        >
          {value}
        </span>
        {unit && (
          <span
            style={{
              fontSize: "14px",
              color: "var(--color-text-muted)",
              fontFamily: "var(--font-mono)",
            }}
          >
            {unit}
          </span>
        )}
      </div>

      {secondaryText && (
        <div
          style={{
            fontSize: "14px",
            color: "var(--color-text-muted)",
            lineHeight: 1.4,
          }}
        >
          {secondaryText}
        </div>
      )}
    </div>
  );
};
