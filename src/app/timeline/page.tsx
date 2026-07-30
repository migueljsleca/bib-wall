import type { Metadata } from "next";

import { RaceTimeline } from "@/components/race-timeline";
import { getRaceEntries } from "@/lib/races";

export const metadata: Metadata = {
  title: "Bib Wall",
  description: "A chronological trail through the Bib Wall race collection.",
};

export default async function TimelinePage() {
  const races = await getRaceEntries();

  return <RaceTimeline races={races} />;
}
