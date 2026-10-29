# BlindSpot — Security Architecture & Threat Model
*Chromium Sandboxing, SSRF Protection, Container Hardening & Residual Risk Assessment · 2026*

## 1. Executive Security Architecture

BlindSpot operates an autonomous headless Chromium browser to crawl, inspect, and verify web applications. Because inspecting untrusted third-party URLs and local code introduces potential security attack vectors, BlindSpot enforces defense-in-depth across multiple architectural layers:

```
┌─────────────────────────────────────────────────────────────┐
│                 Client Request (URL / Code)                 │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 1: Input Validation & Pre-Flight SSRF Guard          │
│  - WHATWG URL normalization (dec/hex/octal IP handling)     │
│  - Node.js net.BlockList (private, loopback, metadata IPs)  │
│  - Path traversal checks (.. and encoded slashes prohibited)│
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 2: Browser Network Boundary (Interception Guard)     │
│  - context.route('**') on all requests, scripts & fetches   │
│  - Block all non-http(s) schemes except data: and blob:     │
│  - Full DNS resolution check on every hostname (all IPs)    │
│  - Redirect hop inspection (3xx Location destination check) │
└──────────────────────────────┬──────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────┐
│  Layer 3: Container & Process Sandbox                       │
│  - Non-root unprivileged execution (pwuser, UID 1000)       │
│  - Read-only root filesystem (except /tmp)                  │
│  - Dropped Linux capabilities (--cap-drop=ALL)              │
│  - Ephemeral in-memory sessions; zero disk persistence      │
└─────────────────────────────────────────────────────────────┘
```

---

## 2. Chromium Sandbox Rationale & Container Hardening

### Why `--no-sandbox` Is Used in Production Containers

In standard Linux container environments (such as Kubernetes clusters, Docker runners, and cloud container environments), the Linux kernel's unprivileged user namespace subsystem (`clone(CLONE_NEWUSER)`) is restricted for unprivileged containers. Chromium's default setuid/user-namespace sandbox relies on these capabilities; without either `CAP_SYS_ADMIN` or a specialized custom seccomp profile granting user namespace creation, Chromium crashes upon initialization with:
`Failed to move to new namespace: PID namespaces supported, Network namespace supported, User namespace not supported` or `No usable sandbox!`.

Because granting `CAP_SYS_ADMIN` or privileged container access to a web-facing service violates basic container security principles, BlindSpot runs Chromium with `--no-sandbox` combined with strict defense-in-depth compensating controls:

### Compensating Controls
1. **Unprivileged Non-Root User**: The container runs under Microsoft Playwright's dedicated `pwuser` (UID 1000). The process possesses no root privileges or `sudo` rights.
2. **Read-Only Root Filesystem**: In production deployments, the container filesystem is mounted read-only (`--read-only`), with only an ephemeral memory-backed `/tmp` mount (`--tmpfs /tmp`) for Chromium temporary files.
3. **Dropped Capabilities**: The container runs with no extra capabilities (`--cap-drop=ALL`).
4. **Network Interception & SSRF Blocking**: Chromium network requests are strictly gated by Playwright's `context.route` handler in `packages/engine/src/ssrf.ts`.

### Explicit Residual Risk Statement
> **Residual Risk:** If an untrusted page exploits an unpatched, zero-day remote code execution (RCE) vulnerability inside Chromium's Blink rendering engine or V8 JavaScript runtime, the lack of an OS-level user namespace sandbox could permit the attacker to execute arbitrary shellcode with the permissions of the `pwuser` process inside the container.
>
> **Mitigation Context:** This risk is constrained by the ephemeral container lifecycle, lack of root privileges, read-only rootfs, absence of persistent cloud secrets or credentials on disk, and the strict network route guard which aborts exfiltration to private, loopback, or metadata addresses.

### Playwright Version Parity Verification
- **Docker Base Image**: `mcr.microsoft.com/playwright:v1.64.1-noble`
- **Node.js Playwright Dependency**: pinned exactly to `1.64.1` across all workspace manifests (`@blindspot/engine`, `@blindspot/detectors`, `@blindspot/fixer`, `@blindspot/bench`).
- **Parity**: The browser binaries pre-installed in the container image match the Playwright automation driver byte-for-byte, preventing runtime driver-browser protocol incompatibilities.

---

## 3. SSRF Protection Specification (`packages/engine/src/ssrf.ts`)

BlindSpot implements SSRF protection using Node's standard `net.BlockList`:

### Blocked IP Ranges
- **IPv4**:
  - `0.0.0.0/8` (Current network)
  - `10.0.0.0/8` (RFC 1918 Private)
  - `100.64.0.0/10` (Carrier-Grade NAT / Shared Address Space)
  - `127.0.0.0/8` (Loopback)
  - `169.254.0.0/16` (Link-Local / Cloud Metadata: AWS, GCP, Azure, Nebius)
  - `172.16.0.0/12` (RFC 1918 Private)
  - `192.0.0.0/24` (IETF Protocol Assignments)
  - `192.0.2.0/24` (TEST-NET-1 Documentation)
  - `192.168.0.0/16` (RFC 1918 Private)
  - `198.18.0.0/15` (Network Benchmark Testing)
  - `198.51.100.0/24` (TEST-NET-2 Documentation)
  - `203.0.113.0/24` (TEST-NET-3 Documentation)
  - `224.0.0.0/4` (Multicast)
  - `240.0.0.0/4` (Reserved)
- **IPv6**:
  - `::` (Unspecified)
  - `::1` (Loopback)
  - `fc00::/7` (Unique Local Address - ULA)
  - `fe80::/10` (Link-Local Unicast)
  - `ff00::/8` (Multicast)
  - `2001:db8::/32` (Documentation)
  - `::ffff:0:0/96` (IPv4-mapped IPv6 where embedded IPv4 is blocked)
  - `64:ff9b::/96` (NAT64 where embedded IPv4 is blocked)

### WHATWG URL Normalization
All URLs pass through `new URL(rawUrl)` prior to address resolution. This automatically normalizes decimal (`http://2130706433/`), hexadecimal (`http://0x7f000001/`), and octal (`http://0177.0.0.1/`) representations of IPv4 addresses into standard dot-decimal form before range checking.

### Documented Fixture Exception
An exception is granted only for BlindSpot's own benchmark fixtures under `/fixtures` on the app's own origin (`localhost`, `127.0.0.1`, or `::1` on the configured `PORT`). This exception:
- Requires exact path prefix `/fixtures/` or `/fixtures`.
- Rejects directory traversal (`..` or `%2e%2e`).
- Rejects access to `/api/` or internal configuration endpoints.
- Rejects any external host or non-matching port.

---

## 4. Report Storage Security

- **Report Identifiers**: Generated strictly using `crypto.randomUUID()` (CSPRNG, 128-bit entropy). Sequential IDs are rejected.
- **Time-to-Live (TTL)**: Reports expire automatically 1 hour after generation.
- **Storage Limits**: Capped at 200 reports or 100 MB total. When limits are exceeded, oldest reports are evicted first (FIFO).
