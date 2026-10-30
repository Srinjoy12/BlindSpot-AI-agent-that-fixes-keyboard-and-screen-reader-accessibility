# Modern Tactile Neomorphism Design System (DESIGN.md)

## 1. Concept in One Sentence
An architectural accessibility testing workbench combining warm organic plaster and mint-mist tactile surfaces, dual-light neomorphic bevels, and sunken instrument wells, anchored by crisp 1px high-contrast structural borders and luminous Sky Blue telemetry focus states for uncompromising WCAG 2.1 AA accessibility.

---

## 2. Reference Sites & Styles
1. **Braun / Dieter Rams Hi-Fi Audio Consoles (1960s-1970s):**
   - Physical debossed sunken switch-wells and tactile push-buttons with positive mechanical detents.
   - Warm organic sand/plaster canvas paired with mint-mist extruded component enclosures.
   - High-contrast, austere typographic hierarchy where labels never vanish into the background.

2. **Teenage Engineering Synthesizers (OP-1 / Field):**
   - Precision micro-machined physical borders (crisp 1px bevels that separate elevation planes).
   - High-contrast utilitarian monospace typography for DOM paths, timings, and diffs.
   - Vivid status indicator LEDs (Lime Green `#84CC16` for verified fixes, Sky Blue `#0EA5E9` for focus telemetry).

3. **Linear & Chrome DevTools:**
   - Strict technical density and zero layout shift.
   - Clear visual feedback on keyboard navigation without decorative blur.

---

## 3. Exact Palette & Semantic Role Mapping

All tokens are defined in CSS custom properties and guaranteed to pass `npm run test:contrast` (WCAG AA: text ≥ 4.5:1, UI components & focus indicators ≥ 3.0:1 against all surface planes).

### Base Canvas & Surfaces
| Token Name | Light Theme Hex | Dark Theme Hex | Semantic Role |
| :--- | :--- | :--- | :--- |
| `--color-bg-canvas` | `#F6F4EE` (Sand) | `#09140E` (Black Green) | Base canvas foundation |
| `--color-surface-1` | `#EBF3EE` (Mint Mist) | `#112219` (Deep Green) | Extruded slabs, raised cards, modals |
| `--color-surface-2` | `#E4ECE6` (Sunken Mist) | `#0B1711` (Sunken Well) | Inset wells, input fields, code tracks |
| `--color-surface-3` | `#DAE4DC` (Trough Deep) | `#183225` (Elevated Deep) | Active pills, dialog headers, tooltips |

### Brand & Interactive Tokens
| Token Name | Light Theme Hex | Dark Theme Hex | Contrast Ratio |
| :--- | :--- | :--- | :--- |
| `--color-accent-primary` | `#1B5E3B` (Invoca Green) | `#1B5E3B` (Invoca Green) | Primary button & CTA background |
| `--color-accent-primary-text` | `#FFFFFF` (Pure White) | `#FFFFFF` (Pure White) | 7.75:1 on Invoca Green |
| `--color-accent-secondary` | `#0369A1` (Deep Sky) | `#38BDF8` (Luminous Sky) | Secondary telemetry & link text |
| `--color-focus-ring` | `#0284C7` (Sky Blue 600) | `#38BDF8` (Sky Blue 400) | ≥ 3.14:1 (Light) / ≥ 5.86:1 (Dark) |
| `--color-status-success` | `#156534` (Deep Forest Green) | `#A3E635` (Lime Green) | ≥ 7.0:1 on all surfaces |

### High-Contrast Typography
| Token Name | Light Theme Hex | Dark Theme Hex | Contrast Ratio |
| :--- | :--- | :--- | :--- |
| `--color-text-primary` | `#0C2015` (Deep Forest) | `#F6F4EE` (Sand Mist) | ≥ 13.0:1 (Light) / ≥ 14.5:1 (Dark) |
| `--color-text-secondary` | `#1D3828` (Dense Forest) | `#D2E0D6` (Mint Light) | ≥ 9.0:1 (Light) / ≥ 10.5:1 (Dark) |
| `--color-text-muted` | `#3E5C4C` (Slate Mint Text) | `#9AB3A5` (Slate Mint Light) | ≥ 5.5:1 (Light) / ≥ 6.5:1 (Dark) |

### Borders & Physical Bevels
| Token Name | Light Theme Hex | Dark Theme Hex | Contrast Ratio |
| :--- | :--- | :--- | :--- |
| `--color-border-subdued` | `#CBD8CF` | `#234432` | Subtle plane dividers |
| `--color-border-ui` | `#587867` | `#688274` | Resting interactive borders (≥ 3.0:1) |
| `--color-border-strong` | `#2C4A3A` | `#829E8F` | Active & emphasized borders (≥ 5.0:1) |

---

## 4. Neomorphic Elevation & Shadow System

Dual light-source physics anchored at 135° (top-left primary white reflection, bottom-right ambient absorption).

