import { describe, expect, it } from "vitest";
import { computeOverallScore } from "./score";

describe("computeOverallScore", () => {
  it("returns 0 when every pillar is 0", () => {
    expect(
      computeOverallScore({
        positioning: 0,
        messaging: 0,
        website_ux: 0,
        conversion: 0,
        trust: 0,
        competition: 0,
        growth_foundation: 0,
      })
    ).toBe(0);
  });

  it("returns 100 when every pillar is 100", () => {
    expect(
      computeOverallScore({
        positioning: 100,
        messaging: 100,
        website_ux: 100,
        conversion: 100,
        trust: 100,
        competition: 100,
        growth_foundation: 100,
      })
    ).toBe(100);
  });

  it("returns 50 when every pillar is 50", () => {
    expect(
      computeOverallScore({
        positioning: 50,
        messaging: 50,
        website_ux: 50,
        conversion: 50,
        trust: 50,
        competition: 50,
        growth_foundation: 50,
      })
    ).toBe(50);
  });

  it("weights positioning at 20%", () => {
    expect(
      computeOverallScore({
        positioning: 100,
        messaging: 0,
        website_ux: 0,
        conversion: 0,
        trust: 0,
        competition: 0,
        growth_foundation: 0,
      })
    ).toBe(20);
  });

  it("weights messaging at 15%", () => {
    expect(
      computeOverallScore({
        positioning: 0,
        messaging: 100,
        website_ux: 0,
        conversion: 0,
        trust: 0,
        competition: 0,
        growth_foundation: 0,
      })
    ).toBe(15);
  });

  it("rounds 17.5 to 18 using Math.round", () => {
    // 50*0.20 + 50*0.15 = 17.5
    expect(
      computeOverallScore({
        positioning: 50,
        messaging: 50,
        website_ux: 0,
        conversion: 0,
        trust: 0,
        competition: 0,
        growth_foundation: 0,
      })
    ).toBe(18);
  });

  it("matches a mixed characterization tuple", () => {
    // 100*0.20 + 80*0.15 + 60*0.15 + 40*0.15 + 20*0.10 + 0*0.10 + 100*0.15
    // = 20 + 12 + 9 + 6 + 2 + 0 + 15 = 64
    expect(
      computeOverallScore({
        positioning: 100,
        messaging: 80,
        website_ux: 60,
        conversion: 40,
        trust: 20,
        competition: 0,
        growth_foundation: 100,
      })
    ).toBe(64);
  });

  it("reads nested { score } objects used by the engine", () => {
    expect(
      computeOverallScore({
        positioning: { score: 100 },
        messaging: { score: 0 },
        website_ux: { score: 0 },
        conversion: { score: 0 },
        trust: { score: 0 },
        competition: { score: 0 },
        growth_foundation: { score: 0 },
      })
    ).toBe(20);
  });

  it("treats missing pillars as 0", () => {
    expect(computeOverallScore({})).toBe(0);
  });
});
