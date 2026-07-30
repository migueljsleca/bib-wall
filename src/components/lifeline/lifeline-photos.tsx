"use client"

import {
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent,
} from "react"
import { cn } from "@/lib/utils"
import { LifelineEventMedia } from "./lifeline-event"
import { LifelineGalleryLightbox } from "./lifeline-gallery-lightbox"
import {
  LifelineLightbox,
  type LifelineLightboxStart,
} from "./lifeline-lightbox"
import type { LifelineMarker, LifelinePhoto } from "./types"

/** Tweak these */
const CARD_WIDTH = 180
/** Matches the events column's pt-6 — cards align with the first event's text. */
const EVENT_TOP = 24
const MAX_TILT_DEG = 6
/**
 * How far along a card the next one in the stack starts — 0.6 leaves
 * a solid margin of every card visible under its neighbor.
 */
const STACK_OVERLAP = 0.6
/**
 * Stacks cascade diagonally: the last card sits level with the event
 * text and each one before it hangs this much lower, so neighbors
 * overlap corner-to-corner instead of side-by-side.
 */
const CASCADE_Y = 170
/** Event text column: max-w-[18rem] plus breathing room. */
const TEXT_ZONE = 288 + 24
/** Pointer travel below this is a click (opens the lightbox), not a drag. */
const CLICK_SLOP = 4
/** Fingers wobble more than mice — touch presses get extra tap room. */
const TOUCH_CLICK_SLOP = 10

/** A fresh tilt on every visit — rolled once per card mount. */
function randomTilt() {
  return 2 + Math.random() * (MAX_TILT_DEG - 2)
}

/**
 * The interactive photo card, positioning-agnostic: drag moves it for
 * the session, a press without travel expands it into the lightbox.
 * Desktop floats it over the track (absolute + left/top); the vertical
 * layout drops it into normal flow.
 */
export function LifelinePhotoCard({
  photo,
  rotate,
  width,
  className,
  style,
  animateIntro = false,
  introDelay = 0,
  introDuration = 420,
}: {
  photo: LifelinePhoto
  /** Resolved resting tilt, degrees. */
  rotate: number
  width: number
  /** Positioning context from the caller (e.g. "absolute"). */
  className?: string
  style?: CSSProperties
  animateIntro?: boolean
  introDelay?: number
  introDuration?: number
}) {
  const [offset, setOffset] = useState({ x: 0, y: 0 })
  const [active, setActive] = useState(false)
  const [lightboxStart, setLightboxStart] =
    useState<LifelineLightboxStart | null>(null)
  const cardRef = useRef<HTMLDivElement>(null)
  const drag = useRef({
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
    slop: CLICK_SLOP,
  })

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => {
    // The desktop track scrubs on drag — a card drag must not reach it.
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    drag.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: offset.x,
      baseY: offset.y,
      moved: false,
      slop: event.pointerType === "touch" ? TOUCH_CLICK_SLOP : CLICK_SLOP,
    }
    setActive(true)
  }

  const onPointerMove = (event: PointerEvent<HTMLDivElement>) => {
    if (!active) return
    const dx = event.clientX - drag.current.startX
    const dy = event.clientY - drag.current.startY
    if (Math.hypot(dx, dy) > drag.current.slop) drag.current.moved = true
    setOffset({ x: drag.current.baseX + dx, y: drag.current.baseY + dy })
  }

  // The card's real geometry: bounding-box center (rotation preserves
  // it) plus untransformed layout size — never the rotated hull, which
  // is what made the lightbox clone jump on open.
  const measureCard = (): LifelineLightboxStart | null => {
    const el = cardRef.current
    if (!el) return null
    const rect = el.getBoundingClientRect()
    // Recover the rendered scale (hover grows the card 3%) from the
    // rotated hull: for tilt θ, hullWidth = (w·cosθ + h·sinθ)·scale.
    const w0 = el.offsetWidth
    const h0 = el.offsetHeight
    const rad = Math.abs((rotate * Math.PI) / 180)
    const hull = w0 * Math.cos(rad) + h0 * Math.sin(rad)
    const scale = hull > 0 ? rect.width / hull : 1
    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      w: w0 * scale,
      h: h0 * scale,
      mediaTime: el.querySelector("video")?.currentTime,
    }
  }

  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    setActive(false)
    // A press that never travelled is a click — expand to the lightbox.
    if (!drag.current.moved && !lightboxStart) {
      setLightboxStart(measureCard())
    }
  }

  // The browser claiming the gesture (a vertical pan-y scroll on
  // touch) is not a click — reset without opening.
  const onPointerCancel = (event: PointerEvent<HTMLDivElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    setActive(false)
    setOffset({ x: drag.current.baseX, y: drag.current.baseY })
  }

  return (
    <>
      <div
        ref={cardRef}
        data-lifeline-interactive=""
        className={cn(
          // pan-y keeps page scrolling alive on touch: a vertical swipe
          // starting on a card scrolls the timeline (the browser claims
          // the gesture and fires pointercancel); horizontal drags move
          // the card.
          "group/photo pointer-events-auto cursor-grab touch-pan-y transition-[scale] duration-200 ease-out",
          active
            ? "z-50 scale-[1.05] cursor-grabbing"
            : "z-20 hover:z-40 hover:scale-[1.03]",
          lightboxStart && "invisible",
          className,
        )}
        style={
          {
            ...style,
            width,
            transform: `translate(${offset.x}px, ${offset.y}px) rotate(${rotate}deg)`,
          } as CSSProperties
        }
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        <div
          className={cn(
            "overflow-hidden rounded-[3px] shadow-xl ring-1 ring-black/10 transition-shadow duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:ring-white/15",
            animateIntro && "lifeline-marker-intro",
            active
              ? "shadow-2xl"
              : "group-hover/photo:shadow-2xl",
          )}
          style={
            animateIntro
              ? ({
                  animationDelay: `${introDelay}ms`,
                  "--lifeline-marker-fade-ms": `${introDuration}ms`,
                } as CSSProperties)
              : undefined
          }
        >
          <LifelineEventMedia
            media={photo}
            className="pointer-events-none block w-full"
          />
        </div>
      </div>
      {lightboxStart && (
        <LifelineLightbox
          photo={photo}
          rotate={rotate}
          start={lightboxStart}
          getHome={measureCard}
          onClosed={() => setLightboxStart(null)}
        />
      )}
    </>
  )
}

