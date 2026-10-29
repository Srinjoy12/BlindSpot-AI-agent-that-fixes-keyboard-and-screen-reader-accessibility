import React from "react";
import { Button } from "./ui/Button.js";

interface HeaderProps {
  theme?: "dark" | "light";
  onToggleTheme?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  theme = "dark",
  onToggleTheme,
}) => {
  return (
    <header
      role="banner"
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        borderBottom: "1px solid var(--color-border-subdued)",
        backgroundColor: "var(--color-surface-1)",
        position: "sticky",
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        className="app-container"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-3)",
          paddingTop: "var(--space-3)",
          paddingBottom: "var(--space-3)",
        }}
      >
        {/* Left: Product Name & Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <span
            style={{
              fontSize: "var(--font-size-lg)",
              fontWeight: 600,
              color: "var(--color-text-primary)",
              letterSpacing: "-0.01em",
            }}
          >
            BlindSpot
          </span>

          <nav aria-label="Main navigation">
            <ul
              style={{
                display: "flex",
                alignItems: "center",
                gap: "var(--space-4)",
                listStyle: "none",
                margin: 0,
                padding: 0,
              }}
            >
              <li>
                <a
                  href="#main-content"
                  aria-current="page"
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: "var(--color-text-primary)",
                    textDecoration: "none",
                    borderBottom: "2px solid var(--color-accent-secondary)",
                    paddingBottom: "4px",
                  }}
                >
                  Audit
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Right: Theme Toggle & Attribution Line */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          <span
            style={{
              fontSize: "var(--font-size-sm)",
              color: "var(--color-text-muted)",
              lineHeight: 1.5,
            }}
          >
            Built with Nebius Token Factory and NVIDIA Nemotron
          </span>

          {onToggleTheme && (
            <Button
              id="theme-toggle-button"
              variant="secondary"
              size="sm"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
            >
              {theme === "dark" ? "Light theme" : "Dark theme"}
            </Button>
          )}
        </div>
      </div>
    </header>
  );
};
