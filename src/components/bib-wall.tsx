"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import Image from "next/image";
import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type Ref,
} from "react";

import { Tabs } from "@/components/ui/vercel-tabs";
import type { RaceEntry } from "@/lib/race-types";

const CARD_WIDTH = 290;
const CANVAS_SPACING = 65;
const MIN_GRID_COLUMNS = 4;
const MAX_GRID_COLUMNS = 9;
const MIN_TILE_WIDTH = 3400;
const TILE_OFFSETS = [-1, 0, 1];
const PREVIEW_ASPECT_RATIO = 1.06 / 0.82;
const PREVIEW_HEIGHT = CARD_WIDTH / PREVIEW_ASPECT_RATIO;
const META_REVEAL_SPACE = 28;
const TILE_GUTTER = CANVAS_SPACING / 2;
const BOARD_INSET_X = TILE_GUTTER;
const BOARD_INSET_Y = TILE_GUTTER;
const INERTIA_FRICTION = 0.92;
const INERTIA_MIN_SPEED = 0.2;
const DRAG_START_THRESHOLD = 6;
const INITIAL_OFFSET = { x: -160, y: -120 };
const DETAIL_PANEL_TRANSITION_MS = 350;
const DETAIL_PANEL_EASING = "cubic-bezier(0.22,1,0.36,1)";
const FILTERS = ["All", "Trail", "Road", "Sky", "VK"] as const;
const SORT_FIELDS = ["date", "distance", "elevation"] as const;
const INLINE_LINK_PATTERN = /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s]+)/g;

type SortField = (typeof SORT_FIELDS)[number];
type SortDirection = "asc" | "desc";

function parseMetricValue(value: string, unit: "km" | "m") {
  const match = value.trim().toLowerCase().match(new RegExp(`([\\d.]+)\\s*${unit}$`));

  if (!match) {
    return 0;
  }

  return Number.parseFloat(match[1]) || 0;
}

function getDistancePrecision(value: number) {
  return Number.isInteger(value) ? 0 : 1;
}

function parseRaceDate(value: string) {
  const [day, month, year] = value.split("/").map((part) => Number.parseInt(part, 10));

  if (!day || !month || !year) {
    return 0;
  }

  return new Date(year, month - 1, day).getTime();
}

function formatRaceDate(value: string) {
  const timestamp = parseRaceDate(value);

  if (!timestamp) {
    return value;
  }

  return new Intl.DateTimeFormat("en-US", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(timestamp);
}

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

function GridIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className="size-4.5 fill-current">
      <path d="M76,60A16,16,0,1,1,60,44,16,16,0,0,1,76,60Zm52-16a16,16,0,1,0,16,16A16,16,0,0,0,128,44Zm68,32a16,16,0,1,0-16-16A16,16,0,0,0,196,76ZM60,112a16,16,0,1,0,16,16A16,16,0,0,0,60,112Zm68,0a16,16,0,1,0,16,16A16,16,0,0,0,128,112Zm68,0a16,16,0,1,0,16,16A16,16,0,0,0,196,112ZM60,180a16,16,0,1,0,16,16A16,16,0,0,0,60,180Zm68,0a16,16,0,1,0,16,16A16,16,0,0,0,128,180Zm68,0a16,16,0,1,0,16,16A16,16,0,0,0,196,180Z" />
    </svg>
  );
}

function ListIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 256 256" className="size-4.5 fill-current">
      <path d="M84,64A12,12,0,0,1,96,52H216a12,12,0,0,1,0,24H96A12,12,0,0,1,84,64Zm132,52H96a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24Zm0,64H96a12,12,0,0,0,0,24H216a12,12,0,0,0,0-24ZM56,52H40a12,12,0,0,0,0,24H56a12,12,0,0,0,0-24Zm0,64H40a12,12,0,0,0,0,24H56a12,12,0,0,0,0-24Zm0,64H40a12,12,0,0,0,0,24H56a12,12,0,0,0,0-24Z" />
    </svg>
  );
}

