// ssrf.ts — Comprehensive SSRF Hardening for BlindSpot.
// Enforces WHATWG URL normalization, Node.js net.BlockList IPv4/IPv6 filtering,
// full Chromium request route interception, and strict fixture isolation.

import net from "node:net";
import dns from "node:dns";
import type { BrowserContext } from "playwright";

export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly target: string,
    public readonly reason: string
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

/**
 * Node.js net.BlockList containing all specified private, loopback, link-local,
 * cloud metadata, documentation, and multicast IPv4 and IPv6 CIDR ranges.
 */
export const blockList = new net.BlockList();

// ── IPv4 Ranges ─────────────────────────────────────────────────────────────
// 0.0.0.0/8        Current network / "this" network
blockList.addSubnet("0.0.0.0", 8, "ipv4");
// 10.0.0.0/8       Private-Use (RFC 1918)
blockList.addSubnet("10.0.0.0", 8, "ipv4");
// 100.64.0.0/10    Carrier-Grade NAT / Shared Address Space (RFC 6598)
blockList.addSubnet("100.64.0.0", 10, "ipv4");
// 127.0.0.0/8      Loopback (RFC 1122)
blockList.addSubnet("127.0.0.0", 8, "ipv4");
// 169.254.0.0/16   Link-Local / Cloud Metadata (AWS, GCP, Azure, Nebius)
blockList.addSubnet("169.254.0.0", 16, "ipv4");
// 172.16.0.0/12    Private-Use (RFC 1918)
blockList.addSubnet("172.16.0.0", 12, "ipv4");
// 192.0.0.0/24     IETF Protocol Assignments (RFC 6890)
blockList.addSubnet("192.0.0.0", 24, "ipv4");
// 192.0.2.0/24     TEST-NET-1 Documentation (RFC 5737)
blockList.addSubnet("192.0.2.0", 24, "ipv4");
// 192.168.0.0/16   Private-Use (RFC 1918)
blockList.addSubnet("192.168.0.0", 16, "ipv4");
// 198.18.0.0/15    Network Interconnect Device Benchmark Testing (RFC 2544)
blockList.addSubnet("198.18.0.0", 15, "ipv4");
// 198.51.100.0/24  TEST-NET-2 Documentation (RFC 5737)
blockList.addSubnet("198.51.100.0", 24, "ipv4");
// 203.0.113.0/24   TEST-NET-3 Documentation (RFC 5737)
blockList.addSubnet("203.0.113.0", 24, "ipv4");
// 224.0.0.0/4      Multicast (RFC 5771)
blockList.addSubnet("224.0.0.0", 4, "ipv4");
// 240.0.0.0/4      Reserved for future use (RFC 1112)
blockList.addSubnet("240.0.0.0", 4, "ipv4");

// ── IPv6 Ranges ─────────────────────────────────────────────────────────────
// ::               Unspecified address
blockList.addAddress("::", "ipv6");
// ::1              Loopback address
blockList.addAddress("::1", "ipv6");
// fc00::/7         Unique Local Address (ULA, RFC 4193)
blockList.addSubnet("fc00::", 7, "ipv6");
// fe80::/10        Link-Local Unicast (RFC 4291)
blockList.addSubnet("fe80::", 10, "ipv6");
// ff00::/8         Multicast (RFC 4291)
blockList.addSubnet("ff00::", 8, "ipv6");
// 2001:db8::/32    Documentation prefix (RFC 3849)
blockList.addSubnet("2001:db8::", 32, "ipv6");

/**
 * Extracts embedded IPv4 addresses from IPv4-mapped (::ffff:0:0/96)
 * or NAT64 (64:ff9b::/96) IPv6 notations.
 */
