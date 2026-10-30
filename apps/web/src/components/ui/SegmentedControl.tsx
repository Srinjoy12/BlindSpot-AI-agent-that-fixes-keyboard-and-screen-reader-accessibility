import React, { useRef } from "react";

export interface SegmentOption<T extends string = string> {
  value: T;
  label: string;
  badge?: string | number;
  id?: string;
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
  role?: "tablist" | "radiogroup";
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
  role = "radiogroup",
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
  const isTablist = role === "tablist";

  return (
    <div
      role={role}
      aria-label={ariaLabel || name}
      className={`ui-segmented-control neo-sunken ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        backgroundColor: "var(--neo-sunken-bg)",
        boxShadow: "var(--neo-sunken-shadow)",
        border: "var(--neo-sunken-border)",
        borderRadius: "var(--radius-lg)",
        padding: "4px",
        gap: "4px",
        maxWidth: "100%",
        overflowX: "auto",
        WebkitOverflowScrolling: "touch",
        scrollbarWidth: "none",
        ...style,
      }}
    >
      {options.map((opt, idx) => {
        const isSelected = opt.value === value;
        const buttonId = opt.id ?? `tab-${opt.value}`;
        return (
          <button
            key={opt.value}
            id={buttonId}
            ref={(el) => {
              buttonRefs.current[idx] = el;
            }}
            type="button"
            role={isTablist ? "tab" : "radio"}
            aria-selected={isTablist ? isSelected : undefined}
            aria-checked={!isTablist ? isSelected : undefined}
            tabIndex={isSelected ? 0 : -1}
            onClick={() => onChange(opt.value)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            className={isSelected ? "neo-extruded" : ""}
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              minHeight: isSmall ? "32px" : "38px",
              padding: isSmall ? "0 12px" : "0 16px",
              borderRadius: "var(--radius-md)",
              backgroundColor: isSelected ? "var(--neo-extruded-bg)" : "transparent",
              boxShadow: isSelected ? "var(--neo-extruded-shadow)" : "none",
              border: isSelected ? "var(--neo-extruded-border)" : "1px solid transparent",
              color: isSelected ? "var(--color-text-primary)" : "var(--color-text-secondary)",
              fontSize: isSmall ? "14px" : "15px",
              fontFamily: "var(--font-sans)",
              fontWeight: isSelected ? 600 : 400,
              cursor: "pointer",
              transition: "all var(--transition-duration) var(--transition-timing)",
              userSelect: "none",
              whiteSpace: "nowrap",
              flexShrink: 0,
            }}
          >
            <span>{opt.label}</span>
            {opt.badge !== undefined && (
              <span
                style={{
                  fontSize: "14px",
                  fontWeight: 600,
                  color: isSelected ? "var(--color-accent-primary)" : "var(--color-text-muted)",
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
