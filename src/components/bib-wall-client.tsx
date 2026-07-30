"use client";

import { BibWall } from "@/components/bib-wall";
import type { WallView } from "@/components/collection-header";
import type { RaceEntry } from "@/lib/race-types";

export function BibWallClient({
  races,
  initialView,
}: {
  races: RaceEntry[];
  initialView: WallView;
}) {
  return <BibWall races={races} initialView={initialView} />;
}