const RACE_STACK_WIDTH = 165
const RACE_STACK_LANDSCAPE_HEIGHT = 3 / 4
const RACE_STACK_PORTRAIT_HEIGHT = 4 / 3
const RACE_STACK_MAX_X = 12
const RACE_STACK_MAX_Y = 36

/**
 * A compact deck for race galleries. Every card keeps an exposed edge,
 * so it can be grabbed and pulled out without turning a photo-heavy race
 * into a page-tall column.
 */
export function LifelineRacePhotoStack({
  photos,
  className,
}: {
  photos: LifelinePhoto[]
  className?: string
}) {
  const [deckOffset, setDeckOffset] = useState({ x: 0, y: 0 })
  const [deckActive, setDeckActive] = useState(false)
  const [galleryStart, setGalleryStart] =
    useState<LifelineLightboxStart | null>(null)
  const [allPortrait, setAllPortrait] = useState(false)
  const deckRef = useRef<HTMLButtonElement>(null)
  const cardRefs = useRef<Array<HTMLSpanElement | null>>([])
  const deckDrag = useRef({
    startX: 0,
    startY: 0,
    baseX: 0,
    baseY: 0,
    moved: false,
    slop: CLICK_SLOP,
  })

  useEffect(() => {
    if (photos.length < 2) return

    let cancelled = false

    Promise.all(
      photos.map(
        (photo) =>
          new Promise<boolean>((resolve) => {
            const probe = new window.Image()
            probe.onload = () =>
              resolve(probe.naturalHeight > probe.naturalWidth)
            probe.onerror = () => resolve(false)
            probe.src = photo.src
          }),
      ),
    ).then((orientations) => {
      if (!cancelled) setAllPortrait(orientations.every(Boolean))
    })

    return () => {
      cancelled = true
    }
  }, [photos])

  if (photos.length === 0) return null

  const isStack = photos.length > 1
  const stackX = isStack
    ? Math.min(4, RACE_STACK_MAX_X / (photos.length - 1))
    : 0
  const stackY = isStack
    ? Math.min(14, RACE_STACK_MAX_Y / (photos.length - 1))
    : 0
  const stackHeight =
    RACE_STACK_WIDTH *
      (allPortrait
        ? RACE_STACK_PORTRAIT_HEIGHT
        : RACE_STACK_LANDSCAPE_HEIGHT) +
    (photos.length - 1) * stackY
  const stackWidth =
    RACE_STACK_WIDTH + (photos.length - 1) * stackX
  const measureStackCard = (
    index: number,
  ): LifelineLightboxStart | null => {
    const el = cardRefs.current[index]
    if (!el) return null

    const cardRotate = photos[index]?.rotate ?? 0
    const rect = el.getBoundingClientRect()
    const width = el.offsetWidth
    const height = el.offsetHeight
    const radians = Math.abs((cardRotate * Math.PI) / 180)
    const rotatedHullWidth =
      width * Math.cos(radians) + height * Math.sin(radians)
    const scale = rotatedHullWidth > 0 ? rect.width / rotatedHullWidth : 1

    return {
      cx: rect.left + rect.width / 2,
      cy: rect.top + rect.height / 2,
      w: width * scale,
      h: height * scale,
      mediaTime: el.querySelector("video")?.currentTime,
    }
  }

  const openGallery = () => {
    const start = measureStackCard(0)
    if (start) setGalleryStart(start)
  }

  const onDeckPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    event.stopPropagation()
    event.preventDefault()
    event.currentTarget.setPointerCapture(event.pointerId)
    deckDrag.current = {
      startX: event.clientX,
      startY: event.clientY,
      baseX: deckOffset.x,
      baseY: deckOffset.y,
      moved: false,
      slop: event.pointerType === "touch" ? TOUCH_CLICK_SLOP : CLICK_SLOP,
    }
    setDeckActive(true)
  }

  const onDeckPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    if (!deckActive) return
    const dx = event.clientX - deckDrag.current.startX
    const dy = event.clientY - deckDrag.current.startY
    if (Math.hypot(dx, dy) > deckDrag.current.slop) {
      deckDrag.current.moved = true
    }
    setDeckOffset({
      x: deckDrag.current.baseX + dx,
      y: deckDrag.current.baseY + dy,
    })
  }

  const onDeckPointerUp = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDeckActive(false)
    if (!deckDrag.current.moved) openGallery()
  }

  const onDeckPointerCancel = (event: PointerEvent<HTMLButtonElement>) => {
    event.currentTarget.releasePointerCapture(event.pointerId)
    setDeckActive(false)
    setDeckOffset({
      x: deckDrag.current.baseX,
      y: deckDrag.current.baseY,
    })
  }

  return (
    <div className={cn("pointer-events-none", className)}>
      {isStack ? (
        <button
          ref={deckRef}
          type="button"
          data-lifeline-interactive=""
          aria-label={`Open ${photos.length} race photos`}
          className={cn(
            "group group/deck pointer-events-auto relative block touch-pan-y text-left transition-[height] duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35 focus-visible:ring-offset-4 focus-visible:ring-offset-background",
            deckActive ? "cursor-grabbing" : "cursor-grab",
            galleryStart && "invisible",
          )}
          style={{
            width: stackWidth,
            height: stackHeight,
            transform: `translate(${deckOffset.x}px, ${deckOffset.y}px)`,
          }}
          onPointerDown={onDeckPointerDown}
          onPointerMove={onDeckPointerMove}
          onPointerUp={onDeckPointerUp}
          onPointerCancel={onDeckPointerCancel}
          onClick={(event) => {
            if (event.detail === 0) openGallery()
          }}
        >
          <span
            aria-hidden="true"
            className={cn(
              "absolute inset-0 block transition-transform duration-200 ease-out",
              deckActive
                ? "scale-[1.05]"
                : "group-hover:scale-[1.03] group-focus-visible:scale-[1.03]",
            )}
          >
            {photos.map((photo, index) => {
              const depth = index

              return (
                <span
                  key={photo.src}
                  ref={(node) => {
                    cardRefs.current[depth] = node
                  }}
                  className={cn(
                    "absolute left-0 top-0 block overflow-hidden rounded-[3px] ring-1 ring-black/10 transition-[left,top,transform,box-shadow] duration-300 ease-[cubic-bezier(0.32,0.72,0,1)] dark:ring-white/15",
                    depth === 0
                      ? "shadow-xl group-hover/deck:shadow-2xl"
                      : "shadow-md",
                  )}
                  style={{
                    left: depth * stackX,
                    top: depth * stackY,
                    width: RACE_STACK_WIDTH,
                    zIndex: photos.length - depth,
                    transform: `rotate(${photo.rotate ?? 0}deg)`,
                  }}
                >
                  <LifelineEventMedia
                    media={photo}
                    className={cn(
                      "pointer-events-none block w-full object-cover",
                      allPortrait ? "aspect-[3/4]" : "aspect-[4/3]",
                    )}
                  />
                </span>
              )
            })}
          </span>
        </button>
      ) : (
        photos.map((photo, index) => (
          <LifelinePhotoCard
            key={`${photo.src}-${index}`}
            photo={photo}
            rotate={photo.rotate ?? 0}
            width={photo.width ?? 180}
            className="relative"
          />
        ))
      )}

      {galleryStart && (
        <LifelineGalleryLightbox
          photos={photos}
          triggerRef={deckRef}
          start={galleryStart}
          rotate={photos[0]?.rotate ?? 0}
          getHome={(index) => {
            const home = measureStackCard(index)
            return home
              ? {
                  start: home,
                  rotate: photos[index]?.rotate ?? 0,
                }
              : null
          }}
          onClosed={() => setGalleryStart(null)}
        />
      )}
    </div>
  )
}

