import type { LookupFn } from "@/lib/security/url";
import {
  assertSafeAuditUrl,
  parseAndAssertHttpUrl,
} from "@/lib/security/url";
import type { EvidenceCategory } from "@/lib/audit/evidence";

export const DEFAULT_DISCOVERY_CANDIDATE_LIMIT = 40;
const MAX_DISCOVERY_CANDIDATE_LIMIT = 50;
const FIRECRAWL_MAP_TIMEOUT_MS = 10_000;

const STATIC_EXTENSIONS =
  /\.(?:avif|bmp|css|csv|eot|gif|ico|jpe?g|js|json|map|mp3|mp4|mov|pdf|png|svg|ttf|webm|webp|woff2?|xml|zip)$/i;

const REJECTED_PATH_SEGMENTS = new Set([
  "_next",
  "assets",
  "static",
  "images",
  "img",
  "login",
  "logout",
  "signin",
  "sign-in",
  "account",
  "cart",
  "checkout",
  "admin",
]);

const CATEGORY_RULES: ReadonlyArray<{
  category: EvidenceCategory;
  priority: number;
  keywords: readonly string[];
}> = [
  {
    category: "conversion",
    priority: 100,
    keywords: ["pricing", "plans", "demo", "signup", "sign-up", "trial"],
  },
  {
    category: "trust",
    priority: 90,
    keywords: [
      "customers",
      "customer-stories",
      "case-studies",
      "case-study",
      "security",
      "testimonials",
      "reviews",
    ],
  },
  {
    category: "positioning",
    priority: 80,
    keywords: ["product", "features", "platform", "solutions", "use-cases"],
  },
  {
    category: "identity",
    priority: 70,
    keywords: ["about", "company", "team", "mission"],
  },
  {
    category: "messaging",
    priority: 65,
    keywords: ["why", "overview"],
  },
  {
    category: "market",
    priority: 60,
    keywords: ["compare", "vs", "alternatives", "alternative", "competitors"],
  },
  {
    category: "growth",
    priority: 50,
    keywords: [
      "blog",
      "docs",
      "changelog",
      "integrations",
      "partners",
      "resources",
      "community",
    ],
  },
];

export type CandidateRanking = {
  priority: number;
  matchedKeyword?: string;
};

export type EvidenceCandidate = {
  url: string;
  path: string;
  category?: EvidenceCategory;
  ranking: CandidateRanking;
};

export type PathClassification = {
  category?: EvidenceCategory;
  ranking: CandidateRanking;
};

export type MapDiscovery = (input: {
  url: string;
  limit: number;
  timeoutMs: number;
}) => Promise<unknown>;

export type DiscoverInternalPagesOptions = {
  limit?: number;
  timeoutMs?: number;
  mapDiscovery?: MapDiscovery;
  lookup?: LookupFn;
};

function pathSegments(pathname: string): string[] {
  return pathname
    .toLowerCase()
    .split("/")
    .map((segment) => segment.trim())
    .filter(Boolean);
}

export function classifyEvidencePath(pathname: string): PathClassification {
  const segments = pathSegments(pathname);

  for (const rule of CATEGORY_RULES) {
    const matchedKeyword = rule.keywords.find((keyword) =>
      segments.includes(keyword)
    );
    if (matchedKeyword) {
      return {
        category: rule.category,
        ranking: { priority: rule.priority, matchedKeyword },
      };
    }
  }

  return { ranking: { priority: 0 } };
}

function normalizeHostname(hostname: string): string {
  return hostname.toLowerCase().replace(/\.+$/, "");
}

function discoverySiteRoot(hostname: string): string {
  const normalized = normalizeHostname(hostname);
  return normalized.startsWith("www.") ? normalized.slice(4) : normalized;
}

export function isSameDiscoverySite(root: URL, candidate: URL): boolean {
  const rootSite = discoverySiteRoot(root.hostname);
  const candidateHost = discoverySiteRoot(candidate.hostname);
  return (
    candidateHost === rootSite || candidateHost.endsWith(`.${rootSite}`)
  );
}

function normalizePath(pathname: string): string {
  const collapsed = pathname.replace(/\/{2,}/g, "/");
  if (collapsed === "/") return "/";
  return collapsed.replace(/\/+$/, "") || "/";
}

function isRejectedPath(pathname: string): boolean {
  if (STATIC_EXTENSIONS.test(pathname)) return true;
  return pathSegments(pathname).some((segment) =>
    REJECTED_PATH_SEGMENTS.has(segment)
  );
}

function normalizeCandidate(root: URL, raw: string): URL | null {
  let candidate: URL;
  try {
    candidate = parseAndAssertHttpUrl(new URL(raw, root.href).href);
  } catch {
    return null;
  }

  if (!isSameDiscoverySite(root, candidate)) return null;

  candidate.hash = "";
  candidate.search = "";
  candidate.pathname = normalizePath(candidate.pathname);

  if (root.protocol === "https:" || candidate.protocol === "https:") {
    candidate.protocol = "https:";
  }

  if (isRejectedPath(candidate.pathname)) return null;
  return candidate;
}

