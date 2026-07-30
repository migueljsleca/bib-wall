"use client";

import Image from "next/image";
import {
  Fragment,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
  type ReactNode,
  type Ref,
} from "react";

import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  CollectionHeader,
  type WallView,
} from "@/components/collection-header";
import { RaceTypeTag } from "@/components/race-type-tag";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { createTiledItems, getGridColumns } from "@/lib/bib-grid";
import {
  formatRaceDate,
  getDistancePrecision,
  parseMetricValue,
  parseRaceDate,
} from "@/lib/race-format";
import type { RaceEntry } from "@/lib/race-types";

const CARD_WIDTH = 290;
const CANVAS_HORIZONTAL_SPACING = 60;
const CANVAS_VERTICAL_SPACING = 48;
const TILE_OFFSETS = [-1, 0, 1];
const PREVIEW_ASPECT_RATIO = 1.06 / 0.82;
const PREVIEW_HEIGHT = CARD_WIDTH / PREVIEW_ASPECT_RATIO;
const META_REVEAL_SPACE = 28;
const TILE_GUTTER_X = CANVAS_HORIZONTAL_SPACING / 2;
const TILE_GUTTER_Y = CANVAS_VERTICAL_SPACING / 2;
const BOARD_INSET_X = TILE_GUTTER_X;
const BOARD_INSET_Y = TILE_GUTTER_Y;
const INERTIA_FRICTION = 0.92;
const INERTIA_MIN_SPEED = 0.2;
const DRAG_START_THRESHOLD = 6;
const INITIAL_OFFSET = { x: -160, y: -120 };
const FILTERS = ["All", "Trail", "Road", "Sky", "VK"] as const;
const SORT_FIELDS = ["date", "distance", "elevation"] as const;
const FILTER_OPTIONS = FILTERS.map((filter) => ({
  id: filter,
  label: filter === "VK" ? filter : filter[0] + filter.slice(1).toLowerCase(),
}));
const SORT_OPTIONS = SORT_FIELDS.map((field) => ({
  id: field,
  label: field === "date" ? "Date" : field === "distance" ? "Distance" : "Elevation",
}));
const INLINE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;

type SortField = (typeof SORT_FIELDS)[number];
type SortDirection = "asc" | "desc";

function wrapOffset(value: number, size: number) {
  const half = size / 2;
  return ((((value + half) % size) + size) % size) - half;
}

function DistanceIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 256 256"
      className="h-[13px] w-[13px] fill-current"
    >
      <path d="M235.32,73.37,182.63,20.69a16,16,0,0,0-22.63,0L20.68,160a16,16,0,0,0,0,22.63l52.69,52.68a16,16,0,0,0,22.63,0L235.32,96A16,16,0,0,0,235.32,73.37ZM84.68,224,32,171.31l32-32,26.34,26.35a8,8,0,0,0,11.32-11.32L75.31,128,96,107.31l26.34,26.35a8,8,0,0,0,11.32-11.32L107.31,96,128,75.31l26.34,26.35a8,8,0,0,0,11.32-11.32L139.31,64l32-32L224,84.69Z" />
    </svg>
  );
}

function ElevationIcon() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 256 256"
      className="h-[13px] w-[13px] fill-current"
    >
      <path d="M240,56v64a8,8,0,0,1-16,0V75.31l-82.34,82.35a8,8,0,0,1-11.32,0L96,123.31,29.66,189.66a8,8,0,0,1-11.32-11.32l72-72a8,8,0,0,1,11.32,0L136,140.69,212.69,64H168a8,8,0,0,1,0-16h64A8,8,0,0,1,240,56Z" />
    </svg>
  );
}

function AnimatedSortQualifier({ value }: { value: string | null }) {
  return (
    <span
      aria-hidden="true"
      className={`relative top-[0.02em] inline-grid align-baseline text-muted-foreground/80 transition-[grid-template-columns,opacity,margin] duration-[380ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
        value ? "ml-0.5 grid-cols-[1fr] opacity-100" : "ml-0 grid-cols-[0fr] opacity-0"
      }`}
    >
      <span className="-my-[0.14em] overflow-hidden py-[0.14em]">
        <span className="block h-[1.3em] whitespace-nowrap leading-[1.2]">
          {value ? (
            <span
              key={value}
              className="block animate-[sort-qualifier-enter_380ms_cubic-bezier(0.22,1,0.36,1)] whitespace-nowrap leading-[1.2]"
            >
              [{value}]
            </span>
          ) : null}
        </span>
      </span>
    </span>
  );
}

const GRID_ROWS_FALLBACK = 1;

function getCardPosition(
  index: number,
  gridColumns: number
) {
  const column = index % gridColumns;
  const row = Math.floor(index / gridColumns);
  const columnStep = CARD_WIDTH + CANVAS_HORIZONTAL_SPACING;
  const rowStep = PREVIEW_HEIGHT + CANVAS_VERTICAL_SPACING;

  return {
    x: BOARD_INSET_X + column * columnStep,
    y: BOARD_INSET_Y + row * rowStep,
  };
}

function getStableShuffleValue(value: string) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash * 31 + value.charCodeAt(index)) >>> 0;
  }

  return hash;
}

