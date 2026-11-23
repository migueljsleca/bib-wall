"use client";

import Image, { type ImageProps } from "next/image";

import { raceImageLoader } from "@/lib/race-image-loader";

export function RaceImage({ alt, ...props }: ImageProps) {
  const generated = typeof props.src === "string" && props.src.startsWith("/race-images/");
  return <Image {...props} alt={alt} loader={generated ? raceImageLoader : undefined} />;
}
