import { describe, expect, it } from "vitest";

import { createTiledItems, getGridColumns } from "./bib-grid";

describe("bib grid geometry", () => {
  it("handles an empty collection without invalid geometry", () => {
    expect(getGridColumns(0)).toBe(1);
    expect(createTiledItems([], 1, 1)).toEqual([]);
  });

  it("keeps small and large collections inside the grid bounds", () => {
    expect(getGridColumns(1)).toBe(1);
    expect(getGridColumns(58)).toBeGreaterThanOrEqual(4);
    expect(getGridColumns(58)).toBeLessThanOrEqual(9);
  });

  it("fills incomplete tiles by repeating the supplied items", () => {
    expect(createTiledItems(["a", "b"], 2, 2)).toEqual(["a", "b", "a", "b"]);
  });
});
