import { describe, expect, it } from "vitest";
import { createTracer } from "./events";

describe("createTracer", () => {
  it("records events in order and invokes onEvent", () => {
    const seen: string[] = [];
    const tracer = createTracer((event) => {
      seen.push(event.type);
    });

    tracer.emit("audit.started");
    tracer.emit("site.homepage_acquired", undefined, { chars: 12 });
    tracer.emit("audit.failed");

    expect(tracer.events.map((event) => event.type)).toEqual([
      "audit.started",
      "site.homepage_acquired",
      "audit.failed",
    ]);
    expect(seen).toEqual([
      "audit.started",
      "site.homepage_acquired",
      "audit.failed",
    ]);
    expect(tracer.events[0].message).toBe("Investigation started");
    expect(tracer.events[1].data).toEqual({ chars: 12 });
    expect(tracer.events.every((event) => typeof event.ts === "number")).toBe(true);
  });
});