function createSeededRandom(seed: number) {
  let state = seed >>> 0;

  return () => {
    state += 0x6d2b79f5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function CloseIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className="size-4 fill-current">
      <path d="M205.66,194.34a8,8,0,0,1-11.32,11.32L128,139.31,61.66,205.66A8,8,0,0,1,50.34,194.34L116.69,128,50.34,61.66A8,8,0,0,1,61.66,50.34L128,116.69l66.34-66.35a8,8,0,0,1,11.32,11.32L139.31,128Z" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className="size-4 fill-current">
      <path d="M208,144v48H48V144a8,8,0,0,0-16,0v48a16,16,0,0,0,16,16H208a16,16,0,0,0,16-16V144a8,8,0,0,0-16,0Zm-85.66,29.66a8,8,0,0,0,11.32,0l40-40a8,8,0,0,0-11.32-11.32L136,148.69V40a8,8,0,0,0-16,0V148.69l-26.34-26.35a8,8,0,0,0-11.32,11.32Z" />
    </svg>
  );
}

function ChevronLeftIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className="size-4 fill-current">
      <path d="M157.66,210.34a8,8,0,0,1-11.32,0l-72-72a8,8,0,0,1,0-11.32l72-72a8,8,0,0,1,11.32,11.32L91.31,128l66.35,66.34A8,8,0,0,1,157.66,210.34Z" />
    </svg>
  );
}

function ChevronRightIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className="size-4 fill-current">
      <path d="M181.66,133.66l-72,72a8,8,0,0,1-11.32-11.32L164.69,128,98.34,61.66a8,8,0,0,1,11.32-11.32l72,72A8,8,0,0,1,181.66,133.66Z" />
    </svg>
  );
}

