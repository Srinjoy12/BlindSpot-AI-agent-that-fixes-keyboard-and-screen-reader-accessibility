// test/ssrf.test.ts — Comprehensive test suite for SSRF hardening.
// Verifies net.BlockList coverage, WHATWG IP normalization, fixture exceptions,
// stubbed DNS resolvers, Playwright request routing, redirect guards, and script fetches.

import { describe, it, expect, afterAll } from "vitest";
import http from "node:http";
import { chromium, type Browser } from "playwright";
import {
  checkUrl,
  SsrfError,
  isIpBlocked,
  isAllowedFixtureUrl,
  attachSsrfGuard,
  resolveAndCheckHost,
} from "../src/ssrf.js";

describe("SSRF Hardening Suite", () => {
  let browser: Browser | null = null;
  const serversToClose: http.Server[] = [];

  afterAll(async () => {
    if (browser) await browser.close();
    for (const s of serversToClose) {
      s.close();
    }
  });

  describe("A. IP Range BlockList Validation", () => {
    it("blocks IPv4 loopback (127.0.0.0/8)", () => {
      expect(isIpBlocked("127.0.0.1")).toBe(true);
      expect(isIpBlocked("127.0.0.2")).toBe(true);
      expect(isIpBlocked("127.255.255.254")).toBe(true);
    });

    it("blocks cloud metadata & link-local (169.254.0.0/16)", () => {
      expect(isIpBlocked("169.254.169.254")).toBe(true);
      expect(isIpBlocked("169.254.1.1")).toBe(true);
    });

    it("blocks RFC 1918 private subnets (10/8, 172.16/12, 192.168/16)", () => {
      expect(isIpBlocked("10.0.0.1")).toBe(true);
      expect(isIpBlocked("10.254.254.254")).toBe(true);
      expect(isIpBlocked("172.16.0.1")).toBe(true);
      expect(isIpBlocked("172.31.255.254")).toBe(true);
      expect(isIpBlocked("192.168.0.1")).toBe(true);
      expect(isIpBlocked("192.168.1.254")).toBe(true);
    });

    it("blocks CGNAT (100.64.0.0/10) and documentation/benchmarking ranges", () => {
      expect(isIpBlocked("100.64.0.1")).toBe(true);
      expect(isIpBlocked("100.127.255.254")).toBe(true);
      expect(isIpBlocked("192.0.2.1")).toBe(true); // TEST-NET-1
      expect(isIpBlocked("198.51.100.1")).toBe(true); // TEST-NET-2
      expect(isIpBlocked("203.0.113.1")).toBe(true); // TEST-NET-3
      expect(isIpBlocked("198.18.0.1")).toBe(true); // Benchmark
      expect(isIpBlocked("224.0.0.1")).toBe(true); // Multicast
      expect(isIpBlocked("240.0.0.1")).toBe(true); // Reserved
      expect(isIpBlocked("0.0.0.0")).toBe(true); // Current network
    });

    it("blocks IPv6 loopback (::1), unspecified (::), and private ULA (fc00::/7)", () => {
      expect(isIpBlocked("::1")).toBe(true);
      expect(isIpBlocked("::")).toBe(true);
      expect(isIpBlocked("fc00::1")).toBe(true);
      expect(isIpBlocked("fd12:3456:789a::1")).toBe(true);
      expect(isIpBlocked("fe80::1")).toBe(true); // Link-local
      expect(isIpBlocked("ff02::1")).toBe(true); // Multicast
      expect(isIpBlocked("2001:db8::1")).toBe(true); // Documentation
    });

    it("blocks IPv4-mapped and NAT64 addresses with private embedded IPv4", () => {
      expect(isIpBlocked("::ffff:127.0.0.1")).toBe(true);
      expect(isIpBlocked("::ffff:169.254.169.254")).toBe(true);
      expect(isIpBlocked("::ffff:10.0.0.1")).toBe(true);
      expect(isIpBlocked("::ffff:7f00:1")).toBe(true); // hex 127.0.0.1
      expect(isIpBlocked("64:ff9b::127.0.0.1")).toBe(true);
      expect(isIpBlocked("64:ff9b::a00:1")).toBe(true); // hex 10.0.0.1
    });

    it("permits public IPv4 and IPv6 addresses", () => {
      expect(isIpBlocked("8.8.8.8")).toBe(false);
      expect(isIpBlocked("1.1.1.1")).toBe(false);
      expect(isIpBlocked("93.184.216.34")).toBe(false);
      expect(isIpBlocked("2607:f8b0:4005:805::200e")).toBe(false);
    });
  });

  describe("B. WHATWG IP Normalization in checkUrl", () => {
    it("normalizes and blocks decimal IPv4 (e.g. 2130706433 -> 127.0.0.1)", async () => {
      await expect(checkUrl("http://2130706433/")).rejects.toThrow(SsrfError);
    });

    it("normalizes and blocks hex IPv4 (e.g. 0x7f000001 -> 127.0.0.1)", async () => {
      await expect(checkUrl("http://0x7f000001/")).rejects.toThrow(SsrfError);
      await expect(checkUrl("http://0x7f.0.0.1/")).rejects.toThrow(SsrfError);
    });

    it("normalizes and blocks octal IPv4 (e.g. 0177.0.0.1 -> 127.0.0.1)", async () => {
      await expect(checkUrl("http://0177.0.0.1/")).rejects.toThrow(SsrfError);
    });

    it("blocks IPv6 bracketed literals", async () => {
      await expect(checkUrl("http://[::1]/")).rejects.toThrow(SsrfError);
      await expect(checkUrl("http://[::ffff:127.0.0.1]/")).rejects.toThrow(SsrfError);
    });

    it("blocks prohibited non-http(s) schemes", async () => {
      await expect(checkUrl("file:///etc/shadow")).rejects.toThrow(SsrfError);
      await expect(checkUrl("gopher://127.0.0.1:70/")).rejects.toThrow(SsrfError);
      await expect(checkUrl("ftp://example.com/file")).rejects.toThrow(SsrfError);
    });
  });

  describe("C. Stubbed DNS Resolver Testing", () => {
    it("blocks hostnames that resolve to private IPv4 addresses", async () => {
      const stubbedResolver = async () => ["10.10.10.10"];
      await expect(
        checkUrl("http://my-safe-looking-domain.com", { resolver: stubbedResolver })
      ).rejects.toThrow(SsrfError);
    });

    it("blocks hostnames when ANY returned address in multi-homed DNS is private", async () => {
      // Resolves to 1 public IP and 1 private loopback IP
      const stubbedResolver = async () => ["93.184.216.34", "127.0.0.1"];
      await expect(
        checkUrl("http://multi-homed-domain.com", { resolver: stubbedResolver })
      ).rejects.toThrow(SsrfError);
    });

    it("allows hostnames that resolve strictly to public IP addresses", async () => {
      const stubbedResolver = async () => ["93.184.216.34", "93.184.216.35"];
      const url = await checkUrl("http://legit-site.org", { resolver: stubbedResolver });
      expect(url.hostname).toBe("legit-site.org");
    });
  });

  describe("D. Documented /fixtures Origin Exception & Traversal Protection", () => {
    it("allows valid benchmark fixtures on the app's own origin", () => {
      expect(
        isAllowedFixtureUrl("http://localhost:3000/fixtures/pages/B01-modal.html", 3000)
      ).toBe(true);
      expect(
        isAllowedFixtureUrl("http://127.0.0.1:3000/fixtures/manifests/B01.json", 3000)
      ).toBe(true);
    });

    it("strictly blocks path traversal to other endpoints (e.g. /api/budget)", () => {
      expect(isAllowedFixtureUrl("http://localhost:3000/api/budget", 3000)).toBe(false);
      expect(isAllowedFixtureUrl("http://localhost:3000/fixtures/../api/budget", 3000)).toBe(false);
      expect(isAllowedFixtureUrl("http://localhost:3000/fixtures/%2e%2e/api/budget", 3000)).toBe(false);
      expect(isAllowedFixtureUrl("http://localhost:3000/fixtures/..%2fapi/budget", 3000)).toBe(false);
      expect(isAllowedFixtureUrl("http://localhost:3000/fixtures%2f..%2fapi/budget", 3000)).toBe(false);
    });

    it("blocks requests on differing ports", () => {
      expect(
        isAllowedFixtureUrl("http://localhost:8080/fixtures/pages/B01-modal.html", 3000)
      ).toBe(false);
    });

    it("blocks fixture paths on external hostnames", () => {
      expect(
        isAllowedFixtureUrl("http://attacker.com:3000/fixtures/pages/B01-modal.html", 3000)
      ).toBe(false);
    });
  });

  describe("E. Playwright Network Interception (Browser Route Guard)", () => {
    it("blocks a page that attempts to redirect to a private address", async () => {
      let targetPrivatePort = 0;
      const privateServer = http
        .createServer((req, res) => {
          res.end("SUPER_SECRET_INTERNAL_METRICS");
        })
        .listen(0);
      serversToClose.push(privateServer);
      targetPrivatePort = (privateServer.address() as any).port;

      const redirectServer = http
        .createServer((req, res) => {
          if (req.url === "/public-entry") {
            // Malicious redirect to loopback private port
            res.writeHead(302, { Location: `http://127.0.0.1:${targetPrivatePort}/secret` });
            res.end();
          } else {
            res.end("public ok");
          }
        })
        .listen(0);
      serversToClose.push(redirectServer);
      const publicPort = (redirectServer.address() as any).port;

      browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      const context = await browser.newContext();

      const blockedUrls: string[] = [];
      await attachSsrfGuard(context, {
        allowFixtures: false,
        allowedOrigins: [`http://127.0.0.1:${publicPort}`],
        onBlocked(url) {
          blockedUrls.push(url);
        },
      });

      const page = await context.newPage();
      let failed = false;
      try {
        await page.goto(`http://127.0.0.1:${publicPort}/public-entry`, { timeout: 3000 });
      } catch {
        failed = true;
      }

      expect(failed).toBe(true);
      expect(blockedUrls.some((u) => u.includes(String(targetPrivatePort)))).toBe(true);
      await context.close();
    });

    it("blocks a page script that calls fetch() on a private/metadata address", async () => {
      const scriptServer = http
        .createServer((req, res) => {
          res.writeHead(200, { "Content-Type": "text/html" });
          res.end(`<!DOCTYPE html>
<html>
<body>
  <h1>Script Fetch Test</h1>
  <script>
    fetch("http://169.254.169.254/latest/meta-data")
      .then(r => r.text())
      .then(t => { window.__exfiltrated = t; })
      .catch(e => { window.__fetchFailed = true; });
  </script>
</body>
</html>`);
        })
        .listen(0);
      serversToClose.push(scriptServer);
      const port = (scriptServer.address() as any).port;

      if (!browser) {
        browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
      }
      const context = await browser.newContext();

      const blockedList: string[] = [];
      await attachSsrfGuard(context, {
        allowFixtures: false,
        onBlocked(url) {
          blockedList.push(url);
        },
      });

      const page = await context.newPage();
      // Allow navigation to the test server itself
      await page.route(`http://127.0.0.1:${port}/*`, (r) => r.continue());

      await page.goto(`http://127.0.0.1:${port}/`, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(400);

      const failed = await page.evaluate(() => (window as any).__fetchFailed);
      const exfiltrated = await page.evaluate(() => (window as any).__exfiltrated);

      expect(failed).toBe(true);
      expect(exfiltrated).toBeUndefined();
      expect(blockedList.some((u) => u.includes("169.254.169.254"))).toBe(true);
      await context.close();
    });
  });
});
