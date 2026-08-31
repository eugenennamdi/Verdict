import {
  AttemptLocalModelProviderError,
  type AuditModelTask,
} from "@/lib/audit/model";

type JsonSchema = {
  type?: unknown;
  properties?: unknown;
  required?: unknown;
  items?: unknown;
  enum?: unknown;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function schemaType(schema: JsonSchema): string {
  return typeof schema.type === "string" ? schema.type.toUpperCase() : "";
}

function validateAgainstSchema(value: unknown, rawSchema: unknown): boolean {
  if (!isRecord(rawSchema)) return true;
  const schema = rawSchema as JsonSchema;
  const type = schemaType(schema);

  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) return false;
  if (type === "STRING" && typeof value !== "string") return false;
  if (type === "BOOLEAN" && typeof value !== "boolean") return false;
  if (type === "INTEGER" && !Number.isInteger(value)) return false;
  if (type === "NUMBER" && (typeof value !== "number" || !Number.isFinite(value))) {
    return false;
  }
  if (type === "ARRAY") {
    return (
      Array.isArray(value) &&
      value.every((item) => validateAgainstSchema(item, schema.items))
    );
  }
  if (type === "OBJECT") {
    if (!isRecord(value)) return false;
    const properties = isRecord(schema.properties) ? schema.properties : {};
    const required = Array.isArray(schema.required)
      ? schema.required.filter((item): item is string => typeof item === "string")
      : [];
    if (required.some((key) => !(key in value))) return false;
    return Object.entries(properties).every(
      ([key, childSchema]) =>
        !(key in value) || validateAgainstSchema(value[key], childSchema)
    );
  }
  return true;
}

const PILLAR_KEYS = [
  "positioning",
  "messaging",
  "website_ux",
  "conversion",
  "trust",
  "competition",
  "growth_foundation",
] as const;

function validateGraderDetails(value: unknown): boolean {
  if (!isRecord(value) || !isRecord(value.pillars)) return false;
  for (const key of PILLAR_KEYS) {
    const pillar = value.pillars[key];
    if (!isRecord(pillar)) return false;
    if (
      typeof pillar.score !== "number" ||
      !Number.isInteger(pillar.score) ||
      pillar.score < 0 ||
      pillar.score > 100
    ) {
      return false;
    }
  }

  if (value.evidence_digests !== undefined) {
    if (!Array.isArray(value.evidence_digests)) return false;
    for (const digest of value.evidence_digests) {
      if (
        !isRecord(digest) ||
        typeof digest.sourceId !== "string" ||
        !/^S[1-9]\d*$/.test(digest.sourceId)
      ) {
        return false;
      }
    }
  }
  return true;
}

function stripMarkdownFence(text: string): string {
  const trimmed = text.trim().replace(/^\uFEFF/, "");
  if (!trimmed.startsWith("```")) return trimmed;

  const firstLineEnd = trimmed.indexOf("\n");
  const lastFence = trimmed.lastIndexOf("```");
  if (firstLineEnd === -1 || lastFence <= firstLineEnd) return trimmed;
  return trimmed.slice(firstLineEnd + 1, lastFence).trim();
}

function firstBalancedJsonObject(text: string): string | undefined {
  const start = text.indexOf("{");
  if (start === -1) return undefined;

  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = start; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth += 1;
    } else if (character === "}") {
      depth -= 1;
      if (depth === 0) return text.slice(start, index + 1);
    }
  }
  return undefined;
}

function removeTrailingJsonCommas(text: string): string {
  let result = "";
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (inString) {
      result += character;
      if (escaped) {
        escaped = false;
      } else if (character === "\\") {
        escaped = true;
      } else if (character === '"') {
        inString = false;
      }
      continue;
    }

    if (character === '"') {
      inString = true;
      result += character;
      continue;
    }
    if (character === ",") {
      let nextIndex = index + 1;
      while (/\s/.test(text[nextIndex] ?? "")) nextIndex += 1;
      if (text[nextIndex] === "}" || text[nextIndex] === "]") continue;
    }
    result += character;
  }
  return result;
}

function structuredOutputCandidates(text: string): string[] {
  const stripped = stripMarkdownFence(text);
  const balanced = firstBalancedJsonObject(stripped);
  const candidates = [text.trim(), stripped, balanced]
    .filter((candidate): candidate is string => Boolean(candidate))
    .flatMap((candidate) => [candidate, removeTrailingJsonCommas(candidate)]);
  return [...new Set(candidates)];
}

export function isNearCompleteGraderOutput(text: string): boolean {
  const candidate = stripMarkdownFence(text);
  const requiredMarkers = [
    "company_name",
    "score_interpretation",
    "pillars",
    "the_verdict",
    "priority_matrix",
    ...PILLAR_KEYS,
  ];
  return (
    candidate.includes("{") &&
    requiredMarkers.every((key) => candidate.includes(`"${key}"`))
  );
}

export function parseAndValidateStructuredOutput(input: {
  task: AuditModelTask;
  text: string;
  schema: unknown;
}): unknown {
  const schemaProperties = isRecord(input.schema) && isRecord(input.schema.properties)
    ? input.schema.properties
    : {};
  const isCanonicalGraderSchema = "pillars" in schemaProperties;
  let parsedAnyCandidate = false;

  for (const candidate of structuredOutputCandidates(input.text)) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(candidate);
      parsedAnyCandidate = true;
    } catch {
      continue;
    }

    const valid =
      validateAgainstSchema(parsed, input.schema) &&
      (!isCanonicalGraderSchema || validateGraderDetails(parsed));
    if (valid) return parsed;
  }

  throw new AttemptLocalModelProviderError(
    parsedAnyCandidate ? "invalid_structured_output" : "malformed_json"
  );
}