function candidateKey(candidate: URL): string {
  return `${normalizeHostname(candidate.hostname)}${candidate.port ? `:${candidate.port}` : ""}${candidate.pathname}`;
}

function rawUrlsFromMapResult(result: unknown): string[] {
  const links =
    result && typeof result === "object" && "links" in result
      ? (result as { links?: unknown }).links
      : result;
  if (!Array.isArray(links)) return [];

  return links.flatMap((link) => {
    if (typeof link === "string") return [link];
    if (
      link &&
      typeof link === "object" &&
      "url" in link &&
      typeof (link as { url?: unknown }).url === "string"
    ) {
      return [(link as { url: string }).url];
    }
    return [];
  });
}

export function normalizeAndRankCandidates(
  root: URL,
  rawCandidates: string[],
  limit = DEFAULT_DISCOVERY_CANDIDATE_LIMIT
): EvidenceCandidate[] {
  const cappedLimit = Math.min(
    MAX_DISCOVERY_CANDIDATE_LIMIT,
    Math.max(1, Math.floor(limit))
  );
  const rootNormalized = normalizeCandidate(root, root.href);
  const rootKey = rootNormalized ? candidateKey(rootNormalized) : undefined;
  const deduped = new Map<string, URL>();

  for (const raw of rawCandidates.slice(0, cappedLimit * 4)) {
    const candidate = normalizeCandidate(root, raw);
    if (!candidate) continue;

    const key = candidateKey(candidate);
    if (key === rootKey) continue;

    const existing = deduped.get(key);
    if (!existing || candidate.protocol === "https:") {
      deduped.set(key, candidate);
    }
  }

  return Array.from(deduped.values())
    .map((candidate) => {
      const classification = classifyEvidencePath(candidate.pathname);
      return {
        url: candidate.href,
        path: candidate.pathname,
        ...(classification.category
          ? { category: classification.category }
          : {}),
        ranking: classification.ranking,
      };
    })
    .sort(
      (left, right) =>
        right.ranking.priority - left.ranking.priority ||
        left.path.localeCompare(right.path)
    )
    .slice(0, cappedLimit);
}

async function firecrawlMapDiscovery(input: {
  url: string;
  limit: number;
  timeoutMs: number;
}): Promise<unknown> {
  const firecrawlKey = process.env.FIRECRAWL_API_KEY;
  if (!firecrawlKey) return [];

  const response = await fetch("https://api.firecrawl.dev/v2/map", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${firecrawlKey}`,
    },
    body: JSON.stringify({
      url: input.url,
      limit: input.limit,
      includeSubdomains: false,
      ignoreQueryParameters: true,
      timeout: input.timeoutMs,
    }),
    signal: AbortSignal.timeout(input.timeoutMs),
  });

  if (!response.ok) return [];
  return response.json();
}

export async function discoverInternalPages(
  rootUrl: string,
  options: DiscoverInternalPagesOptions = {}
): Promise<EvidenceCandidate[]> {
  const root = await assertSafeAuditUrl(rootUrl, { lookup: options.lookup });
  const limit = Math.min(
    MAX_DISCOVERY_CANDIDATE_LIMIT,
    Math.max(
      1,
      Math.floor(options.limit ?? DEFAULT_DISCOVERY_CANDIDATE_LIMIT)
    )
  );
  const timeoutMs = Math.max(
    1,
    Math.min(
      FIRECRAWL_MAP_TIMEOUT_MS,
      Math.floor(options.timeoutMs ?? FIRECRAWL_MAP_TIMEOUT_MS)
    )
  );

  let rawCandidates: string[];
  try {
    const result = await (options.mapDiscovery ?? firecrawlMapDiscovery)({
      url: root.href,
      limit: limit * 2,
      timeoutMs,
    });
    rawCandidates = rawUrlsFromMapResult(result);
  } catch {
    return [];
  }

  const candidates = normalizeAndRankCandidates(root, rawCandidates, limit);
  const validationByHostname = new Map<string, Promise<boolean>>();

  const validated = await Promise.all(
    candidates.map(async (candidate) => {
      const candidateUrl = new URL(candidate.url);
      if (candidateUrl.hostname === root.hostname) return candidate;

      let validation = validationByHostname.get(candidateUrl.hostname);
      if (!validation) {
        validation = assertSafeAuditUrl(candidate.url, { lookup: options.lookup })
          .then(() => true)
          .catch(() => false);
        validationByHostname.set(candidateUrl.hostname, validation);
      }

      return (await validation) ? candidate : null;
    })
  );

  return validated.filter(
    (candidate): candidate is EvidenceCandidate => candidate !== null
  );
}
