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
          backgroundColor: disabled ? "var(--color-surface-3)" : undefined,
          color: disabled ? "var(--color-text-muted)" : "var(--color-accent-primary-text)",
          fontWeight: 600,
        };
      case "secondary":
        return {
          color: disabled ? "var(--color-text-muted)" : "var(--color-text-primary)",
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
  const variantClass = variant === "primary" ? "neo-button-primary" : variant === "secondary" ? "neo-button-secondary" : "";

  return (
    <button
      disabled={disabled}
      className={`ui-button ui-button-${variant} ${variantClass} ${className}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "8px",
        minHeight: isSmall ? "36px" : "44px",
        padding: isSmall ? "0 14px" : "0 18px",
        borderRadius: "var(--radius-md)",
        fontSize: isSmall ? "14px" : "16px",
        fontFamily: "var(--font-sans)",
        lineHeight: 1.5,
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.6 : 1,
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