function FloatingCard({
  photo,
  stackIndex,
  stackCount,
  x,
  defaultY,
  width,
  animateIntro,
  introDelay,
  introDuration,
}: {
  photo: LifelinePhoto
  stackIndex: number
  stackCount: number
  /** Resolved left position within the track. */
  x: number
  /** Cascade position when the photo has no explicit y. */
  defaultY: number
  width: number
  animateIntro: boolean
  introDelay: number
  introDuration: number
}) {
  const y = photo.y ?? defaultY
  // Rolled once per mount: solo cards flip a coin for direction;
  // neighbors in a stack lean away from each other so the pile reads
  // as scattered.
  const [mountTilt] = useState(() => {
    const sign =
      stackCount > 1
        ? stackIndex % 2 === 0
          ? -1
          : 1
        : Math.random() > 0.5
          ? 1
          : -1
    return sign * randomTilt()
  })

  return (
    <LifelinePhotoCard
      photo={photo}
      rotate={photo.rotate ?? mountTilt}
      width={width}
      className="absolute"
      style={{ left: x, top: `calc(var(--lifeline-rail) + ${y}px)` }}
      animateIntro={animateIntro}
      introDelay={introDelay}
      introDuration={introDuration}
    />
  )
}

/**
 * Always-visible media scattered over the timeline — anchored to their
 * marker's slot, tilted and overlapping like photos in a notebook.
 * Rendered inside the transformed track, so they ride the scroll;
 * dragging repositions a card for the session.
 */
