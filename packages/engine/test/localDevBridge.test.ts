// localDevBridge.test.ts — Comprehensive test suite for the Local Dev Server Bridge.
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import http from "node:http";
import { chromium, type Browser } from "playwright";
import {
  validateLocalDevUrl,
  attachLocalDevBridgeGuard,
  isLoopbackAddress,
  startLocalDevSession,
} from "../src/index.js";
import { SsrfError } from "../src/ssrf.js";

describe("Local Dev Server Bridge (validateLocalDevUrl)", () => {
  const originalEnv = process.env.ENABLE_LOCAL_DEV_BRIDGE;

  afterEach(() => {
    if (originalEnv !== undefined) {
      process.env.ENABLE_LOCAL_DEV_BRIDGE = originalEnv;
    } else {
      delete process.env.ENABLE_LOCAL_DEV_BRIDGE;
    }
  });

  describe("1. Flag-Off and Attestation Invariants", () => {
    it("rejects local dev URLs when ENABLE_LOCAL_DEV_BRIDGE is not set", () => {
      delete process.env.ENABLE_LOCAL_DEV_BRIDGE;
      expect(() =>
        validateLocalDevUrl("http://localhost:5173", { attested: true })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://localhost:5173", { attested: true })
      ).toThrow(/bridge is disabled/i);
    });

    it("rejects local dev URLs when ENABLE_LOCAL_DEV_BRIDGE is false", () => {
      process.env.ENABLE_LOCAL_DEV_BRIDGE = "false";
      expect(() =>
        validateLocalDevUrl("http://localhost:5173", { attested: true })
      ).toThrow(SsrfError);
    });

    it("rejects local dev URLs when flag is true but ownership attestation is false", () => {
      process.env.ENABLE_LOCAL_DEV_BRIDGE = "true";
      expect(() =>
        validateLocalDevUrl("http://localhost:5173", { attested: false })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://localhost:5173", { attested: false })
      ).toThrow(/attestation is required/i);
    });
  });

  describe("2. Own-Port & Explicit Port Constraints", () => {
    beforeEach(() => {
      process.env.ENABLE_LOCAL_DEV_BRIDGE = "true";
    });

    it("rejects URLs targeting the BlindSpot server's own port (e.g. 3000)", () => {
      expect(() =>
        validateLocalDevUrl("http://localhost:3000", { attested: true, ownPort: 3000 })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://localhost:3000", { attested: true, ownPort: 3000 })
      ).toThrow(/own port/i);
    });

    it("rejects URLs targeting the BlindSpot server's own port on 127.0.0.1", () => {
      expect(() =>
        validateLocalDevUrl("http://127.0.0.1:3000", { attested: true, ownPort: 3000 })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://127.0.0.1:3000", { attested: true, ownPort: 3000 })
      ).toThrow(/own port/i);
    });

    it("rejects URLs with no explicit port specified", () => {
      expect(() =>
        validateLocalDevUrl("http://localhost", { attested: true, ownPort: 3000 })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://localhost", { attested: true, ownPort: 3000 })
      ).toThrow(/explicit port/i);

      expect(() =>
        validateLocalDevUrl("http://127.0.0.1/", { attested: true, ownPort: 3000 })
      ).toThrow(SsrfError);
    });

    it("rejects invalid non-numeric or out-of-range ports", () => {
      expect(() =>
        validateLocalDevUrl("http://localhost:0", { attested: true, ownPort: 3000 })
      ).toThrow(SsrfError);

      expect(() =>
        validateLocalDevUrl("http://localhost:70000", { attested: true, ownPort: 3000 })
      ).toThrow(SsrfError);
    });
  });

  describe("3. Host Isolation (Loopback Only)", () => {
    beforeEach(() => {
      process.env.ENABLE_LOCAL_DEV_BRIDGE = "true";
    });

    it("permits standard loopback dev server targets with explicit ports", () => {
      const u1 = validateLocalDevUrl("http://localhost:5173", { attested: true, ownPort: 3000 });
      expect(u1.hostname).toBe("localhost");
      expect(u1.port).toBe("5173");

      const u2 = validateLocalDevUrl("http://127.0.0.1:8080/app", { attested: true, ownPort: 3000 });
      expect(u2.hostname).toBe("127.0.0.1");
      expect(u2.port).toBe("8080");

      const u3 = validateLocalDevUrl("http://[::1]:4000", { attested: true, ownPort: 3000 });
      expect(u3.port).toBe("4000");

      const u4 = validateLocalDevUrl("http://127.0.0.2:5173", { attested: true, ownPort: 3000 });
      expect(u4.hostname).toBe("127.0.0.2");
      expect(u4.port).toBe("5173");
    });

    it("rejects userinfo injection tricks (e.g. http://localhost:5173@evil.com)", () => {
      expect(() =>
        validateLocalDevUrl("http://localhost:5173@evil.com", { attested: true })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://localhost:5173@evil.com", { attested: true })
      ).toThrow(/userinfo/i);
    });

    it("rejects DNS rebinding / wildcard domains like 127.0.0.1.nip.io", () => {
      expect(() =>
        validateLocalDevUrl("http://127.0.0.1.nip.io:5173", { attested: true })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://127.0.0.1.nip.io:5173", { attested: true })
      ).toThrow(/not a permitted loopback/i);

      expect(() =>
        validateLocalDevUrl("http://127.evil.com:5173", { attested: true })
      ).toThrow(SsrfError);
    });

    it("rejects 0.0.0.0 (INADDR_ANY)", () => {
      expect(() =>
        validateLocalDevUrl("http://0.0.0.0:5173", { attested: true })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://0.0.0.0:5173", { attested: true })
      ).toThrow(/not a permitted loopback/i);
    });

    it("strictly blocks private RFC 1918 subnets even when bridge flag is on", () => {
      expect(() =>
        validateLocalDevUrl("http://10.0.0.1:5173", { attested: true })
      ).toThrow(SsrfError);

      expect(() =>
        validateLocalDevUrl("http://192.168.1.50:3000", { attested: true })
      ).toThrow(SsrfError);

      expect(() =>
        validateLocalDevUrl("http://172.16.0.5:8080", { attested: true })
      ).toThrow(SsrfError);
    });

    it("strictly blocks link-local and cloud metadata addresses", () => {
      expect(() =>
        validateLocalDevUrl("http://169.254.169.254:80", { attested: true })
      ).toThrow(SsrfError);
    });

    it("strictly blocks public domains on the dev bridge route", () => {
      expect(() =>
        validateLocalDevUrl("http://example.com:5173", { attested: true })
      ).toThrow(SsrfError);
      expect(() =>
        validateLocalDevUrl("http://google.com:8080", { attested: true })
      ).toThrow(/not a permitted loopback/i);
    });
  });

  describe("4. Remote Address Check (isLoopbackAddress)", () => {
    it("identifies IPv4 loopback addresses", () => {
      expect(isLoopbackAddress("127.0.0.1")).toBe(true);
      expect(isLoopbackAddress("127.0.1.1")).toBe(true);
    });

    it("identifies IPv6 loopback addresses", () => {
      expect(isLoopbackAddress("::1")).toBe(true);
      expect(isLoopbackAddress("[::1]")).toBe(true);
    });

    it("identifies IPv4-mapped loopback addresses", () => {
      expect(isLoopbackAddress("::ffff:127.0.0.1")).toBe(true);
    });

    it("rejects non-loopback remote addresses", () => {
      expect(isLoopbackAddress(undefined)).toBe(false);
      expect(isLoopbackAddress("10.0.0.1")).toBe(false);
      expect(isLoopbackAddress("192.168.1.100")).toBe(false);
      expect(isLoopbackAddress("169.254.169.254")).toBe(false);
      expect(isLoopbackAddress("8.8.8.8")).toBe(false);
    });
  });

  describe("5. In-Session Local Dev Bridge Guard (attachLocalDevBridgeGuard)", () => {
    let browser: Browser;
    let devServer: http.Server;
    let devPort: number;
    let blockedEvents: { url: string; reason: string }[] = [];

    beforeEach(async () => {
      process.env.ENABLE_LOCAL_DEV_BRIDGE = "true";
      blockedEvents = [];

      // Create dummy local dev server
      devServer = http.createServer((req, res) => {
        if (req.url === "/api/cross-fetch") {
          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ ok: true }));
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><body><h1>Dev Server</h1></body></html>`);
      });

      await new Promise<void>((resolve) => {
        devServer.listen(0, "127.0.0.1", () => {
          const addr = devServer.address() as any;
          devPort = addr.port;
          resolve();
        });
      });

      browser = await chromium.launch({ headless: true });
    });

    afterEach(async () => {
      await browser.close().catch(() => {});
      await new Promise<void>((resolve) => devServer.close(() => resolve()));
    });

    it("allows requests to the audited dev server origin and port", async () => {
      const context = await browser.newContext();
      await attachLocalDevBridgeGuard(context, {
        devOrigin: `http://127.0.0.1:${devPort}`,
        devPort,
        ownPort: 3000,
        onBlocked: (url, reason) => blockedEvents.push({ url, reason }),
      });

      const page = await context.newPage();
      const response = await page.goto(`http://127.0.0.1:${devPort}`, { waitUntil: "domcontentloaded" });
      expect(response?.status()).toBe(200);
      expect(blockedEvents.length).toBe(0);
      await context.close();
    });

    it("blocks cross-port loopback requests (e.g. dev server script fetching localhost:8080)", async () => {
      const context = await browser.newContext();
      await attachLocalDevBridgeGuard(context, {
        devOrigin: `http://127.0.0.1:${devPort}`,
        devPort,
        ownPort: 3000,
        onBlocked: (url, reason) => blockedEvents.push({ url, reason }),
      });

      const page = await context.newPage();
      await page.goto(`http://127.0.0.1:${devPort}`, { waitUntil: "domcontentloaded" });

      // Attempt to fetch another loopback port from inside the page
      const fetchFailed = await page.evaluate(async () => {
        try {
          await fetch("http://127.0.0.1:8080/secrets");
          return false;
        } catch {
          return true; // Expected to fail due to route abort
        }
      });

      expect(fetchFailed).toBe(true);
      expect(blockedEvents.some((e) => e.reason.includes("cross_port_loopback_blocked_8080"))).toBe(true);
      await context.close();
    });

    it("blocks redirects from the dev server to a private or metadata address", async () => {
      // Create a dev server that issues a redirect to 169.254.169.254
      const redirectServer = http.createServer((req, res) => {
        res.writeHead(302, { Location: "http://169.254.169.254/latest/meta-data/" });
        res.end();
      });

      let redirPort = 0;
      await new Promise<void>((resolve) => {
        redirectServer.listen(0, "127.0.0.1", () => {
          redirPort = (redirectServer.address() as any).port;
          resolve();
        });
      });

      try {
        const context = await browser.newContext();
        await attachLocalDevBridgeGuard(context, {
          devOrigin: `http://127.0.0.1:${redirPort}`,
          devPort: redirPort,
          ownPort: 3000,
          onBlocked: (url, reason) => blockedEvents.push({ url, reason }),
        });

        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${redirPort}`, { timeout: 3000 }).catch(() => {});
        expect(blockedEvents.some((e) => e.url.includes("169.254.169.254"))).toBe(true);
        await context.close();
      } finally {
        await new Promise<void>((res) => redirectServer.close(() => res()));
      }
    });

    it("blocks redirects from audited origin to a different loopback port (cross-port redirect)", async () => {
      // Create target loopback server on a second port
      const targetServer = http.createServer((req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" });
        res.end("secret admin");
      });
      let targetPort = 0;
      await new Promise<void>((resolve) => {
        targetServer.listen(0, "127.0.0.1", () => {
          targetPort = (targetServer.address() as any).port;
          resolve();
        });
      });

      // Create audited server that redirects to targetPort
      const redirectServer = http.createServer((req, res) => {
        res.writeHead(302, { Location: `http://127.0.0.1:${targetPort}/admin` });
        res.end();
      });
      let auditedPort = 0;
      await new Promise<void>((resolve) => {
        redirectServer.listen(0, "127.0.0.1", () => {
          auditedPort = (redirectServer.address() as any).port;
          resolve();
        });
      });

      try {
        const context = await browser.newContext();
        await attachLocalDevBridgeGuard(context, {
          devOrigin: `http://127.0.0.1:${auditedPort}`,
          devPort: auditedPort,
          ownPort: 3000,
          onBlocked: (url, reason) => blockedEvents.push({ url, reason }),
        });

        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${auditedPort}`, { timeout: 3000 }).catch(() => {});

        expect(
          blockedEvents.some(
            (e) =>
              e.reason.includes(`cross_port_loopback_redirect_blocked_${targetPort}`) ||
              e.url.includes(String(targetPort))
          )
        ).toBe(true);
        await context.close();
      } finally {
        await new Promise<void>((res) => redirectServer.close(() => res()));
        await new Promise<void>((res) => targetServer.close(() => res()));
      }
    });

    it("supports streaming endpoints (Next.js HMR EventSource / chunked SSE) without hanging", async () => {
      // Create server with an SSE streaming endpoint
      const sseServer = http.createServer((req, res) => {
        if (req.url === "/events") {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
          });
          res.write("data: ping\n\n");
          // Keep connection open indefinitely like real HMR SSE
          return;
        }
        res.writeHead(200, { "Content-Type": "text/html" });
        res.end(`<!DOCTYPE html><html><body><h1>HMR SSE Test</h1></body></html>`);
      });

      let ssePort = 0;
      await new Promise<void>((resolve) => {
        sseServer.listen(0, "127.0.0.1", () => {
          ssePort = (sseServer.address() as any).port;
          resolve();
        });
      });

      try {
        const context = await browser.newContext();
        await attachLocalDevBridgeGuard(context, {
          devOrigin: `http://127.0.0.1:${ssePort}`,
          devPort: ssePort,
          ownPort: 3000,
          onBlocked: (url, reason) => blockedEvents.push({ url, reason }),
        });

        const page = await context.newPage();
        await page.goto(`http://127.0.0.1:${ssePort}`, { waitUntil: "domcontentloaded" });

        // Connect to the EventSource stream from inside the page
        const messageReceived = await page.evaluate(async () => {
          return new Promise<string>((resolve, reject) => {
            const timeout = setTimeout(() => reject(new Error("EventSource timed out")), 2000);
            const es = new EventSource("/events");
            es.onmessage = (event) => {
              clearTimeout(timeout);
              es.close();
              resolve(event.data);
            };
            es.onerror = (err) => {
              clearTimeout(timeout);
              es.close();
              reject(new Error("EventSource error"));
            };
          });
        });

        expect(messageReceived).toBe("ping");
        expect(blockedEvents.length).toBe(0);
        await context.close();
      } finally {
        await new Promise<void>((res) => sseServer.close(() => res()));
      }
    });
  });
});
