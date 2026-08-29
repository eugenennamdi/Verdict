import type { ActivityEvent } from "@/lib/audit/events";
import type { AuditSummary } from "./types";

export type InvestigateFrame =
  | { kind: "event"; event: ActivityEvent }
  | { kind: "result"; result: AuditSummary }
  | { kind: "error"; error: string };

export async function readInvestigateStream(
  response: Response,
  handlers: {
    onEvent: (event: ActivityEvent) => void;
    onResult: (result: AuditSummary) => void;
    onError: (error: string) => void;
  }
): Promise<void> {
  if (!response.body) {
    handlers.onError("The investigation stream did not start.");
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  const consumeBlock = (block: string) => {
    const dataLines = block
      .split("\n")
      .filter((line) => line.startsWith("data:"))
      .map((line) => line.slice(5).trimStart());
    if (dataLines.length === 0) return;
    const payload = dataLines.join("\n");
    let frame: InvestigateFrame;
    try {
      frame = JSON.parse(payload) as InvestigateFrame;
    } catch {
      return;
    }
    if (frame.kind === "event" && frame.event) handlers.onEvent(frame.event);
    else if (frame.kind === "result" && frame.result) handlers.onResult(frame.result);
    else if (frame.kind === "error") handlers.onError(frame.error || "Investigation failed.");
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    let separator = buffer.indexOf("\n\n");
    while (separator !== -1) {
      const block = buffer.slice(0, separator);
      buffer = buffer.slice(separator + 2);
      consumeBlock(block);
      separator = buffer.indexOf("\n\n");
    }
  }

  if (buffer.trim()) consumeBlock(buffer);
}
