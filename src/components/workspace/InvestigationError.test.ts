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

    expect(html).toContain("The analysis service is temporarily busy");
    expect(html).not.toMatch(/MODEL_HIGH_DEMAND|gemini-3\.7-flash/i);
    expect(MODEL_TEMPORARILY_UNAVAILABLE_MESSAGE).not.toMatch(/gemini|google/i);
  });
});
