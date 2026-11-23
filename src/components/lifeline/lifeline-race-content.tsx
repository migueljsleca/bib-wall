import {
  getLifelineEventKey,
  LifelineEventText,
} from "./lifeline-event"
import { RaceTypeTag } from "@/components/race-type-tag"
import { raceImageSrcSet } from "@/lib/race-image-loader"
import type { LifelineMarker } from "./types"

function DistanceIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 256 256"
      className="size-3.5 shrink-0 fill-current"
    >
      <path d="M235.32,73.37,182.63,20.69a16,16,0,0,0-22.63,0L20.68,160a16,16,0,0,0,0,22.63l52.69,52.68a16,16,0,0,0,22.63,0L235.32,96A16,16,0,0,0,235.32,73.37ZM84.68,224,32,171.31l32-32,26.34,26.35a8,8,0,0,0,11.32-11.32L75.31,128,96,107.31l26.34,26.35a8,8,0,0,0,11.32-11.32L107.31,96,128,75.31l26.34,26.35a8,8,0,0,0,11.32-11.32L139.31,64l32-32L224,84.69Z" />
    </svg>
  )
}

function ElevationIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 256 256"
      className="size-3.5 shrink-0 fill-current"
    >
      <path d="M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z" />
    </svg>
  )
}

export function LifelineRaceContent({ marker }: { marker: LifelineMarker }) {
  const race = marker.race
  if (!race) return null

  return (
    <div className="flex w-full max-w-[18rem] flex-col items-start">
      {race.bib && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={race.bib.src}
          srcSet={raceImageSrcSet(race.bib.src)}
          sizes="108px"
          loading="lazy"
          alt={race.bib.alt}
          draggable={false}
          className="mb-5 block h-auto max-h-[4.5rem] w-auto max-w-[6.75rem] object-contain object-left"
        />
      )}

      <RaceTypeTag type={race.type} className="mb-3" />

      <h3 className="text-left text-[15px] font-medium leading-[1.45] tracking-[-0.01em] text-foreground">
        {race.name}
      </h3>

      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-[13px] leading-5 text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <DistanceIcon />
          <span>{race.distance}</span>
        </span>
        <span className="inline-flex items-center gap-1.5">
          <ElevationIcon />
          <span>{race.elevation}</span>
        </span>
      </div>

      {marker.events.length > 0 && (
        <div className="mt-5 space-y-3 border-t border-border/60 pt-4">
          {marker.events.map((event, index) => (
            <p
              key={getLifelineEventKey(event, index)}
              className="whitespace-pre-line text-left text-[13px] leading-[1.6] tracking-[-0.005em] text-muted-foreground"
            >
              <LifelineEventText event={event} />
            </p>
          ))}
        </div>
      )}
    </div>
  )
}
