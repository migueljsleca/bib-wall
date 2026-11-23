import { describe, expect, it } from "vitest";
import { raceImageLoader, raceImageSrcSet, raceImageUrl } from "./race-image-loader";

describe("prepared race image selection", () => {
  it.each([[290, 320], [580, 640], [870, 960], [1260, 1280], [1920, 1920], [3840, 1920]])(
    "serves an available variant for a %ipx request", (width, expected) => {
      expect(raceImageLoader({ src: "/race-images/abc-960.webp", width }))
        .toBe(`/race-images/abc-${expected}.webp`);
    },
  );
  it("leaves external images alone and only advertises generated widths", () => {
    expect(raceImageUrl("https://example.com/photo.jpg", 320)).toBe("https://example.com/photo.jpg");
    expect(raceImageSrcSet("/logo.svg")).toBeUndefined();
    expect(raceImageSrcSet("/race-images/abc-1920.webp")?.split(", ")).toEqual([
      "/race-images/abc-320.webp 320w", "/race-images/abc-640.webp 640w",
      "/race-images/abc-960.webp 960w", "/race-images/abc-1280.webp 1280w",
      "/race-images/abc-1920.webp 1920w",
    ]);
  });
});
