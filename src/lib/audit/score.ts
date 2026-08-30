export const PILLAR_WEIGHTS = Object.freeze({
  positioning: 0.20,
  messaging: 0.15,
  website_ux: 0.15,
  conversion: 0.15,
  trust: 0.10,
  competition: 0.10,
  growth_foundation: 0.15,
} as const);

export const GROWTH_READINESS_FRAMEWORK = Object.freeze({
  id: "verdict-growth-readiness",
  version: 1,
  pillars: PILLAR_WEIGHTS,
});

export type PillarKey = keyof typeof PILLAR_WEIGHTS;

export type PillarScores = Record<PillarKey, number>;

type PillarInput =
  | PillarScores
  | Record<string, number | { score?: number } | null | undefined>;

function readScore(pillars: PillarInput, key: PillarKey): number {
  const value = pillars[key];
  if (typeof value === "number") return value || 0;
  if (value && typeof value === "object") return value.score || 0;
  return 0;
}

/**
 * Deterministic Growth Readiness Score.
 * Must stay byte-identical to the historical engine formula.
 */
export function computeOverallScore(pillars: PillarInput): number {
  return Math.round(
    readScore(pillars, "positioning") * PILLAR_WEIGHTS.positioning +
      readScore(pillars, "messaging") * PILLAR_WEIGHTS.messaging +
      readScore(pillars, "website_ux") * PILLAR_WEIGHTS.website_ux +
      readScore(pillars, "conversion") * PILLAR_WEIGHTS.conversion +
      readScore(pillars, "trust") * PILLAR_WEIGHTS.trust +
      readScore(pillars, "competition") * PILLAR_WEIGHTS.competition +
      readScore(pillars, "growth_foundation") * PILLAR_WEIGHTS.growth_foundation
  );
}
