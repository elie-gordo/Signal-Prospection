import { describe, expect, it } from "vitest";
import { HOT_SCORE } from "../types";
import { computeStats, filterLeads } from "./demo";
import { DEMO_LEADS, DEMO_NOW } from "./fixtures";

describe("filterLeads", () => {
  it("hides ignored leads unless explicitly requested", () => {
    expect(filterLeads(DEMO_LEADS, {}).some((l) => l.status === "ignored")).toBe(false);
    const ignored = filterLeads(DEMO_LEADS, { status: "ignored" });
    expect(ignored.length).toBeGreaterThan(0);
    expect(ignored.every((l) => l.status === "ignored")).toBe(true);
  });

  it("combines source and min score, sorted by score desc", () => {
    const res = filterLeads(DEMO_LEADS, { source: "codeur", minScore: 60 });
    expect(res.every((l) => l.source === "codeur" && l.score >= 60)).toBe(true);
    expect(res.map((l) => l.score)).toEqual([...res.map((l) => l.score)].sort((a, b) => b - a));
  });

  it("searches title, company name and city case-insensitively", () => {
    const city = DEMO_LEADS.find((l) => l.company?.city)?.company?.city as string;
    const res = filterLeads(DEMO_LEADS, { q: city.toUpperCase() });
    expect(res.length).toBeGreaterThan(0);
  });
});

describe("computeStats", () => {
  const stats = computeStats(DEMO_LEADS, DEMO_NOW);

  it("counts are consistent with the dataset", () => {
    expect(stats.total).toBe(DEMO_LEADS.length);
    expect(stats.bySource.reduce((s, b) => s + b.count, 0)).toBe(DEMO_LEADS.length);
    expect(stats.scoreBuckets.reduce((s, b) => s + b.count, 0)).toBe(DEMO_LEADS.length);
    expect(stats.hot).toBe(
      DEMO_LEADS.filter((l) => l.score >= HOT_SCORE && (l.status === "new" || l.status === "qualified")).length,
    );
  });

  it("returns 14 days ending today", () => {
    expect(stats.byDay).toHaveLength(14);
    expect(stats.byDay.at(-1)?.day).toBe(new Date(DEMO_NOW).toISOString().slice(0, 10));
  });

  it("uses publication date for the 7-day window", () => {
    expect(stats.last7Days).toBeLessThan(stats.total);
  });
});
