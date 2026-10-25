// test/ssrf.test.ts — Unit tests for the SSRF protection module
import { describe, it, expect } from "vitest";
import { checkUrl, SsrfError } from "../src/ssrf.js";

describe("SSRF guard", () => {
  it("rejects non-http(s) protocols", async () => {
    await expect(checkUrl("file:///etc/passwd")).rejects.toThrow(SsrfError);
    await expect(checkUrl("ftp://ftp.example.com")).rejects.toThrow(SsrfError);
    await expect(checkUrl("javascript:alert(1)")).rejects.toThrow(SsrfError);
  });

  it("rejects localhost and loopback domains", async () => {
    await expect(checkUrl("http://localhost:3000")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://127.0.0.1:8080")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://0.0.0.0")).rejects.toThrow(SsrfError);
  });

  it("rejects cloud metadata endpoints", async () => {
    await expect(checkUrl("http://169.254.169.254/latest/meta-data")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://metadata.google.internal")).rejects.toThrow(SsrfError);
  });

  it("rejects private IP ranges (10.x, 192.168.x, 172.16-31.x)", async () => {
    await expect(checkUrl("http://10.0.0.1")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://192.168.1.1")).rejects.toThrow(SsrfError);
    await expect(checkUrl("http://172.20.0.1")).rejects.toThrow(SsrfError);
  });

  it("allows valid public web URLs", async () => {
    const url = await checkUrl("https://example.com");
    expect(url.hostname).toBe("example.com");
  });
});
