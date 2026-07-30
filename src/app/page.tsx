import { BibWallClient } from "@/components/bib-wall-client";
import { getRaceEntries } from "@/lib/races";

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ view?: string | string[] }>;
}) {
  const races = await getRaceEntries();
  const view = (await searchParams).view;
  const initialView = view === "list" ? "list" : "grid";

  return <BibWallClient races={races} initialView={initialView} />;
}
