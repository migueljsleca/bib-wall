"use client"

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react"
import { ChevronLeft, ChevronRight, X } from "lucide-react"
import { createPortal } from "react-dom"
import { cn } from "@/lib/utils"
import { LifelineEventMedia } from "./lifeline-event"
import type { LifelineLightboxStart } from "./lifeline-lightbox"
import type { LifelinePhoto } from "./types"

const OPEN_MS = 520
const CLOSE_MS = 180
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"
const FIT = 0.76

function getOpeningTransform(
  start: LifelineLightboxStart,
  rotate: number,
) {
  const viewportWidth = window.innerWidth
  const viewportHeight = window.innerHeight
  const aspect = start.h / start.w
  const targetWidth = Math.min(
    viewportWidth * FIT,
    (viewportHeight * FIT) / aspect,
  )
  const targetHeight = targetWidth * aspect

  return `translate3d(${start.cx - viewportWidth / 2}px, ${
    start.cy - viewportHeight / 2
  }px, 0) scale(${start.w / targetWidth}, ${
    start.h / targetHeight
  }) rotate(${rotate}deg)`
}

interface GalleryHome {
  start: LifelineLightboxStart
  rotate: number
}

export function LifelineGalleryLightbox({
  photos,
  triggerRef,
  start,
  rotate,
  getHome,
  onClosed,
}: {
  photos: LifelinePhoto[]
  triggerRef: RefObject<HTMLButtonElement | null>
  start: LifelineLightboxStart
  rotate: number
  getHome: (index: number) => GalleryHome | null
  onClosed: () => void
}) {
  const [index, setIndex] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const figureRef = useRef<HTMLElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const closing = useRef(false)
  const [isClosing, setIsClosing] = useState(false)
  const [isReturning, setIsReturning] = useState(false)
  const [reducedMotion] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  )
  const [visible, setVisible] = useState(reducedMotion)
  const [figureTransform, setFigureTransform] = useState(() =>
    reducedMotion ? "none" : getOpeningTransform(start, rotate),
  )

  const previous = useCallback(() => {
    setIndex((current) => (current - 1 + photos.length) % photos.length)
  }, [photos.length])

  const next = useCallback(() => {
    setIndex((current) => (current + 1) % photos.length)
  }, [photos.length])

  const close = useCallback(() => {
    if (closing.current) return
    closing.current = true
    setIsClosing(true)
    setVisible(false)

    if (reducedMotion) {
      onClosed()
      return
    }

    const home = getHome(index)
    const figure = figureRef.current

    if (home && figure) {
      const targetWidth = figure.offsetWidth
      const targetHeight = figure.offsetHeight

      if (targetWidth > 0 && targetHeight > 0) {
        setIsReturning(true)
        setFigureTransform(
          `translate3d(${home.start.cx - window.innerWidth / 2}px, ${
            home.start.cy - window.innerHeight / 2
          }px, 0) scale(${home.start.w / targetWidth}, ${
            home.start.h / targetHeight
          }) rotate(${home.rotate}deg)`,
        )
        window.setTimeout(onClosed, OPEN_MS + 120)
        return
      }
    }

    window.setTimeout(onClosed, CLOSE_MS)
  }, [getHome, index, onClosed, reducedMotion])

  useEffect(() => {
    let innerFrame = 0
    const outerFrame = requestAnimationFrame(() => {
      closeRef.current?.focus()
      if (reducedMotion) return

      innerFrame = requestAnimationFrame(() => {
        setVisible(true)
        setFigureTransform("translate3d(0, 0, 0) scale(1) rotate(0deg)")
      })
    })

    const root = rootRef.current
    const trigger = triggerRef.current
    const siblings = Array.from(document.body.children).filter(
      (element) => element !== root,
    ) as HTMLElement[]
    const inertStates = siblings.map((element) => element.inert)
    const previousOverflow = document.body.style.overflow

    siblings.forEach((element) => {
      element.inert = true
    })
    document.body.style.overflow = "hidden"

    return () => {
      cancelAnimationFrame(outerFrame)
      cancelAnimationFrame(innerFrame)
      siblings.forEach((element, siblingIndex) => {
        element.inert = inertStates[siblingIndex]
      })
      document.body.style.overflow = previousOverflow
      trigger?.focus()
    }
  }, [reducedMotion, triggerRef])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault()
        event.stopImmediatePropagation()
        close()
        return
      }

      if (event.key === "ArrowLeft") {
        event.preventDefault()
        event.stopImmediatePropagation()
        previous()
        return
      }

      if (event.key === "ArrowRight") {
        event.preventDefault()
        event.stopImmediatePropagation()
        next()
        return
      }

      if (event.key === "ArrowUp" || event.key === "ArrowDown") {
        event.preventDefault()
        event.stopImmediatePropagation()
        return
      }

      if (event.key !== "Tab") return

      const controls = Array.from(
        rootRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [],
      )
      if (controls.length === 0) return

      const first = controls[0]
      const last = controls[controls.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        event.stopImmediatePropagation()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        event.stopImmediatePropagation()
        first.focus()
      }
    }

    window.addEventListener("keydown", onKeyDown, { capture: true })
    return () =>
      window.removeEventListener("keydown", onKeyDown, { capture: true })
  }, [close, next, previous])

  const currentPhoto = photos[index]

  return createPortal(
    <div
      ref={rootRef}
      role="dialog"
      aria-modal="true"
      aria-label={`${photos.length} race photos`}
      className="fixed inset-0 z-[999] flex touch-none items-center justify-center overscroll-contain p-4 sm:p-12"
      onPointerDown={(event) => event.stopPropagation()}
      onPointerMove={(event) => event.stopPropagation()}
      onPointerUp={(event) => event.stopPropagation()}
    >
      <div
        aria-hidden="true"
        className={cn(
          "absolute inset-0 cursor-zoom-out bg-black/80 transition-opacity",
          visible ? "opacity-100" : "opacity-0",
        )}
        style={{
          transitionDuration: `${
            isClosing && !isReturning ? CLOSE_MS : OPEN_MS
          }ms`,
        }}
        onClick={close}
      />

      <button
        ref={closeRef}
        type="button"
        aria-label="Close photo gallery"
        className={cn(
          "absolute right-4 top-4 z-20 flex size-11 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,opacity] hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={(event) => {
          event.stopPropagation()
          close()
        }}
      >
        <X className="size-5" aria-hidden="true" />
      </button>

      <button
        type="button"
        aria-label="Previous photo"
        className={cn(
          "absolute left-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,opacity] hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:left-6",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={(event) => {
          event.stopPropagation()
          previous()
        }}
      >
        <ChevronLeft className="size-5" aria-hidden="true" />
      </button>

      <figure
        ref={figureRef}
        className="inline-flex max-h-[76vh] max-w-[76vw] items-center justify-center"
        style={{
          transform: figureTransform,
          transformOrigin: "center",
          transition: reducedMotion
            ? undefined
            : `transform ${OPEN_MS}ms ${EASE}`,
          willChange: "transform",
        }}
        onClick={(event) => event.stopPropagation()}
      >
        <LifelineEventMedia
          key={currentPhoto.src}
          media={currentPhoto}
          className="block h-auto max-h-[76vh] w-auto max-w-[76vw] rounded-[3px] object-contain shadow-2xl"
        />
      </figure>

      <button
        type="button"
        aria-label="Next photo"
        className={cn(
          "absolute right-3 top-1/2 z-20 flex size-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/10 text-white transition-[background-color,opacity] hover:bg-white/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white sm:right-6",
          visible ? "opacity-100" : "opacity-0",
        )}
        onClick={(event) => {
          event.stopPropagation()
          next()
        }}
      >
        <ChevronRight className="size-5" aria-hidden="true" />
      </button>

      <p
        aria-live="polite"
        className={cn(
          "absolute bottom-5 left-1/2 -translate-x-1/2 text-[11px] font-medium tabular-nums tracking-[0.08em] text-white/75 transition-opacity",
          visible ? "opacity-100" : "opacity-0",
        )}
      >
        {index + 1} / {photos.length}
      </p>
    </div>,
    document.body,
  )
}
