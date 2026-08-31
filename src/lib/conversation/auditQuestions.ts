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
  | { type: "overall_score" }
  | { type: "pillar_score"; pillar: PillarKey }
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

  if (
    /\b(?:what|which)\s+(?:was|is)\s+(?:our|the|this\s+company(?:'s)?|their)?\s*growth readiness score\b|\bwhat\s+growth readiness score\s+did\b/i.test(
      trimmed
    )
  ) {
    return hasActiveReport ? { type: "overall_score" } : { type: "missing_context" };
  }

  const explicitScorePillar = referencedPillar(trimmed);
  if (
    explicitScorePillar &&
    (/\bwhat\s+(?:score|rating)\s+did\b/i.test(trimmed) ||
      /\bwhat\s+(?:was|is)\b.*\b(?:score|rating)\b/i.test(trimmed) ||
      /\bhow\s+(?:much|many points)\b.*\b(?:score|rating|get)\b/i.test(trimmed))
  ) {
    return hasActiveReport
      ? { type: "pillar_score", pillar: explicitScorePillar }
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
    .map((source) => source.path || "/")
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

function pillarStanding(
  context: AuditContextPackV1,
  pillarKey: PillarKey
): string {
  const scores = (Object.keys(context.pillars) as PillarKey[]).map(
    (key) => context.pillars[key].score
  );
  const strongest = Math.max(...scores);
  const weakest = Math.min(...scores);
  const score = context.pillars[pillarKey].score;
  if (strongest === weakest) return "was in line with the other areas";
  if (score === strongest) {
    return scores.filter((value) => value === strongest).length === 1
      ? "was the strongest area"
      : "was one of the strongest areas";
  }
  if (score === weakest) {
    return scores.filter((value) => value === weakest).length === 1
      ? "was the weakest area"
      : "was one of the weakest areas";
  }
  return "sat between the strongest and weakest areas";
}

function pillarSignalsLabel(pillarKey: PillarKey | null): string {
  if (!pillarKey) return "relevant";
  const labels: Record<PillarKey, string> = {
    positioning: "positioning",
    messaging: "messaging",
    website_ux: "website and UX",
    conversion: "conversion",
    trust: "trust",
    competition: "market and competition",
    growth_foundation: "growth foundation",
  };
  return labels[pillarKey];
}

function isHomepageOnly(loaded: LoadedAuditContext): boolean {
  const sources = loaded.context.sources;
  const pagesAccepted =
    loaded.context.investigation.pagesAccepted ?? sources.length;
  return (
    pagesAccepted === 1 &&
    sources.length === 1 &&
    sources[0]?.role === "homepage"
  );
}

function withoutPublicPillarScores(
  answer: string,
  context: AuditContextPackV1
): string {
  let sanitized = answer;
  for (const pillarKey of Object.keys(PILLAR_ALIASES) as PillarKey[]) {
    const aliases = [PILLAR_LABELS[pillarKey], ...PILLAR_ALIASES[pillarKey]]
      .sort((left, right) => right.length - left.length)
      .map(escapeRegex)
      .join("|");
    const replacement = `${PILLAR_LABELS[pillarKey]} ${pillarStanding(
      context,
      pillarKey
    )}`;
    sanitized = sanitized
      .replace(
        new RegExp(
          `\\b(?:${aliases})\\s+(?:scored|received|got|was\\s+rated)\\s+(?:(?:the\\s+)?(?:highest|lowest)\\s*)?(?:at\\s+)?\\(?\\*{0,2}\\d{1,3}(?:\\s*\\/\\s*100)?\\*{0,2}\\)?`,
          "gi"
        ),
        replacement
      )
      .replace(
        new RegExp(
          `\\b(?:${aliases})\\s*(?:score\\s*)?[:=]\\s*\\*{0,2}\\d{1,3}(?:\\s*\\/\\s*100)?\\*{0,2}`,
          "gi"
        ),
        replacement
      );
  }
  return sanitized.replace(/\s{2,}/g, " ").trim();
}

export function applyPublicAuditQaPolicy(
  answer: AuditQaAnswer,
  loaded: LoadedAuditContext,
  question: string
): AuditQaAnswer {
  const limitations = answer.limitations
    .filter(
      (limitation) =>
        !/framework-weighted|score\s+is\s+.*calculation|single\s+page|homepage\s+inspection|crawler|debug/i.test(
          limitation
        )
    )
    .slice(0, 4);

  if (isHomepageOnly(loaded)) {
    limitations.push(
      `Based on the homepage inspected for this audit; additional ${pillarSignalsLabel(
        referencedPillar(question)
      )} signals may exist elsewhere on the site.`
    );
  }

  return {
    ...answer,
    answer: withoutPublicPillarScores(answer.answer, loaded.context)
      .replace(/\s*\[(?:source\s+)?S\d+\]/gi, "")
      .replace(/\b(?:source\s+)?S\d+\s*·?\s*/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim(),
    limitations: [...new Set(limitations)],
  };
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
      `${PILLAR_LABELS[pillarKey]} ${pillarStanding(context, pillarKey)}. The stored audit basis is: ${pillar.reason}${gap} Confidence in that area was recorded as ${pillar.confidence || "unspecified"}.`,
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

  if (route.type === "overall_score") {
    return deterministicAnswer(
      `The Growth Readiness Score was **${context.outcome.overallScore}/100**.`,
      {
        citations: [],
        answerType: "score_explanation",
        confidence: "high",
        limitations: [],
      }
    );
  }

  if (route.type === "pillar_score") {
    const pillar = context.pillars[route.pillar];
    const gap = pillar.weaknesses[0]
      ? ` The leading stored weakness is: ${pillar.weaknesses[0]}`
      : "";
    return deterministicAnswer(
      `Verdict doesn't expose individual dimension scores. ${PILLAR_LABELS[
        route.pillar
      ]} ${pillarStanding(context, route.pillar)} in this audit because ${pillar.reason}${gap}`,
      {
        citations: [],
        answerType: "score_explanation",
        confidence:
          pillar.confidence.toLowerCase() === "high" ? "high" : "medium",
        limitations: [],
      }
    );
  }

  if (route.type === "score_breakdown") {
    const breakdown = scoreBreakdown(context);
    return deterministicAnswer(
      `The Growth Readiness Score is **${breakdown.total}/100**. It is calculated deterministically from seven weighted dimensions. Verdict doesn't expose the individual dimension scores.`,
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
    return deterministicAnswer(
      `The stored Growth Readiness Score remains **${result.actual}/100**. With the requested hypothetical dimension change, the deterministic counterfactual is **${result.counterfactual}/100**. This does not modify the report.`,
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
    const acceptedPages =
      budgetUsage.pagesAccepted ?? budgetUsage.pagesInspected;
    const unsuccessfulAttempts = Math.max(
      0,
      budgetUsage.pagesUsed - acceptedPages
    );
    const explanations: Record<typeof stopReason, string> = {
      sufficient:
        "The investigation stopped after its evidence-coverage threshold was reached.",
      page_budget: `The investigation used its maximum ${budgetUsage.maxPages}-page research budget.`,
      planning_round_budget: `The investigation used its maximum ${budgetUsage.maxPlanningRounds} planning rounds.`,
      character_budget: `The investigation reached its ${budgetUsage.maxEvidenceChars.toLocaleString()}-character evidence budget after ${acceptedPages} accepted evidence pages.`,
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
        ? ` ${unsuccessfulAttempts} page attempt${unsuccessfulAttempts === 1 ? " did" : "s did"} not become an accepted evidence source.`
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
