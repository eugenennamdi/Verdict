import type { AuditContextPackV1 } from "@/lib/audit/auditContext";
import {
  computeOverallScore,
  PILLAR_WEIGHTS,
  type PillarKey,
  type PillarScores,
} from "@/lib/audit/score";
import type { AuditContextSource } from "@/lib/audit/auditContext";
import type { LoadedAuditContext } from "@/lib/conversation/auditContextLoader";
import type { AuditQaAnswer } from "@/lib/conversation/auditAnswer";

export type AuditFollowupRoute =
  | { type: "general" }
  | { type: "missing_context" }
  | { type: "grounded_qa" }
  | { type: "source_list" }
  | { type: "source_count" }
  | { type: "source_exists"; term: string }
  | { type: "score_breakdown" }
  | { type: "counterfactual"; overrides: Partial<PillarScores>; invalid?: string }
  | { type: "completeness" }
  | { type: "research_extension" }
  | { type: "comparison_required" };

const PILLAR_LABELS: Record<PillarKey, string> = {
  positioning: "Positioning",
  messaging: "Messaging",
  website_ux: "Website & UX",
  conversion: "Conversion",
  trust: "Trust & Credibility",
  competition: "Market & Competition",
  growth_foundation: "Growth Foundation",
};

const PILLAR_ALIASES: Record<PillarKey, string[]> = {
  positioning: ["positioning"],
  messaging: ["messaging"],
  website_ux: ["website and ux", "website & ux", "website ux", "ux"],
  conversion: ["conversion"],
  trust: ["trust and credibility", "trust & credibility", "trust", "credibility"],
  competition: ["market and competition", "market & competition", "competition", "market"],
  growth_foundation: ["growth foundation", "growth"],
};

const AUDIT_TOPIC_PATTERN =
  /\b(score|scored|pillar|positioning|messaging|conversion|trust|credibility|website|ux|competition|growth|evidence|source|pricing|customers?|case stud|security|inspect|investigation|report|recommend|fix first|confidence|verdict|weighted|weight)\b/i;

const EXISTING_AUDIT_PATTERN =
  /\b(why did (?:it|they)|what did you (?:see|find)|did you inspect|did you look|which sources? support|how confident|what should (?:they|we) fix|what does (?:that|the score|\d{1,3}) mean|explain (?:it|the|this)|their score)\b/i;

const COMPARISON_PATTERN =
  /\b(compare|comparison|versus|vs\.?|previous audit|other audit)\b/i;

const RESEARCH_EXTENSION_PATTERN =
  /\b(?:can|could|would|please)?\s*(?:you\s+)?(?:inspect|research|check|look at|visit)\b.*\b(?:too|also|next|additional|another|now)\b/i;

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function parseCounterfactual(question: string): AuditFollowupRoute | null {
  if (!/\b(what if|if|hypothetical|became|were|changed?|raised?|increased?)\b/i.test(question)) {
    return null;
  }

  const overrides: Partial<PillarScores> = {};
  let invalid: string | undefined;
  for (const key of Object.keys(PILLAR_ALIASES) as PillarKey[]) {
    for (const alias of PILLAR_ALIASES[key]) {
      const match = question.match(
        new RegExp(
          `\\b${escapeRegex(alias)}\\b(?:\\s+score)?\\s*(?:were|was|became|to|at|=|is)\\s*(-?\\d{1,3}(?:\\.\\d+)?)`,
          "i"
        )
      );
      if (!match) continue;
      const value = Number(match[1]);
      if (!Number.isFinite(value) || value < 0 || value > 100) {
        invalid = `${PILLAR_LABELS[key]} must be between 0 and 100.`;
      } else {
        overrides[key] = value;
      }
      break;
    }
  }

  if (Object.keys(overrides).length === 0 && !invalid) return null;
  return { type: "counterfactual", overrides, ...(invalid ? { invalid } : {}) };
}