export function LifelineFloatingPhotos({
  markers,
  offsets,
  widths,
  animateIntro = false,
  getIntroDelay,
  getIntroDuration,
}: {
  markers: LifelineMarker[]
  offsets: number[]
  widths: number[]
  animateIntro?: boolean
  getIntroDelay?: (markerIndex: number) => number
  getIntroDuration?: (markerIndex: number) => number
}) {
  const trackEnd =
    offsets.length > 0
      ? offsets[offsets.length - 1] + widths[widths.length - 1]
      : 0

  // Intro sync: a card fades in when the rail tip reaches it, i.e. on
  // the schedule of the marker whose slot its center sits over — which
  // is usually days past its anchor.
  const markerIndexAt = (x: number) => {
    for (let index = offsets.length - 1; index >= 0; index--) {
      if (offsets[index] <= x) return index
    }
    return 0
  }

  return (
    <div aria-hidden="true" className="pointer-events-none absolute inset-0">
      {markers.map((marker, index) => {
        // Race photos live directly beneath their marker content so they
        // never cover the bib, metrics, or notes. Generic lifelines keep
        // the original loose-photo treatment.
        if (!marker.photos?.length || marker.race) return null

        // The card's free run: after this day's own text column, up to
        // the start of the next day that has text of its own.
        const zoneStart =
          offsets[index] + (marker.events.length > 0 ? TEXT_ZONE : 0)
        const nextTextIndex = markers.findIndex(
          (candidate, candidateIndex) =>
            candidateIndex > index && candidate.events.length > 0,
        )
        const zoneEnd =
          nextTextIndex === -1 ? trackEnd : offsets[nextTextIndex]

        // Stacks center as a group so a lone card sits in the middle
        // of the gap and a pile spreads evenly around it. Each card
        // starts STACK_OVERLAP of the way along the one beneath it.
        const steps: number[] = []
        let fan = 0
        for (const stacked of marker.photos) {
          steps.push(fan)
          fan += (stacked.width ?? CARD_WIDTH) * STACK_OVERLAP
        }
        const photoCount = marker.photos.length
        const lastPhoto = marker.photos[photoCount - 1]
        const groupWidth =
          steps[steps.length - 1] + (lastPhoto.width ?? CARD_WIDTH)

        return marker.photos.map((photo, photoIndex) => {
          const width = photo.width ?? CARD_WIDTH
          // Default home: centered in the text-free run between this
          // day's events and the next day that has text — comfortably
          // away from both columns.
          const x =
            photo.x !== undefined
              ? offsets[index] + photo.x * widths[index]
              : Math.max(
                  zoneStart,
                  zoneStart +
                    (zoneEnd - zoneStart - groupWidth) / 2 +
                    steps[photoIndex],
                )
          const introIndex = markerIndexAt(x + width / 2)
          // The last card of a stack sits level with the event text;
          // earlier cards hang progressively lower — the diagonal.
          const defaultY =
            EVENT_TOP + (photoCount - 1 - photoIndex) * CASCADE_Y

          return (
            <FloatingCard
              key={`${marker.id}-${photoIndex}`}
              photo={photo}
              stackIndex={photoIndex}
              stackCount={photoCount}
              x={x}
              defaultY={defaultY}
              width={width}
              animateIntro={animateIntro}
              introDelay={getIntroDelay?.(introIndex) ?? 0}
              introDuration={getIntroDuration?.(introIndex) ?? 420}
            />
          )
        })
      })}
    </div>
  )
}
