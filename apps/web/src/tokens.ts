/**
 * BlindSpot Design Tokens
 * 
 * Strict minimal design system tokens adhering to WCAG 2.1 AA:
 * - Text contrast >= 4.5:1
 * - UI components and focus rings >= 3:1
 * - NVIDIA Brand Green (#76B900)
 *   Source: https://www.nvidia.com/en-us/about-nvidia/legal-info/brand-guidelines/
 * - Nebius Brand Accent (#614efa / #b186db)
 *   Source: https://nebius.com/_next/static/css/c44eba56dc823930.css (sampled on 2026-10-27)
 *   Secondary text link source: https://nebius.com/_next/static/css/d09a98cf4da412f0.css (sampled on 2026-10-27)
 * - Radii: 6px and 10px only.
 * - Spacing: 4px base (8, 12, 16, 24, 32, 48px).
 * - Typography: Base 16px, nothing below 14px, two weights (400, 600), sentence case.
 */

export interface ThemeColors {
  bgCanvas: string;
  surface1: string;
  surface2: string;
  surface3: string;
  borderSubdued: string;
  borderUi: string;
  borderStrong: string;
  focusRing: string;
  textPrimary: string;
  textSecondary: string;
  textMuted: string;
  accentPrimary: string;
  accentPrimaryText: string;
  accentSecondary: string;
  severityBlocker: string;
  severityMajor: string;
  severityMinor: string;
  statusSuccess: string;
  statusWarning: string;
  statusError: string;
}

export const darkTheme: ThemeColors = {
  // Foundations
  bgCanvas: "#0C0E12",
  surface1: "#151820",
  surface2: "#1E222D",
  surface3: "#282E3D",

  // Borders
  borderSubdued: "#363E50",
  borderUi: "#707A8F",
  borderStrong: "#8E98AB",
  focusRing: "#76B900", // NVIDIA Green for high-visibility outline

  // Text
  textPrimary: "#F9FAFB",
  textSecondary: "#D1D5DB",
  textMuted: "#A6ADB9",

  // Brand Accents
  // Primary accent: NVIDIA Green #76B900
  // Source: https://www.nvidia.com/en-us/about-nvidia/legal-info/brand-guidelines/
  accentPrimary: "#76B900",
  accentPrimaryText: "#000000",

  // Secondary accent: Nebius Purple/Lavender
  // Source: https://nebius.com/_next/static/css/d09a98cf4da412f0.css (sampled on 2026-10-27)
  accentSecondary: "#B186DB",

  // Semantic Severity & Status
  severityBlocker: "#FF7A7A",
  severityMajor: "#FBBF24",
  severityMinor: "#60A5FA",
  statusSuccess: "#34D399",
  statusWarning: "#FBBF24",
  statusError: "#FF7A7A",
};

export const lightTheme: ThemeColors = {
  // Foundations
  bgCanvas: "#FFFFFF",
  surface1: "#F8F9FA",
  surface2: "#EEF0F4",
  surface3: "#E2E5EB",

  // Borders
  borderSubdued: "#D0D5DD",
  borderUi: "#667085",
  borderStrong: "#344054",
  focusRing: "#2E6B00", // High-contrast deep green for focus indicator in light mode

  // Text
  textPrimary: "#0F172A",
  textSecondary: "#334155",
  textMuted: "#526075",

  // Brand Accents
  accentPrimary: "#76B900",
  accentPrimaryText: "#000000",

  // Secondary accent: Nebius Purple (accessible on light backgrounds)
  // Source: https://nebius.com/_next/static/css/c44eba56dc823930.css (sampled on 2026-10-27, #614efa / #5136E2)
  accentSecondary: "#5136E2",

  // Semantic Severity & Status
  severityBlocker: "#B91C1C",
  severityMajor: "#92400E",
  severityMinor: "#1D4ED8",
  statusSuccess: "#065F46",
  statusWarning: "#92400E",
  statusError: "#B91C1C",
};

export const spacing = {
  2: "8px",
  3: "12px",
  4: "16px",
  6: "24px",
  8: "32px",
  12: "48px",
} as const;

export const radius = {
  sm: "6px",
  md: "10px",
} as const;

export const shadows = {
  none: "none",
  subtleDark: "0 1px 2px rgba(0, 0, 0, 0.4)",
  subtleLight: "0 1px 2px rgba(0, 0, 0, 0.08)",
} as const;

export const motion = {
  duration: "150ms",
  timing: "cubic-bezier(0.16, 1, 0.3, 1)",
} as const;

export const typography = {
  fontSans: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
  fontMono: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
  fontSizeSm: "14px",
  fontSizeBase: "16px",
  fontSizeLg: "18px",
  fontSizeXl: "20px",
  fontSize2xl: "24px",
  fontSize3xl: "32px",
  fontWeightRegular: "400",
  fontWeightSemibold: "600",
  lineHeightBase: "1.5",
} as const;
