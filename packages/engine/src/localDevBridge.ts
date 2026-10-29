// localDevBridge.ts — Local dev server bridge for BlindSpot.
// Safely allows auditing running local development servers (e.g. http://localhost:5173)
// when explicitly opted-in via ENABLE_LOCAL_DEV_BRIDGE=true and user ownership attestation.
// Enforces loopback isolation, own-port rejection, HMR WebSocket gating, and redirect protection.

import net from "node:net";
import type { BrowserContext, Page } from "playwright";
import { SsrfError, blockList, resolveAndCheckHost, extractEmbeddedIpv4 } from "./ssrf.js";

export interface ValidateLocalDevUrlOptions {
  attested: boolean;
  ownPort?: number | undefined;
  envFlag?: string | undefined; // Defaults to process.env.ENABLE_LOCAL_DEV_BRIDGE
}

/**
 * Checks whether a hostname is a valid loopback host:
 * - "localhost"
 * - IPv4 in 127.0.0.0/8 (e.g. 127.0.0.1, 127.0.0.2)
 * - IPv6 ::1
 * Rejects domain tricks like 127.0.0.1.nip.io, 127.evil.com, or 0.0.0.0.
 */
export function isLoopbackHost(hostname: string): boolean {
  const clean = hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (clean === "localhost") return true;

  const ipVer = net.isIP(clean);
  if (ipVer === 4) {
    // 127.0.0.0/8 is IPv4 loopback
    return clean.startsWith("127.");
  }
  if (ipVer === 6) {
    return clean === "::1" || clean === "0:0:0:0:0:0:0:1";
  }
  return false;
}

/**
 * Checks whether an incoming client IP address is a valid loopback address.
 * Handles IPv4 (127.0.0.1), IPv6 (::1), and IPv4-mapped IPv6 (::ffff:127.0.0.1).
 */
export function isLoopbackAddress(remoteAddress: string | undefined): boolean {
  if (!remoteAddress) return false;
  const cleaned = remoteAddress.trim().toLowerCase().replace(/^\[|\]$/g, "");
  if (cleaned === "127.0.0.1" || cleaned === "::1" || cleaned === "localhost") return true;

  const embedded = extractEmbeddedIpv4(cleaned);
  if (embedded && embedded.startsWith("127.")) {
    return true;
  }

  if (net.isIP(cleaned) === 4 && cleaned.startsWith("127.")) {
    return true;
  }

  return false;
}

export interface BridgeRequestSecurityInput {
  origin?: string | undefined;
  host?: string | undefined;
  remoteAddress?: string | undefined;
  attested?: boolean | undefined;
  serverPort: number;
  envFlag?: string | undefined; // Defaults to process.env.ENABLE_LOCAL_DEV_BRIDGE
}

export interface BridgeRequestSecurityResult {
  valid: boolean;
  status: number;
  error?: string | undefined;
}

/**
 * Validates security invariants for incoming HTTP requests to the local dev bridge endpoint:
 * 1. Feature flag: ENABLE_LOCAL_DEV_BRIDGE must be "true".
 * 2. Origin check: Origin header must match BlindSpot server or be absent (same-origin / curl).
 * 3. Host header check: Must match loopback (localhost/127.0.0.1/[::1]) and BlindSpot server port.
 * 4. Socket remoteAddress check: Connection must originate from a loopback address.
 * 5. Ownership attestation: Caller must attest they own/run the target dev server.
 */
