import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MessageList } from "./MessageList";
import type { WorkspaceMessage } from "./types";

describe("grounded audit answer presentation", () => {
  it("renders compact validated source references and limitations", () => {
    const messages: WorkspaceMessage[] = [
      {
        id: "answer-1",
        role: "verdict",
        kind: "text",
        content: "The pricing page supports that conclusion. [S2]",
        auditQa: {
          answerType: "evidence",
          confidence: "medium",
          citations: [
            {
              sourceId: "S2",
              url: "https://example.com/pricing",
              path: "/pricing",
              category: "conversion",
            },
          ],
          limitations: ["Customer evidence was limited."],
        },
      },
    ];

    const html = renderToStaticMarkup(
      createElement(MessageList, {
        messages,
        liveEvents: [],
        investigating: false,
      })
    );

    expect(html).toContain("S2");
    expect(html).toContain("Pricing");
    expect(html).toContain("example.com/pricing");
    expect(html).toContain("https://example.com/pricing");
    expect(html).toContain("Customer evidence was limited.");
    expect(html).not.toContain("reasoning");
  });
});
