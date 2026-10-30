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
        tabRefs.current[activeIdx]?.focus({ preventScroll: true });
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
      tabRefs.current[nextIndex]?.focus({ preventScroll: true });
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
          paddingBottom: "2px",
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
              className={isSelected && !isDisabled ? "neo-extruded" : ""}
              style={{
                position: "relative",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                minHeight: "44px",
                borderRadius: "var(--radius-md) var(--radius-md) 0 0",
                fontSize: "var(--font-size-base)",
                fontFamily: "var(--font-sans)",
                fontWeight: isSelected ? 600 : 400,
                color: isDisabled
                  ? "var(--color-text-muted)"
                  : isSelected
                  ? "var(--color-text-primary)"
                  : "var(--color-text-secondary)",
                backgroundColor: isSelected && !isDisabled ? "var(--neo-extruded-bg)" : "transparent",
                boxShadow: isSelected && !isDisabled ? "var(--neo-extruded-shadow)" : "none",
                border: isSelected && !isDisabled ? "var(--neo-extruded-border)" : "1px solid transparent",
                cursor: isDisabled ? "not-allowed" : "pointer",
                opacity: isDisabled ? 0.6 : 1,
                transition: "all var(--transition-duration) var(--transition-timing)",
                flexShrink: 0,
              }}
            >
              <span>{tab.label}</span>

              {tab.badge !== undefined && (
                <span
                  style={{
                    fontSize: "var(--font-size-sm)",
                    fontWeight: 600,
                    padding: "1px 8px",
                    borderRadius: "var(--radius-full)",
                    backgroundColor: isSelected ? "var(--color-accent-primary)" : "var(--color-surface-2)",
                    color: isSelected ? "#FFFFFF" : "var(--color-text-muted)",
                  }}
                >
                  {tab.badge}
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

              {/* Selected Tab indicator: Invoca green tactile indicator bar */}
              {isSelected && !isDisabled && (
                <span
                  aria-hidden="true"
                  style={{
                    position: "absolute",
                    bottom: "-1px",
                    left: "12px",
                    right: "12px",
                    height: "3px",
                    backgroundColor: "var(--color-accent-primary)",
                    borderRadius: "2px",
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