export function validateBridgeRequestSecurity(
  input: BridgeRequestSecurityInput
): BridgeRequestSecurityResult {
  const envFlag = input.envFlag ?? process.env.ENABLE_LOCAL_DEV_BRIDGE;

  // 1. Feature flag gating
  if (envFlag !== "true") {
    return {
      valid: false,
      status: 403,
      error: "Local dev server bridge is disabled. Set ENABLE_LOCAL_DEV_BRIDGE=true in the environment to enable local dev server auditing.",
    };
  }

  // 2. Same-Origin check: Origin header must match BlindSpot server or be absent
  if (input.origin) {
    try {
      const u = new URL(input.origin);
      const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
      const portMatches = (u.port || (u.protocol === "https:" ? "443" : "80")) === String(input.serverPort);
      if (!isLocal || !portMatches) {
        return {
          valid: false,
          status: 403,
          error: "Cross-origin requests to local dev bridge are forbidden.",
        };
      }
    } catch {
      return {
        valid: false,
        status: 400,
        error: "Invalid Origin header.",
      };
    }
  }

  // 3. Host header check (DNS rebinding protection: localhost / 127.0.0.1 / [::1] + own port)
  if (!input.host) {
    return {
      valid: false,
      status: 400,
      error: "Host header is required.",
    };
  }
  const hostMatch = input.host.match(/^(?:localhost|127\.0\.0\.1|\[::1\])(?::(\d+))?$/i);
  if (!hostMatch) {
    return {
      valid: false,
      status: 403,
      error: `Invalid Host header '${input.host}' for local dev bridge.`,
    };
  }
  const hostPort = hostMatch[1] ? parseInt(hostMatch[1], 10) : 80;
  if (hostPort !== input.serverPort) {
    return {
      valid: false,
      status: 403,
      error: `Host port '${hostPort}' does not match BlindSpot server port '${input.serverPort}'.`,
    };
  }

  // 4. Loopback remoteAddress check
  if (!isLoopbackAddress(input.remoteAddress)) {
    return {
      valid: false,
      status: 403,
      error: `Dev server bridge only accepts connections from loopback addresses. Received: '${input.remoteAddress}'. If running in Docker, see limitations.md regarding host networking.`,
    };
  }

  // 5. Ownership attestation
  if (!input.attested) {
    return {
      valid: false,
      status: 400,
      error: "Ownership attestation is required to audit a local development server.",
    };
  }

  return { valid: true, status: 200 };
}

/**
 * Validates a target URL for the local dev server bridge.
 * Requirements:
 * 1. ENABLE_LOCAL_DEV_BRIDGE === "true"
 * 2. Ownership attestation ticked (attested: true)
 * 3. Host is strictly loopback (localhost, 127.0.0.1, ::1, 127.0.0.0/8)
 * 4. Userinfo (username/password) is prohibited
 * 5. Explicit non-zero port provided
 * 6. Port must NOT match the BlindSpot server's own port
 * 7. Scheme must be http or https
 */
export function validateLocalDevUrl(
  rawUrl: string,
  opts: ValidateLocalDevUrlOptions
): URL {
  const isEnabled = (opts.envFlag ?? process.env.ENABLE_LOCAL_DEV_BRIDGE) === "true";
  if (!isEnabled) {
    throw new SsrfError(
      "Local dev server bridge is disabled. Set ENABLE_LOCAL_DEV_BRIDGE=true in the environment to enable local dev server auditing.",
      rawUrl,
      "bridge_disabled"
    );
  }

  if (!opts.attested) {
    throw new SsrfError(
      "Ownership attestation is required to audit local development servers.",
      rawUrl,
      "attestation_required"
    );
  }

  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`, rawUrl, "parse_error");
  }

  // Reject userinfo (e.g. http://localhost:5173@evil.com)
  if (url.username || url.password) {
    throw new SsrfError(
      "Userinfo (username/password) is not permitted in local dev bridge URLs.",
      rawUrl,
      "userinfo_not_permitted"
    );
  }

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new SsrfError(
      `Only http and https protocols are allowed for local dev bridge (received '${protocol}')`,
      rawUrl,
      "bad_protocol"
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!isLoopbackHost(hostname)) {
    throw new SsrfError(
      `Target host '${hostname}' is not a permitted loopback address. Local dev bridge permits localhost / 127.0.0.1 / ::1 only.`,
      rawUrl,
      "non_loopback_host"
    );
  }

  // Explicit port requirement
  if (!url.port || url.port === "") {
    throw new SsrfError(
      "Local dev bridge URLs must specify an explicit port (e.g. http://localhost:5173). Default ports 80/443 without an explicit port are not permitted.",
      rawUrl,
      "missing_port"
    );
  }

  const portNum = parseInt(url.port, 10);
  if (isNaN(portNum) || portNum <= 0 || portNum > 65535) {
    throw new SsrfError(
      `Invalid port number '${url.port}' specified for local dev bridge.`,
      rawUrl,
      "invalid_port"
    );
  }

  // Own port rejection
  if (opts.ownPort !== undefined && portNum === opts.ownPort) {
    throw new SsrfError(
      `Target port ${portNum} matches the BlindSpot server's own port. Self-targeting on the local dev bridge is prohibited.`,
      rawUrl,
      "own_port_collision"
    );
  }

  return url;
}

