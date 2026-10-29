import React, { useRef } from "react";

export interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  badge?: string | number;
  sublabel?: string;
  disabled?: boolean;
  disabledReason?: string;
}

interface TabsProps {
  idPrefix: string;
  tabs: TabItem[];
  activeTabId: string;
  onChange: (tabId: string) => void;
  ariaLabel?: string;
  className?: string;
  style?: React.CSSProperties;
}

export const Tabs: React.FC<TabsProps> = ({
  idPrefix,
  tabs,
  activeTabId,
  onChange,
  ariaLabel = "Content sections",
  className = "",
  style = {},
}) => {
  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const isNavigatingWithKeyboard = useRef(false);

  React.useEffect(() => {
    if (isNavigatingWithKeyboard.current) {
      isNavigatingWithKeyboard.current = false;
      const activeIdx = tabs.findIndex((t) => t.id === activeTabId);
      if (activeIdx >= 0) {
        tabRefs.current[activeIdx]?.focus();
      }
    }
  }, [activeTabId, tabs]);

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    const availableIndices = tabs
      .map((t, i) => (t.disabled ? -1 : i))
      .filter((i) => i !== -1);

    if (availableIndices.length === 0) return;

    const currentPos = availableIndices.indexOf(index);
    let nextIndex = -1;

    if (e.key === "ArrowRight") {
      e.preventDefault();
      const nextPos = (currentPos + 1) % availableIndices.length;
      nextIndex = availableIndices[nextPos];
    } else if (e.key === "ArrowLeft") {
      e.preventDefault();
      const prevPos = (currentPos - 1 + availableIndices.length) % availableIndices.length;
      nextIndex = availableIndices[prevPos];
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = availableIndices[0];
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = availableIndices[availableIndices.length - 1];
    }

    if (nextIndex >= 0) {
      isNavigatingWithKeyboard.current = true;
      onChange(tabs[nextIndex].id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  return (
    <div className={`ui-tabs-container ${className}`} style={{ width: "100%", ...style }}>
      {/* Horizontally scrollable Tablist for mobile & desktop */}
      <div
        role="tablist"
        aria-label={ariaLabel}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-2)",
          borderBottom: "1px solid var(--color-border-subdued)",
          marginBottom: "var(--space-4)",
          overflowX: "auto",
          WebkitOverflowScrolling: "touch",
          scrollbarWidth: "none",
          whiteSpace: "nowrap",
        }}
      >
        {tabs.map((tab, idx) => {
          const isSelected = tab.id === activeTabId;
          const isDisabled = Boolean(tab.disabled);
          const tabElementId = `${idPrefix}-tab-${tab.id}`;
          const panelElementId = `${idPrefix}-panel-${tab.id}`;

          return (
            <button
              key={tab.id}
              ref={(el) => {
                tabRefs.current[idx] = el;
              }}
              type="button"
              role="tab"
              id={tabElementId}
              aria-selected={isSelected}
              aria-controls={panelElementId}
              aria-disabled={isDisabled}
              disabled={isDisabled}
              title={isDisabled ? (tab.disabledReason || "Available after the scan") : undefined}
              tabIndex={isSelected && !isDisabled ? 0 : -1}
              onClick={() => {
                if (!isDisabled) {
                  onChange(tab.id);
                }
              }}
              onKeyDown={(e) => handleKeyDown(e, idx)}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 14px",
                minHeight: "44px",
                fontSize: "var(--font-size-base)",
                fontFamily: "var(--font-sans)",
                fontWeight: isSelected ? 600 : 400,
                color: isDisabled
                  ? "var(--color-text-muted)"
                  : isSelected
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
                backgroundColor: "transparent",
                border: "none",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.6 : 1,
                transition: "color var(--transition-duration) var(--transition-timing)",
                flexShrink: 0,
              }}
            >
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    color: isSelected ? "var(--color-text-primary)" : "var(--color-text-muted)",
                  }}
                >
                  ({tab.badge})
                </span>
              )}

              {tab.sublabel && (
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    color: "var(--color-text-muted)",
                    fontWeight: 400,
                  }}
                >
                  {tab.sublabel}
                </span>
              )}

              {/* Selected Tab indicator: marked with an underline in the secondary accent and bold label */}
              {isSelected && !isDisabled && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    bottom: "-1px",
                    left: "0",
                    right: "0",
                    height: "2px",
                    backgroundColor: "var(--color-accent-secondary)",
                    borderRadius: "1px",
                  }}
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      {tabs.map((tab) => {
        const isSelected = tab.id === activeTabId;
        const tabElementId = `${idPrefix}-tab-${tab.id}`;
        const panelElementId = `${idPrefix}-panel-${tab.id}`;

        return (
          <div
            key={tab.id}
            role="tabpanel"
            id={panelElementId}
            aria-labelledby={tabElementId}
            tabIndex={0}
            hidden={!isSelected}
            style={{
              display: isSelected ? "block" : "none",
              outline: "none",
            }}
          >
            {tab.content}
          </div>
        );
      })}
    </div>
  );
};
