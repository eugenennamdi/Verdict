import { describe, expect, it } from "vitest";
import {
  humanAuditQuotaExhaustedMessage,
  humanAuditQuotaLabel,
} from "./humanAuditQuotaContract";

describe("human audit quota presentation", () => {
  it("shows subtle remaining-state copy", () => {
    expect(
      humanAuditQuotaLabel({
        limit: 3,
        used: 0,
        remaining: 3,
        nextAvailableAt: null,
      })
    ).toBe("3 free audits available");
    expect(
      humanAuditQuotaLabel({
        limit: 3,
        used: 2,
        remaining: 1,
        nextAvailableAt: null,
      })
    ).toBe("1 free audit remaining");
  });

  it("formats rolling-window availability without payment copy", () => {
    const now = Date.UTC(2026, 7, 3, 10, 0, 0);
    const quota = {
      limit: 3,
      used: 3,
      remaining: 0,
      nextAvailableAt: new Date(now + 8 * 60 * 60_000 + 24 * 60_000).toISOString(),
    };
    expect(humanAuditQuotaExhaustedMessage(quota, now)).toBe(
      "Free audits used for now. Your next free audit becomes available in 8h 24m."
    );
    expect(humanAuditQuotaLabel(quota, now)).not.toMatch(/USDC|payment/i);
  });
});