export interface LocalDevBridgeGuardOptions {
  devOrigin: string; // e.g. "http://localhost:5173"
  devPort: number;
  ownPort?: number | undefined;
  resolver?: ((host: string) => Promise<string[]>) | undefined;
  onBlocked?: ((url: string, reason: string) => void) | undefined;
}

/**
 * Attaches the local dev server bridge guard to a Playwright BrowserContext.
 * Rules:
 * - Documents, subresources, and fetches to the target dev server (same host + same port) are allowed.
 * - HMR WebSockets (ws: or wss:) are allowed ONLY to the exact audited dev server port.
 * - Cross-port loopback requests (e.g. to localhost:3000, 8080, etc.) are strictly blocked.
 * - Public external requests (e.g. CDNs or external APIs) are checked against the standard SSRF blockList.
 * - Avoids buffering streaming responses (EventSource/SSE for Next.js/Vite HMR): uses route.continue()
 *   for subresources/fetches while Chromium re-routes redirect hops through context.route("**").
 * - Only uses route.fetch({ maxRedirects: 0 }) for top-level document navigations to inspect redirects.
 */
export async function attachLocalDevBridgeGuard(
  context: BrowserContext,
  opts: LocalDevBridgeGuardOptions
): Promise<void> {
  const allowedPort = opts.devPort;

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
    const cleanHost = parsedUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
    const isLoopback = isLoopbackHost(cleanHost);

    // 1. Data: and Blob: are allowed
    if (protocol === "data:" || protocol === "blob:") {
      await route.continue();
      return;
    }

    // 2. WebSocket Support (for Vite/Webpack HMR)
    if (protocol === "ws:" || protocol === "wss:") {
      const port = parsedUrl.port ? parseInt(parsedUrl.port, 10) : (protocol === "wss:" ? 443 : 80);
      if (isLoopback && port === allowedPort) {
        await route.continue();
        return;
      }
      opts.onBlocked?.(rawUrl, "disallowed_websocket_destination");
      await route.abort("blockedbyclient");
      return;
    }

    // 3. Reject other non-http(s) schemes
    if (protocol !== "http:" && protocol !== "https:") {
      opts.onBlocked?.(rawUrl, `disallowed_scheme_${protocol}`);
      await route.abort("blockedbyclient");
      return;
    }

    const actualPort = parsedUrl.port
      ? parseInt(parsedUrl.port, 10)
      : (protocol === "https:" ? 443 : 80);

    // 4. Loopback handling: ONLY allowed on the exact devPort
    if (isLoopback) {
      if (actualPort !== allowedPort) {
        opts.onBlocked?.(rawUrl, `cross_port_loopback_blocked_${actualPort}`);
        await route.abort("blockedbyclient");
        return;
      }
    } else {
      // 5. Public / External handling: must pass SSRF resolveAndCheckHost
      try {
        await resolveAndCheckHost(parsedUrl.hostname, opts.resolver);
      } catch (err) {
        opts.onBlocked?.(rawUrl, err instanceof Error ? err.message : String(err));
        await route.abort("blockedbyclient");
        return;
      }
    }

    // 6. Navigation vs Subresource handling:
    // Avoid buffering streaming responses (Next.js/Vite HMR EventSource, chunked SSE):
    // Only use route.fetch({ maxRedirects: 0 }) for document navigations.
    // For other requests, validate the URL and call route.continue(), relying on Chromium
    // re-routing redirect hops back through context.route("**").
    const isDocumentNavigation =
      req.isNavigationRequest() && (req.resourceType() === "document" || req.resourceType() === "");

    if (!isDocumentNavigation) {
      await route.continue();
      return;
    }

    // 7. Inspect document navigation redirects before following
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

        const redirHost = redirectUrl.hostname.toLowerCase().replace(/^\[|\]$/g, "");
        const isRedirLoopback = isLoopbackHost(redirHost);
        const redirPort = redirectUrl.port
          ? parseInt(redirectUrl.port, 10)
          : (redirProto === "https:" ? 443 : 80);

        if (isRedirLoopback) {
          if (redirPort === allowedPort) {
            await route.fulfill({ response });
            return;
          }
          opts.onBlocked?.(redirectUrl.href, `cross_port_loopback_redirect_blocked_${redirPort}`);
          await route.abort("blockedbyclient");
          return;
        }

        // Validate public destination
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
