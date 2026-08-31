import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE } from "@/lib/audit/publicError";
import { InvestigationError } from "./InvestigationError";

describe("InvestigationError", () => {
  it("renders sanitized availability copy without provider details", () => {
    const html = renderToStaticMarkup(
      createElement(InvestigationError, {
        message: "MODEL_HIGH_DEMAND from gemini-3.7-flash",
      })
    );

    expect(html).toContain("Your audit wasn&#x27;t counted");
    expect(html).not.toMatch(/MODEL_HIGH_DEMAND|gemini-3\.7-flash/i);
    expect(MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE).not.toMatch(/gemini|google/i);
  });

  it("never renders an unknown internal-looking backend code", () => {
    const html = renderToStaticMarkup(
      createElement(InvestigationError, {
        message: "MODEL_PROVIDER_TERMINAL_FAILURE",
      })
    );

    expect(html).not.toContain("MODEL_PROVIDER_TERMINAL_FAILURE");
    expect(html).toContain("couldn&#x27;t complete this investigation");
  });

  it("never renders a serialized provider error payload", () => {
    const html = renderToStaticMarkup(
      createElement(InvestigationError, {
        message:
          '{"error":{"code":400,"message":"Manually set deadline 8s is too short. Minimum allowed deadline is 10s.","status":"INVALID_ARGUMENT"}}',
      })
    );

    expect(html).toContain("couldn&#x27;t complete this investigation");
    expect(html).not.toMatch(/deadline|INVALID_ARGUMENT|code(?:&quot;|\")?:400|10s/i);
  });
});
