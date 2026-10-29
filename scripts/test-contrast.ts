import { darkTheme, lightTheme, type ThemeColors } from "../apps/web/src/tokens.js";

/**
 * Computes WCAG 2.1 relative luminance according to the W3C spec:
 * https://www.w3.org/WAI/GL/wiki/Relative_luminance
 */
function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "").trim();
  const r8 = parseInt(cleanHex.slice(0, 2), 16);
  const g8 = parseInt(cleanHex.slice(2, 4), 16);
  const b8 = parseInt(cleanHex.slice(4, 6), 16);

  const [r, g, b] = [r8, g8, b8].map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });

  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes contrast ratio between two colors:
 * (L1 + 0.05) / (L2 + 0.05)
 */
function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

interface TestFailure {
  theme: string;
  category: "text" | "ui";
  token: string;
  tokenColor: string;
  background: string;
  backgroundColor: string;
  ratio: number;
  threshold: number;
}

function runContrastSuite(): boolean {
  console.log("==========================================================");
  console.log("   BlindSpot Design Tokens WCAG Contrast Validation");
  console.log("   Text threshold: 4.5:1 | UI components & focus: 3.0:1");
  console.log("==========================================================\n");

  const themes: Array<{ name: string; tokens: ThemeColors }> = [
    { name: "Dark Theme (Default)", tokens: darkTheme },
    { name: "Light Theme", tokens: lightTheme },
  ];

  const failures: TestFailure[] = [];
  let totalTests = 0;
  let passedTests = 0;

  for (const { name, tokens } of themes) {
    console.log(`Checking ${name}...`);

    const backgrounds: Record<string, string> = {
      bgCanvas: tokens.bgCanvas,
      surface1: tokens.surface1,
      surface2: tokens.surface2,
      surface3: tokens.surface3,
    };

    // Text tokens that must meet 4.5:1 against every surface
    const textTokens: Record<string, string> = {
      textPrimary: tokens.textPrimary,
      textSecondary: tokens.textSecondary,
      textMuted: tokens.textMuted,
      accentSecondary: tokens.accentSecondary,
      severityBlocker: tokens.severityBlocker,
      severityMajor: tokens.severityMajor,
      severityMinor: tokens.severityMinor,
      statusSuccess: tokens.statusSuccess,
      statusWarning: tokens.statusWarning,
      statusError: tokens.statusError,
    };

    // UI component & focus tokens that must meet 3.0:1 against surfaces
    const uiTokens: Record<string, string> = {
      borderUi: tokens.borderUi,
      borderStrong: tokens.borderStrong,
      focusRing: tokens.focusRing,
      accentSecondaryUi: tokens.accentSecondary,
    };

    // Test text tokens against all backgrounds
    for (const [textName, textColor] of Object.entries(textTokens)) {
      for (const [bgName, bgColor] of Object.entries(backgrounds)) {
        totalTests++;
        const ratio = getContrastRatio(textColor, bgColor);
        const threshold = 4.5;
        if (ratio < threshold) {
          failures.push({
            theme: name,
            category: "text",
            token: textName,
            tokenColor: textColor,
            background: bgName,
            backgroundColor: bgColor,
            ratio,
            threshold,
          });
        } else {
          passedTests++;
        }
      }
    }

    // Special check: primary button text on primary button background (#76B900)
    totalTests++;
    const buttonRatio = getContrastRatio(tokens.accentPrimaryText, tokens.accentPrimary);
    if (buttonRatio < 4.5) {
      failures.push({
        theme: name,
        category: "text",
        token: "accentPrimaryText",
        tokenColor: tokens.accentPrimaryText,
        background: "accentPrimary",
        backgroundColor: tokens.accentPrimary,
        ratio: buttonRatio,
        threshold: 4.5,
      });
    } else {
      passedTests++;
      console.log(`  ✓ Primary button text (${tokens.accentPrimaryText}) on NVIDIA green (${tokens.accentPrimary}): ${buttonRatio.toFixed(2)}:1`);
    }

    // Test UI component tokens against all backgrounds
    for (const [uiName, uiColor] of Object.entries(uiTokens)) {
      for (const [bgName, bgColor] of Object.entries(backgrounds)) {
        totalTests++;
        const ratio = getContrastRatio(uiColor, bgColor);
        const threshold = 3.0;
        if (ratio < threshold) {
          failures.push({
            theme: name,
            category: "ui",
            token: uiName,
            tokenColor: uiColor,
            background: bgName,
            backgroundColor: bgColor,
            ratio,
            threshold,
          });
        } else {
          passedTests++;
        }
      }
    }

    console.log(`  ✓ All tokens verified for ${name}.\n`);
  }

  console.log("----------------------------------------------------------");
  console.log(`Total contrast assertions: ${totalTests}`);
  console.log(`Passed: ${passedTests}`);
  console.log(`Failed: ${failures.length}`);
  console.log("----------------------------------------------------------");

  if (failures.length > 0) {
    console.error("\n❌ Contrast validation FAILED on the following token pairs:\n");
    for (const f of failures) {
      console.error(
        `  [${f.theme}] ${f.category.toUpperCase()}: ${f.token} (${f.tokenColor}) on ${f.background} (${f.backgroundColor})` +
        ` = ${f.ratio.toFixed(2)}:1 (minimum required: ${f.threshold}:1)`
      );
    }
    return false;
  }

  console.log("\n✅ All design token pairs pass WCAG 2.1 AA requirements!\n");
  return true;
}

const passed = runContrastSuite();
process.exit(passed ? 0 : 1);
