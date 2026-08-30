import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("./HumanWalletButton", () => ({
  HumanWalletButton: () => "wallet-control",
}));

import { WorkspaceTopBar } from "./WorkspaceTopBar";

describe("workspace top bar", () => {
  it("places the wallet control on the same row as New Audit", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceTopBar, {
        phase: "idle",
        hasEvents: false,
        isRightPanelOpen: false,
        onToggleRightPanel: () => undefined,
        onOpenMobileSidebar: () => undefined,
      })
    );
    expect(html).toContain("New Audit");
    expect(html).toContain("wallet-control");
    expect(html.indexOf("New Audit")).toBeLessThan(html.indexOf("wallet-control"));
  });

  it("shows only the startup name while an audit is running", () => {
    const html = renderToStaticMarkup(
      createElement(WorkspaceTopBar, {
        phase: "investigating",
        targetDomain: "solana.com",
        hasEvents: true,
        isRightPanelOpen: false,
        onToggleRightPanel: () => undefined,
        onOpenMobileSidebar: () => undefined,
      })
    );
    expect(html).toContain("solana.com");
    expect(html).not.toContain("Auditing");
  });
});