function sourceTerm(question: string): string {
  const match = question.match(
    /(?:did you|have you)?\s*(?:inspect(?:ed)?|look(?:ed)? at|review(?:ed)?|visit(?:ed)?|check(?:ed)?)\s+(?:the\s+|their\s+|its\s+)?([^?.,]+)/i
  );
  return (match?.[1] || "")
    .replace(/\b(page|pages|section|site)\b/gi, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyAuditFollowup(
  question: string,
  hasActiveReport: boolean
): AuditFollowupRoute {
  const trimmed = question.trim();
  if (!trimmed) return { type: "general" };
  if (/https?:\/\/|\b[a-z0-9-]+\.(?:com|io|co|ai|app|dev)\b/i.test(trimmed)) {
    return { type: "general" };
  }

  if (COMPARISON_PATTERN.test(trimmed)) {
    return hasActiveReport
      ? { type: "comparison_required" }
      : { type: "missing_context" };
  }
  if (RESEARCH_EXTENSION_PATTERN.test(trimmed)) {
    return hasActiveReport
      ? { type: "research_extension" }
      : { type: "missing_context" };
  }

  const counterfactual = parseCounterfactual(trimmed);
  if (counterfactual) {
    return hasActiveReport ? counterfactual : { type: "missing_context" };
  }

  if (/\b(how many|number of)\b.*\b(pages?|sources?)\b.*\b(inspect|look|review|source)/i.test(trimmed)) {
    return hasActiveReport ? { type: "source_count" } : { type: "missing_context" };
  }
  if (/\b(which|what)\b.*\b(pages?|sources?)\b.*\b(inspect|look|review|use)/i.test(trimmed)) {
    return hasActiveReport ? { type: "source_list" } : { type: "missing_context" };
  }
  if (/\b(did you|have you)\b.*\b(inspect|look|review|visit|check)/i.test(trimmed)) {
    return hasActiveReport
      ? { type: "source_exists", term: sourceTerm(trimmed) }
      : { type: "missing_context" };
  }
  if (/\b(exhaustive|exhaustively|complete investigation|research complete|why did (?:you|it) stop|budget|coverage threshold)\b/i.test(trimmed)) {
    return hasActiveReport ? { type: "completeness" } : { type: "missing_context" };
  }
  if (/\b(score breakdown|how (?:did you|get|is|was).*(?:score|calculated)|how did you get \d{1,3}|how is the score calculated|show.*weights?|weighted total)\b/i.test(trimmed)) {
    return hasActiveReport ? { type: "score_breakdown" } : { type: "general" };
  }

  const shortContextual = /^(why|how so|what does that mean|which source|what evidence)\??$/i.test(trimmed);
  const auditSpecific = AUDIT_TOPIC_PATTERN.test(trimmed) || EXISTING_AUDIT_PATTERN.test(trimmed) || shortContextual;
  if (auditSpecific) {
    return hasActiveReport ? { type: "grounded_qa" } : { type: "missing_context" };
  }
  return { type: "general" };
}

export type ScoreBreakdownLine = {
  pillar: PillarKey;
  label: string;
  score: number;
  weight: number;
  contribution: number;
};

export function scoreBreakdown(context: AuditContextPackV1): {
  lines: ScoreBreakdownLine[];
  total: number;
} {
  const scores = Object.fromEntries(
    (Object.keys(PILLAR_WEIGHTS) as PillarKey[]).map((key) => [
      key,
      context.pillars[key].score,
    ])
  ) as PillarScores;
  return {
    lines: (Object.keys(PILLAR_WEIGHTS) as PillarKey[]).map((key) => ({
      pillar: key,
      label: PILLAR_LABELS[key],
      score: scores[key],
      weight: PILLAR_WEIGHTS[key],
      contribution: scores[key] * PILLAR_WEIGHTS[key],
    })),
    total: computeOverallScore(scores),
  };
}

export function counterfactualScore(
  context: AuditContextPackV1,
  overrides: Partial<PillarScores>
): { actual: number; counterfactual: number; scores: PillarScores } {
  const scores = Object.fromEntries(
    (Object.keys(PILLAR_WEIGHTS) as PillarKey[]).map((key) => [
      key,
      context.pillars[key].score,
    ])
  ) as PillarScores;
  const hypothetical = { ...scores };
  for (const key of Object.keys(overrides) as PillarKey[]) {
    const value = overrides[key];
    if (typeof value !== "number" || value < 0 || value > 100) {
      throw new RangeError(`${PILLAR_LABELS[key]} must be between 0 and 100.`);
    }
    hypothetical[key] = value;
  }
  return {
    actual: computeOverallScore(scores),
    counterfactual: computeOverallScore(hypothetical),
    scores: hypothetical,
  };
}

function normalizedWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .split(/\s+/)
    .filter((word) => word && !["their", "the", "a", "an"].includes(word));
}

const SOURCE_ALIASES: Record<string, string[]> = {
  customer: ["customer", "customers", "case", "stories", "testimonials"],
  customers: ["customer", "customers", "case", "stories", "testimonials"],
  pricing: ["pricing", "price", "plans"],
  security: ["security", "compliance"],
  docs: ["docs", "documentation"],
  documentation: ["docs", "documentation"],
  product: ["product", "features"],
  integration: ["integration", "integrations"],
  integrations: ["integration", "integrations"],
};

export function matchingSources(
  sources: AuditContextSource[],
  term: string
): AuditContextSource[] {
  const words = normalizedWords(term).flatMap(
    (word) => SOURCE_ALIASES[word] ?? [word]
  );
  if (words.length === 0) return [];
  return sources.filter((source) => {
    const path = source.path
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, " ");
    const requested = normalizedWords(term);
    return (
      words.some((word) => path.includes(word)) ||
      requested.some((word) => word === source.category)
    );
  });
}

