import { CollectionHeader } from "@/components/collection-header"
import {
  LifelineShell,
  LifelineStage,
} from "@/components/lifeline-shell"
import { Lifeline } from "@/components/lifeline"
import type { LifelineMarker } from "@/components/lifeline/types"
import {
  formatRaceDate,
  getDistancePrecision,
  parseMetricValue,
  parseRaceDate,
} from "@/lib/race-format"
import type { RaceEntry } from "@/lib/race-types"

const PHOTO_ROTATIONS = [-3.5, 2.2, -1.8, 3, -2.4, 1.4]

function getRaceNotes(notes: string) {
  const normalized = notes.replace(/\r\n/g, "\n").trim()

  if (!normalized || normalized.toLowerCase() === "metadata pending update.") {
    return []
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(
      (block) =>
        block.length > 0 &&
        !/^\[[^\]]+\]\(https?:\/\/[^)]+\)$/i.test(block),
    )
}

function toMarkers(races: RaceEntry[]): LifelineMarker[] {
  return [...races]
    .sort((left, right) => parseRaceDate(left.date) - parseRaceDate(right.date))
    .map((race, index) => ({
        id: race.slug,
        year: index,
        age: String(index + 1).padStart(2, "0"),
        label: formatRaceDate(race.date),
        events: getRaceNotes(race.notes),
        race: {
          name: race.raceName,
          type: race.raceType,
          distance: race.distance,
          elevation: race.elevation,
          bib: race.bibImage
            ? {
                src: race.bibImage,
                alt: `${race.raceName} race bib`,
              }
            : undefined,
        },
        photos:
          race.photos.length > 0
            ? race.photos.map((src, photoIndex) => ({
                src,
                alt: `${race.raceName} race photo ${photoIndex + 1}`,
                rotate:
                  PHOTO_ROTATIONS[
                    (index + photoIndex) % PHOTO_ROTATIONS.length
                  ],
                width: 180,
              }))
            : undefined,
      }))
}

export function RaceTimeline({ races }: { races: RaceEntry[] }) {
  const markers = toMarkers(races)
  const totalDistance = races.reduce(
    (sum, race) => sum + parseMetricValue(race.distance, "km"),
    0,
  )
  const totalElevation = races.reduce(
    (sum, race) => sum + parseMetricValue(race.elevation, "m"),
    0,
  )
  const distancePrecision = getDistancePrecision(totalDistance)

  return (
    <LifelineShell className="bg-background text-foreground">
      <CollectionHeader
        activeView="timeline"
        count={races.length}
        distance={totalDistance}
        elevation={totalElevation}
        distancePrecision={distancePrecision}
      />

      <LifelineStage className="pt-[57px]">
        {markers.length > 0 ? (
          <Lifeline
            markers={markers}
            birthYear={0}
            title="Bib Wall race timeline"
            mode="page"
            className="h-full"
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center text-sm text-muted-foreground">
            Add a race to begin the timeline.
          </div>
        )}
      </LifelineStage>
    </LifelineShell>
  )
}
