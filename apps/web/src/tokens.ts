/**
 * BlindSpot Design Tokens
 * 
 * Modern Tactile Neomorphism Design System adhering strictly to WCAG 2.1 AA:
 * - Text contrast >= 4.5:1
 * - UI components and focus rings >= 3:1
 * - Primary Brand Accent: Invoca Green (#1B5E3B)
 * - Light Foundation: Sand (#F6F4EE) & Mint Mist (#EBF3EE)
 * - Dark Foundation: Black Green (#09140E) & Deep Green (#112219)
 * - Status Tokens: Lime Green (#A3E635 / #156534)
 * - Focus & Telemetry: Sky Blue (#0EA5E9 / #38BDF8 / #0284C7)
 * - Accents & Secondary: Slate / Muted Mint (#688274)
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
  // Foundations - Black Green & Deep Green
  bgCanvas: "#09140E",
  surface1: "#112219", // Deep Green extruded slabs
  surface2: "#0B1711", // Sunken well
  surface3: "#183225", // Elevated deep

  // Borders - Crisp 1px anchoring bevels
  borderSubdued: "#234432",
  borderUi: "#688274", // Slate / Muted Mint (>= 3.31:1 on all dark surfaces)
  borderStrong: "#829E8F",
  focusRing: "#38BDF8", // Luminous Sky Blue (>= 5.86:1 on all dark surfaces)

  // Typography - High Contrast on Black Green / Deep Green
  textPrimary: "#F6F4EE", // Warm Sand mist (>= 14.5:1)
  textSecondary: "#D2E0D6", // Mint Light (>= 10.5:1)
  textMuted: "#9AB3A5", // Slate Mint Light (>= 6.5:1)

  // Brand Accents
  accentPrimary: "#1B5E3B", // Invoca Green
  accentPrimaryText: "#FFFFFF", // Pure White (7.75:1 on Invoca Green)
  accentSecondary: "#38BDF8", // Sky Blue

  // Semantic Severity & Status
  severityBlocker: "#FF7B7B",
  severityMajor: "#FCD34D",
  severityMinor: "#7DD3FC",
  statusSuccess: "#A3E635", // High-energy Lime Green (>= 9.1:1 on dark)
  statusWarning: "#FCD34D",
  statusError: "#FF7B7B",
};

export const lightTheme: ThemeColors = {
  // Foundations - Sand & Mint Mist
  bgCanvas: "#F6F4EE", // Sand primary canvas
  surface1: "#EBF3EE", // Mint Mist raised slabs/cards
  surface2: "#E4ECE6", // Sunken well light
  surface3: "#DAE4DC", // Trough deep light

  // Borders - Crisp 1px anchoring bevels
  borderSubdued: "#CBD8CF",
  borderUi: "#587867", // Slate Mint UI border (>= 3.1:1 on light)
  borderStrong: "#2C4A3A", // Deep Forest strong border (>= 8.0:1)
  focusRing: "#0284C7", // Sky Blue 600 (>= 3.14:1 on all light surfaces)

  // Typography - Deep Forest & Slate on Sand/Mint
  textPrimary: "#0C2015", // Deep Forest (>= 13.0:1)
  textSecondary: "#1D3828", // Dense Forest (>= 9.0:1)
  textMuted: "#3E5C4C", // Slate Mint Text (>= 5.5:1)

  // Brand Accents
  accentPrimary: "#1B5E3B", // Invoca Green
  accentPrimaryText: "#FFFFFF", // Pure White (7.75:1 on Invoca Green)
  accentSecondary: "#0369A1", // Deep Sky Blue (>= 4.55:1 on all light surfaces)

  // Semantic Severity & Status
  severityBlocker: "#B91C1C",
  severityMajor: "#92400E",
  severityMinor: "#0369A1",
  statusSuccess: "#156534", // Deep Forest Green (>= 7.0:1)
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
  lg: "12px",
  xl: "16px",
  full: "9999px",
} as const;

export const shadows = {
  none: "none",
  subtleDark: "6px 6px 16px rgba(0, 0, 0, 0.6), -4px -4px 12px rgba(35, 68, 50, 0.25)",
  subtleLight: "6px 6px 14px rgba(18, 38, 27, 0.08), -6px -6px 14px rgba(255, 255, 255, 0.9)",
} as const;

export const neomorphism = {
  extrudedLight: "6px 6px 14px rgba(18, 38, 27, 0.08), -6px -6px 14px rgba(255, 255, 255, 0.9)",
  extrudedDark: "6px 6px 16px rgba(0, 0, 0, 0.6), -4px -4px 12px rgba(35, 68, 50, 0.25)",
  sunkenLight: "inset 3px 3px 6px rgba(18, 38, 27, 0.1), inset -3px -3px 6px rgba(255, 255, 255, 0.85)",
  sunkenDark: "inset 3px 3px 8px rgba(0, 0, 0, 0.7), inset -2px -2px 6px rgba(35, 68, 50, 0.2)",
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
