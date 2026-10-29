import { darkTheme, lightTheme, type ThemeColors } from "../apps/web/src/tokens.js";

function getRelativeLuminance(hex: string): number {
  const cleanHex = hex.replace("#", "").trim();
  const r8 = parseInt(cleanHex.slice(0, 2), 16);
  const g8 = parseInt(cleanHex.slice(2, 4), 16);
  const b8 = parseInt(cleanHex.slice(4, 6), 16);
  const [r, g, b] = [r8, g8, b8].map((val) => {
    const s = val / 255;
    return s <= 0.04045 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function getContrastRatio(hex1: string, hex2: string): number {
  const lum1 = getRelativeLuminance(hex1);
  const lum2 = getRelativeLuminance(hex2);
  const lighter = Math.max(lum1, lum2);
  const darker = Math.min(lum1, lum2);
  return (lighter + 0.05) / (darker + 0.05);
}

const themes: Array<{ name: string; tokens: ThemeColors }> = [
  { name: "Dark Theme (Default)", tokens: darkTheme },
  { name: "Light Theme", tokens: lightTheme },
];

console.log("Analyzing AA (4.5:1 text, 3.0:1 UI) vs AAA (7.0:1 text, 4.5:1 UI):\n");

for (const { name, tokens } of themes) {
  console.log(`=== ${name} ===`);
  const surfaces = [
    { name: "bgCanvas", color: tokens.bgCanvas },
    { name: "surface1", color: tokens.surface1 },
    { name: "surface2", color: tokens.surface2 },
    { name: "surface3", color: tokens.surface3 },
  ];

  console.log("\n[Text Tokens]:");
  for (const s of surfaces) {
    const pRatio = getContrastRatio(tokens.textPrimary, s.color);
    const sRatio = getContrastRatio(tokens.textSecondary, s.color);
    const mRatio = getContrastRatio(tokens.textMuted, s.color);
    console.log(`On ${s.name} (${s.color}):`);
    console.log(`  textPrimary (${tokens.textPrimary}):   ${pRatio.toFixed(2)}:1 -> AA: ${pRatio >= 4.5 ? "PASS" : "FAIL"}, AAA: ${pRatio >= 7.0 ? "PASS" : "FAIL"}`);
    console.log(`  textSecondary (${tokens.textSecondary}): ${sRatio.toFixed(2)}:1 -> AA: ${sRatio >= 4.5 ? "PASS" : "FAIL"}, AAA: ${sRatio >= 7.0 ? "PASS" : "FAIL"}`);
    console.log(`  textMuted (${tokens.textMuted}):     ${mRatio.toFixed(2)}:1 -> AA: ${mRatio >= 4.5 ? "PASS" : "FAIL"}, AAA: ${mRatio >= 7.0 ? "PASS" : "FAIL"}`);
  }

  console.log("\n[Button / Accent Tokens]:");
  const btnTextOnAccent = getContrastRatio(tokens.accentPrimaryText, tokens.accentPrimary);
  console.log(`  primary button text (${tokens.accentPrimaryText}) on accent (${tokens.accentPrimary}): ${btnTextOnAccent.toFixed(2)}:1 -> AA: ${btnTextOnAccent >= 4.5 ? "PASS" : "FAIL"}, AAA: ${btnTextOnAccent >= 7.0 ? "PASS" : "FAIL"}`);
  
  for (const s of surfaces) {
    const secRatio = getContrastRatio(tokens.accentSecondary, s.color);
    console.log(`  accentSecondary (${tokens.accentSecondary}) on ${s.name}: ${secRatio.toFixed(2)}:1 -> AA: ${secRatio >= 4.5 ? "PASS" : "FAIL"}, AAA: ${secRatio >= 7.0 ? "PASS" : "FAIL"}`);
  }
  console.log("");
}
