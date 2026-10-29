import React, { useState, useId } from "react";

interface TooltipProps {
  definition: string;
  term: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Tooltip: React.FC<TooltipProps> = ({
  definition,
  term,
  className = "",
  style = {},
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const tooltipId = useId();

  return (
    <span
      className={`ui-tooltip-wrapper ${className}`}
      style={{
        position: "relative",
        display: "inline-flex",
        alignItems: "center",
        ...style,
      }}
      onMouseEnter={() => setIsVisible(true)}
      onMouseLeave={() => setIsVisible(false)}
      onFocus={() => setIsVisible(true)}
      onBlur={() => setIsVisible(false)}
    >
      <button
        type="button"
        aria-describedby={isVisible ? tooltipId : undefined}
        style={{
          background: "none",
          border: "none",
          padding: 0,
          color: "inherit",
          font: "inherit",
          cursor: "help",
          textDecoration: "underline",
          textDecorationStyle: "dotted",
          textUnderlineOffset: "3px",
          textDecorationColor: "var(--color-border-strong)",
        }}
      >
        {term}
      </button>

      {isVisible && (
        <span
          id={tooltipId}
          role="tooltip"
          style={{
            position: "absolute",
            bottom: "calc(100% + 6px)",
            left: "50%",
            transform: "translateX(-50%)",
            backgroundColor: "var(--color-surface-3)",
            color: "var(--color-text-primary)",
            border: "1px solid var(--color-border-strong)",
            borderRadius: "var(--radius-sm)",
            padding: "6px 10px",
            fontSize: "14px",
            lineHeight: 1.4,
            whiteSpace: "normal",
            width: "max-content",
            maxWidth: "280px",
            zIndex: 1000,
            boxShadow: "var(--shadow-subtle)",
            pointerEvents: "none",
          }}
        >
          {definition}
        </span>
      )}
    </span>
  );
};
