export const dynamic = "force-dynamic";

import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { FALLBACK_REPLY, resolveModelTurn } from "@/lib/conversation/actions";
import type { PublicAuditQaMetadata } from "@/lib/conversation/auditAnswer";
import {
  answerGroundedAuditQuestion,
  type AuditQaGenerator,
} from "@/lib/conversation/auditQa";
import {
  loadAuditContext,
  type LoadedAuditContext,
} from "@/lib/conversation/auditContextLoader";
import {
  answerDeterministically,
  classifyAuditFollowup,
  fallbackGroundedAnswer,
} from "@/lib/conversation/auditQuestions";
import {
  buildVerdictSystemPrompt,
  completeConversation,
  type DeepSeekCompletion,
  type ChatTurn,
} from "@/lib/conversation/deepseek";
import {
  attachAnonymousVisitorCookie,
  resolveAnonymousAuditVisitor,
  type AnonymousAuditVisitor,
} from "@/lib/humanAuditIdentity";
import { getHumanAuditQuota } from "@/lib/humanAuditQuota";
import {
  humanAuditQuotaExhaustedMessage,
  type HumanAuditQuotaState,
} from "@/lib/humanAuditQuotaContract";
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

export function sanitizeReportId(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value
    )
  ) {
    return undefined;
  }
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

type KnownAuditReference = {
  reportId: string;
  companyName: string;
  domain: string;
};

function sanitizeKnownAudits(raw: unknown): KnownAuditReference[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  return raw.slice(0, 25).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const record = item as Record<string, unknown>;
    const reportId = sanitizeReportId(record.reportId);
    if (!reportId || seen.has(reportId)) return [];
    seen.add(reportId);
    return [
      {
        reportId,
        companyName:
          typeof record.companyName === "string"
            ? record.companyName.trim().slice(0, 160)
            : "",
        domain:
          typeof record.domain === "string"
            ? record.domain.trim().toLowerCase().slice(0, 255)
            : "",
      },
    ];
  });
}

function resolveReportReference(
  question: string,
  activeReportId: string | undefined,
  knownAudits: KnownAuditReference[]
): { reportId?: string; ambiguous: boolean } {
  const normalized = question.toLowerCase();
  const matches = knownAudits.filter((item) => {
    const company = item.companyName.toLowerCase();
    const domain = item.domain.toLowerCase();
    return (
      (company.length >= 3 && normalized.includes(company)) ||
      (domain.length >= 3 && normalized.includes(domain))
    );
  });
  const ids = [...new Set(matches.map((item) => item.reportId))];
  if (ids.length > 1) return { ambiguous: true };
  return { reportId: ids[0] ?? activeReportId, ambiguous: false };
}

function conversationSummary(history: ChatTurn[]): string {
  return history
    .slice(0, -1)
    .slice(-6)
    .map((turn) => `${turn.role}: ${turn.content}`)
    .join("\n");
}

