export type DocsNavItem = {
  title: string;
  href: string;
  description: string;
  badge?: string;
};

export type DocsNavGroup = {
  title: string;
  items: DocsNavItem[];
};

export const DOCS_NAVIGATION: DocsNavGroup[] = [
  {
    title: "Getting Started",
    items: [
      {
        title: "Introduction",
        href: "/docs",
        description:
          "What Verdict is, who it is for, and how the human and agent surfaces work.",
      },
      {
        title: "Quickstart",
        href: "/docs/quickstart",
        description:
          "Step-by-step guide to running your first audit, reviewing the report, and asking follow-ups.",
      },
    ],
  },
  {
    title: "Using Verdict",
    items: [
      {
        title: "Running an audit",
        href: "/docs/running-an-audit",
        description:
          "Auditable URL criteria, input validation, execution timing, and quota handling.",
      },
      {
        title: "Reading your result",
        href: "/docs/reading-your-result",
        description:
          "Navigating the Growth Readiness Score, company profile, primary bottleneck, and full report.",
      },
      {
        title: "Growth Readiness Score",
        href: "/docs/growth-readiness-score",
        description:
          "How the 0–100 score is structured, why it is deterministic, and how to interpret it.",
      },
      {
        title: "Audit follow-ups",
        href: "/docs/audit-follow-ups",
        description:
          "Asking grounded conversational questions against the preserved audit context.",
      },
    ],
  },
  {
    title: "How Verdict Works",
    items: [
      {
        title: "Investigation model",
        href: "/docs/investigation-model",
        description:
          "Multi-page discovery, selective acquisition, evidence coverage, and deterministic grading.",
      },
      {
        title: "Evidence & relevance",
        href: "/docs/evidence-and-relevance",
        description:
          "Separating page acquisition from relevance admission to prevent noise and pollution.",
      },
      {
        title: "Evaluation framework",
        href: "/docs/evaluation-framework",
        description:
          "The seven core growth dimensions and their diagnostic evaluation signals.",
      },
      {
        title: "Recommendations",
        href: "/docs/recommendations",
        description:
          "Actionable roadmap prioritization, impact/effort assessment, and bottleneck resolution.",
      },
    ],
  },
  {
    title: "Agent API",
    items: [
      {
        title: "Overview",
        href: "/docs/agent-api",
        description:
          "Programmatic growth intelligence endpoint for autonomous agents via x402 on Base.",
      },
      {
        title: "Quickstart",
        href: "/docs/agent-quickstart",
        description:
          "Copy-pastable integration examples in cURL and TypeScript using standard x402 clients.",
      },
      {
        title: "x402 payment flow",
        href: "/docs/x402-flow",
        description:
          "The challenge-and-retry HTTP 402 protocol, payment headers, signing, and settlement.",
      },
      {
        title: "API reference",
        href: "/docs/api-reference",
        description:
          "Complete endpoint specification, request schema, response payload, and status codes.",
      },
      {
        title: "Errors",
        href: "/docs/errors",
        description:
          "Sanitized, deterministic error codes and safe client-side recovery patterns.",
      },
    ],
  },
  {
    title: "Trust",
    items: [
      {
        title: "Security & privacy",
        href: "/docs/security",
        description:
          "Public web inspection boundaries, non-custodial payments, and secret safety.",
      },
      {
        title: "Payments",
        href: "/docs/payments",
        description:
          "Human free quotas, Base USDC entitlement, and agent x402 payment rails.",
      },
      {
        title: "Reliability",
        href: "/docs/reliability",
        description:
          "Bounded execution, multi-provider failover, structured validation, and fail-closed safety.",
      },
    ],
  },
  {
    title: "Reference",
    items: [
      {
        title: "Scoring methodology",
        href: "/docs/scoring-methodology",
        description:
          "Mathematical weighting formula, dimension definitions, and rubric score tiers.",
      },
      {
        title: "Limits & usage",
        href: "/docs/limits",
        description:
          "Free rolling 24-hour quota, paid audit entitlements, and agent rate parameters.",
      },
      {
        title: "FAQ",
        href: "/docs/faq",
        description:
          "Answers to common technical, product, evaluation, and integration questions.",
      },
      {
        title: "Brand assets",
        href: "/docs/brand-assets",
        description:
          "Official Verdict logos, marks, guidelines, and vector downloads.",
      },
    ],
  },
];

export const ALL_DOCS_PAGES: DocsNavItem[] = DOCS_NAVIGATION.flatMap(
  (group) => group.items
);

export function getDocsPagination(currentHref: string): {
  prev?: DocsNavItem;
  next?: DocsNavItem;
} {
  const normalizedCurrent = currentHref.replace(/\/$/, "");
  const index = ALL_DOCS_PAGES.findIndex(
    (item) => item.href.replace(/\/$/, "") === normalizedCurrent
  );

  if (index === -1) return {};

  return {
    prev: index > 0 ? ALL_DOCS_PAGES[index - 1] : undefined,
    next: index < ALL_DOCS_PAGES.length - 1 ? ALL_DOCS_PAGES[index + 1] : undefined,
  };
}

export function getDocsGroupForHref(currentHref: string): DocsNavGroup | undefined {
  const normalizedCurrent = currentHref.replace(/\/$/, "");
  return DOCS_NAVIGATION.find((group) =>
    group.items.some((item) => item.href.replace(/\/$/, "") === normalizedCurrent)
  );
}
