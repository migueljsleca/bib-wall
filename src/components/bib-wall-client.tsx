"use client";

import dynamic from "next/dynamic";

import type { RaceEntry } from "@/lib/race-types";

const ClientOnlyBibWall = dynamic(
  () => import("@/components/bib-wall").then((module) => module.BibWall),
  {
    ssr: false,
  }
);

export function BibWallClient({ races }: { races: RaceEntry[] }) {
  return <ClientOnlyBibWall races={races} />;
}
