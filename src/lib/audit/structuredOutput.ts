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

export function parseAndValidateStructuredOutput(input: {
  task: AuditModelTask;
  text: string;
  schema: unknown;
}): unknown {
  let parsed: unknown;
  try {
    parsed = JSON.parse(input.text);
  } catch {
    throw new AttemptLocalModelProviderError("malformed_json");
  }

  const schemaProperties = isRecord(input.schema) && isRecord(input.schema.properties)
    ? input.schema.properties
    : {};
  const isCanonicalGraderSchema = "pillars" in schemaProperties;
  const valid =
    validateAgainstSchema(parsed, input.schema) &&
    (!isCanonicalGraderSchema || validateGraderDetails(parsed));
  if (!valid) {
    throw new AttemptLocalModelProviderError("invalid_structured_output");
  }
  return parsed;
}
