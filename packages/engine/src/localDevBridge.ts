// localDevBridge.ts — Local dev server bridge for BlindSpot.
// Safely allows auditing running local development servers (e.g. http://localhost:5173)
// when explicitly opted-in via ENABLE_LOCAL_DEV_BRIDGE=true and user ownership attestation.
// Enforces loopback isolation, own-port rejection, HMR WebSocket gating, and redirect protection.

import net from "node:net";
import type { BrowserContext, Page } from "playwright";
import { SsrfError, blockList, resolveAndCheckHost, extractEmbeddedIpv4 } from "./ssrf.js";

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);

export interface ValidateLocalDevUrlOptions {
  attested: boolean;
  ownPort?: number | undefined;
  envFlag?: string | undefined; // Defaults to process.env.ENABLE_LOCAL_DEV_BRIDGE
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

/**
 * Validates a target URL for the local dev server bridge.
 * Requirements:
 * 1. ENABLE_LOCAL_DEV_BRIDGE === "true"
 * 2. Ownership attestation ticked (attested: true)
 * 3. Host is strictly loopback (localhost, 127.0.0.1, ::1)
 * 4. Explicit non-zero port provided
 * 5. Port must NOT match the BlindSpot server's own port
 * 6. Scheme must be http or https
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

  const protocol = url.protocol.toLowerCase();
  if (protocol !== "http:" && protocol !== "https:") {
    throw new SsrfError(
      `Only http and https protocols are allowed for local dev bridge (received '${protocol}')`,
      rawUrl,
      "bad_protocol"
    );
  }

  const hostname = url.hostname.toLowerCase().replace(/^\[|\]$/g, "");
  if (!LOOPBACK_HOSTS.has(hostname) && !hostname.startsWith("127.")) {
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
 * - Redirects are inspected: redirecting to a different loopback port or private/metadata address is blocked.
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
    const isLoopback = LOOPBACK_HOSTS.has(cleanHost) || cleanHost.startsWith("127.");

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

    // 6. Redirect inspection before following
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
        const isRedirLoopback = LOOPBACK_HOSTS.has(redirHost) || redirHost.startsWith("127.");
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
