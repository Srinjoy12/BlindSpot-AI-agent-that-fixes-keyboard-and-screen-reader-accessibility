import React, { useRef } from "react";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: string | number;
}

interface SegmentedControlProps<T extends string = string> {
  name: string;
  options: SegmentOption<T>[];
  value: T;
  onChange: (value: T) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
  className?: string;
  style?: React.CSSProperties;
}

export function SegmentedControl<T extends string = string>({
  name,
  options,
  value,
  onChange,
  ariaLabel,
  size = "md",
  className = "",
  style = {},
}: SegmentedControlProps<T>) {
  const buttonRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (index + 1) % options.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (index - 1 + options.length) % options.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = options.length - 1;
    }

    if (nextIndex >= 0) {
      onChange(options[nextIndex].value);
      buttonRefs.current[nextIndex]?.focus();
    }
  };

  const isSmall = size === "sm";

  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel || name}
      className={`ui-segmented-control ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "var(--color-surface-2)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-sm)",
        padding: "2px",
        gap: "2px",
        ...style,
      }}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        return (
          <button
            key={opt.value}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role="radio"
            aria-checked={isSelected}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              minHeight: isSmall ? "32px" : "38px",
              padding: isSmall ? "0 10px" : "0 14px",
              borderRadius: "var(--radius-sm)",
              backgroundColor: isSelected ? "var(--color-surface-3)" : "transparent",
              color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              border: isSelected ? "1px solid var(--color-border-strong)" : "1px solid transparent",
              fontSize: isSmall ? "14px" : "15px",
              fontFamily: "var(--font-sans)",
              fontWeight: isSelected ? 600 : 400,
              cursor: "pointer",
              transition: "background-color var(--transition-duration) var(--transition-timing), color var(--transition-duration) var(--transition-timing), border-color var(--transition-duration) var(--transition-timing)",
              userSelect: "none",
              whiteSpace: "nowrap",
            }}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: isSelected ? "var(--color-text-primary)" : "var(--color-text-muted)",
                }}
              >
                ({opt.badge})
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
