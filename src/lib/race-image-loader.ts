import type { ImageLoaderProps } from "next/image";

import widths from "./race-image-widths.json";

export function raceImageLoader({ src, width }: ImageLoaderProps) {
  const selectedWidth = widths.find((candidate) => candidate >= width) ?? widths.at(-1)!;
  return src.replace(/-\d+\.webp$/, `-${selectedWidth}.webp`);
}

export function raceImageUrl(src: string, width: number) {
  return src.startsWith("/race-images/") ? raceImageLoader({ src, width }) : src;
}

export function raceImageSrcSet(src: string) {
  if (!src.startsWith("/race-images/")) return undefined;
  return widths.map((width) => `${raceImageUrl(src, width)} ${width}w`).join(", ");
}
