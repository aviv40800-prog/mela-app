import { describe, expect, it } from "vitest";
import { tranzilaHeaders } from "@/lib/tranzila";

describe("tranzila auth headers", () => {
  it("matches Tranzila's Python reference implementation", () => {
    // Expected value computed with Tranzila's documented Python snippet for the same inputs.
    const h = tranzilaHeaders("app_test_123", "secret_xyz", 1760000000, "ab".repeat(40));
    expect(h).toEqual({
      "X-tranzila-api-app-key": "app_test_123",
      "X-tranzila-api-request-time": "1760000000",
      "X-tranzila-api-nonce": "ab".repeat(40),
      "X-tranzila-api-access-token": "5afad5f697ab96b50e70fdd85b4318c8f0f5937c8619d77f6ce86995b95c5c05",
    });
  });

  it("uses a fresh 80-hex-char nonce per request", () => {
    const a = tranzilaHeaders("k", "s");
    const b = tranzilaHeaders("k", "s");
    expect(a["X-tranzila-api-nonce"]).toMatch(/^[0-9a-f]{80}$/);
    expect(a["X-tranzila-api-nonce"]).not.toBe(b["X-tranzila-api-nonce"]);
  });

  it("refuses to sign without credentials", () => {
    expect(() => tranzilaHeaders("", "")).toThrow(/credentials/);
  });
});
