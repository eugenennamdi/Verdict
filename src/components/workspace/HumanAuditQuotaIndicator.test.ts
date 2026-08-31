import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  HumanAuditQuotaIndicator,
  remainingDuration,
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

function renderQuota(
  state: HumanAuditUsageState | null,
  options: { compact?: boolean; defaultOpen?: boolean; status?: "loading" | "ready" | "unavailable" } = {}
): string {
  return renderToStaticMarkup(
    createElement(HumanAuditQuotaIndicator, {
      usage: state,
      compact: options.compact,
      defaultOpen: options.defaultOpen,
      status: options.status,
    })
  );
}

describe("sidebar human audit quota disclosure", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders collapsed disclosure by default with 'Usage' label and aria-expanded='false'", () => {
    const html = renderQuota(usage(3));
    expect(html).toContain("Usage");
    expect(html).toContain("aria-expanded=\"false\"");
    expect(html).toContain("id=\"sidebar-usage-trigger\"");
    expect(html).toContain("aria-controls=\"sidebar-usage-details\"");
    expect(html).toContain("grid-rows-[0fr]"); // Details hidden
    expect(html).not.toContain("FREE AUDITS");
    expect(html).not.toContain("Upgrade");
    expect(html).not.toContain("Pro");
  });

  it("renders expanded details with discrete free audits count and paid count", () => {
    const html = renderQuota(usage(3, 0), { defaultOpen: true });
    expect(html).toContain("aria-expanded=\"true\"");
    expect(html).toContain("grid-rows-[1fr]");
    expect(html).toContain("Free audits");
    expect(html).toContain("3 / 3");
    expect(html).toContain("Paid audits");
    expect(html).toContain(">0<"); // Neutral 0
    expect(html).not.toContain("%"); // No percentages
    expect(html).not.toContain("circle"); // No progress ring
  });

  it("renders exhausted free audits with reset timer and paid entitlement when ready", () => {
    const html = renderQuota(usage(0, 1), { defaultOpen: true });
    expect(html).toContain("0 / 3");
    expect(html).toContain("Resets in");
    expect(html).toContain("22h 38m");
    expect(remainingDuration("2026-08-31T10:00:00.000Z", NOW)).toBe("22h 38m");
    expect(html).toContain("1 ready");
    expect(html).not.toContain("Pay $0.50 USDC");
    expect(html).not.toContain("Upgrade");
  });

  it("renders plural for multiple paid audits ready", () => {
    const html = renderQuota(usage(0, 2), { defaultOpen: true });
    expect(html).toContain("2 ready");
  });

  it("keeps wallet and payment actions out of the quota surface", () => {
    const html = renderQuota(usage(0), { defaultOpen: true });
    expect(html).not.toContain("Connect Wallet");
    expect(html).not.toContain("Continue");
    expect(html).not.toContain("$0.50");
    expect(html).not.toContain("Upgrade to Pro");
  });

  it("renders compact icon indicator in collapsed sidebar mode", () => {
    const html = renderQuota(usage(2), { compact: true });
    expect(html).toContain("aria-label=\"Usage: 2 of 3 free audits remaining\"");
    expect(html).not.toContain("id=\"sidebar-usage-trigger\"");
  });

  it("keeps Usage visible while loading without fabricated quota values", () => {
    const html = renderQuota(null, { defaultOpen: true, status: "loading" });
    expect(html).toContain("Usage");
    expect(html).toContain("Loading…");
    expect(html).not.toContain("3 / 3");
    expect(html).not.toContain("0 / 3");
  });

  it("keeps Usage visible in a neutral unavailable state after fetch failure", () => {
    const html = renderQuota(null, {
      defaultOpen: true,
      status: "unavailable",
    });
    expect(html).toContain("Usage unavailable");
    expect(html).not.toContain("3 / 3");
    expect(html).not.toContain("0 / 3");
  });
});