### 1. Extruded Surface (`.neo-extruded`)
- **Light Mode (`[data-theme="light"]`):**
  - `background: #EBF3EE;`
  - `box-shadow: 6px 6px 14px rgba(18, 38, 27, 0.08), -6px -6px 14px rgba(255, 255, 255, 0.9);`
  - `border: 1px solid rgba(255, 255, 255, 0.6);`
- **Dark Mode (`[data-theme="dark"]`):**
  - `background: #112219;`
  - `box-shadow: 6px 6px 16px rgba(0, 0, 0, 0.6), -4px -4px 12px rgba(35, 68, 50, 0.25);`
  - `border: 1px solid rgba(255, 255, 255, 0.05);`

### 2. Sunken / Inset Well (`.neo-sunken`)
- **Light Mode (`[data-theme="light"]`):**
  - `background: #E4ECE6;`
  - `box-shadow: inset 3px 3px 6px rgba(18, 38, 27, 0.1), inset -3px -3px 6px rgba(255, 255, 255, 0.85);`
  - `border: 1px solid rgba(18, 38, 27, 0.06);`
- **Dark Mode (`[data-theme="dark"]`):**
  - `background: #0B1711;`
  - `box-shadow: inset 3px 3px 8px rgba(0, 0, 0, 0.7), inset -2px -2px 6px rgba(35, 68, 50, 0.2);`
  - `border: 1px solid rgba(0, 0, 0, 0.4);`

### 3. Tactile Pill Buttons & Convex Interactive States (`.neo-pill`, `.neo-button`)
- **Resting:** Raised extruded surface with subtle top-to-bottom convex linear gradient (+3% lightness at top).
- **Hover:** Elevated lift with enhanced bottom-right shadow (+2px spread) and intensified rim reflection.
- **Active / Pressed (`:active`, `aria-selected="true"`):** Snaps instantly to sunken inset shadow with Invoca Green/Mint tint.
- **Keyboard Focus Ring:** `outline: 3px solid var(--color-focus-ring); outline-offset: 2px;`

---

## 5. Typography System
- **Interface Font:** `system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`
- **Code & Telemetry Font:** `ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", monospace`
- **Rules:**
  - Base body: 16px / line-height 1.5. Nothing below 14px in any UI element.
  - Two primary weights: 400 (regular) and 600 (semibold).
  - Sentence case everywhere for maximum readability.

---

## 6. Component Blueprints

1. **Header (`Header.tsx`):**
   - Floating neomorphic bar on Sand canvas with rounded-2xl geometry.
   - Brand title "BlindSpot" in Deep Green with a subtle Mint glow dot.
   - Tactile debossed Theme Toggle button with smooth convex-to-inset toggle animation.
   - Clean header layout focused on brand identity and tactile theme toggle.

2. **Audit Control Bar (`AuditBar.tsx`):**
   - Sunken segmented track with a sliding convex pill for `URL | Paste code | Open folder`.
   - URL & Code Inputs: Sunken inset wells with monospace typography, crisp caret, and clear placeholder contrast.
   - Primary Audit Button: Rich Invoca Green convex button (`#1B5E3B`) with crisp white text, tactile hover lift, and physical pressed-in state on click.

3. **Progress Stepper (`PhaseStepper.tsx`):**
   - Recessed inset connecting groove.
   - Inactive steps: Soft raised circular debossed beads.
   - Active step: Glowing Sky Blue ring with active pulse animation.
   - Completed step: Tactile Mint/Lime convex badge with crisp dark checkmark.

4. **Results Summary & Metric Cards (`ResultsSummary.tsx`):**
   - 4-Card Stat Grid styled as extruded tactile slabs.
   - "Blocks keyboard use": Deep coral/crimson inset badge.
   - "Verified fixes": Crisp Lime Green convex badge with Invoca Green text.
   - axe-core comparison card: Sunken debossed comparison pill highlighting BlindSpot's dynamic detection lift.

5. **Keyboard Path Visualizer (`KeyboardReplay.tsx`):**
   - Visual SVG canvas framed inside an extruded bevel viewport frame.
   - Scrubber track styled as an inset well with raised pill buttons for each Tab stop.
   - Active focus node represented by a dual-ring Sky Blue / Lime Green glowing marker.
   - Clean Scrubber & Narrative: High-contrast step narrative summary sentence indicating current stop, focus visibility, and next destination.

6. **Fix Viewer & Diff Modal (`FixesInlineView.tsx` & `DiffModal.tsx`):**
   - Monospace unified diff container recessed in a dark deep-green sunken editor well.
   - `+` Additions styled with Mint/Lime Green soft tint; `-` Deletions styled with soft rose tint.
   - `HTML / DOM Patch` vs `React (JSX / TSX)` segmented toggle styled with tactile physical pill switches.

7. **Telemetry & Cost Panel (`ModelsAndCostPanel.tsx`):**
   - Token budget meter rendered as an inset recessed cylinder with an Invoca-to-Lime gradient fill.
   - Model cards (Nano 30B, Super 120B, Ultra 550B) styled as physical microchips/slabs with subtle debossed metallic border accents.