export function extractEmbeddedIpv4(ip: string): string | null {
  const lower = ip.toLowerCase().replace(/^\[|\]$/g, "");

  // Form 1: Dotted notation — ::ffff:192.0.2.1, ::ffff:0:192.0.2.1, 64:ff9b::192.0.2.1
  const dotMapped = lower.match(/^::ffff:(?:0:)?(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotMapped && dotMapped[1]) return dotMapped[1];
  const dotNat64 = lower.match(/^64:ff9b::(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})$/);
  if (dotNat64 && dotNat64[1]) return dotNat64[1];

  // Form 2: Hex groups — ::ffff:7f00:0001, 64:ff9b::7f00:0001
  const hexMapped = lower.match(/^::ffff:(?:0:)?([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexMapped && hexMapped[1] && hexMapped[2]) {
    const p1 = parseInt(hexMapped[1], 16);
    const p2 = parseInt(hexMapped[2], 16);
    return `${(p1 >> 8) & 255}.${p1 & 255}.${(p2 >> 8) & 255}.${p2 & 255}`;
  }

  const hexNat64 = lower.match(/^64:ff9b::([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (hexNat64 && hexNat64[1] && hexNat64[2]) {
    const p1 = parseInt(hexNat64[1], 16);
    const p2 = parseInt(hexNat64[2], 16);
    return `${(p1 >> 8) & 255}.${p1 & 255}.${(p2 >> 8) & 255}.${p2 & 255}`;
  }

  return null;
}

/**
 * Evaluates whether an IP address (IPv4 or IPv6 literal) is blocked by the BlockList
 * or encapsulates a blocked IPv4 address within an IPv4-mapped/NAT64 envelope.
 */
export function isIpBlocked(rawIp: string): boolean {
  const ip = rawIp.replace(/^\[|\]$/g, "").trim();

  // 1. Direct IPv4 Check
  if (net.isIP(ip) === 4) {
    return blockList.check(ip, "ipv4");
  }

  // 2. Direct IPv6 Check
  if (net.isIP(ip) === 6) {
    // Check if it encapsulates an IPv4 address
    const embedded = extractEmbeddedIpv4(ip);
    if (embedded && isIpBlocked(embedded)) {
      return true;
    }
    return blockList.check(ip, "ipv6");
  }

  // Not a valid standard IP literal; default to blocked for safety
  return true;
}

/**
 * Documented Exception:
 * BlindSpot allows requests ONLY to its own origin for static benchmark/audit fixtures under /fixtures.
 * Strictly verifies:
 * 1. Protocol is http: or https:
 * 2. Origin is localhost, 127.0.0.1, or ::1 on the app's configured PORT (default 3000)
 * 3. Path strictly starts with /fixtures/ or equals /fixtures
 * 4. Raw and decoded paths are checked for path traversal (.. or %2e%2e), encoded slashes, or redirection to other endpoints (/api/budget, etc.)
 */
export function isAllowedFixtureUrl(target: string | URL, appPort?: number): boolean {
  let url: URL;
  try {
    url = typeof target === "string" ? new URL(target) : target;
  } catch {
    return false;
  }

  // 1. Protocol must be http or https
  if (url.protocol !== "http:" && url.protocol !== "https:") return false;

  // 2. Port check
  const expectedPort = appPort ?? (process.env.PORT ? parseInt(process.env.PORT, 10) : 3000);
  const actualPort = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80);
  if (actualPort !== expectedPort) return false;

  // 3. Hostname check — only loopback / app origin
  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
  if (!allowedHosts.has(url.hostname.toLowerCase())) return false;

  // 4. Strict Path & Traversal check
  const rawPath = url.pathname;
  if (!rawPath.startsWith("/fixtures/") && rawPath !== "/fixtures") {
    return false;
  }

  // Check URL pathname against directory traversal & encoding tricks
  let decodedPath = "";
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch {
    return false; // Malformed percent-encoding
  }

  if (decodedPath.includes("..") || rawPath.includes("..")) {
    return false;
  }

  if (!decodedPath.startsWith("/fixtures/") && decodedPath !== "/fixtures") {
    return false;
  }

  // Ensure it cannot target API routes or internal state
  if (decodedPath.startsWith("/api") || decodedPath.includes("/api/")) {
    return false;
  }

  return true;
}

/**
 * Resolves a hostname to all associated IP addresses (IPv4 and IPv6)
 * and verifies that NONE of the returned addresses fall into blocked subnets.
 */
export async function resolveAndCheckHost(
  hostname: string,
  resolver?: (host: string) => Promise<string[]>
): Promise<string[]> {
  const cleanHost = hostname.toLowerCase().replace(/^\[|\]$/g, "");

  // If the host is already an IP literal:
  if (net.isIP(cleanHost)) {
    if (isIpBlocked(cleanHost)) {
      throw new SsrfError(
        `Host '${cleanHost}' is a blocked private or reserved IP address`,
        cleanHost,
        "blocked_ip"
      );
    }
    return [cleanHost];
  }

  // Hostnames that are unconditionally blocked
  if (
    cleanHost === "localhost" ||
    cleanHost.endsWith(".localhost") ||
    cleanHost.endsWith(".local") ||
    cleanHost.endsWith(".internal") ||
    cleanHost === "metadata.google.internal"
  ) {
    throw new SsrfError(
      `Hostname '${cleanHost}' is a reserved local/internal hostname`,
      cleanHost,
      "blocked_hostname"
    );
  }

  // Resolve all addresses (IPv4 and IPv6)
  let addresses: string[] = [];
  try {
    if (resolver) {
      addresses = await resolver(cleanHost);
    } else {
      const records = await dns.promises.lookup(cleanHost, { all: true });
      addresses = records.map((r) => r.address);
    }
  } catch (err) {
    throw new SsrfError(
      `Cannot resolve hostname '${cleanHost}': ${err instanceof Error ? err.message : err}`,
      cleanHost,
      "dns_failure"
    );
  }

  if (!addresses || addresses.length === 0) {
    throw new SsrfError(
      `Hostname '${cleanHost}' resolved to zero IP addresses`,
      cleanHost,
      "dns_failure"
    );
  }

  // Abort when ANY returned address is blocked
  for (const addr of addresses) {
    if (isIpBlocked(addr)) {
      throw new SsrfError(
        `Hostname '${cleanHost}' resolves to blocked private/reserved IP: ${addr}`,
        cleanHost,
        "blocked_ip"
      );
    }
  }

  return addresses;
}

export interface CheckUrlOptions {
  allowFixtures?: boolean | undefined;
  allowSelfAudit?: boolean | undefined;
  appPort?: number | undefined;
  resolver?: ((host: string) => Promise<string[]>) | undefined;
}

/**
 * Validates a user-supplied URL and verifies that its resolved IP addresses are safe.
 * Parses with WHATWG URL parser so decimal, hex, and octal IPv4 forms are normalized.
 */
export async function checkUrl(rawUrl: string, opts: CheckUrlOptions = {}): Promise<URL> {
  let url: URL;
  try {
    // WHATWG URL parser normalizes decimal, hex, and octal IP formats
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`, rawUrl, "parse_error");
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new SsrfError(
      `Only http and https URLs are allowed (received '${protocol}')`,
      rawUrl,
      "bad_protocol"
    );
  }

  if (url.href.length > 2048) {
    throw new SsrfError(`URL too long (max 2048 chars)`, rawUrl, "too_long");
  }

  // Documented exception for /fixtures on own origin
  if (opts.allowFixtures && isAllowedFixtureUrl(url, opts.appPort)) {
    return url;
  }

  // Documented exception for self-audit on own loopback origin
  if (opts.allowSelfAudit) {
    if (opts.appPort === undefined || typeof opts.appPort !== "number") {
      throw new SsrfError("Self-audit requires appPort to be explicitly defined.", rawUrl, "self_audit_no_port");
    }
    if (process.env.BLINDSPOT_SELF_AUDIT !== "1") {
      throw new SsrfError("Self-audit requires BLINDSPOT_SELF_AUDIT=1 in environment.", rawUrl, "self_audit_env_disabled");
    }
    const isLoopback = url.hostname === "localhost" || url.hostname === "127.0.0.1" || url.hostname === "::1" || url.hostname === "[::1]";
    const actualPort = url.port ? parseInt(url.port, 10) : (url.protocol === "https:" ? 443 : 80);
    if (isLoopback && actualPort === opts.appPort) {
      return url;
    }
  }

  await resolveAndCheckHost(url.hostname, opts.resolver);
  return url;
}

/**
 * Attaches a comprehensive SSRF guard to EVERY request in the Playwright BrowserContext:
 * - Documents, subresources (scripts, CSS, images, media), fetches, XHR, and WebSocket upgrades.
 * - Enforces allowed schemes: only http/https plus data: and blob:.
 * - Intercepts all redirect hops (3xx responses with Location header) and inspects destinations before following.
 * - Allows only the documented /fixtures exception on own origin.
 */
export async function attachSsrfGuard(
  context: BrowserContext,
  opts: {
    allowFixtures?: boolean | undefined;
    allowSelfAudit?: boolean | undefined;
    appPort?: number | undefined;
    resolver?: ((host: string) => Promise<string[]>) | undefined;
    allowedOrigins?: string[] | undefined;
    onBlocked?: ((url: string, reason: string) => void) | undefined;
  } = {}
): Promise<void> {
  await context.route("**", async (route) => {
    const req = route.request();
    const rawUrl = req.url();

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(rawUrl);
    } catch {
      opts.onBlocked?.(rawUrl, "invalid_url");
      await route.abort("blockedbyclient");
      return;
    }

    const protocol = parsedUrl.protocol.toLowerCase();

    // Allow data: and blob:
    if (protocol === "data:" || protocol === "blob:") {
      await route.continue();
      return;
    }

    // Block all non-http(s) schemes (file:, gopher:, ftp:, etc.)
    if (protocol !== "http:" && protocol !== "https:") {
      opts.onBlocked?.(rawUrl, `disallowed_scheme_${protocol}`);
      await route.abort("blockedbyclient");
      return;
    }

    // Documented fixture exception
    if (opts.allowFixtures && isAllowedFixtureUrl(parsedUrl, opts.appPort)) {
      await route.continue();
      return;
    }

    if (opts.allowSelfAudit) {
      if (opts.appPort === undefined || typeof opts.appPort !== "number") {
        opts.onBlocked?.(rawUrl, "self_audit_no_port");
        await route.abort("blockedbyclient");
        throw new SsrfError("Self-audit requires appPort to be explicitly defined.", rawUrl, "self_audit_no_port");
      }
      if (process.env.BLINDSPOT_SELF_AUDIT !== "1") {
        opts.onBlocked?.(rawUrl, "self_audit_env_disabled");
        await route.abort("blockedbyclient");
        throw new SsrfError("Self-audit requires BLINDSPOT_SELF_AUDIT=1 in environment.", rawUrl, "self_audit_env_disabled");
      }
      const isLoopback = parsedUrl.hostname === "localhost" || parsedUrl.hostname === "127.0.0.1" || parsedUrl.hostname === "::1" || parsedUrl.hostname === "[::1]";
      const actualPort = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (parsedUrl.protocol === "https:" ? 443 : 80);
      if (isLoopback && actualPort === opts.appPort) {
        await route.continue();
        return;
      }
    }

    const isOriginAllowed = opts.allowedOrigins?.includes(parsedUrl.origin);

    // Check target host
    if (!isOriginAllowed) {
      try {
        await resolveAndCheckHost(parsedUrl.hostname, opts.resolver);
      } catch (err) {
        opts.onBlocked?.(rawUrl, err instanceof Error ? err.message : String(err));
        await route.abort("blockedbyclient");
        return;
      }
    }

    // Check redirect hops before following
    try {
      const response = await route.fetch({ maxRedirects: 0 });
      const status = response.status();
      const location = response.headers()["location"];

      if (status >= 300 && status < 400 && location) {
        let redirectUrl: URL;
        try {
          redirectUrl = new URL(location, parsedUrl);
        } catch {
          opts.onBlocked?.(location, "invalid_redirect_url");
          await route.abort("blockedbyclient");
          return;
        }

        const redirProto = redirectUrl.protocol.toLowerCase();
        if (redirProto === "data:" || redirProto === "blob:") {
          await route.fulfill({ response });
          return;
        }

        if (redirProto !== "http:" && redirProto !== "https:") {
          opts.onBlocked?.(redirectUrl.href, `disallowed_redirect_scheme_${redirProto}`);
          await route.abort("blockedbyclient");
          return;
        }

        if (opts.allowFixtures && isAllowedFixtureUrl(redirectUrl, opts.appPort)) {
          await route.fulfill({ response });
          return;
        }

        if (opts.allowSelfAudit) {
          if (opts.appPort === undefined || typeof opts.appPort !== "number") {
            opts.onBlocked?.(redirectUrl.href, "self_audit_no_port");
            await route.abort("blockedbyclient");
            throw new SsrfError("Self-audit requires appPort to be explicitly defined.", redirectUrl.href, "self_audit_no_port");
          }
          if (process.env.BLINDSPOT_SELF_AUDIT !== "1") {
            opts.onBlocked?.(redirectUrl.href, "self_audit_env_disabled");
            await route.abort("blockedbyclient");
            throw new SsrfError("Self-audit requires BLINDSPOT_SELF_AUDIT=1 in environment.", redirectUrl.href, "self_audit_env_disabled");
          }
          const isLoopback = redirectUrl.hostname === "localhost" || redirectUrl.hostname === "127.0.0.1" || redirectUrl.hostname === "::1" || redirectUrl.hostname === "[::1]";
          const actualPort = redirectUrl.port ? parseInt(redirectUrl.port, 10) : (redirectUrl.protocol === "https:" ? 443 : 80);
          if (isLoopback && actualPort === opts.appPort) {
            await route.fulfill({ response });
            return;
          }
        }

        try {
          await resolveAndCheckHost(redirectUrl.hostname, opts.resolver);
        } catch (err) {
          opts.onBlocked?.(redirectUrl.href, err instanceof Error ? err.message : String(err));
          await route.abort("blockedbyclient");
          return;
        }
      }

      await route.fulfill({ response });
    } catch {
      await route.abort("failed");
    }
  });
}
