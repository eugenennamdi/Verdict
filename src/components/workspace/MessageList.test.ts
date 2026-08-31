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
              role: "supporting",
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

    expect(html).not.toContain("S2");
    expect(html).toContain("Source · Pricing");
    expect(html).toContain("Pricing");
    expect(html).toContain("example.com/pricing");
    expect(html).toContain("https://example.com/pricing");
    expect(html).toContain("Customer evidence was limited.");
    expect(html).not.toContain("reasoning");
  });

  it("renders Thinking loading state for general conversation", () => {
    const html = renderToStaticMarkup(
      createElement(MessageList, {
        messages: [{ id: "u1", role: "user", kind: "text", content: "hey" }],
        liveEvents: [],
        investigating: false,
        pendingReply: true,
        pendingReplyMode: "thinking",
      })
    );

    expect(html).toContain("Thinking");
    expect(html).not.toContain("Reviewing audit evidence");
    expect(html).not.toContain("Investigating");
  });

  it("renders Reviewing audit evidence loading state for grounded follow-up", () => {
    const html = renderToStaticMarkup(
      createElement(MessageList, {
        messages: [
          { id: "u1", role: "user", kind: "text", content: "Why is conversion weak?" },
        ],
        liveEvents: [],
        investigating: false,
        pendingReply: true,
        pendingReplyMode: "followup",
      })
    );

    expect(html).toContain("Reviewing audit evidence");
    expect(html).not.toContain("Thinking");
  });

  it("renders Investigating domain loading state for new audit before events stream", () => {
    const html = renderToStaticMarkup(
      createElement(MessageList, {
        messages: [
          { id: "u1", role: "user", kind: "text", content: "linear.app" },
        ],
        liveEvents: [],
        investigating: true,
        activeDomain: "linear.app",
      })
    );

    expect(html).toContain("Investigating linear.app");
    expect(html).not.toContain("Thinking");
    expect(html).not.toContain("Reviewing audit evidence");
  });

  it("completed structured audit result does not render duplicate conversational prose", () => {
    const messages: WorkspaceMessage[] = [
      {
        id: "result-1",
        role: "verdict",
        kind: "result",
        summary:
          "I inspected 1 page for this investigation. Aave scores 79/100 on Growth Readiness. The full breakdown is in the report.",
        result: {
          overallScore: 79,
          identity: { company_name: "Aave" },
          pagesInspected: 1,
          pagesAccepted: 1,
          stopReason: "no_candidates",
          reportId: "355886de-8808-43de-a1af-881e595b7d10",
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

    // The AuditResultCard should render
    expect(html).toContain("Aave");
    expect(html).toContain("79");
    expect(html).toContain("/100");
    // But the duplicate prose summary should NOT appear
    expect(html).not.toContain("I inspected 1 page for this investigation");
  });

  it("normal assistant conversation still renders", () => {
    const messages: WorkspaceMessage[] = [
      {
        id: "text-1",
        role: "verdict",
        kind: "text",
        content: "Verdict analyzes startup growth across 7 dimensions.",
      },
    ];

    const html = renderToStaticMarkup(
      createElement(MessageList, {
        messages,
        liveEvents: [],
        investigating: false,
      })
    );

    expect(html).toContain("Verdict analyzes startup growth across 7 dimensions.");
  });

  it("audit Q&A still renders with citations", () => {
    const messages: WorkspaceMessage[] = [
      {
        id: "qa-1",
        role: "verdict",
        kind: "text",
        content: "The conversion funnel has gaps. [S1]",
        auditQa: {
          answerType: "evidence",
          confidence: "high",
          citations: [
            {
              sourceId: "S1",
              url: "https://example.com/",
              path: "/",
              role: "homepage",
              category: "identity",
            },
          ],
          limitations: [],
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

    expect(html).toContain("The conversion funnel has gaps");
    expect(html).not.toContain("S1");
    expect(html).toContain("Source · Homepage");
    expect(html).not.toContain("Identity");
  });
});
