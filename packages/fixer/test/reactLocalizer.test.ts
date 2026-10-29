import { describe, it, expect } from "vitest";
import {
  localizeReactCandidateFiles,
  type LocalizeReactBarrierInput,
} from "../src/index.js";

describe("React Source Localizer — Heuristic Candidate Localization", () => {
  it("scores direct id=\"x\" and id={\"x\"} with high score (+30) and high confidence", () => {
    const fileSet = new Map<string, string>([
      [
        "src/components/Modal.tsx",
        `export function Modal() {
  return (
    <div id="settings-dialog" role="dialog" aria-modal="true">
      <button id={"close-btn"}>Close</button>
    </div>
  );
}`,
      ],
      [
        "src/components/Sidebar.tsx",
        `export function Sidebar() {
  return <nav id="main-nav"><a href="/home">Home</a></nav>;
}`,
      ],
    ]);

    const barrier1: LocalizeReactBarrierInput = {
      selector: "#settings-dialog",
      detectorId: "D1",
    };
    const res1 = localizeReactCandidateFiles(barrier1, fileSet);
    expect(res1.length).toBeGreaterThanOrEqual(1);
    expect(res1[0]!.path).toBe("src/components/Modal.tsx");
    expect(res1[0]!.confidence).toBe("high");
    expect(res1[0]!.matchedSignals.some((s) => s.includes("settings-dialog"))).toBe(true);

    const barrier2: LocalizeReactBarrierInput = {
      selector: "#close-btn",
      detectorId: "D8",
    };
    const res2 = localizeReactCandidateFiles(barrier2, fileSet);
    expect(res2[0]!.path).toBe("src/components/Modal.tsx");
    expect(res2[0]!.confidence).toBe("high");
    expect(res2[0]!.matchedSignals.some((s) => s.includes("close-btn"))).toBe(true);
  });

  it("scores CSS selector #x and class names correctly", () => {
    const fileSet = new Map<string, string>([
      [
        "src/components/Header.module.css",
        `.navHeader { display: flex; }
#mobile-menu-trigger { background: transparent; }`,
      ],
      [
        "src/components/Header.tsx",
        `import styles from "./Header.module.css";
export function Header() {
  return <header className={styles.navHeader}><button id="mobile-menu-trigger">Menu</button></header>;
}`,
      ],
    ]);

    const barrier: LocalizeReactBarrierInput = {
      selector: "header .navHeader #mobile-menu-trigger",
      detectorId: "D2",
    };

    const res = localizeReactCandidateFiles(barrier, fileSet);
    expect(res.length).toBe(2);
    // Header.tsx has id="mobile-menu-trigger" (+30) + styles.navHeader (+15) + <header (+4) + TSX D2 affinity (+20) = 69
    expect(res[0]!.path).toBe("src/components/Header.tsx");
    expect(res[0]!.confidence).toBe("high");
    expect(res[1]!.path).toBe("src/components/Header.module.css");
  });

  it("identifies CSS module styles.x references in JSX", () => {
    const fileSet = new Map<string, string>([
      [
        "src/Button.tsx",
        `import styles from "./Button.module.css";
export function Button() {
  return <button className={styles.primaryBtn}>Click</button>;
}`,
      ],
      [
        "src/Card.tsx",
        `export function Card() {
  return <div className="card">Card</div>;
}`,
      ],
    ]);

    const barrier: LocalizeReactBarrierInput = {
      selector: "button.primaryBtn",
      detectorId: "D3",
    };

    const res = localizeReactCandidateFiles(barrier, fileSet);
    expect(res.length).toBe(1);
    expect(res[0]!.path).toBe("src/Button.tsx");
    expect(res[0]!.matchedSignals.some((s) => s.includes("styles.primaryBtn"))).toBe(true);
  });

  it("gives partial credit and low confidence for computed/dynamic classNames", () => {
    const fileSet = new Map<string, string>([
      [
        "src/components/DynamicBox.tsx",
        `import clsx from "clsx";
export function DynamicBox({ active }: { active: boolean }) {
  return <div className={clsx("box", active && "tab-active")}>Content</div>;
}`,
      ],
      [
        "src/components/StaticOther.tsx",
        `export function StaticOther() {
  return <span className="other">None</span>;
}`,
      ],
    ]);

    const barrier: LocalizeReactBarrierInput = {
      selector: ".tab-active",
      detectorId: "D4",
    };

    const res = localizeReactCandidateFiles(barrier, fileSet);
    expect(res.length).toBe(1);
    expect(res[0]!.path).toBe("src/components/DynamicBox.tsx");
    expect(res[0]!.confidence).toBe("low");
    expect(res[0]!.matchedSignals.some((s) => s.includes("computed/dynamic"))).toBe(true);
  });

  it("applies detector affinities: D3/D5 boosts CSS, D1/D8/D2 boosts TSX/JSX", () => {
    const fileSet = new Map<string, string>([
      [
        "src/styles/navbar.css",
        `.nav-link { color: blue; }
.nav-link:focus { outline: none; }`,
      ],
      [
        "src/components/Navbar.tsx",
        `export function Navbar() {
  return <nav><a href="/test" className="nav-link">Test</a></nav>;
}`,
      ],
    ]);

    // D3 (focus not visible) should boost the CSS file
    const d3Res = localizeReactCandidateFiles(
      { selector: "a.nav-link", detectorId: "D3" },
      fileSet
    );
    // navbar.css: .nav-link (+15) + D3 affinity (+20) = 35
    // Navbar.tsx: className="nav-link" (+15) + <nav (+4) = 19
    expect(d3Res[0]!.path).toBe("src/styles/navbar.css");

    // D2 (unreachable control) should boost the TSX file
    const d2Res = localizeReactCandidateFiles(
      { selector: "a.nav-link", detectorId: "D2" },
      fileSet
    );
    // Navbar.tsx: className="nav-link" (+15) + <nav (+4) + D2 affinity (+20) = 39
    // navbar.css: .nav-link (+15) = 15
    expect(d2Res[0]!.path).toBe("src/components/Navbar.tsx");
  });

  it("caps results at maxCandidates (default 3) and maxTotalBytes (60 KB)", () => {
    // Create 5 candidate files
    const fileSet = new Map<string, string>();
    for (let i = 1; i <= 5; i++) {
      fileSet.set(
        `src/comp${i}.tsx`,
        `// file ${i}\nexport const Comp${i} = () => <div className="test-item" id="item-${i}">Item ${i}</div>;`
      );
    }

    const barrier: LocalizeReactBarrierInput = {
      selector: ".test-item",
      detectorId: "D2",
    };

    const res = localizeReactCandidateFiles(barrier, fileSet, { maxCandidates: 3 });
    expect(res.length).toBe(3);

    // Now test byte capping with large content
    const largeContent = "// large\n".repeat(2500) + '<div className="heavy-match">Big</div>;'; // ~22 KB
    const heavyFileSet = new Map<string, string>([
      ["src/Big1.tsx", largeContent],
      ["src/Big2.tsx", largeContent],
      ["src/Big3.tsx", largeContent],
      ["src/Big4.tsx", largeContent],
    ]);

    const cappedRes = localizeReactCandidateFiles(
      { selector: ".heavy-match" },
      heavyFileSet,
      { maxCandidates: 5, maxTotalBytes: 50 * 1024 }
    );
    // 2 files are ~44 KB (<= 50KB); 3 files would be ~66 KB (> 50KB)
    expect(cappedRes.length).toBe(2);
  });

  it("returns empty array when no files match barrier tokens", () => {
    const fileSet = new Map<string, string>([
      ["src/Alpha.tsx", "export function Alpha() { return <p>Hello</p>; }"],
      ["src/Beta.tsx", "export function Beta() { return <span>World</span>; }"],
    ]);

    const barrier: LocalizeReactBarrierInput = {
      selector: "#non-existent-element",
      detectorId: "D1",
    };

    const res = localizeReactCandidateFiles(barrier, fileSet);
    expect(res.length).toBe(0);
  });
});