function sourcesText(sources: AuditContextSource[]): string {
  return sources
    .map((source) => `${source.sourceId} · ${source.path || "/"}`)
    .join(", ");
}

function deterministicAnswer(
  answer: string,
  input: Omit<AuditQaAnswer, "answer">
): AuditQaAnswer {
  return { answer, ...input };
}

function referencedPillar(question: string): PillarKey | null {
  const normalized = question.toLowerCase();
  for (const key of Object.keys(PILLAR_ALIASES) as PillarKey[]) {
    if (
      PILLAR_ALIASES[key].some((alias) =>
        normalized.includes(alias.toLowerCase())
      )
    ) {
      return key;
    }
  }
  return null;
}

export function fallbackGroundedAnswer(
  loaded: LoadedAuditContext,
  question: string
): AuditQaAnswer {
  const context = loaded.context;
  const pillarKey = referencedPillar(question);

  if (/\b(weight|weighted|percentage|percent)\b/i.test(question) && pillarKey) {
    const weight = Math.round(PILLAR_WEIGHTS[pillarKey] * 100);
    return deterministicAnswer(
      `${PILLAR_LABELS[pillarKey]} contributes **${weight}%** in the canonical Verdict Growth Readiness framework. The stored framework defines that weight; this audit context does not contain a separate historical rationale for why the framework designers chose it.`,
      {
        citations: [],
        answerType: "framework",
        confidence: "high",
        limitations: ["Framework-design rationale is not stored in this audit."],
      }
    );
  }

  if (/\b(fix first|recommend|priority|prioritize|improve first)\b/i.test(question)) {
    const first = context.priorityMatrix[0];
    if (first) {
      return deterministicAnswer(
        `The first stored priority is **${first.task}** (${first.impact} impact, ${first.effort} effort). ${first.why}`,
        {
          citations: [],
          answerType: "recommendation",
          confidence: "medium",
          limitations: [
            "This recommendation comes from the completed audit and does not reflect new research.",
          ],
        }
      );
    }
  }

  if (pillarKey) {
    const pillar = context.pillars[pillarKey];
    const gap = pillar.weaknesses[0]
      ? ` The leading stored weakness is: ${pillar.weaknesses[0]}`
      : "";
    return deterministicAnswer(
      `${PILLAR_LABELS[pillarKey]} scored **${pillar.score}/100**. The stored audit basis is: ${pillar.reason}${gap} Confidence in that pillar was recorded as ${pillar.confidence || "unspecified"}.`,
      {
        citations: [],
        answerType: "score_explanation",
        confidence: pillar.confidence.toLowerCase() === "high" ? "high" : "medium",
        limitations: [
          "The interpretive model was unavailable, so this answer is limited to the stored audit fields.",
        ],
      }
    );
  }

  const sourcesWithFindings = context.sources.filter(
    (source) => source.keyFindings.length > 0
  );
  if (/\b(evidence|source|support|find|saw|see)\b/i.test(question)) {
    if (sourcesWithFindings.length > 0) {
      return deterministicAnswer(
        sourcesWithFindings
          .map(
            (source) =>
              `${source.keyFindings[0]} [${source.sourceId}]`
          )
          .join(" "),
        {
          citations: sourcesWithFindings.map((source) => source.sourceId),
          answerType: "evidence",
          confidence: "medium",
          limitations: [
            "Only the compact findings retained by the completed audit are available.",
          ],
        }
      );
    }
    return deterministicAnswer(
      "The report does not retain enough source-level semantic evidence to answer that confidently.",
      {
        citations: [],
        answerType: "evidence",
        confidence: "low",
        limitations: ["No source-level semantic findings are available."],
      }
    );
  }

  return deterministicAnswer(
    "I could not complete the interpretive answer, but the stored audit remains unchanged. Ask about a specific pillar, source, priority, or score calculation and I can answer from deterministic report fields.",
    {
      citations: [],
      answerType: "general",
      confidence: "low",
      limitations: ["The interpretive model was unavailable."],
    }
  );
}

