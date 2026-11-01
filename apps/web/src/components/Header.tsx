import React from "react";
import Switch from "./ui/sky-toggle.js";

interface HeaderProps {
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme = "light",
  onToggleTheme,
}) => {
  return (
    <header
      role="banner"
      style={{
        position: "sticky",
        top: 0,
        left: 0,
        right: 0,
        width: "100%",
        zIndex: 100,
        height: "60px",
        margin: 0,
        padding: 0,
        background: "var(--neo-extruded-bg)",
        boxShadow:
          theme === "dark"
            ? "0 4px 16px rgba(0, 0, 0, 0.6), 0 2px 6px rgba(35, 68, 50, 0.25), inset 0 -1px 0 rgba(255, 255, 255, 0.05)"
            : "0 4px 14px rgba(18, 38, 27, 0.08), 0 2px 6px rgba(255, 255, 255, 0.9), inset 0 -1px 0 rgba(255, 255, 255, 0.7)",
        borderBottom: "1px solid var(--color-border-subdued)",
        transition:
          "background var(--transition-duration) var(--transition-timing), box-shadow var(--transition-duration) var(--transition-timing), border-color var(--transition-duration) var(--transition-timing)",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          height: "100%",
          padding: "0 clamp(16px, 3.5vw, 36px)",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        {/* Left Corner: Clean Logo & Brand Wordmark */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            userSelect: "none",
          }}
        >
          <div
            aria-hidden="true"
            style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              background: "linear-gradient(135deg, #1B5E3B 0%, #0F3822 100%)",
              border: "1px solid rgba(255, 255, 255, 0.15)",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.3)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#FFFFFF",
              fontWeight: 800,
              fontSize: "15px",
              lineHeight: 1,
              fontFamily:
                "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
              flexShrink: 0,
            }}
          >
            B
          </div>

          <span
            style={{
              fontSize: "16px",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
              lineHeight: 1,
            }}
          >
            BlindSpot
          </span>
        </div>

        {/* Right Corner: Light / Dark Mode Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
          }}
        >
          {onToggleTheme && (
            <Switch
              id="theme-toggle-button"
              checked={theme === "dark"}
              onChange={() => onToggleTheme()}
              size={13}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            />
          )}
        </div>
      </div>
    </header>
  );
};