function NavStatTooltip({ label }: { label: string }) {
  return (
    <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-border/70 bg-background/95 px-2 py-1 font-mono text-[12px] normal-case text-foreground opacity-0 shadow-sm transition duration-150 group-hover:opacity-100">
      {label}
    </span>
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
  const columnStep = CARD_WIDTH + CANVAS_SPACING;
  const rowStep = PREVIEW_HEIGHT + CANVAS_SPACING;

  return {
    x: BOARD_INSET_X + column * columnStep,
    y: BOARD_INSET_Y + row * rowStep,
  };
}

function getGridColumns(raceCount: number) {
  const minColumns = Math.min(MIN_GRID_COLUMNS, raceCount);
  const maxColumns = Math.min(MAX_GRID_COLUMNS, raceCount);
  const widthPreferredColumns = Math.min(
    maxColumns,
    Math.max(minColumns, Math.ceil(MIN_TILE_WIDTH / (CARD_WIDTH + CANVAS_SPACING)))
  );

  let bestColumns = widthPreferredColumns;
  let bestScore = Number.POSITIVE_INFINITY;

  for (let columns = widthPreferredColumns; columns <= maxColumns; columns += 1) {
    const repeatedCells = (columns - (raceCount % columns)) % columns;
    const preferredWidthPenalty = Math.abs(columns - widthPreferredColumns);
    const score = repeatedCells * 100 + preferredWidthPenalty * 10;

    if (score < bestScore) {
      bestScore = score;
      bestColumns = columns;
    }
  }

  return bestColumns;
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
}: {
  item: RaceEntry;
  x: number;
  y: number;
  onOpen: (item: RaceEntry) => void;
}) {
  return (
    <button
      type="button"
      className="group absolute w-[290px] cursor-pointer select-none text-left"
      onDragStart={(event) => event.preventDefault()}
      onClick={() => onOpen(item)}
      aria-label={`Open ${item.raceName} details`}
      style={{
        left: `${x}px`,
        top: `${y}px`,
        height: `${PREVIEW_HEIGHT + META_REVEAL_SPACE}px`,
      }}
    >
      <div className="relative h-full overflow-visible">
        <div className="absolute inset-x-0 top-0 translate-x-0 translate-y-0 transform-gpu transition-transform duration-200 ease-out will-change-transform group-hover:-translate-y-4">
          <div className="relative aspect-[1.06/0.82] w-full overflow-hidden">
            <RacePreview image={item.bibImage} raceName={item.raceName} />
          </div>
        </div>

        <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 transform-gpu opacity-0 transition-[transform,opacity] duration-200 ease-out will-change-transform group-hover:translate-y-0 group-hover:opacity-100">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <h2 className="truncate text-[14px] text-foreground">{item.raceName}</h2>
            </div>
            <div className="shrink-0 text-right text-[14px] text-foreground">
              {item.raceType}
            </div>
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
  onOpen: (item: RaceEntry) => void;
  rowRef?: Ref<HTMLButtonElement>;
  onHoverStart?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onOpen(item)}
      ref={rowRef}
      onMouseEnter={onHoverStart}
      className="relative z-10 -mx-4 flex w-[calc(100%+2rem)] animate-[list-row-enter_680ms_cubic-bezier(0.22,1,0.36,1)] items-center gap-6 rounded-[8px] px-2 py-3 text-left opacity-0 transition-colors [animation-delay:var(--row-delay)] [animation-fill-mode:forwards] hover:text-foreground sm:-mx-5 sm:w-[calc(100%+2.5rem)] sm:px-3 sm:py-3"
      style={{ "--row-delay": `${Math.min(index, 8) * 45}ms` } as CSSProperties}
      aria-label={`Open ${item.raceName} details`}
    >
      <div className="w-[112px] shrink-0">
        <RacePreview image={item.bibImage} raceName={item.raceName} />
      </div>

      <div className="flex min-w-0 flex-1 items-start justify-between gap-6">
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

        <div className="shrink-0 text-right">
          <p className="text-[14px] text-foreground">{item.raceType}</p>
          <p className="mt-0.5 text-sm text-muted-foreground">{formatRaceDate(item.date)}</p>
        </div>
      </div>
    </button>
  );
}

