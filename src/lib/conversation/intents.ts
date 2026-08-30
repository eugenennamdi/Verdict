export type ConversationIntent =
  | { type: "greeting" }
  | { type: "capabilities" }
  | { type: "scoring" }
  | { type: "example" }
  | { type: "audit"; url: string }
  | { type: "audit_missing_url" }
  | { type: "audit_followup" }
  | { type: "unknown" };

const URL_PATTERN =
  /(?:https?:\/\/)?(?:www\.)?(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}(?::\d{2,5})?(?:\/[^\s]*)?/i;

const GREETING_PATTERN = /^(hi|hello|hey|yo|howdy)([,!.\s].*)?$/i;

const CAPABILITY_PATTERN =
  /\b(what can you do|what do you do|how do you work|how does this work|help|capabilities|what are you)\b/i;

const SCORING_PATTERN =
  /\b(how does scoring work|how do you score|what are the pillars|7-?pillar|growth readiness|scoring)\b/i;

const EXAMPLE_PATTERN = /\b(example audit|view an example|sample audit|show (me )?an example)\b/i;

const AUDIT_VERB_PATTERN = /\b(audit|investigate|analyze|analyse|teardown|review)\b/i;

export function normalizeCandidateUrl(raw: string): string {
  const trimmed = raw.trim().replace(/[.,;:!?)]+$/g, "");
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

export function extractStartupUrl(text: string): string | null {
  const match = text.match(URL_PATTERN);
  if (!match) return null;
  const candidate = normalizeCandidateUrl(match[0]);
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    if (!parsed.hostname.includes(".")) return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function classifyIntent(
  text: string,
  context?: { hasCompletedAudit?: boolean }
): ConversationIntent {
  const trimmed = text.trim();
  if (!trimmed) return { type: "unknown" };

  const url = extractStartupUrl(trimmed);
  if (url) return { type: "audit", url };

  if (GREETING_PATTERN.test(trimmed)) return { type: "greeting" };
  if (CAPABILITY_PATTERN.test(trimmed)) return { type: "capabilities" };
  if (SCORING_PATTERN.test(trimmed)) return { type: "scoring" };
  if (EXAMPLE_PATTERN.test(trimmed)) return { type: "example" };
  if (AUDIT_VERB_PATTERN.test(trimmed)) return { type: "audit_missing_url" };
  if (context?.hasCompletedAudit) return { type: "audit_followup" };
  return { type: "unknown" };
}

export const REPLIES = {
  greeting: `Hello. I'm Verdict — an autonomous growth investigator for startups.

I examine positioning, messaging, UX, conversion, trust, competition, and growth readiness from the company's actual website.

Share a startup URL when you're ready.`,
  capabilities: `I investigate startup websites and produce a Growth Readiness Score across seven pillars: Positioning, Messaging, Website & UX, Conversion, Trust, Market & Competition, and Growth Foundation.

Give me a URL. I'll inspect the homepage, identify the primary bottleneck, and write a shareable report.`,
  scoring: `The Growth Readiness Score is a weighted 0–100 total from seven pillars:

Positioning 20%, Messaging 15%, Website & UX 15%, Conversion 15%, Growth Foundation 15%, Trust 10%, Market & Competition 10%.

The model scores each pillar from evidence on the page. The overall number is computed deterministically from those weights.

Full rubric: /docs/scoring`,
  example: `Public reports live at a permanent /report/[id] link after each investigation.

The scoring framework is documented here: /docs/growth-readiness

Paste a startup URL if you'd like me to run a live audit.`,
  auditMissingUrl: `I can investigate that. What is the startup's URL?`,
  followupUnavailable: `I couldn't resolve an active report for that follow-up. Select a completed investigation and ask again.`,
  unknown: `I specialize in investigating startup growth. Give me a startup URL, or ask what I can analyze.`,
} as const;

export const FALLBACK_REPLY =
  "Whenever you're ready, send a public startup URL and I'll take a look.";

export function rateLimitReply(retryAfterSeconds?: number): string {
  if (retryAfterSeconds && retryAfterSeconds > 0) {
    const hours = Math.max(1, Math.ceil(retryAfterSeconds / 3600));
    return `You've used this period's free investigation. The limit is one audit every 12 hours. Try again in about ${hours} hour${hours === 1 ? "" : "s"}.`;
  }
  return `You've used this period's free investigation. The limit is one audit every 12 hours. Please try again later.`;
}
