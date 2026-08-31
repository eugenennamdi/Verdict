export const dynamic = "force-dynamic";

import { NextResponse } from "next/dist/server/web/spec-extension/response";
import { FALLBACK_REPLY, resolveModelTurn } from "@/lib/conversation/actions";
import type {
  AuditQaAnswer,
  PublicAuditQaMetadata,
} from "@/lib/conversation/auditAnswer";
import {
  loadAuditContext,
  type LoadedAuditContext,
} from "@/lib/conversation/auditContextLoader";
import {
  answerDeterministically,
  applyPublicAuditQaPolicy,
  classifyAuditFollowup,
  composeCanonicalGroundedAnswer,
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
import { getHumanAuditUsage } from "@/lib/humanAuditAccess";
import {
  humanAuditQuotaExhaustedMessage,
} from "@/lib/humanAuditQuotaContract";
import type { HumanAuditUsageState } from "@/lib/humanAuditUsageContract";
import { redis } from "@/lib/redis";

const MAX_MESSAGES = 10;
const MAX_MESSAGE_CHARS = 1500;
const CONVERSATION_RATE_LIMIT = 30;
const CONVERSATION_RATE_WINDOW_SECONDS = 60;
export const CONVERSATION_RATE_LIMIT_TIMEOUT_MS = 1_000;

const inflight = new Set<string>();

type ConversationRateLimitStore = {
  incr: (key: string) => Promise<number>;
  expire: (key: string, seconds: number) => Promise<unknown>;
};

export async function isConversationRateLimited(
  store: ConversationRateLimitStore,
  rateKey: string,
  timeoutMs = CONVERSATION_RATE_LIMIT_TIMEOUT_MS
): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<boolean>((resolve) => {
    timer = setTimeout(() => resolve(false), timeoutMs);
  });
  const check = (async () => {
    try {
      const count = await store.incr(rateKey);
      if (count === 1) {
        await store.expire(rateKey, CONVERSATION_RATE_WINDOW_SECONDS);
      }
      return typeof count === "number" && count > CONVERSATION_RATE_LIMIT;
    } catch {
      return false;
    }
  })();

  try {
    return await Promise.race([check, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

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
  if (activeReportId) return { reportId: activeReportId, ambiguous: false };
  if (ids.length > 1) return { ambiguous: true };
  return { reportId: ids[0], ambiguous: false };
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
  answer: AuditQaAnswer
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
              role: source.role,
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
  getNewAuditUsage?: (request: Request) => Promise<{
    usage: HumanAuditUsageState;
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
        const publicAnswer = applyPublicAuditQaPolicy(
          deterministic,
          loaded,
          question
        );
        return NextResponse.json({
          action: "respond",
          message: publicAnswer.answer,
          url: null,
          auditQa: publicQaMetadata(loaded, publicAnswer),
        });
      }

      const grounded = composeCanonicalGroundedAnswer(loaded, question);
      const publicAnswer = applyPublicAuditQaPolicy(
        grounded,
        loaded,
        question
      );
      return NextResponse.json({
        action: "respond",
        message: publicAnswer.answer,
        url: null,
        auditQa: publicQaMetadata(loaded, publicAnswer),
      });
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
      if (action.action !== "start_audit" || !dependencies.getNewAuditUsage) {
        return NextResponse.json(action);
      }

      try {
        const access = await dependencies.getNewAuditUsage(req);
        if (!access.usage.canStartAudit) {
          return withOptionalVisitorCookie(
            NextResponse.json({
              action: "payment_required",
              message: humanAuditQuotaExhaustedMessage(access.usage.free),
              url: action.url ?? null,
              quota: access.usage.free,
              usage: access.usage,
            }),
            access.visitor
          );
        }
        return withOptionalVisitorCookie(
          NextResponse.json({
            ...action,
            quota: access.usage.free,
            usage: access.usage,
          }),
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
  getNewAuditUsage: async (request) => {
    const visitor = resolveAnonymousAuditVisitor(request);
    const usage = await getHumanAuditUsage(visitor.quotaIdentity);
    return { usage, visitor };
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

  const rateKey = `conversation_rate:${ip}`;
  if (await isConversationRateLimited(redis, rateKey)) {
    return NextResponse.json(
      { action: "respond", message: FALLBACK_REPLY, url: null },
      { status: 429 }
    );
  }

  inflight.add(ip);
  try {
    return await conversationHandler(req);
  } finally {
    inflight.delete(ip);
  }
}
