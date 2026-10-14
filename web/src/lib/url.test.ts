import { describe, expect, it } from "vitest";
import { safeUrl } from "./url";

describe("safeUrl", () => {
  it("allows http and https", () => {
    expect(safeUrl("https://example.com/a")).toBe("https://example.com/a");
    expect(safeUrl("http://example.com")).toBe("http://example.com/");
  });

  it("rejects script and data schemes, garbage and empty values", () => {
    expect(safeUrl("javascript:alert(1)")).toBeUndefined();
    expect(safeUrl("data:text/html,<script>")).toBeUndefined();
    expect(safeUrl("not a url")).toBeUndefined();
    expect(safeUrl(null)).toBeUndefined();
  });
});
