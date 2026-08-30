import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it, vi } from "vitest";

vi.mock("./HumanAuditQuotaIndicator", () => ({
  HumanAuditQuotaIndicator: () => "quota-module",
}));

vi.mock("next-themes", () => ({
  useTheme: () => ({ theme: "light", setTheme: vi.fn() }),
}));

import { AppSidebar } from "./AppSidebar";

const USAGE = {
  free: { limit: 3, used: 1, remaining: 2, nextAvailableAt: null },
  paid: { available: 0 },
  canStartAudit: true,
};

function renderSidebar(isMobileOpen: boolean): string {
  return renderToStaticMarkup(
    createElement(AppSidebar, {
      isCollapsed: false,
      onToggleCollapse: () => undefined,
      onNewInvestigation: () => undefined,
      recents: [],
      onSelectRecent: () => undefined,
      activeUrl: undefined,
      isMobileOpen,
      onMobileClose: () => undefined,
      humanAuditUsage: USAGE,
    })
  );
}

describe("workspace sidebar quota placement", () => {
  it("places the quota immediately above Agent and Documentation links", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/workspace/AppSidebar.tsx"),
      "utf8"
    );
    const quotaIndex = source.indexOf("<HumanAuditQuotaIndicator");
    expect(quotaIndex).toBeGreaterThan(-1);
    expect(quotaIndex).toBeLessThan(source.indexOf('href="/agents"'));
    expect(quotaIndex).toBeLessThan(source.indexOf('href="/docs"'));
  });

  it("uses the same sidebar content for desktop and the open mobile drawer", () => {
    expect(renderSidebar(false).match(/quota-module/g)).toHaveLength(1);
    expect(renderSidebar(true).match(/quota-module/g)).toHaveLength(2);
  });

  it("keeps persistent quota, wallet, and payment UI out of the composer", () => {
    const workspaceSource = readFileSync(
      join(process.cwd(), "src/components/workspace/VerdictWorkspace.tsx"),
      "utf8"
    );
    expect(workspaceSource).not.toMatch(
      /HumanAuditPayment|HumanAuditQuotaIndicator|humanAuditQuotaLabel|humanAuditAccessLabel/
    );
    expect(workspaceSource).toContain("<AppSidebar");
    expect(workspaceSource).toContain("humanAuditUsage={humanAuditUsage}");
    expect(workspaceSource).toContain("<HumanAuditPaywallDialog");
    expect(workspaceSource).toContain("humanAuditUsage?.free.remaining === 0");
    expect(workspaceSource).toContain("humanAuditUsage.paid.available === 0");
  });

  it("does not contain a persistent wallet or paid-continuation action", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/workspace/AppSidebar.tsx"),
      "utf8"
    );
    expect(source).not.toMatch(/Connect Wallet|Continue.*\$0\.50/);
  });
});