export function answerDeterministically(
  route: AuditFollowupRoute,
  loaded: LoadedAuditContext,
  question: string
): AuditQaAnswer | null {
  const context = loaded.context;
  if (route.type === "source_list" || route.type === "source_count") {
    const count = context.sources.length;
    const detail = sourcesText(context.sources);
    if (count === 0) {
      return deterministicAnswer(
        "This report does not retain an inspected-source list.",
        {
          citations: [],
          answerType: "evidence",
          confidence: "low",
          limitations: ["Source provenance is unavailable for this report."],
        }
      );
    }
    const answer =
      route.type === "source_count"
        ? `The bounded investigation inspected ${count} page${count === 1 ? "" : "s"}: ${detail}.`
        : `The inspected sources were: ${detail}.`;
    return deterministicAnswer(answer, {
      citations: context.sources.map((source) => source.sourceId),
      answerType: "evidence",
      confidence: "high",
      limitations: [],
    });
  }

  if (route.type === "source_exists") {
    const matches = matchingSources(context.sources, route.term);
    if (matches.length > 0) {
      return deterministicAnswer(
        `Yes. The stored audit shows ${matches
          .map((source) => `${source.path} [${source.sourceId}]`)
          .join(", ")} as inspected.`,
        {
          citations: matches.map((source) => source.sourceId),
          answerType: "evidence",
          confidence: "high",
          limitations: [],
        }
      );
    }
    return deterministicAnswer(
      `No. The stored source list does not show a ${route.term || "matching"} page as inspected. This was a bounded investigation, so that does not mean the page does not exist.`,
      {
        citations: [],
        answerType: "evidence",
        confidence: "high",
        limitations: ["No matching inspected source is present in this audit."],
      }
    );
  }

  if (route.type === "score_breakdown") {
    const breakdown = scoreBreakdown(context);
    const lines = breakdown.lines.map(
      (line) =>
        `- ${line.label}: ${line.score} × ${Math.round(line.weight * 100)}% = ${line.contribution.toFixed(1)}`
    );
    return deterministicAnswer(
      `The score is calculated from the stored pillar scores and canonical weights:\n\n${lines.join("\n")}\n\nThe weighted total rounds to **${breakdown.total}/100**.`,
      {
        citations: [],
        answerType: "score_explanation",
        confidence: "high",
        limitations: [],
      }
    );
  }

  if (route.type === "counterfactual") {
    if (route.invalid) {
      return deterministicAnswer(route.invalid, {
        citations: [],
        answerType: "counterfactual",
        confidence: "high",
        limitations: ["No hypothetical score was calculated."],
      });
    }
    const result = counterfactualScore(context, route.overrides);
    const changes = (Object.keys(route.overrides) as PillarKey[])
      .map((key) => `${PILLAR_LABELS[key]} = ${result.scores[key]}`)
      .join(", ");
    return deterministicAnswer(
      `The stored score remains **${result.actual}/100**. With ${changes}, the deterministic counterfactual is **${result.counterfactual}/100**. This does not modify the report.`,
      {
        citations: [],
        answerType: "counterfactual",
        confidence: "high",
        limitations: ["This changes pillar scores only; it does not simulate new company evidence."],
      }
    );
  }

  if (route.type === "completeness") {
    const { stopReason, budgetUsage } = context.investigation;
    const unsuccessfulAttempts = Math.max(
      0,
      budgetUsage.pagesUsed - budgetUsage.pagesInspected
    );
    const explanations: Record<typeof stopReason, string> = {
      sufficient:
        "The investigation stopped after its evidence-coverage threshold was reached.",
      page_budget: `The investigation used its maximum ${budgetUsage.maxPages}-page research budget.`,
      planning_round_budget: `The investigation used its maximum ${budgetUsage.maxPlanningRounds} planning rounds.`,
      character_budget: `The investigation reached its ${budgetUsage.maxEvidenceChars.toLocaleString()}-character evidence budget after ${budgetUsage.pagesInspected} inspected pages.`,
      gather_timeout:
        "The investigation stopped when its bounded evidence-gathering time expired.",
      discovery_failed:
        "Internal-page discovery was unavailable, so the audit completed from the evidence it had.",
      no_candidates:
        "No additional useful internal-page candidates were available to inspect.",
      no_selection:
        "The planner found no additional candidate worth selecting within the remaining budget.",
    };
    const attemptNote =
      unsuccessfulAttempts > 0
        ? ` ${unsuccessfulAttempts} page attempt${unsuccessfulAttempts === 1 ? " did" : "s did"} not become a usable inspected source.`
        : "";
    return deterministicAnswer(
      `${explanations[stopReason]}${attemptNote} It was a bounded investigation, not an exhaustive crawl of the site.`,
      {
        citations: [],
        answerType: "completeness",
        confidence: "high",
        limitations: ["Verdict does not characterize bounded audits as exhaustive."],
      }
    );
  }

  if (route.type === "research_extension") {
    return deterministicAnswer(
      "That would require a new bounded research-extension action. I have not inspected the requested page in this conversation, and Phase 5A-2 does not start new website acquisition from follow-up chat.",
      {
        citations: [],
        answerType: "research_extension",
        confidence: "high",
        limitations: ["No new page was fetched."],
      }
    );
  }

  if (route.type === "comparison_required") {
    return deterministicAnswer(
      "A grounded comparison needs two explicit report references. This conversation currently resolves one active audit, so please identify the other investigation you mean.",
      {
        citations: [],
        answerType: "comparison_required",
        confidence: "high",
        limitations: ["Cross-report comparison is not enabled in this slice."],
      }
    );
  }

  if (
    route.type === "grounded_qa" &&
    !loaded.sourceSemanticsAvailable &&
    /\b(what (?:did|does).*(?:page|pricing|source).*(?:say|show|find)|exactly.*(?:page|source))\b/i.test(
      question
    )
  ) {
    return deterministicAnswer(
      "This older report does not retain enough source-level semantic detail to answer that confidently. I can identify which pages were inspected and explain the stored scores, but I should not reconstruct page claims that were not preserved.",
      {
        citations: [],
        answerType: "evidence",
        confidence: "low",
        limitations: ["Source-level semantic findings are unavailable for this legacy report."],
      }
    );
  }

  return null;
}
