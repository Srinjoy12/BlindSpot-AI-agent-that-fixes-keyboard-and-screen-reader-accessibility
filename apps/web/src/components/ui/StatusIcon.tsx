import React from "react";

export type StatusType = "blocker" | "major" | "minor" | "success" | "warning" | "error" | "info";

interface StatusIconProps {
  status?: StatusType | string;
  name?: string;
  color?: string;
  size?: number;
  showLabel?: boolean;
  className?: string;
  style?: React.CSSProperties;
}

export const StatusIcon: React.FC<StatusIconProps> = ({
  status,
  name,
  color: propColor,
  size = 16,
  showLabel = false,
  className = "",
  style = {},
}) => {
  const effectiveStatus = (status || name || "info").toLowerCase();

  const getIconData = () => {
    switch (effectiveStatus) {
      case "blocker":
      case "error":
        return {
          label: "Blocks use",
          color: propColor || "var(--color-severity-blocker)",
          svg: (
            <svg
              width={size}
              height={size}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <rect x="2" y="2" width="12" height="12" rx="2" />
              <line x1="3" y1="13" x2="13" y2="3" />
            </svg>
          ),
        };
      case "major":
      case "warning":
        return {
          label: "Hard to use",
          color: propColor || "var(--color-severity-major)",
          svg: (
            <svg
              width={size}
              height={size}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polygon points="8,1.5 15,14 1,14" />
              <line x1="8" y1="6" x2="8" y2="9.5" />
              <circle cx="8" cy="11.8" r="0.8" fill="currentColor" />
            </svg>
          ),
        };
      case "terminal":
        return {
          label: "Terminal",
          color: propColor || "var(--color-accent-primary)",
          svg: (
            <svg
              width={size}
              height={size}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <polyline points="3,5 7,8 3,11" />
              <line x1="8.5" y1="11" x2="13" y2="11" />
            </svg>
          ),
        };
      case "play":
        return {
          label: "Run",
          color: propColor || "currentColor",
          svg: (
            <svg
              width={size}
              height={size}
              viewBox="0 0 16 16"
              fill="currentColor"
              aria-hidden="true"
            >
              <polygon points="4,2 14,8 4,14" />
            </svg>
          ),
        };
      case "check":
      case "success":
        return {
          label: "Verified",
          color: propColor || "var(--color-status-success)",
          svg: (
            <svg
              width={size}
              height={size}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6.5" />
              <polyline points="4.5,8.2 7,10.7 11.5,5.5" />
            </svg>
          ),
        };
      case "minor":
      case "info":
      default:
        return {
          label: "Info",
          color: propColor || "var(--color-severity-minor)",
          svg: (
            <svg
              width={size}
              height={size}
              viewBox="0 0 16 16"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.75"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <circle cx="8" cy="8" r="6.5" />
              <circle cx="8" cy="5.2" r="0.8" fill="currentColor" />
              <line x1="8" y1="7.5" x2="8" y2="11.5" />
            </svg>
          ),
        };
    }
  };

  const { label, color, svg } = getIconData();

  return (
    <span
      className={`status-icon-wrapper ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "6px",
        color,
        lineHeight: 1,
        verticalAlign: "middle",
        ...style,
      }}
    >
      {svg}
      {showLabel && (
        <span style={{ fontSize: "14px", fontWeight: 600, color }}>
          {label}
        </span>
      )}
    </span>
  );
};
