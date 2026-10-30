import React from "react";

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
        position: "sticky",
        top: "var(--space-3)",
        zIndex: 100,
        padding: "0 var(--space-4)",
        marginBottom: "var(--space-4)",
      }}
    >
      <div
        className="app-container neo-extruded"
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "var(--space-4)",
          borderRadius: "var(--radius-xl)",
          padding: "var(--space-3) var(--space-6)",
          maxWidth: "1120px",
          margin: "0 auto",
        }}
      >
        {/* Left: Brand Name with Mint Glow Dot & Navigation */}
        <div style={{ display: "flex", alignItems: "center", gap: "var(--space-6)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span
              style={{
                width: "10px",
                height: "10px",
                borderRadius: "50%",
                backgroundColor: "var(--color-status-success)",
                boxShadow: "0 0 10px var(--color-status-success)",
                display: "inline-block",
                flexShrink: 0,
              }}
              aria-hidden="true"
            />
            <span
              style={{
                fontSize: "var(--font-size-xl)",
                fontWeight: 600,
                color: theme === "light" ? "#132A1E" : "var(--color-text-primary)",
                letterSpacing: "-0.01em",
              }}
            >
              BlindSpot
            </span>
          </div>

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
                    borderBottom: "2px solid var(--color-accent-primary)",
                    paddingBottom: "2px",
                  }}
                >
                  Audit
                </a>
              </li>
            </ul>
          </nav>
        </div>

        {/* Right: Debossed Theme Toggle */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "var(--space-3)",
          }}
        >
          {/* Tactile debossed Theme Toggle button */}
          {onToggleTheme && (
            <button
              id="theme-toggle-button"
              type="button"
              onClick={onToggleTheme}
              aria-label={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              title={`Switch to ${theme === "dark" ? "light" : "dark"} theme`}
              className="neo-pill"
              style={{
                padding: "6px 14px",
                minHeight: "36px",
                fontSize: "var(--font-size-sm)",
                fontWeight: 600,
                color: "var(--color-text-primary)",
                gap: "6px",
              }}
            >
              <span aria-hidden="true">{theme === "dark" ? "☀️" : "🌙"}</span>
              <span>{theme === "dark" ? "Light theme" : "Dark theme"}</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
