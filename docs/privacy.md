# Privacy & Security in BlindSpot Project Folder Mode
*Transparent Data Handling, Ephemeral Processing & Developer Safeguards*

BlindSpot's **Open project folder** mode is an in-browser project scanner built directly on the Web File System Access API without requiring local software installation or giving blanket access to your computer. This document details our data handling architecture, network isolation, and developer safeguards.

---

## 1. Zero Disk Persistence on Hosted Server

When you grant BlindSpot access to a local project folder:
1. **Local Browser Reading**: The browser's native File System Access API (`window.showDirectoryPicker` on Chromium desktop) or directory upload (`webkitdirectory` fallback on Firefox/Safari) reads selected files in memory inside your browser.
2. **Ephemeral In-Memory Sandbox**: Files are transferred via HTTPS to `/api/audit-files`. They are held strictly in memory in a ephemeral server instance (`createFileSetServer`) bound to an unprivileged loopback port on `127.0.0.1`.
3. **No Database & No Server Disk Storage**: Uploaded files are **never** written to the server's filesystem, database, or object storage.
4. **Immediate Deallocation**: As soon as the audit stream completes or the browser tab disconnects, the in-memory session is closed and memory is deallocated.

---

## 2. Airgapped Sandbox Egress Blocking

To protect user code and prevent data exfiltration:
- The Playwright Chromium sandbox uses strict request interception (`page.route("**/*")`).
- Any outbound request attempting to access external origins (such as external CDNs, third-party analytics, remote scripts, or tracking pixels) is immediately aborted.
- Egress attempts are counted and reported directly in the audit summary (`blockedResourcesCount`).

---

## 3. Automatic Security Exclusions

Before any files leave your browser, BlindSpot scans folder entries against a strict exclusion list. The following files are **never read or uploaded**:

| Category | Patterns Excluded |
| :--- | :--- |
| **Secrets & Keys** | `.env`, `.env.*`, `*.pem`, `*.key`, `*.cert`, `*.pfx`, `id_rsa*` |
| **Version Control** | `.git/*`, `.github/*`, `.svn/*`, `.hg/*` |
| **Dependencies & Build Artifacts** | `node_modules/*`, `dist/*`, `build/*`, `.next/*`, `.nuxt/*`, `out/*` |
| **BlindSpot Internal Artifacts** | `.blindspot/*` (backups, state) |
| **OS Metadata & Binaries** | `.DS_Store`, `Thumbs.db`, `.idea/*`, `.vscode/*`, binaries, images, fonts |

File limits enforced at client and server:
- **Maximum 300 files** per project folder.
- **Maximum 200 KB** per individual file.
- **Maximum 5 MB** total upload payload across all files.

---

## 4. AI Token Exposure & Localization

BlindSpot does not dump your entire repository into a language model.
- **Deterministic Localization First**: When an accessibility barrier is detected (e.g. `#submit-btn` missing focus outline), deterministic scoring identifies the 1–3 most relevant files (e.g. `styles.css` or `src/components/Button.tsx`) based on ID, class, selector, and detector affinity.
- **Strict Byte Caps**: In React and folder modes, candidate source files sent to the model for inspection and repair are capped at a maximum of 60 KB across all candidate files.
- **Surgical Snippet Prompts**: Only the localized file content (up to 60 KB) and specific barrier evidence are provided to NVIDIA Nemotron Ultra to generate a repair.
- **Out-of-Bounds Edit Protection**: If a language model proposes modifying a path not explicitly present in the uploaded FileSet, the proposal is strictly rejected.
- **Local Dev Server Bridge Data Isolation**: When auditing a local development server, candidate source files attached from your React `src/` folder are held in ephemeral server memory and inspected strictly for localization. No disk writes occur in local dev server mode.

---

## 5. Write Control, Automated Backups & Revert Safeguards

BlindSpot will **never** alter your local disk silently:
1. **Explicit Developer Approval**: Fixes are only written to your disk when you click **"Apply all verified fixes"** or inspect a diff and click **"Apply fix"**.
2. **Automated Safety Backups**: Before the first file is modified, BlindSpot copies the original files into `.blindspot/backup/<ISO-timestamp>/<path>`.
3. **Stale File Detection**: Immediately before writing, BlindSpot re-reads the file from disk. If the file was edited in your code editor after the audit started, the write is aborted with a warning to protect your unsaved changes.
4. **Byte-for-Byte Revert**: Clicking **"Revert changes"** restores all modified files from the backup and verifies that the file contents on disk match the original baseline byte-for-byte.