function getStoryBlocks(notes: string) {
  const normalized = notes.replace(/\r\n/g, "\n").trim();

  if (!normalized || normalized.toLowerCase() === "metadata pending update.") {
    return [];
  }

  return normalized
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function sanitizeExternalHref(value: string) {
  try {
    const url = new URL(value);

    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch {}

  return null;
}

function renderInlineContent(content: string) {
  const lines = content.split("\n");

  return lines.map((line, lineIndex) => {
    const segments: ReactNode[] = [];
    let lastIndex = 0;

    for (const match of line.matchAll(INLINE_LINK_PATTERN)) {
      const [fullMatch, markdownLabel, markdownHref, plainHref] = match;
      const matchIndex = match.index ?? 0;

      if (matchIndex > lastIndex) {
        segments.push(line.slice(lastIndex, matchIndex));
      }

      const href = sanitizeExternalHref(markdownHref ?? plainHref ?? "");
      const label = markdownLabel ?? plainHref ?? fullMatch;

      if (href) {
        segments.push(
          <a
            key={`${lineIndex}-${matchIndex}-${href}`}
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-foreground/30 underline-offset-4 transition hover:decoration-foreground"
          >
            {label}
          </a>
        );
      } else {
        segments.push(fullMatch);
      }

      lastIndex = matchIndex + fullMatch.length;
    }

    if (lastIndex < line.length) {
      segments.push(line.slice(lastIndex));
    }

    if (segments.length === 0) {
      segments.push(line);
    }

    return (
      <Fragment key={`story-line-${lineIndex}`}>
        {segments}
        {lineIndex < lines.length - 1 ? <br /> : null}
      </Fragment>
    );
  });
}

function RacePreview({ image, raceName }: { image?: string; raceName: string }) {
  if (image) {
    return (
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[8px]">
        <Image
          src={image}
          alt={raceName}
          fill
          draggable={false}
          className="pointer-events-none object-contain"
          sizes="290px"
        />
      </div>
    );
  }

  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="relative aspect-[4/3] w-full overflow-hidden rounded-[8px] bg-muted">
        <div className="absolute inset-0 bg-[linear-gradient(45deg,color-mix(in_oklab,var(--foreground)_10%,transparent)_25%,transparent_25%,transparent_75%,color-mix(in_oklab,var(--foreground)_10%,transparent)_75%,color-mix(in_oklab,var(--foreground)_10%,transparent)),linear-gradient(45deg,color-mix(in_oklab,var(--foreground)_10%,transparent)_25%,transparent_25%,transparent_75%,color-mix(in_oklab,var(--foreground)_10%,transparent)_75%,color-mix(in_oklab,var(--foreground)_10%,transparent))] bg-[length:28px_28px] bg-[position:0_0,14px_14px]" />
      </div>
    </div>
  );
}

function GalleryCard({
  item,
  x,
  y,
  onOpen,
  interactive,
}: {
  item: RaceEntry;
  x: number;
  y: number;
  onOpen: (item: RaceEntry, trigger?: HTMLButtonElement) => void;
  interactive: boolean;
}) {
  const className =
    "group absolute w-[290px] cursor-pointer select-none text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/50 focus-visible:ring-offset-4 focus-visible:ring-offset-background";
  const style = {
    left: `${x}px`,
    top: `${y}px`,
    height: `${PREVIEW_HEIGHT + META_REVEAL_SPACE}px`,
  };
  const content = (
    <div className="relative h-full overflow-visible">
      <div className="absolute inset-x-0 top-0 translate-x-0 translate-y-0 transform-gpu transition-transform duration-200 ease-out group-hover:-translate-y-4 group-focus-visible:-translate-y-4">
        <div className="relative aspect-[1.06/0.82] w-full overflow-hidden">
          <RacePreview image={item.bibImage} raceName={item.raceName} />
        </div>
      </div>

      <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 transform-gpu opacity-0 transition-[transform,opacity] duration-200 ease-out group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="truncate text-[14px] text-foreground">{item.raceName}</h2>
          </div>
          <RaceTypeTag
            type={item.raceType}
            className="shrink-0 px-1.5 py-0.5 text-[11px] leading-4"
          />
        </div>

        <div className="mt-0.5 flex items-start justify-between gap-4 text-sm text-muted-foreground">
          <div className="flex items-center gap-5">
            <span className="inline-flex items-center gap-2">
              <DistanceIcon />
              {item.distance}
            </span>
            <span className="inline-flex items-center gap-2">
              <ElevationIcon />
              {item.elevation}
            </span>
          </div>
          <div className="shrink-0 text-right">{formatRaceDate(item.date)}</div>
        </div>
      </div>
    </div>
  );

  if (!interactive) {
    return (
      <div
        aria-hidden="true"
        data-race-card=""
        className={className}
        onDragStart={(event) => event.preventDefault()}
        onClick={() => onOpen(item)}
        style={style}
      >
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      data-race-card=""
      className={className}
      onDragStart={(event) => event.preventDefault()}
      onClick={(event) => onOpen(item, event.currentTarget)}
      aria-label={`Open ${item.raceName} details`}
      style={style}
    >
      {content}
    </button>
  );
}

function ListRow({
  item,
  index,
  onOpen,
  rowRef,
  onHoverStart,
}: {
  item: RaceEntry;
  index: number;
  onOpen: (item: RaceEntry, trigger?: HTMLButtonElement) => void;
  rowRef?: Ref<HTMLButtonElement>;
  onHoverStart?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={(event) => onOpen(item, event.currentTarget)}
      ref={rowRef}
      onMouseEnter={onHoverStart}
      className="relative z-10 -mx-2 flex w-[calc(100%+1rem)] animate-[list-row-enter_260ms_cubic-bezier(0.22,1,0.36,1)] items-center gap-4 rounded-[8px] px-2 py-3 text-left opacity-0 transition-colors [animation-delay:var(--row-delay)] [animation-fill-mode:forwards] hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35 sm:-mx-5 sm:w-[calc(100%+2.5rem)] sm:gap-6 sm:px-3 sm:py-3"
      style={{ "--row-delay": `${Math.min(index, 5) * 25}ms` } as CSSProperties}
      aria-label={`Open ${item.raceName} details`}
    >
      <div className="w-[92px] shrink-0 sm:w-[112px]">
        <RacePreview image={item.bibImage} raceName={item.raceName} />
      </div>

      <div className="flex min-w-0 flex-1 items-start justify-between gap-3 sm:gap-6">
        <div className="min-w-0">
          <h2 className="truncate text-[14px] text-foreground">{item.raceName}</h2>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-5 gap-y-1 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <DistanceIcon />
              {item.distance}
            </span>
            <span className="inline-flex items-center gap-2">
              <ElevationIcon />
              {item.elevation}
            </span>
          </div>
        </div>

        <div className="hidden shrink-0 flex-col items-end text-right min-[380px]:flex">
          <RaceTypeTag type={item.raceType} />
          <p className="mt-1 text-sm text-muted-foreground">{formatRaceDate(item.date)}</p>
        </div>
      </div>
    </button>
  );
}

function RaceDetailPanel({
  race,
  isOpen,
  onOpenChange,
  onCloseAutoFocus,
}: {
  race: RaceEntry;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onCloseAutoFocus: () => void;
}) {
  const storyBlocks = getStoryBlocks(race.notes);
  const hasPhotos = race.photos.length > 0;
  const hasRoute = Boolean(race.gpxFile);
  const hasContent = storyBlocks.length > 0 || hasPhotos || hasRoute;
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);

  return (
    <Sheet open={isOpen} onOpenChange={onOpenChange}>
      <SheetContent
        side="right"
        showCloseButton={false}
        aria-modal="true"
        onCloseAutoFocus={(event) => {
          event.preventDefault();
          onCloseAutoFocus();
        }}
        className="overflow-hidden border-border/70 bg-[color:color-mix(in_oklab,var(--background)_88%,white_12%)] shadow-[0_24px_80px_rgba(15,15,15,0.12)] data-[side=right]:inset-y-4 data-[side=right]:right-4 data-[side=right]:h-[calc(100%-2rem)] data-[side=right]:w-[calc(100%-2rem)] data-[side=right]:max-w-[460px] data-[side=right]:rounded-[4px] data-[side=right]:border"
      >
          <SheetHeader className="flex-row items-start justify-between gap-4 border-b border-border/70 px-5 pt-5 pb-4">
            <div className="min-w-0">
              <p className="text-sm uppercase text-muted-foreground">
                Race Notes
              </p>
              <SheetTitle className="mt-2 font-normal">{race.raceName}</SheetTitle>
              <SheetDescription className="mt-1 text-sm">
                {formatRaceDate(race.date)}
              </SheetDescription>
            </div>

            <SheetClose asChild>
              <button
                type="button"
                aria-label="Close details panel"
                className="inline-flex size-10 shrink-0 items-center justify-center border border-border/70 text-muted-foreground transition-[background-color,color,transform] hover:bg-muted hover:text-foreground active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
              >
                <CloseIcon />
              </button>
            </SheetClose>
          </SheetHeader>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-6 pb-5">
              <div className="grid gap-0 border-x border-b border-border/70 sm:grid-cols-[minmax(0,1fr)_176px]">
                <div className="relative flex items-center justify-center overflow-hidden bg-muted/65 p-4">
                  <div className="relative mx-auto w-[94%]">
                    <RacePreview image={race.bibImage} raceName={race.raceName} />
                  </div>
                </div>

                <div className="grid h-full grid-cols-1 divide-y divide-border/70 border-l border-border/70 text-sm text-muted-foreground">
                  <div className="bg-background px-3 py-3">
                    <p>Type</p>
                    <RaceTypeTag type={race.raceType} className="mt-1" />
                  </div>
                  <div className="bg-background px-3 py-3">
                    <p>Distance</p>
                    <p className="mt-1 text-sm tracking-normal text-foreground">{race.distance}</p>
                  </div>
                  <div className="bg-background px-3 py-3">
                    <p>Elevation</p>
                    <p className="mt-1 text-sm tracking-normal text-foreground">{race.elevation}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-5 px-5 [font-family:var(--font-geist-sans)]">
                {hasRoute ? (
                  <div>
                    <a
                      href={race.gpxFile}
                      target="_blank"
                      rel="noreferrer"
                      download
                      className="inline-flex items-center gap-2 text-sm text-foreground underline decoration-foreground/30 underline-offset-4 transition hover:decoration-foreground"
                    >
                      <DownloadIcon />
                      Download GPX file
                    </a>
                  </div>
                ) : null}

                {storyBlocks.length > 0
                  ? storyBlocks.map((block, index) => {
                      const lines = block
                        .split("\n")
                        .map((line) => line.trim())
                        .filter(Boolean);
                      const isList =
                        lines.length > 1 && lines.every((line) => line.startsWith("- "));

                      if (isList) {
                        return (
                          <ul
                            key={`${race.slug}-story-${index}`}
                            className="space-y-2 text-[14px] leading-6 text-foreground"
                          >
                            {lines.map((line) => (
                              <li key={line} className="flex items-start gap-3">
                                <span className="mt-2 size-1.5 shrink-0 rounded-full bg-foreground" />
                                <span>{renderInlineContent(line.slice(2))}</span>
                              </li>
                            ))}
                          </ul>
                        );
                      }

                      return (
                        <p
                          key={`${race.slug}-story-${index}`}
                          className="text-[14px] leading-6 text-foreground"
                        >
                          {renderInlineContent(block)}
                        </p>
                      );
                    })
                  : null}

                {hasPhotos ? (
                  <div className="space-y-3">
                    <div>
                      <div className="relative aspect-[4/3] overflow-hidden border border-border/70 bg-background">
                        <Image
                          src={race.photos[activePhotoIndex]}
                          alt={`${race.raceName} photo ${activePhotoIndex + 1}`}
                          fill
                          className="object-cover"
                          sizes="(max-width: 640px) 100vw, 420px"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm text-muted-foreground">
                        {activePhotoIndex + 1}/{race.photos.length}
                      </div>

                      <div className="flex items-center gap-2">
                        {race.photos.length > 1 ? (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setActivePhotoIndex((current) =>
                                  current === 0 ? race.photos.length - 1 : current - 1
                                )
                              }
                              className="inline-flex size-9 items-center justify-center border border-border/70 text-foreground transition hover:bg-muted"
                              aria-label="Previous photo"
                            >
                              <ChevronLeftIcon />
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setActivePhotoIndex((current) =>
                                  current === race.photos.length - 1 ? 0 : current + 1
                                )
                              }
                              className="inline-flex size-9 items-center justify-center border border-border/70 text-foreground transition hover:bg-muted"
                              aria-label="Next photo"
                            >
                              <ChevronRightIcon />
                            </button>
                          </>
                        ) : null}
                      </div>
                    </div>
                  </div>
                ) : null}

                {!hasContent ? (
                  <p className="text-sm leading-6 text-muted-foreground">
                    info coming soon...
                  </p>
                ) : null}
              </div>
            </div>
          </div>
      </SheetContent>
    </Sheet>
  );
}

