import React from "react";

export interface Column<T> {
  key: string;
  header: string;
  align?: "left" | "right" | "center";
  width?: string;
  render?: (item: T, index: number) => React.ReactNode;
}

interface TableProps<T> {
  columns: Column<T>[];
  data: T[];
  caption?: string;
  keyExtractor: (item: T, index: number) => string | number;
  footer?: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export function Table<T>({
  columns,
  data,
  caption,
  keyExtractor,
  footer,
  className = "",
  style = {},
}: TableProps<T>) {
  return (
    <div
      className={`ui-table-container ${className}`}
      tabIndex={0}
      role="region"
      aria-label={caption || "Data table"}
      style={{
        overflowX: "auto",
        border: "1px solid var(--color-border-subdued)",
        borderRadius: "var(--radius-sm)",
        backgroundColor: "var(--color-surface-1)",
        ...style,
      }}
    >
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
          fontFamily: "var(--font-sans)",
          lineHeight: 1.5,
          textAlign: "left",
        }}
      >
        {caption && (
          <caption
            style={{
              padding: "10px 14px",
              textAlign: "left",
              fontSize: "14px",
              color: "var(--color-text-muted)",
              borderBottom: "1px solid var(--color-border-subdued)",
              captionSide: "top",
            }}
          >
            {caption}
          </caption>
        )}

        <thead>
          <tr
            style={{
              borderBottom: "1px solid var(--color-border-subdued)",
              backgroundColor: "var(--color-surface-2)",
            }}
          >
            {columns.map((col, idx) => (
              <th
                key={col.key || idx}
                scope="col"
                style={{
                  padding: "10px 14px",
                  fontWeight: 600,
                  fontSize: "14px",
                  color: "var(--color-text-secondary)",
                  textAlign: col.align || "left",
                  width: col.width,
                  whiteSpace: "nowrap",
                }}
              >
                {col.header}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {data.length === 0 ? (
            <tr>
              <td
                colSpan={columns.length}
                style={{
                  padding: "24px",
                  textAlign: "center",
                  color: "var(--color-text-muted)",
                  fontSize: "14px",
                }}
              >
                No data available
              </td>
            </tr>
          ) : (
            data.map((item, rowIdx) => (
              <tr
                key={keyExtractor(item, rowIdx)}
                style={{
                  borderBottom: rowIdx === data.length - 1 && !footer ? "none" : "1px solid var(--color-border-subdued)",
                  transition: "background-color var(--transition-duration) var(--transition-timing)",
                }}
              >
                {columns.map((col, colIdx) => {
                  const val = (item as any)[col.key];
                  const content = col.render ? col.render(item, rowIdx) : val;
                  const isFirstCol = colIdx === 0;

                  return isFirstCol ? (
                    <th
                      key={col.key || colIdx}
                      scope="row"
                      style={{
                        padding: "10px 14px",
                        fontWeight: 600,
                        color: "var(--color-text-primary)",
                        textAlign: col.align || "left",
                      }}
                    >
                      {content}
                    </th>
                  ) : (
                    <td
                      key={col.key || colIdx}
                      style={{
                        padding: "10px 14px",
                        color: "var(--color-text-secondary)",
                        textAlign: col.align || "left",
                      }}
                    >
                      {content}
                    </td>
                  );
                })}
              </tr>
            ))
          )}
        </tbody>

        {footer && (
          <tfoot>
            {footer}
          </tfoot>
        )}
      </table>
    </div>
  );
}
