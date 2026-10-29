import React from "react";

export type ButtonVariant = "primary" | "secondary" | "quiet";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: "sm" | "md";
  children: React.ReactNode;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "secondary",
  size = "md",
  disabled = false,
  children,
  className = "",
  style = {},
  ...rest
}) => {
  const getVariantStyles = (): React.CSSProperties => {
    switch (variant) {
      case "primary":
        return {
          backgroundColor: disabled ? "var(--color-surface-3)" : "var(--color-accent-primary)",
          color: disabled ? "var(--color-text-muted)" : "var(--color-accent-primary-text)",
          border: "1px solid transparent",
          fontWeight: 600,
        };
      case "secondary":
        return {
          backgroundColor: "var(--color-surface-2)",
          color: disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
          border: "1px solid var(--color-border-ui)",
          fontWeight: 600,
        };
      case "quiet":
        return {
          backgroundColor: "transparent",
          color: disabled ? "var(--color-text-muted)" : "var(--color-text-secondary)",
          border: "1px solid transparent",
          fontWeight: 400,
        };
    }
  };

  const isSmall = size === "sm";

  return (
    <button
      disabled={disabled}
      className={`ui-button ui-button-${variant} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        minHeight: isSmall ? "36px" : "44px",
        padding: isSmall ? "0 12px" : "0 16px",
        borderRadius: "var(--radius-sm)",
        fontSize: isSmall ? "14px" : "16px",
        fontFamily: "var(--font-sans)",
        lineHeight: 1.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
        transition: "background-color var(--transition-duration) var(--transition-timing), border-color var(--transition-duration) var(--transition-timing), color var(--transition-duration) var(--transition-timing)",
        userSelect: "none",
        whiteSpace: "nowrap",
        ...getVariantStyles(),
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
};
