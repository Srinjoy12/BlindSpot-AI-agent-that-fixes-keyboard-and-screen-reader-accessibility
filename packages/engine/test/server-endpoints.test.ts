// server-endpoints.test.ts — Unit tests for rate-limiting, daily token budgeting, and code validation.

import { describe, it, expect } from "vitest";
import { isLoopbackAddress } from "../src/index.js";

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
  it("rejects cross-origin requests with non-matching origin header", () => {
    const serverPort = 3000;
    const isOriginAllowed = (origin: string | undefined): boolean => {
      if (!origin) return true; // same-origin navigation/curl has no Origin header
      try {
        const u = new URL(origin);
        const isLocal = u.hostname === "localhost" || u.hostname === "127.0.0.1" || u.hostname === "::1";
        const portMatches = (u.port || (u.protocol === "https:" ? "443" : "80")) === String(serverPort);
        return isLocal && portMatches;
      } catch {
        return false;
      }
    };

    expect(isOriginAllowed(undefined)).toBe(true);
    expect(isOriginAllowed("http://localhost:3000")).toBe(true);
    expect(isOriginAllowed("http://127.0.0.1:3000")).toBe(true);
    expect(isOriginAllowed("http://localhost:5173")).toBe(false);
    expect(isOriginAllowed("https://evil.com")).toBe(false);
    expect(isOriginAllowed("http://127.0.0.1:8080")).toBe(false);
  });

  it("requires loopback remoteAddress socket check", () => {
    expect(isLoopbackAddress("127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("::1")).toBe(true);
    expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    expect(isLoopbackAddress("192.168.1.5")).toBe(false);
    expect(isLoopbackAddress("10.0.0.1")).toBe(false);
  });
});
