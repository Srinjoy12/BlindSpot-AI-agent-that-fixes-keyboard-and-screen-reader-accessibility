import React from "react";

interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  padding?: "sm" | "md" | "lg" | "none";
  surface?: "surface1" | "surface2" | "sunken";
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

  const isSunken = surface === "sunken" || surface === "surface2";

  return (
    <div
      className={`ui-card ${isSunken ? "neo-sunken" : "neo-extruded"} ${className}`}
      style={{
        padding: getPadding(),
        borderRadius: "var(--radius-lg)",
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
};
