import React from "react";
import { StatusIcon, type StatusType } from "./StatusIcon.js";

export type CalloutVariant = "info" | "warning" | "error" | "success";

interface CalloutProps {
  variant?: CalloutVariant;
  title?: string;
  children: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Callout: React.FC<CalloutProps> = ({
  variant = "info",
  title,
  children,
  action,
  className = "",
  style = {},
}) => {
  const getSemanticStyles = () => {
    switch (variant) {
      case "error":
        return {
          status: "error" as StatusType,
          label: "Error",
          borderColor: "var(--color-severity-blocker)",
          color: "var(--color-text-primary)",
        };
      case "warning":
        return {
          status: "warning" as StatusType,
          label: "Warning",
          borderColor: "var(--color-severity-major)",
          color: "var(--color-text-primary)",
        };
      case "success":
        return {
          status: "success" as StatusType,
          label: "Success",
          borderColor: "var(--color-status-success)",
          color: "var(--color-text-primary)",
        };
      case "info":
      default:
        return {
          status: "info" as StatusType,
          label: "Information",
          borderColor: "var(--color-border-ui)",
          color: "var(--color-text-primary)",
        };
    }
  };

  const { status, label, borderColor, color } = getSemanticStyles();

  return (
    <div
      role={variant === "error" ? "alert" : "status"}
      className={`ui-callout ui-callout-${variant} ${className}`}
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: "12px",
        padding: "14px 16px",
        backgroundColor: "var(--color-surface-2)",
        border: `1px solid ${borderColor}`,
        borderRadius: "var(--radius-sm)",
        color,
        fontSize: "15px",
        lineHeight: 1.5,
        ...style,
      }}
    >
      <div style={{ flexShrink: 0, marginTop: "2px" }}>
        <StatusIcon status={status} size={18} />
      </div>

      <div style={{ flex: "1 1 auto", minWidth: 0 }}>
        {title && (
          <div
            style={{
              fontWeight: 600,
              fontSize: "15px",
              marginBottom: "4px",
              color: "var(--color-text-primary)",
            }}
          >
            <span className="visually-hidden">{label}: </span>
            {title}
          </div>
        )}
        <div style={{ color: "var(--color-text-secondary)", fontSize: "14px" }}>
          {children}
        </div>
      </div>

      {action && <div style={{ flexShrink: 0, marginLeft: "8px" }}>{action}</div>}
    </div>
  );
};