function RaceDetailPanel({
  race,
  isOpen,
  onClose,
  onExited,
}: {
  race: RaceEntry;
  isOpen: boolean;
  onClose: () => void;
  onExited: () => void;
}) {
  const storyBlocks = getStoryBlocks(race.notes);
  const hasPhotos = race.photos.length > 0;
  const hasRoute = Boolean(race.gpxFile);
  const hasContent = storyBlocks.length > 0 || hasPhotos || hasRoute;
  const [activePhotoIndex, setActivePhotoIndex] = useState(0);
  const transitionDuration = `${DETAIL_PANEL_TRANSITION_MS}ms`;

  return (
    <div
      className={`fixed inset-0 z-30 ${isOpen ? "pointer-events-auto" : "pointer-events-none"}`}
    >
      <button
        type="button"
        aria-label="Close race details"
        className={`absolute inset-0 bg-background/72 backdrop-blur-[2px] ${
          isOpen ? "animate-[detail-backdrop-enter_350ms_cubic-bezier(0.22,1,0.36,1)]" : ""
        } transition-opacity ${
          isOpen ? "opacity-100" : "opacity-0"
        }`}
        style={{
          transitionDuration,
          transitionTimingFunction: DETAIL_PANEL_EASING,
        }}
        onClick={onClose}
      />

      <aside className="pointer-events-none absolute inset-x-4 inset-y-4 flex justify-end">
        <div
          className={`pointer-events-auto flex h-full max-h-full w-full max-w-[460px] transform-gpu flex-col overflow-hidden rounded-[4px] border border-border/70 bg-[color:color-mix(in_oklab,var(--background)_88%,white_12%)] shadow-[0_24px_80px_rgba(15,15,15,0.12)] backdrop-blur-xl ${
            isOpen ? "animate-[detail-panel-enter_350ms_cubic-bezier(0.22,1,0.36,1)]" : ""
          } transition-transform ${
            isOpen ? "translate-x-0" : "translate-x-[calc(100%+1.5rem)]"
          }`}
          style={{
            transitionDuration,
            transitionTimingFunction: DETAIL_PANEL_EASING,
          }}
          onTransitionEnd={(event) => {
            if (event.target !== event.currentTarget || event.propertyName !== "transform" || isOpen) {
              return;
            }

            onExited();
          }}
          onClick={(event) => event.stopPropagation()}
        >
          <div className="flex items-start justify-between gap-4 border-b border-border/70 px-5 pt-5 pb-4">
            <div className="min-w-0">
              <p className="text-sm uppercase text-muted-foreground">
                Race Notes
              </p>
              <h2 className="mt-2 text-sm text-foreground">{race.raceName}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{formatRaceDate(race.date)}</p>
            </div>

            <button
              type="button"
              onClick={onClose}
              aria-label="Close details panel"
              className="inline-flex size-9 shrink-0 items-center justify-center border border-border/70 text-muted-foreground transition hover:bg-muted hover:text-foreground"
            >
              <CloseIcon />
            </button>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto">
            <div className="space-y-6 pb-5">
              <div className="grid gap-0 border-x border-b border-border/70 sm:grid-cols-[minmax(0,1fr)_176px]">
                <div className="relative flex items-center justify-center overflow-hidden bg-muted/65 p-5">
                  <div className="relative mx-auto w-[88%]">
                    <RacePreview image={race.bibImage} raceName={race.raceName} />
                  </div>
                </div>

                <div className="grid h-full grid-cols-1 divide-y divide-border/70 border-l border-border/70 text-sm text-muted-foreground">
                  <div className="bg-background px-3 py-3">
                    <p>Type</p>
                    <p className="mt-1 text-sm tracking-normal text-foreground">{race.raceType}</p>
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
        </div>
      </aside>

    </div>
  );
}

