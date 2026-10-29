import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "sm" | "md" | "lg" | "none";
  surface?: "surface1" | "surface2";
}

export const Card: React.FC<CardProps> = ({
  children,
  padding = "md",
  surface = "surface1",
  className = "",
  style = {},
  ...rest
}) => {
  const getPadding = () => {
    switch (padding) {
      case "sm":
        return "var(--space-3)"; // 12px
      case "md":
        return "var(--space-4)"; // 16px
      case "lg":
        return "var(--space-6)"; // 24px
      case "none":
        return "0";
    }
  };

  return (
    <div
      className={`ui-card ${className}`}
      style={{
        backgroundColor: surface === "surface1" ? "var(--color-surface-1)" : "var(--color-surface-2)",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-md)", // Strictly 10px
        padding: getPadding(),
        boxShadow: "var(--shadow-subtle)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};
