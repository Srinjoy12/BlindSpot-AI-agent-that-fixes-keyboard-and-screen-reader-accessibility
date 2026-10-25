// SSRF guard — refuses URLs that resolve to private/internal addresses.
// Call checkUrl() before passing any user-supplied URL to the browser.

import dns from "dns";
import { promisify } from "util";

const dnsLookup = promisify(dns.lookup);

// Private, loopback, link-local, and cloud metadata IP ranges (IPv4 and IPv6).
const BLOCKED_RANGES = [
  // Loopback
  /^127\./,
  /^::1$/,
  // Private
  /^10\./,
  /^172\.(1[6-9]|2[0-9]|3[01])\./,
  /^192\.168\./,
  // Link-local
  /^169\.254\./,
  /^fe80:/i,
  // Cloud metadata
  /^100\.64\./,  // CGNAT
  // IPv6 loopback / unspecified
  /^::$/,
  /^0\.0\.0\.0$/,
];

// Hostnames that should never be contacted.
const BLOCKED_HOSTNAMES = [
  "localhost",
  "metadata.google.internal",
  "169.254.169.254",
];

export class SsrfError extends Error {
  constructor(
    message: string,
    public readonly url: string,
    public readonly reason: string
  ) {
    super(message);
    this.name = "SsrfError";
  }
}

function isPrivateIp(ip: string): boolean {
  return BLOCKED_RANGES.some((re) => re.test(ip));
}

/** Validates a URL and resolves its hostname to check for SSRF risk.
 *  Throws SsrfError if the URL or its resolved IP is blocked. */
export async function checkUrl(rawUrl: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(rawUrl);
  } catch {
    throw new SsrfError(`Invalid URL: ${rawUrl}`, rawUrl, "parse_error");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new SsrfError(
      `Only http and https URLs are allowed`,
      rawUrl,
      "bad_protocol"
    );
  }

  if (url.href.length > 2048) {
    throw new SsrfError(`URL too long (max 2048 chars)`, rawUrl, "too_long");
  }

  const hostname = url.hostname.toLowerCase();

  if (BLOCKED_HOSTNAMES.includes(hostname)) {
    throw new SsrfError(
      `Hostname '${hostname}' is not allowed`,
      rawUrl,
      "blocked_hostname"
    );
  }

  // Resolve hostname → IP and check
  let address: string;
  try {
    const result = await dnsLookup(hostname);
    address = result.address;
  } catch (err) {
    throw new SsrfError(
      `Cannot resolve hostname '${hostname}': ${err instanceof Error ? err.message : err}`,
      rawUrl,
      "dns_failure"
    );
  }

  if (isPrivateIp(address)) {
    throw new SsrfError(
      `Hostname '${hostname}' resolves to a private address (${address})`,
      rawUrl,
      "private_ip"
    );
  }

  return url;
}