export function BibWall({ races }: { races: RaceEntry[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [selectedRace, setSelectedRace] = useState<RaceEntry | null>(null);
  const [isDetailPanelOpen, setIsDetailPanelOpen] = useState(false);
  const [detailPanelInstance, setDetailPanelInstance] = useState(0);
  const [hoveredListRace, setHoveredListRace] = useState<string | null>(null);
  const [listHoverStyle, setListHoverStyle] = useState<CSSProperties>({
    top: "0px",
    left: "0px",
    width: "0px",
    height: "0px",
  });
  const [isDragging, setIsDragging] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const listRowRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const offsetRef = useRef(INITIAL_OFFSET);
  const dragStateRef = useRef<{
    clientX: number;
    clientY: number;
    startX: number;
    startY: number;
    hasMoved: boolean;
  } | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const lastPointerRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const inertiaFrameRef = useRef<number | null>(null);
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
  const tiledRaces = useMemo(() => {
    const tileCellCount = gridColumns * gridRows;
    return Array.from({ length: tileCellCount }, (_, index) => shuffledRaces[index % shuffledRaces.length]);
  }, [gridColumns, gridRows, shuffledRaces]);
  const canvasWidth =
    BOARD_INSET_X * 2 + (gridColumns - 1) * (CARD_WIDTH + CANVAS_SPACING) + CARD_WIDTH;
  const canvasHeight =
    BOARD_INSET_Y * 2 + (gridRows - 1) * (PREVIEW_HEIGHT + CANVAS_SPACING) + PREVIEW_HEIGHT;
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
  const filterTabs = useMemo(
    () =>
      FILTERS.map((filter) => ({
        id: filter,
        label: filter === "VK" ? filter : filter[0] + filter.slice(1).toLowerCase(),
      })),
    []
  );
  const sortOptions = useMemo(
    () =>
      SORT_FIELDS.map((field) => ({
        id: field,
        label: field === "date" ? "Date" : field === "distance" ? "Distance" : "Elevation",
      })),
    []
  );
  const [animatedCount, setAnimatedCount] = useState(0);
  const [animatedDistance, setAnimatedDistance] = useState(0);
  const [animatedElevation, setAnimatedElevation] = useState(0);
  const [listAnimationCycle, setListAnimationCycle] = useState(0);
  const handleRaceClose = useCallback(() => {
    setIsDetailPanelOpen(false);
  }, []);

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
    };
  }, []);

  useEffect(() => {
    if (!selectedRace) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        handleRaceClose();
      }
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [handleRaceClose, selectedRace]);

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
    const frame = requestAnimationFrame(() => {
      setAnimatedCount(displayedRaces.length);
      setAnimatedDistance(totalDistance);
      setAnimatedElevation(totalElevation);
    });

    return () => {
      cancelAnimationFrame(frame);
    };
  }, [displayedRaces.length, totalDistance, totalElevation]);

  const stopInertia = useCallback(() => {
    if (inertiaFrameRef.current !== null) {
      cancelAnimationFrame(inertiaFrameRef.current);
      inertiaFrameRef.current = null;
    }
  }, []);

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

  const startInertia = useCallback(() => {
    stopInertia();

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
        return;
      }

      setCanvasOffset({
        x: offsetRef.current.x + velocityRef.current.x,
        y: offsetRef.current.y + velocityRef.current.y,
      });

      inertiaFrameRef.current = requestAnimationFrame(step);
    };

    inertiaFrameRef.current = requestAnimationFrame(step);
  }, [setCanvasOffset, stopInertia]);

  const endPointerDrag = useCallback(() => {
    if (!dragStateRef.current) {
      return;
    }

    suppressClickRef.current = dragStateRef.current.hasMoved;
    dragStateRef.current = null;
    lastPointerRef.current = null;
    setIsDragging(false);

    if (suppressClickRef.current) {
      startInertia();
      return;
    }

    velocityRef.current = { x: 0, y: 0 };
  }, [startInertia]);

  function handlePointerDown(event: ReactMouseEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    stopInertia();

    dragStateRef.current = {
      clientX: event.clientX,
      clientY: event.clientY,
      startX: offsetRef.current.x,
      startY: offsetRef.current.y,
      hasMoved: false,
    };
    velocityRef.current = { x: 0, y: 0 };
    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };

    const handlePointerMove = (nativeEvent: MouseEvent) => {
      if (!dragStateRef.current) {
        return;
      }

      if (nativeEvent.cancelable) {
        nativeEvent.preventDefault();
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
        setIsDragging(true);
      }

      if (previousPointer) {
        const elapsed = Math.max(now - previousPointer.time, 1);
        const frameScale = 16 / elapsed;

        velocityRef.current = {
          x: (nativeEvent.clientX - previousPointer.x) * frameScale,
          y: (nativeEvent.clientY - previousPointer.y) * frameScale,
        };
      }

      setCanvasOffset({
        x: dragStateRef.current.startX + deltaX,
        y: dragStateRef.current.startY + deltaY,
      });

      lastPointerRef.current = {
        x: nativeEvent.clientX,
        y: nativeEvent.clientY,
        time: now,
      };
    };

    const cleanupDragListeners = () => {
      window.removeEventListener("mousemove", handlePointerMove);
      window.removeEventListener("mouseup", handlePointerEnd);
      window.removeEventListener("blur", handleWindowBlur);
      document.body.style.userSelect = "";
      dragCleanupRef.current = null;
    };

    const handlePointerEnd = () => {
      cleanupDragListeners();
      endPointerDrag();
    };

    const handleWindowBlur = () => {
      cleanupDragListeners();
      endPointerDrag();
    };

    if (dragCleanupRef.current) {
      dragCleanupRef.current();
    }

    document.body.style.userSelect = "none";
    window.addEventListener("mousemove", handlePointerMove, { passive: false });
    window.addEventListener("mouseup", handlePointerEnd);
    window.addEventListener("blur", handleWindowBlur);
    dragCleanupRef.current = cleanupDragListeners;
  }

  function handleSortChange(nextField: SortField) {
    if (sortField === nextField) {
      setSortDirection((current) => (current === "desc" ? "asc" : "desc"));
      setListAnimationCycle((cycle) => cycle + 1);
      return;
    }

    setSortField(nextField);
    setSortDirection("desc");
    setListAnimationCycle((cycle) => cycle + 1);
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
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleRaceOpen(item: RaceEntry) {
    if (suppressClickRef.current) {
      suppressClickRef.current = false;
      return;
    }

    if (selectedRace?.slug === item.slug && isDetailPanelOpen) {
      return;
    }

    if (selectedRace?.slug === item.slug) {
      setDetailPanelInstance((current) => current + 1);
      setIsDetailPanelOpen(true);
      return;
    }

    setSelectedRace(item);
    setDetailPanelInstance((current) => current + 1);
    setIsDetailPanelOpen(true);
  }

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/70 bg-background/88 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-6 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-left text-sm text-muted-foreground">
            <button
              type="button"
              onClick={handleHomeClick}
              aria-label="Go to home grid view"
              className="flex shrink-0 items-center gap-2 rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/25"
            >
              <Image
                src="/logo.svg"
                alt="BIB WALL"
                width={807}
                height={577}
                priority
                className="h-7 w-auto shrink-0"
              />
              <span className="shrink-0 font-heading text-foreground">BIB WALL</span>
            </button>
            <span className="shrink-0 text-muted-foreground/60">·</span>
            <span className="flex min-w-0 items-center [font-family:var(--font-geist-sans)]">
              <span className="truncate">A collection of race bibs from years of&nbsp;</span>
              <span className="group relative shrink-0">
                <span className="underline decoration-foreground/30 underline-offset-[3px] transition-colors group-hover:text-foreground group-hover:decoration-foreground/60">
                  type 2 fun
                </span>
                <span className="pointer-events-none absolute left-1/2 top-full z-20 mt-2 -translate-x-1/2 whitespace-nowrap rounded-[6px] border border-border/70 bg-background/95 px-2 py-1 font-mono text-[12px] normal-case text-foreground opacity-0 shadow-sm transition duration-150 group-hover:opacity-100">
                  Not always fun in the moment, but somehow you sign up for another race right after.
                </span>
              </span>
              <span className="shrink-0">.</span>
            </span>
          </div>

          <div className="flex items-center gap-6 text-xs uppercase text-muted-foreground">
            <NumberFlowGroup>
              <div className="flex items-center gap-5">
                <span className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <NumberFlow
                    value={animatedCount}
                    format={{ useGrouping: false }}
                    className="tabular-nums"
                  />
                  <span>races</span>
                </span>
                <span className="group relative inline-flex items-center gap-2 transition-colors hover:text-foreground">
                  <NavStatTooltip label="Total distance" />
                  <DistanceIcon />
                  <NumberFlow
                    value={animatedDistance}
                    format={{
                      minimumFractionDigits: distancePrecision,
                      maximumFractionDigits: distancePrecision,
                      useGrouping: false,
                    }}
                    suffix="km"
                    className="tabular-nums"
                  />
                </span>
                <span className="group relative inline-flex items-center gap-2 transition-colors hover:text-foreground">
                  <NavStatTooltip label="Elevation gain" />
                  <ElevationIcon />
                  <NumberFlow
                    value={animatedElevation}
                    format={{ maximumFractionDigits: 0, useGrouping: false }}
                    suffix="m"
                    className="tabular-nums"
                  />
                </span>
              </div>
            </NumberFlowGroup>

            <div className="h-5 w-px bg-foreground/18" />

            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                aria-label="Grid view"
                className={`inline-flex items-center p-1.5 transition ${
                  viewMode === "grid"
                    ? "text-foreground opacity-100"
                    : "text-muted-foreground opacity-35 hover:opacity-100 hover:text-foreground"
                }`}
              >
                <GridIcon />
              </button>
              <button
                type="button"
                onClick={() => {
                  setViewMode("list");
                  setListAnimationCycle((cycle) => cycle + 1);
                }}
                aria-label="List view"
                className={`inline-flex items-center p-1.5 transition ${
                  viewMode === "list"
                    ? "text-foreground opacity-100"
                    : "text-muted-foreground opacity-35 hover:opacity-100 hover:text-foreground"
                }`}
              >
                <ListIcon />
              </button>
            </div>
          </div>
        </div>
      </header>

      {viewMode === "grid" ? (
        <section
          ref={sectionRef}
          className={`relative h-screen select-none overflow-hidden bg-background pt-[57px] ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onDragStart={(event) => event.preventDefault()}
          onMouseDown={handlePointerDown}
        >
          <div
            ref={canvasRef}
            className="absolute left-1/2 top-1/2 will-change-transform"
            style={{
              width: `${canvasWidth}px`,
              height: `${canvasHeight}px`,
              transform: `translate(calc(-50% + ${INITIAL_OFFSET.x}px), calc(-50% + ${INITIAL_OFFSET.y}px))`,
            }}
          >
            {TILE_OFFSETS.flatMap((tileY) =>
              TILE_OFFSETS.flatMap((tileX) =>
                tiledRaces.map((item, index) => {
                  const position = getCardPosition(index, gridColumns);

                  return (
                    <GalleryCard
                      key={`${tileX}-${tileY}-${index}-${item.slug}`}
                      item={item}
                      x={position.x + tileX * canvasWidth}
                      y={position.y + tileY * canvasHeight}
                      onOpen={handleRaceOpen}
                    />
                  );
                })
              )
            )}
          </div>
        </section>
      ) : (
        <section className="min-h-screen bg-background pt-[81px]">
          <div className="mx-auto max-w-[640px] px-4 pb-10 sm:px-6">
            <div className="mb-6 flex items-center justify-between gap-6">
              <Tabs
                tabs={filterTabs}
                activeTab={activeFilter}
                onTabChange={(tabId) => {
                  setActiveFilter(tabId);
                  setListAnimationCycle((cycle) => cycle + 1);
                }}
                className="min-w-0 text-xs"
              />

              <div className="flex shrink-0 items-center gap-3 text-[14px] text-muted-foreground">
                {sortOptions.map((option) => {
                  const isActive = sortField === option.id;
                  const qualifier = getSortQualifierLabel(option.id);

                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => handleSortChange(option.id)}
                      className={`group relative inline-flex items-center gap-1.5 transition ${
                        isActive
                          ? "text-foreground"
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

            <div
              ref={listContainerRef}
              className="relative"
              onMouseLeave={() => setHoveredListRace(null)}
            >
              <div
                className="pointer-events-none absolute rounded-[8px] bg-foreground/[0.04] transition-all duration-300 ease-out"
                style={{
                  ...listHoverStyle,
                  opacity: hoveredListRace ? 1 : 0,
                }}
              />
              {sortedRaces.map((item, index) => (
                <ListRow
                  key={`${listAnimationCycle}-${item.slug}`}
                  item={item}
                  index={index}
                  onOpen={handleRaceOpen}
                  rowRef={(node) => {
                    listRowRefs.current[item.slug] = node;
                  }}
                  onHoverStart={() => setHoveredListRace(item.slug)}
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {selectedRace ? (
        <RaceDetailPanel
          key={`${selectedRace.slug}-${detailPanelInstance}`}
          race={selectedRace}
          isOpen={isDetailPanelOpen}
          onClose={handleRaceClose}
          onExited={() => setSelectedRace(null)}
        />
      ) : null}
    </main>
  );
}
