import { describe, expect, it } from "vitest";

import {
  formatRaceDate,
  getDistancePrecision,
  parseMetricValue,
  parseRaceDate,
} from "./race-format";

describe("race formatting", () => {
  it("parses metric values and rejects mismatched units", () => {
    expect(parseMetricValue("42.2 km", "km")).toBe(42.2);
    expect(parseMetricValue("1,250 m", "m")).toBe(1250);
    expect(parseMetricValue("500 m", "km")).toBe(0);
  });

  it("chooses the precision needed by the distance total", () => {
    expect(getDistancePrecision(100)).toBe(0);
    expect(getDistancePrecision(100.5)).toBe(1);
  });

  it("parses and formats race dates while preserving invalid input", () => {
    expect(parseRaceDate("31/12/2025")).toBeGreaterThan(0);
    expect(parseRaceDate("pending")).toBe(0);
    expect(formatRaceDate("31/12/2025")).toBe("Dec 31, 2025");
    expect(formatRaceDate("pending")).toBe("pending");
  });
});
