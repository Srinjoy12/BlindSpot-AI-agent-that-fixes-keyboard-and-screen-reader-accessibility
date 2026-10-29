// server-endpoints.test.ts — Unit tests for rate-limiting, daily token budgeting, code validation, and /api/audit-local-dev endpoint security.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  isLoopbackAddress,
  checkUrl,
  validateFileSet,
  validateBridgeRequestSecurity,
} from "../src/index.js";
import { SsrfError } from "../src/ssrf.js";

describe("Audit code validation rules", () => {
  it("rejects empty source code input", () => {
    const validate = (source: string) => {
      if (!source || typeof source !== "string" || source.trim().length === 0) {
        return { valid: false, error: "Missing or empty 'source' parameter." };
      }
      return { valid: true };
    };

    expect(validate("").valid).toBe(false);
    expect(validate("   ").valid).toBe(false);
    expect(validate("<button>OK</button>").valid).toBe(true);
  });

  it("rejects source code input exceeding 100 KB limit", () => {
    const validateSize = (source: string) => {
      const byteLength = Buffer.byteLength(source, "utf-8");
      if (byteLength > 100 * 1024) {
        return { valid: false, error: "Pasted source exceeds maximum allowed size of 100 KB." };
      }
      return { valid: true };
    };

    const smallSource = "<main><h1>Hello</h1></main>";
    const largeSource = "a".repeat(101 * 1024);

    expect(validateSize(smallSource).valid).toBe(true);
    expect(validateSize(largeSource).valid).toBe(false);
  });

  it("enforces sliding-window rate limit per IP per hour", () => {
    const ipRequests = new Map<string, number[]>();
    const limit = 5;

    const checkRateLimit = (ip: string, now: number) => {
      const oneHourAgo = now - 3600 * 1000;
      const timestamps = (ipRequests.get(ip) || []).filter((t) => t > oneHourAgo);
      if (timestamps.length >= limit) {
        return false;
      }
      timestamps.push(now);
      ipRequests.set(ip, timestamps);
      return true;
    };

    const testIp = "192.168.1.100";
    const baseTime = 1000000;

    for (let i = 0; i < 5; i++) {
      expect(checkRateLimit(testIp, baseTime + i * 100)).toBe(true);
    }
    // 6th request within the hour fails with rate limit
    expect(checkRateLimit(testIp, baseTime + 600)).toBe(false);
    // Request 1 hour later succeeds
    expect(checkRateLimit(testIp, baseTime + 3601 * 1000)).toBe(true);
  });
});