export function BibWall({
  races,
  initialView = "grid",
}: {
  races: RaceEntry[];
  initialView?: WallView;
}) {
  const [viewMode, setViewMode] = useState<WallView>(initialView);
  const [animateCanvasEntry, setAnimateCanvasEntry] = useState(false);
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRace, setSelectedRace] = useState<RaceEntry | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [hoveredListRace, setHoveredListRace] = useState<string | null>(null);
  const [listHoverStyle, setListHoverStyle] = useState<CSSProperties>({
    top: "0px",
    left: "0px",
    width: "0px",
    height: "0px",
  });
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const listRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const sortScrollerRef = useRef<HTMLDivElement | null>(null);
  const sortButtonRefs = useRef<Record<SortField, HTMLButtonElement | null>>({
    date: null,
    distance: null,
    elevation: null,
  });
  const detailTriggerRef = useRef<HTMLButtonElement | null>(null);
  const offsetRef = useRef(INITIAL_OFFSET);
  const dragStateRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
    surface: HTMLElement;
  } | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const inertiaFrameRef = useRef<number | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const drawerOpenFrameRef = useRef<number | null>(null);
  const pendingDragOffsetRef = useRef<{ x: number; y: number } | null>(null);
  const dragCleanupRef = useRef<(() => void) | null>(null);
  const suppressClickRef = useRef(false);

  const shuffledRaces = useMemo(() => {
    const items = [...races];
    const seedSource = races
      .map((race) => race.slug)
      .sort()
      .join("|");
    const seed = getStableShuffleValue(seedSource) || 1;
    const random = createSeededRandom(seed);

    for (let index = items.length - 1; index > 0; index -= 1) {
      const swapIndex = Math.floor(random() * (index + 1));
      [items[index], items[swapIndex]] = [items[swapIndex], items[index]];
    }

    return items;
  }, [races]);
  const gridColumns = Math.max(1, getGridColumns(races.length));
  const gridRows = Math.max(Math.ceil(races.length / gridColumns), GRID_ROWS_FALLBACK);
  const tiledRaces = useMemo(
    () => createTiledItems(shuffledRaces, gridColumns, gridRows),
    [gridColumns, gridRows, shuffledRaces]
  );
  const canvasWidth =
    BOARD_INSET_X * 2 +
    (gridColumns - 1) * (CARD_WIDTH + CANVAS_HORIZONTAL_SPACING) +
    CARD_WIDTH;
  const canvasHeight =
    BOARD_INSET_Y * 2 +
    (gridRows - 1) * (PREVIEW_HEIGHT + CANVAS_VERTICAL_SPACING) +
    PREVIEW_HEIGHT;
  const filteredRaces = useMemo(
    () =>
      activeFilter === "All"
        ? races
        : races.filter((race) => race.raceType.toLowerCase() === activeFilter.toLowerCase()),
    [activeFilter, races]
  );
  const sortedRaces = useMemo(() => {
    const items = [...filteredRaces];

    items.sort((left, right) => {
      const leftValue =
        sortField === "date"
          ? parseRaceDate(left.date)
          : parseMetricValue(left[sortField], sortField === "distance" ? "km" : "m");
      const rightValue =
        sortField === "date"
          ? parseRaceDate(right.date)
          : parseMetricValue(right[sortField], sortField === "distance" ? "km" : "m");

      if (leftValue === rightValue) {
        return left.raceName.localeCompare(right.raceName);
      }

      return sortDirection === "asc" ? leftValue - rightValue : rightValue - leftValue;
    });

    return items;
  }, [filteredRaces, sortDirection, sortField]);
  const displayedRaces = viewMode === "list" ? sortedRaces : races;
  const totalDistance = displayedRaces.reduce(
    (sum, race) => sum + parseMetricValue(race.distance, "km"),
    0
  );
  const totalElevation = displayedRaces.reduce(
    (sum, race) => sum + parseMetricValue(race.elevation, "m"),
    0
  );
  const distancePrecision = getDistancePrecision(totalDistance);
  const [animatedCount, setAnimatedCount] = useState(0);
  const [animatedDistance, setAnimatedDistance] = useState(0);
  const [animatedElevation, setAnimatedElevation] = useState(0);

  useEffect(() => {
    document.documentElement.dataset.viewMode = viewMode;

    return () => {
      delete document.documentElement.dataset.viewMode;
    };
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (dragCleanupRef.current) {
        dragCleanupRef.current();
      }

      if (inertiaFrameRef.current !== null) {
        cancelAnimationFrame(inertiaFrameRef.current);
      }

      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
      }

      if (drawerOpenFrameRef.current !== null) {
        cancelAnimationFrame(drawerOpenFrameRef.current);
      }

      delete document.documentElement.dataset.detailPanelOpen;
    };
  }, []);

  useEffect(() => {
    if (!hoveredListRace || !listContainerRef.current) {
      return;
    }

    const updateHoverStyle = () => {
      const container = listContainerRef.current;
      const row = listRowRefs.current[hoveredListRace];

      if (!container || !row) {
        return;
      }

      const containerRect = container.getBoundingClientRect();
      const rowRect = row.getBoundingClientRect();

      const nextHoverStyle = {
        top: `${rowRect.top - containerRect.top}px`,
        left: `${rowRect.left - containerRect.left}px`,
        width: `${rowRect.width}px`,
        height: `${rowRect.height}px`,
      };

      setListHoverStyle((currentHoverStyle) =>
        currentHoverStyle.top === nextHoverStyle.top &&
        currentHoverStyle.left === nextHoverStyle.left &&
        currentHoverStyle.width === nextHoverStyle.width &&
        currentHoverStyle.height === nextHoverStyle.height
          ? currentHoverStyle
          : nextHoverStyle
      );
    };

    updateHoverStyle();
    window.addEventListener("resize", updateHoverStyle);

    return () => {
      window.removeEventListener("resize", updateHoverStyle);
    };
  }, [hoveredListRace, sortedRaces]);

  useEffect(() => {
    const scroller = sortScrollerRef.current;
    const activeButton = sortButtonRefs.current[sortField];

    if (!scroller || !activeButton) {
      return;
    }

    let frameId: number | null = null;
    const keepActiveSortVisible = () => {
      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }

      frameId = requestAnimationFrame(() => {
        frameId = null;
        const scrollerBounds = scroller.getBoundingClientRect();
        const buttonBounds = activeButton.getBoundingClientRect();
        const edgeInset = 8;

        if (buttonBounds.right > scrollerBounds.right - edgeInset) {
          scroller.scrollLeft += buttonBounds.right - scrollerBounds.right + edgeInset;
        } else if (buttonBounds.left < scrollerBounds.left + edgeInset) {
          scroller.scrollLeft -= scrollerBounds.left - buttonBounds.left + edgeInset;
        }
      });
    };

    keepActiveSortVisible();

    const resizeObserver = new ResizeObserver(keepActiveSortVisible);
    resizeObserver.observe(activeButton);

    return () => {
      resizeObserver.disconnect();

      if (frameId !== null) {
        cancelAnimationFrame(frameId);
      }
    };
  }, [sortDirection, sortField]);

  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      setAnimatedCount(displayedRaces.length);
      setAnimatedDistance(totalDistance);
      setAnimatedElevation(totalElevation);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [displayedRaces.length, totalDistance, totalElevation]);

  const setCanvasCompositing = useCallback((active: boolean) => {
    if (canvasRef.current) {
      canvasRef.current.style.willChange = active ? "transform" : "auto";
    }
  }, []);

  const stopInertia = useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }

    setCanvasCompositing(false);
  }, [setCanvasCompositing]);

  const applyCanvasTransform = useCallback((nextOffset: { x: number; y: number }) => {
    if (!canvasRef.current) {
      return;
    }

    const { x, y } = nextOffset;
    canvasRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }, []);

  const setCanvasOffset = useCallback(
    (nextOffset: { x: number; y: number }) => {
      const wrappedOffset = {
        x: wrapOffset(nextOffset.x, canvasWidth),
        y: wrapOffset(nextOffset.y, canvasHeight),
      };
      offsetRef.current = wrappedOffset;
      applyCanvasTransform(wrappedOffset);
    },
    [applyCanvasTransform, canvasHeight, canvasWidth]
  );

  useEffect(() => {
    setCanvasOffset(offsetRef.current);
  }, [canvasHeight, canvasWidth, setCanvasOffset]);

  useLayoutEffect(() => {
    if (viewMode !== "grid" || !animateCanvasEntry || !canvasRef.current) {
      return;
    }

    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const visibleTiles = Array.from(
      canvasRef.current.querySelectorAll<HTMLElement>("[data-canvas-tile]")
    )
      .map((tile) => ({ tile, rect: tile.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.right > 0 &&
          rect.left < viewportWidth &&
          rect.bottom > 57 &&
          rect.top < viewportHeight
      );
    const cards = visibleTiles
      .flatMap(({ tile }) =>
        Array.from(tile.querySelectorAll<HTMLElement>("[data-race-card]"))
      )
      .map((card) => ({ card, rect: card.getBoundingClientRect() }))
      .filter(
        ({ rect }) =>
          rect.right > 0 &&
          rect.left < viewportWidth &&
          rect.bottom > 57 &&
          rect.top < viewportHeight
      )
      .sort((left, right) => {
        const rowDifference = left.rect.top - right.rect.top;

        return Math.abs(rowDifference) > 40
          ? rowDifference
          : left.rect.left - right.rect.left;
      });

    cards.forEach(({ card }, index) => {
      card.dataset.canvasEnter = "";
      card.style.setProperty("--canvas-entry-delay", `${Math.min(index, 7) * 28}ms`);
    });

    const cleanupAnimationStyles = () => {
      cards.forEach(({ card }) => {
        delete card.dataset.canvasEnter;
        card.style.removeProperty("--canvas-entry-delay");
      });
    };
    const cleanupTimer = window.setTimeout(cleanupAnimationStyles, 480);

    return () => {
      window.clearTimeout(cleanupTimer);
      cleanupAnimationStyles();
    };
  }, [animateCanvasEntry, viewMode]);

  const startInertia = useCallback(() => {
    stopInertia();
    setCanvasCompositing(true);

    const step = () => {
      velocityRef.current = {
        x: velocityRef.current.x * INERTIA_FRICTION,
        y: velocityRef.current.y * INERTIA_FRICTION,
      };

      if (
        Math.abs(velocityRef.current.x) < INERTIA_MIN_SPEED &&
        Math.abs(velocityRef.current.y) < INERTIA_MIN_SPEED
      ) {
        inertiaFrameRef.current = null;
        setCanvasCompositing(false);
        return;
      }

      setCanvasOffset({
        x: offsetRef.current.x + velocityRef.current.x,
        y: offsetRef.current.y + velocityRef.current.y,
      });

      inertiaFrameRef.current = requestAnimationFrame(step);
    };

    inertiaFrameRef.current = requestAnimationFrame(step);
  }, [setCanvasCompositing, setCanvasOffset, stopInertia]);

  const endPointerDrag = useCallback(() => {
    if (!dragStateRef.current) {
      return;
    }

    suppressClickRef.current = dragStateRef.current.hasMoved;
    delete dragStateRef.current.surface.dataset.dragging;
    dragStateRef.current = null;
    lastPointerRef.current = null;

    if (suppressClickRef.current) {
      window.setTimeout(() => {
        suppressClickRef.current = false;
      }, 0);
      startInertia();
      return;
    }

    velocityRef.current = { x: 0, y: 0 };
    setCanvasCompositing(false);
  }, [setCanvasCompositing, startInertia]);

  function handlePointerDown(event: ReactPointerEvent<HTMLElement>) {
    if (!event.isPrimary || event.button !== 0) {
      return;
    }

    const dragSurface = event.currentTarget;
    const previousUserSelect = document.body.style.userSelect;
    stopInertia();
    setCanvasCompositing(true);

    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragOffsetRef.current = null;

    dragStateRef.current = {
      pointerId: event.pointerId,
      clientX: event.clientX,
      clientY: event.clientY,
      startX: offsetRef.current.x,
      startY: offsetRef.current.y,
      hasMoved: false,
      surface: dragSurface,
    };
    velocityRef.current = { x: 0, y: 0 };
    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };

    const flushPendingDragOffset = () => {
      const pendingOffset = pendingDragOffsetRef.current;

      if (!pendingOffset) {
        return;
      }

      pendingDragOffsetRef.current = null;
      setCanvasOffset(pendingOffset);
    };

    const scheduleCanvasUpdate = () => {
      if (dragFrameRef.current !== null) {
        return;
      }

      dragFrameRef.current = requestAnimationFrame(() => {
        dragFrameRef.current = null;
        flushPendingDragOffset();
      });
    };

    const handlePointerMove = (nativeEvent: PointerEvent) => {
      if (
        !dragStateRef.current ||
        nativeEvent.pointerId !== dragStateRef.current.pointerId
      ) {
        return;
      }

      const deltaX = nativeEvent.clientX - dragStateRef.current.clientX;
      const deltaY = nativeEvent.clientY - dragStateRef.current.clientY;
      const movement = Math.hypot(deltaX, deltaY);
      const now = performance.now();
      const previousPointer = lastPointerRef.current;

      if (!dragStateRef.current.hasMoved && movement < DRAG_START_THRESHOLD) {
        return;
      }

      if (!dragStateRef.current.hasMoved) {
        dragStateRef.current.hasMoved = true;
        dragStateRef.current.surface.dataset.dragging = "";
        document.body.style.userSelect = "none";

        if (!dragSurface.hasPointerCapture(nativeEvent.pointerId)) {
          dragSurface.setPointerCapture(nativeEvent.pointerId);
        }
      }

      if (nativeEvent.cancelable) {
        nativeEvent.preventDefault();
      }

      if (previousPointer) {
        const elapsed = Math.max(now - previousPointer.time, 1);
        const frameScale = 16 / elapsed;

        velocityRef.current = {
          x: (nativeEvent.clientX - previousPointer.x) * frameScale,
          y: (nativeEvent.clientY - previousPointer.y) * frameScale,
        };
      }

      pendingDragOffsetRef.current = {
        x: dragStateRef.current.startX + deltaX,
        y: dragStateRef.current.startY + deltaY,
      };
      scheduleCanvasUpdate();

      lastPointerRef.current = {
        x: nativeEvent.clientX,
        y: nativeEvent.clientY,
        time: now,
      };
    };

    const cleanupDragListeners = () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerEnd);
      window.removeEventListener("pointercancel", handlePointerEnd);
      window.removeEventListener("blur", handleWindowBlur);
      document.body.style.userSelect = previousUserSelect;

      if (dragSurface.hasPointerCapture(event.pointerId)) {
        dragSurface.releasePointerCapture(event.pointerId);
      }

      dragCleanupRef.current = null;
    };

    const handlePointerEnd = (nativeEvent: PointerEvent) => {
      if (
        dragStateRef.current &&
        nativeEvent.pointerId !== dragStateRef.current.pointerId
      ) {
        return;
      }

      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      flushPendingDragOffset();
      cleanupDragListeners();
      endPointerDrag();
    };

    const handleWindowBlur = () => {
      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }
      pendingDragOffsetRef.current = null;
      cleanupDragListeners();
      endPointerDrag();
    };

    if (dragCleanupRef.current) {
      dragCleanupRef.current();
    }

    window.addEventListener("pointermove", handlePointerMove, { passive: false });
    window.addEventListener("pointerup", handlePointerEnd);
    window.addEventListener("pointercancel", handlePointerEnd);
    window.addEventListener("blur", handleWindowBlur);
    dragCleanupRef.current = cleanupDragListeners;
  }

  function handleSortChange(nextField: SortField) {
    if (sortField === nextField) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      return;
    }

    setSortField(nextField);
    setSortDirection("desc");
  }

  function getSortQualifierLabel(field: SortField) {
    if (field !== sortField) {
      return null;
    }

    if (field === "date") {
      return sortDirection === "asc" ? "oldest" : "newest";
    }

    if (field === "distance") {
      return sortDirection === "asc" ? "shortest" : "longest";
    }

    return sortDirection === "asc" ? "lowest" : "highest";
  }

  function handleHomeClick() {
    setViewMode("grid");
    window.history.replaceState(null, "", "/?view=grid");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCollectionViewChange(
    nextView: WallView,
    interactionDetail: number,
  ) {
    if (nextView === "grid") {
      setAnimateCanvasEntry(viewMode !== "grid" && interactionDetail > 0);
    } else {
      stopInertia();
    }

    setViewMode(nextView);
    window.history.replaceState(
      null,
      "",
      nextView === "list" ? "/?view=list" : "/?view=grid",
    );
  }

  function handleRaceOpen(item: RaceEntry, trigger?: HTMLButtonElement) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (selectedRace?.slug === item.slug && isDetailPanelOpen) {
      return;
    }

    detailTriggerRef.current = trigger ?? null;
    document.documentElement.dataset.detailPanelOpen = "true";

    if (trigger) {
      trigger.blur();
    }

    const openDetails = () => {
      drawerOpenFrameRef.current = null;
      setSelectedRace(item);
      setIsDetailPanelOpen(true);
    };

    if (viewMode === "grid") {
      stopInertia();

      if (dragFrameRef.current !== null) {
        cancelAnimationFrame(dragFrameRef.current);
        dragFrameRef.current = null;
      }

      pendingDragOffsetRef.current = null;
      drawerOpenFrameRef.current = requestAnimationFrame(openDetails);
      return;
    }

    openDetails();
  }

  function handleDetailOpenChange(open: boolean) {
    setIsDetailPanelOpen(open);
  }

  function handleDetailCloseAutoFocus() {
    const trigger = detailTriggerRef.current;

    delete document.documentElement.dataset.detailPanelOpen;

    if (!trigger || !trigger.isConnected) {
      return;
    }

    trigger.focus({ preventScroll: true });
  }

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <h1 className="sr-only">Bib Wall race collection</h1>
      <CollectionHeader
        activeView={viewMode}
        count={animatedCount}
        distance={animatedDistance}
        elevation={animatedElevation}
        distancePrecision={distancePrecision}
        onHomeClick={handleHomeClick}
        onViewChange={handleCollectionViewChange}
      />

      {viewMode === "grid" ? (
        <section
          aria-label="Race bib gallery"
          aria-describedby="gallery-instructions"
          className="relative h-screen touch-none cursor-grab select-none overflow-hidden bg-background pt-[57px] data-[dragging]:cursor-grabbing"
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={handlePointerDown}
        >
          <p id="gallery-instructions" className="sr-only">
            Drag in any direction to explore. Use Tab to move through each race and Enter to open
            its details.
          </p>
          {races.length === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center px-6 pt-[57px] text-center">
              <div>
                <h2 className="text-base text-foreground">No race bibs yet</h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Add a race entry to start the collection.
                </p>
              </div>
            </div>
          ) : null}
          <div
            ref={canvasRef}
            data-canvas-layer=""
            className="absolute left-1/2 top-1/2"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              transform: `translate(calc(-50% + ${INITIAL_OFFSET.x}px), calc(-50% + ${INITIAL_OFFSET.y}px))`,
            }}
          >
            {TILE_OFFSETS.flatMap((tileY) =>
              TILE_OFFSETS.map((tileX) => (
                <div
                  key={`${tileX}-${tileY}`}
                  aria-hidden={tileX === 0 && tileY === 0 ? undefined : true}
                  data-canvas-tile=""
                  className="absolute [contain:layout_paint_style] [content-visibility:auto]"
                  style={{
                    left: `${tileX * canvasWidth}px`,
                    top: `${tileY * canvasHeight}px`,
                    width: `${canvasWidth}px`,
                    height: `${canvasHeight}px`,
                    containIntrinsicSize: `${canvasWidth}px ${canvasHeight}px`,
                  }}
                >
                  {tiledRaces.map((item, index) => {
                    const position = getCardPosition(index, gridColumns);

                    return (
                      <GalleryCard
                        key={`${index}-${item.slug}`}
                        item={item}
                        x={position.x}
                        y={position.y}
                        onOpen={handleRaceOpen}
                        interactive={
                          tileX === 0 &&
                          tileY === 0 &&
                          index < shuffledRaces.length
                        }
                      />
                    );
                  })}
                </div>
              ))
            )}
          </div>
        </section>
      ) : (
        <section className="min-h-screen bg-background pt-[81px]">
          <div className="mx-auto max-w-[700px] px-4 pb-10 sm:px-6">
            <div className="mb-6 -mx-2 flex w-[calc(100%+1rem)] flex-col items-stretch gap-3 sm:-mx-5 sm:w-[calc(100%+2.5rem)] min-[720px]:flex-row min-[720px]:items-center min-[720px]:justify-between min-[720px]:gap-6">
              <div className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <ToggleGroup
                  type="single"
                  value={activeFilter}
                  onValueChange={(value) => {
                    if (value) {
                      setActiveFilter(value);
                    }
                  }}
                  aria-label="Filter races by type"
                  className="min-w-max"
                >
                  {FILTER_OPTIONS.map((tab) => (
                    <ToggleGroupItem
                      key={tab.id}
                      value={tab.id}
                      aria-label={`Show ${tab.label} races`}
                      className="h-10 rounded-[4px] px-3 font-normal text-muted-foreground data-[state=on]:bg-muted data-[state=on]:text-foreground"
                    >
                      {tab.label}
                    </ToggleGroupItem>
                  ))}
                </ToggleGroup>
              </div>

              <div
                ref={sortScrollerRef}
                className="-mx-1 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              >
                <div
                  className="flex min-w-max items-center gap-1 pe-2 text-[14px] text-muted-foreground min-[720px]:pe-0"
                  role="group"
                  aria-label="Sort races"
                >
                {SORT_OPTIONS.map((option) => {
                  const isActive = sortField === option.id;
                  const qualifier = getSortQualifierLabel(option.id);

                  return (
                    <button
                      key={option.id}
                      ref={(node) => {
                        sortButtonRefs.current[option.id] = node;
                      }}
                      type="button"
                      onClick={() => handleSortChange(option.id)}
                      aria-pressed={isActive}
                      aria-label={
                        isActive
                          ? `Sort by ${option.label}, ${qualifier}. Activate to reverse order.`
                          : `Sort by ${option.label}`
                      }
                      className={`group relative inline-flex h-10 items-center gap-1.5 rounded-[4px] px-2 transition-[background-color,color,transform] active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35 ${
                        isActive
                          ? "bg-muted text-foreground"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <span>{option.label}</span>
                      <AnimatedSortQualifier value={qualifier} />
                    </button>
                  );
                })}
                </div>
              </div>
            </div>
            <p role="status" className="sr-only">
              Showing {sortedRaces.length} {activeFilter === "All" ? "" : activeFilter} races,
              sorted by {sortField} {getSortQualifierLabel(sortField)}.
            </p>

            <div
              ref={listContainerRef}
              className="relative"
              onMouseLeave={() => setHoveredListRace(null)}
            >
              <div
                className="pointer-events-none absolute rounded-[8px] bg-muted transition-[top,left,width,height,opacity] duration-200 ease-out"
                style={{
                  ...listHoverStyle,
                  opacity: hoveredListRace ? 1 : 0,
                }}
              />
              {sortedRaces.map((item, index) => (
                <ListRow
                  key={item.slug}
                  item={item}
                  index={index}
                  onOpen={handleRaceOpen}
                  rowRef={(node) => {
                    listRowRefs.current[item.slug] = node;
                  }}
                  onHoverStart={() => setHoveredListRace(item.slug)}
                />
              ))}
              {sortedRaces.length === 0 ? (
                <div className="rounded-[8px] border border-border/70 px-5 py-10 text-center">
                  <h2 className="text-base text-foreground">No {activeFilter} races yet</h2>
                  <p className="mt-2 text-sm text-muted-foreground">
                    Try another race type or show the full collection.
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveFilter("All")}
                    className="mt-5 inline-flex h-10 items-center justify-center rounded-[4px] border border-border/70 px-4 text-sm text-foreground transition-[background-color,transform] hover:bg-muted active:scale-[0.96] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35"
                  >
                    Show all races
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        </section>
      )}

      {selectedRace ? (
        <RaceDetailPanel
          key={selectedRace.slug}
          race={selectedRace}
          isOpen={isDetailPanelOpen}
          onOpenChange={handleDetailOpenChange}
          onCloseAutoFocus={handleDetailCloseAutoFocus}
        />
      ) : null}
    </main>
  );
}
