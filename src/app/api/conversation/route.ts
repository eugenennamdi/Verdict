export const dynamic = "force-dynamic";

import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { FALLBACK_REPLY, resolveModelTurn } from "@/lib/conversation/actions";
import {
  buildVerdictSystemPrompt,
  completeConversation,
  type ChatTurn,
} from "@/lib/conversation/deepseek";
import { redis } from "@/lib/redis";

const MAX_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1500;
const CONVERSATION_RATE_LIMIT = 30;
const CONVERSATION_RATE_WINDOW_SECONDS = 60;

const inflight = new Set<string>();

function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || "127.0.0.1";
}

function sanitizeReportId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (!/^[0-9a-f-]{8,64}$/i.test(value)) return undefined;
  return value;
}

function sanitizeMessages(raw: unknown): ChatTurn[] {
  if (!Array.isArray(raw)) return [];
  const cleaned: ChatTurn[] = [];
  for (const item of raw.slice(-MAX_MESSAGES)) {
    if (!item || typeof item !== "object") continue;
    const role = (item as { role?: unknown }).role;
    const content = (item as { content?: unknown }).content;
    if (role !== "user" && role !== "assistant") continue;
    if (typeof content !== "string") continue;
    const trimmed = content.trim().slice(0, MAX_MESSAGE_CHARS);
    if (!trimmed) continue;
    cleaned.push({ role, content: trimmed });
  }
  return cleaned;
}

export async function POST(req: Request) {
  const ip = clientIp(req);

  if (inflight.has(ip)) {
    return NextResponse.json(
      { action: "respond", message: FALLBACK_REPLY, url: null },
      { status: 429 }
    );
  }

  try {
    const rateKey = `conversation_rate:${ip}`;
    const count = await redis.incr(rateKey);
    if (count === 1) {
      await redis.expire(rateKey, CONVERSATION_RATE_WINDOW_SECONDS);
    }
    if (typeof count === "number" && count > CONVERSATION_RATE_LIMIT) {
      return NextResponse.json(
        { action: "respond", message: FALLBACK_REPLY, url: null },
        { status: 429 }
      );
    }
  } catch {
    // Dummy redis still supports incr; ignore limiter failures.
  }

  let body: { messages?: unknown; activeReportId?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { action: "respond", message: FALLBACK_REPLY, url: null },
      { status: 400 }
    );
  }

  const history = sanitizeMessages(body.messages);
  if (history.length === 0) {
    return NextResponse.json(
      { action: "respond", message: FALLBACK_REPLY, url: null },
      { status: 400 }
    );
  }

  const last = history[history.length - 1];
  if (last.role !== "user") {
    return NextResponse.json(
      { action: "respond", message: FALLBACK_REPLY, url: null },
      { status: 400 }
    );
  }

  inflight.add(ip);
  try {
    const completion = await completeConversation([
      {
        role: "system",
        content: buildVerdictSystemPrompt(sanitizeReportId(body.activeReportId)),
      },
      ...history,
    ]);

    const action = resolveModelTurn({
      content: completion.content,
      toolCalls: completion.toolCalls,
    });

    return NextResponse.json(action);
  } catch {
    return NextResponse.json({
      action: "respond",
      message: FALLBACK_REPLY,
      url: null,
    });
  } finally {
    inflight.delete(ip);
  }
}
