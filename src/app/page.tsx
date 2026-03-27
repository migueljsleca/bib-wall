import { BibWallClient } from "@/components/bib-wall-client";
import { getRaceEntries } from "@/lib/races";

export default async function Home() {
  const races = await getRaceEntries();

  return <BibWallClient races={races} />;
}
