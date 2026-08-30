import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HumanAuditQuotaIndicator,
  humanAuditQuotaSecondaryCopy,
} from "./HumanAuditQuotaIndicator";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";

const NOW = Date.UTC(2026, 7, 30, 11, 22);

function usage(remaining: number, paidAvailable = 0): HumanAuditUsageState {
  return {
    free: {
      limit: 3,
      used: 3 - remaining,
      remaining,
      nextAvailableAt:
        remaining === 0 ? "2026-08-31T10:00:00.000Z" : null,
    },
    paid: { available: paidAvailable },
    canStartAudit: remaining > 0 || paidAvailable > 0,
  };
}

function renderQuota(state: HumanAuditUsageState): string {
  return renderToStaticMarkup(
    createElement(HumanAuditQuotaIndicator, { usage: state })
  );
}

describe("sidebar human audit quota", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([3, 2, 1])(
    "renders the %i of 3 remaining segmented quota state",
    (remaining) => {
      const html = renderQuota(usage(remaining));
      expect(html).toContain(`${remaining} of 3 left`);
      expect(html).toContain(`${remaining} of 3 free audits remaining`);
      expect(html).toContain("24h rolling limit");
    }
  );

  it("renders the exhausted state from the server-provided reset timestamp", () => {
    const html = renderQuota(usage(0));
    expect(html).toContain("0 of 3 left");
    expect(html).toContain("0 of 3 free audits remaining");
    expect(html).toContain("Resets in 22h 38m");
    expect(humanAuditQuotaSecondaryCopy(usage(0).free, NOW)).toBe(
      "Resets in 22h 38m"
    );
  });

  it("keeps wallet and payment actions out of the quota surface", () => {
    const html = renderQuota(usage(0));
    expect(html).not.toContain("Connect Wallet");
    expect(html).not.toContain("Continue");
    expect(html).not.toContain("$0.50");
  });

  it("shows an already-created paid entitlement without a payment CTA", () => {
    const html = renderQuota(usage(0, 1));
    expect(html).toContain("1 paid audit ready");
    expect(html).not.toContain("Pay $0.50 USDC");
  });
});