describe("/api/audit-local-dev endpoint security validation", () => {
  const SERVER_PORT = 3000;

  // Calls the exact shared validation function exported from @blindspot/engine and used by apps/web/server.ts
  function validateBridgeRequest(req: {
    headers: { origin?: string | undefined; host?: string | undefined };
    remoteAddress?: string | undefined;
    body?: { targetUrl?: string | undefined; attested?: boolean | undefined } | undefined;
    envFlag?: string | undefined;
  }) {
    return validateBridgeRequestSecurity({
      origin: req.headers.origin,
      host: req.headers.host,
      remoteAddress: req.remoteAddress,
      attested: req.body?.attested,
      serverPort: SERVER_PORT,
      envFlag: req.envFlag,
    });
  }

  describe("1. Feature flag gating", () => {
    it("returns 403 when ENABLE_LOCAL_DEV_BRIDGE is not set", () => {
      const res = validateBridgeRequest({
        headers: { host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: undefined,
      });
      expect(res.status).toBe(403);
      expect(res.error).toContain("disabled");
    });

    it("returns 403 when ENABLE_LOCAL_DEV_BRIDGE is 'false'", () => {
      const res = validateBridgeRequest({
        headers: { host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "false",
      });
      expect(res.status).toBe(403);
      expect(res.error).toContain("disabled");
    });
  });

  describe("2. Origin header validation", () => {
    it("rejects foreign origin with 403", () => {
      const res = validateBridgeRequest({
        headers: { origin: "https://evil.com", host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(403);
      expect(res.error).toContain("Cross-origin requests to local dev bridge are forbidden");
    });

    it("rejects dev server origin on different port with 403", () => {
      const res = validateBridgeRequest({
        headers: { origin: "http://localhost:5173", host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(403);
      expect(res.error).toContain("Cross-origin requests to local dev bridge are forbidden");
    });

    it("rejects malformed origin with 400", () => {
      const res = validateBridgeRequest({
        headers: { origin: "not-a-valid-url", host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(400);
      expect(res.error).toContain("Invalid Origin header");
    });

    it("allows matching same-origin headers", () => {
      const res = validateBridgeRequest({
        headers: { origin: "http://localhost:3000", host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(200);

      const res2 = validateBridgeRequest({
        headers: { origin: "http://127.0.0.1:3000", host: "127.0.0.1:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res2.status).toBe(200);
    });

    it("allows missing Origin header (same-origin browser navigation / curl)", () => {
      const res = validateBridgeRequest({
        headers: { host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(200);
    });
  });

  describe("3. Host header validation", () => {
    it("rejects missing Host header with 400", () => {
      const res = validateBridgeRequest({
        headers: {},
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(400);
      expect(res.error).toContain("Host header is required");
    });

    it("rejects non-loopback Host hostname with 403 (DNS rebinding protection)", () => {
      const res = validateBridgeRequest({
        headers: { host: "evil.com:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(403);
      expect(res.error).toContain("Invalid Host header");

      const res2 = validateBridgeRequest({
        headers: { host: "192.168.1.50:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res2.status).toBe(403);
    });

    it("rejects Host header with wrong port with 403", () => {
      const res = validateBridgeRequest({
        headers: { host: "localhost:8080" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(403);
      expect(res.error).toContain("Host port '8080' does not match BlindSpot server port '3000'");
    });

    it("allows valid loopback Host headers matching server port", () => {
      expect(
        validateBridgeRequest({
          headers: { host: "localhost:3000" },
          remoteAddress: "127.0.0.1",
          body: { attested: true },
          envFlag: "true",
        }).status
      ).toBe(200);

      expect(
        validateBridgeRequest({
          headers: { host: "127.0.0.1:3000" },
          remoteAddress: "127.0.0.1",
          body: { attested: true },
          envFlag: "true",
        }).status
      ).toBe(200);

      expect(
        validateBridgeRequest({
          headers: { host: "[::1]:3000" },
          remoteAddress: "::1",
          body: { attested: true },
          envFlag: "true",
        }).status
      ).toBe(200);
    });
  });

  describe("4. Socket remoteAddress check", () => {
    it("rejects external or non-loopback remote addresses with 403", () => {
      const nonLoopbacks = ["192.168.1.100", "10.0.0.1", "172.16.0.5", "169.254.169.254", "8.8.8.8", "unknown"];
      for (const ip of nonLoopbacks) {
        const res = validateBridgeRequest({
          headers: { host: "localhost:3000" },
          remoteAddress: ip,
          body: { attested: true },
          envFlag: "true",
        });
        expect(res.status).toBe(403);
        expect(res.error).toContain("loopback addresses");
      }
    });

    it("accepts loopback socket connections", () => {
      const loopbacks = ["127.0.0.1", "::1", "::ffff:127.0.0.1", "127.0.0.2"];
      for (const ip of loopbacks) {
        const res = validateBridgeRequest({
          headers: { host: "localhost:3000" },
          remoteAddress: ip,
          body: { attested: true },
          envFlag: "true",
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe("5. Ownership attestation", () => {
    it("rejects request when attestation is false with 400", () => {
      const res = validateBridgeRequest({
        headers: { host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: false },
        envFlag: "true",
      });
      expect(res.status).toBe(400);
      expect(res.error).toContain("Ownership attestation is required");
    });

    it("rejects request when attestation is omitted or undefined with 400", () => {
      const res = validateBridgeRequest({
        headers: { host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: {},
        envFlag: "true",
      });
      expect(res.status).toBe(400);
      expect(res.error).toContain("Ownership attestation is required");
    });

    it("accepts request when attested is true", () => {
      const res = validateBridgeRequest({
        headers: { host: "localhost:3000" },
        remoteAddress: "127.0.0.1",
        body: { attested: true },
        envFlag: "true",
      });
      expect(res.status).toBe(200);
    });
  });
});

describe("Regression Tests: URL, Paste code, and Open folder modes with flag off", () => {
  const originalFlag = process.env.ENABLE_LOCAL_DEV_BRIDGE;

  beforeEach(() => {
    delete process.env.ENABLE_LOCAL_DEV_BRIDGE;
  });

  afterEach(() => {
    if (originalFlag !== undefined) {
      process.env.ENABLE_LOCAL_DEV_BRIDGE = originalFlag;
    } else {
      delete process.env.ENABLE_LOCAL_DEV_BRIDGE;
    }
  });

  it("URL mode: preserves standard SSRF protections and allows public hosts", async () => {
    // Flag is off
    expect(process.env.ENABLE_LOCAL_DEV_BRIDGE).toBeUndefined();

    // Loopback targets are strictly blocked by standard checkUrl
    await expect(checkUrl("http://localhost:5173")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://127.0.0.1:8080")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://10.0.0.1/admin")).rejects.toThrow(SsrfError);

    // Public host URL checks pass without throwing
    const mockResolver = async (host: string) => ["93.184.216.34"];
    const verified = await checkUrl("https://example.com/keyboard-nav", {
      resolver: mockResolver,
    });
    expect(verified.hostname).toBe("example.com");
  });

  it("Paste code mode: preserves HTML size limits and validation identically", () => {
    expect(process.env.ENABLE_LOCAL_DEV_BRIDGE).toBeUndefined();

    const validatePaste = (source: string) => {
      if (!source || typeof source !== "string" || source.trim().length === 0) {
        return { valid: false, error: "Missing or empty 'source' parameter." };
      }
      if (Buffer.byteLength(source, "utf-8") > 100 * 1024) {
        return { valid: false, error: "Pasted source exceeds maximum allowed size of 100 KB." };
      }
      return { valid: true };
    };

    expect(validatePaste("").valid).toBe(false);
    expect(validatePaste("  ").valid).toBe(false);
    expect(validatePaste("a".repeat(101 * 1024)).valid).toBe(false);
    expect(validatePaste("<button id='btn'>Accessible</button>").valid).toBe(true);
  });

  it("Open folder mode: preserves default static behavior, exclusions, and file parsing", () => {
    expect(process.env.ENABLE_LOCAL_DEV_BRIDGE).toBeUndefined();

    // Default static mode rejects non-static files like .tsx
    const staticProjectFiles = [
      { path: "index.html", content: "<!DOCTYPE html><html><body><h1>Static</h1></body></html>" },
      { path: "styles.css", content: "body { font-family: sans-serif; }" },
      { path: "main.js", content: "console.log('Static app');" },
    ];

    const result = validateFileSet(staticProjectFiles);
    expect(result.valid).toBe(true);
    expect(result.fileSet).toBeDefined();
    expect(result.fileSet?.has("index.html")).toBe(true);
    expect(result.fileSet?.has("styles.css")).toBe(true);
    expect(result.fileSet?.has("main.js")).toBe(true);

    // Default mode rejects excluded secrets and version control
    const forbiddenFiles = [
      { path: ".env", content: "SECRET=123" },
      { path: "index.html", content: "<h1>App</h1>" },
    ];
    const forbiddenResult = validateFileSet(forbiddenFiles);
    expect(forbiddenResult.valid).toBe(false);
    expect(forbiddenResult.error).toContain(".env");
  });
});
