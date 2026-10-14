import { describe, expect, it } from "vitest";
import { filtersToQuery, parseFilters } from "./filters";

describe("parseFilters", () => {
  it("keeps valid enum values and numbers", () => {
    expect(parseFilters({ source: "codeur", status: "won", min: "70", q: " site ", page: "2" })).toEqual({
      source: "codeur",
      signal: undefined,
      status: "won",
      minScore: 70,
      q: "site",
      page: 2,
    });
  });

  it("drops unknown enums and out-of-range numbers", () => {
    const f = parseFilters({ source: "linkedin", status: "DROP TABLE", min: "500", page: "-3" });
    expect(f.source).toBeUndefined();
    expect(f.status).toBeUndefined();
    expect(f.minScore).toBeUndefined();
    expect(f.page).toBe(1);
  });

  it("takes the first value of repeated params and caps query length", () => {
    const f = parseFilters({ source: ["bodacc", "codeur"], q: "x".repeat(300) });
    expect(f.source).toBe("bodacc");
    expect(f.q).toHaveLength(100);
  });
});

describe("filtersToQuery", () => {
  it("round-trips filters and omits page 1", () => {
    expect(filtersToQuery({ source: "bodacc", minScore: 70, page: 1 })).toBe("?source=bodacc&min=70");
    expect(filtersToQuery({ source: "bodacc" }, { page: 3 })).toBe("?source=bodacc&page=3");
    expect(filtersToQuery({})).toBe("");
  });
});