function explicitCompanyReference(question: string): string | null {
  const match = question.match(
    /\b([A-Z][A-Za-z0-9-]{2,})[’']s\s+(?:score|positioning|messaging|conversion|trust|credibility|website|ux|competition|growth|report|audit)/i
  );
  return match?.[1]?.toLowerCase() ?? null;
}

function contextMatchesExplicitCompany(
  question: string,
  loaded: LoadedAuditContext
): boolean {
  const reference = explicitCompanyReference(question);
  if (!reference) return true;
  const company = loaded.context.companyIdentity.company_name.toLowerCase();
  const domain = loaded.context.audited.domain.toLowerCase();
  return company.includes(reference) || domain.includes(reference);
}

function safeHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

function publicQaMetadata(
  loaded: LoadedAuditContext,
  answer: Awaited<ReturnType<typeof answerGroundedAuditQuestion>>
): PublicAuditQaMetadata {
  const sourceById = new Map(
    loaded.context.sources.map((source) => [source.sourceId, source])
  );
  return {
    answerType: answer.answerType,
    confidence: answer.confidence,
    citations: answer.citations.flatMap((sourceId) => {
      const source = sourceById.get(sourceId);
      return source && safeHttpUrl(source.url)
        ? [
            {
              sourceId,
              url: source.url,
              path: source.path,
              ...(source.category ? { category: source.category } : {}),
            },
          ]
        : [];
    }),
    limitations: answer.limitations,
  };
}

type ConversationDependencies = {
  complete?: (
    messages: ChatTurn[]
  ) => Promise<DeepSeekCompletion>;
  loadContext?: (reportId: string) => Promise<LoadedAuditContext | null>;
  answerGrounded?: typeof answerGroundedAuditQuestion;
  qaGenerator?: AuditQaGenerator;
  getNewAuditQuota?: (request: Request) => Promise<{
    quota: HumanAuditQuotaState;
    visitor?: AnonymousAuditVisitor;
  }>;
};

function withOptionalVisitorCookie(
  response: NextResponse,
  visitor?: AnonymousAuditVisitor
): NextResponse {
  return visitor
    ? attachAnonymousVisitorCookie(response, visitor)
    : response;
}

export function createConversationHandler(
  dependencies: ConversationDependencies = {}
) {
  const complete = dependencies.complete ?? completeConversation;
  const loadContext = dependencies.loadContext ?? loadAuditContext;
  const answerGrounded =
    dependencies.answerGrounded ?? answerGroundedAuditQuestion;

  return async function handleConversation(req: Request): Promise<NextResponse> {
    let body: {
      messages?: unknown;
      activeReportId?: unknown;
      knownAudits?: unknown;
    };
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { action: "respond", message: FALLBACK_REPLY, url: null },
        { status: 400 }
      );
    }

    const history = sanitizeMessages(body.messages);
    if (history.length === 0 || history.at(-1)?.role !== "user") {
      return NextResponse.json(
        { action: "respond", message: FALLBACK_REPLY, url: null },
        { status: 400 }
      );
    }

    const question = history.at(-1)!.content;
    const reference = resolveReportReference(
      question,
      sanitizeReportId(body.activeReportId),
      sanitizeKnownAudits(body.knownAudits)
    );
    const route = classifyAuditFollowup(question, Boolean(reference.reportId));

    if (reference.ambiguous) {
      return NextResponse.json({
        action: "respond",
        message:
          "I found more than one matching investigation. Which report should I use?",
        url: null,
      });
    }

    if (route.type === "missing_context") {
      return NextResponse.json({
        action: "respond",
        message:
          "I need an active completed investigation to answer that accurately. Select a report or run an audit first.",
        url: null,
      });
    }

    if (route.type !== "general" && reference.reportId) {
      let loaded: LoadedAuditContext | null;
      try {
        loaded = await loadContext(reference.reportId);
      } catch {
        loaded = null;
      }
      if (!loaded) {
        return NextResponse.json({
          action: "respond",
          message:
            "I couldn't load that investigation safely. Select the report again or run a new audit.",
          url: null,
        });
      }
      if (!contextMatchesExplicitCompany(question, loaded)) {
        return NextResponse.json({
          action: "respond",
          message:
            "That company reference does not match the active investigation. Which completed report should I use?",
          url: null,
        });
      }

      const deterministic = answerDeterministically(route, loaded, question);
      if (deterministic) {
        return NextResponse.json({
          action: "respond",
          message: deterministic.answer,
          url: null,
          auditQa: publicQaMetadata(loaded, deterministic),
        });
      }

      try {
        const answer = await answerGrounded(
          {
            question,
            loaded,
            conversationSummary: conversationSummary(history),
          },
          dependencies.qaGenerator
            ? { generate: dependencies.qaGenerator }
            : undefined
        );
        return NextResponse.json({
          action: "respond",
          message: answer.answer,
          url: null,
          auditQa: publicQaMetadata(loaded, answer),
        });
      } catch {
        const fallback = fallbackGroundedAnswer(loaded, question);
        return NextResponse.json({
          action: "respond",
          message: fallback.answer,
          url: null,
          auditQa: publicQaMetadata(loaded, fallback),
        });
      }
    }

    try {
      const completion = await complete([
        {
          role: "system",
          content: buildVerdictSystemPrompt(reference.reportId),
        },
        ...history,
      ]);
      const action = resolveModelTurn({
        content: completion.content,
        toolCalls: completion.toolCalls,
      });
      if (action.action !== "start_audit" || !dependencies.getNewAuditQuota) {
        return NextResponse.json(action);
      }

      try {
        const access = await dependencies.getNewAuditQuota(req);
        if (access.quota.remaining === 0) {
          return withOptionalVisitorCookie(
            NextResponse.json({
              action: "quota_exhausted",
              message: humanAuditQuotaExhaustedMessage(access.quota),
              url: null,
              quota: access.quota,
            }),
            access.visitor
          );
        }
        return withOptionalVisitorCookie(
          NextResponse.json({ ...action, quota: access.quota }),
          access.visitor
        );
      } catch {
        return NextResponse.json({
          action: "respond",
          message:
            "I couldn't verify free-audit availability just now. Please try again shortly.",
          url: null,
        });
      }
    } catch {
      return NextResponse.json({
        action: "respond",
        message: FALLBACK_REPLY,
        url: null,
      });
    }
  };
}

const conversationHandler = createConversationHandler({
  getNewAuditQuota: async (request) => {
    const visitor = resolveAnonymousAuditVisitor(request);
    const quota = await getHumanAuditQuota(visitor.quotaIdentity);
    return { quota, visitor };
  },
});

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

  inflight.add(ip);
  try {
    return await conversationHandler(req);
  } finally {
    inflight.delete(ip);
  }
}
