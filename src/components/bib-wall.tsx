"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import Image from "next/image";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { Tabs } from "@/components/ui/vercel-tabs";
import type { RaceEntry } from "@/lib/race-types";

const CARD_WIDTH = 290;
const CANVAS_SPACING = 65;
const MAX_GRID_COLUMNS = 4;
const TILE_OFFSETS = [-1, 0, 1];
const PREVIEW_ASPECT_RATIO = 1.06 / 0.82;
const PREVIEW_HEIGHT = CARD_WIDTH / PREVIEW_ASPECT_RATIO;
const META_REVEAL_SPACE = 28;
const TILE_GUTTER = CANVAS_SPACING / 2;
const INERTIA_FRICTION = 0.92;
const INERTIA_MIN_SPEED = 0.2;
const INITIAL_OFFSET = { x: -160, y: -120 };
const FILTERS = ["All", "Trail", "Road", "Sky", "VK"] as const;
const SORT_FIELDS = ["date", "distance", "elevation"] as const;

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
    <span className="pointer-events-none absolute left-1/2 top-full mt-2 -translate-x-1/2 rounded-[6px] border border-border/70 bg-background/95 px-2 py-1 text-[10px] normal-case text-foreground opacity-0 shadow-sm transition duration-150 group-hover:opacity-100">
      {label}
    </span>
  );
}

const GRID_ROWS_FALLBACK = 1;

function getCardPosition(index: number, gridColumns: number) {
  const column = index % gridColumns;
  const row = Math.floor(index / gridColumns);

  return {
    x: TILE_GUTTER + column * (CARD_WIDTH + CANVAS_SPACING),
    y: TILE_GUTTER + row * (PREVIEW_HEIGHT + CANVAS_SPACING),
  };
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
}: {
  item: RaceEntry;
  x: number;
  y: number;
}) {
  return (
    <article
      className="group absolute w-[290px] cursor-inherit select-none"
      onDragStart={(event) => event.preventDefault()}
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
            <div className="shrink-0 text-right">{item.date}</div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ListRow({ item, index }: { item: RaceEntry; index: number }) {
  return (
    <article
      className="flex animate-[list-row-enter_680ms_cubic-bezier(0.22,1,0.36,1)] items-center gap-6 py-5 opacity-0 [animation-delay:var(--row-delay)] [animation-fill-mode:forwards] first:pt-0 last:pb-0"
      style={{ "--row-delay": `${Math.min(index, 8) * 45}ms` } as CSSProperties}
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
          <p className="mt-0.5 text-sm text-muted-foreground">{item.date}</p>
        </div>
      </div>
    </article>
  );
}

export function BibWall({ races }: { races: RaceEntry[] }) {
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeFilter, setActiveFilter] = useState("All");
  const [sortField, setSortField] = useState<SortField>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [isDragging, setIsDragging] = useState(false);
  const sectionRef = useRef<HTMLElement | null>(null);
  const canvasRef = useRef<HTMLDivElement | null>(null);
  const offsetRef = useRef(INITIAL_OFFSET);
  const pointerIdRef = useRef<number | null>(null);
  const dragStateRef = useRef<{
    pointerX: number;
    pointerY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const velocityRef = useRef({ x: 0, y: 0 });
  const transformFrameRef = useRef<number | null>(null);
  const pendingOffsetRef = useRef(INITIAL_OFFSET);
  const lastPointerRef = useRef<{
    x: number;
    y: number;
    time: number;
  } | null>(null);
  const inertiaFrameRef = useRef<number | null>(null);

  const gridColumns = Math.max(1, Math.min(MAX_GRID_COLUMNS, races.length));
  const gridRows = Math.max(Math.ceil(races.length / gridColumns), GRID_ROWS_FALLBACK);
  const canvasWidth = gridColumns * (CARD_WIDTH + CANVAS_SPACING);
  const canvasHeight = gridRows * (PREVIEW_HEIGHT + CANVAS_SPACING);
  const filteredRaces =
    activeFilter === "All"
      ? races
      : races.filter((race) => race.raceType.toLowerCase() === activeFilter.toLowerCase());
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

  useEffect(() => {
    document.documentElement.dataset.viewMode = viewMode;

    return () => {
      delete document.documentElement.dataset.viewMode;
    };
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (inertiaFrameRef.current !== null) {
        cancelAnimationFrame(inertiaFrameRef.current);
      }

      if (transformFrameRef.current !== null) {
        cancelAnimationFrame(transformFrameRef.current);
      }
    };
  }, []);

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

  const flushCanvasTransform = useCallback(() => {
    if (!canvasRef.current) {
      return;
    }

    const { x, y } = pendingOffsetRef.current;
    canvasRef.current.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
  }, []);

  const setCanvasOffset = useCallback(
    (nextOffset: { x: number; y: number }) => {
      offsetRef.current = {
        x: wrapOffset(nextOffset.x, canvasWidth),
        y: wrapOffset(nextOffset.y, canvasHeight),
      };
      pendingOffsetRef.current = offsetRef.current;

      if (transformFrameRef.current !== null) {
        return;
      }

      transformFrameRef.current = requestAnimationFrame(() => {
        transformFrameRef.current = null;
        flushCanvasTransform();
      });
    },
    [canvasHeight, canvasWidth, flushCanvasTransform]
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

  const handleNativePointerMove = useCallback(
    (event: PointerEvent) => {
      if (!dragStateRef.current) {
        return;
      }

      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return;
      }

      const deltaX = event.clientX - dragStateRef.current.pointerX;
      const deltaY = event.clientY - dragStateRef.current.pointerY;
      const now = performance.now();
      const previousPointer = lastPointerRef.current;

      if (previousPointer) {
        const elapsed = Math.max(now - previousPointer.time, 1);
        const frameScale = 16 / elapsed;

        velocityRef.current = {
          x: (event.clientX - previousPointer.x) * frameScale,
          y: (event.clientY - previousPointer.y) * frameScale,
        };
      }

      setCanvasOffset({
        x: dragStateRef.current.startX + deltaX,
        y: dragStateRef.current.startY + deltaY,
      });

      lastPointerRef.current = {
        x: event.clientX,
        y: event.clientY,
        time: now,
      };
    },
    [setCanvasOffset]
  );

  const endPointerDrag = useCallback(() => {
    if (!dragStateRef.current) {
      return;
    }

    const section = sectionRef.current;
    const pointerId = pointerIdRef.current;
    if (section && pointerId !== null && section.hasPointerCapture(pointerId)) {
      section.releasePointerCapture(pointerId);
    }

    pointerIdRef.current = null;
    dragStateRef.current = null;
    lastPointerRef.current = null;
    setIsDragging(false);
    startInertia();
  }, [startInertia]);

  useEffect(() => {
    function handlePointerMove(event: PointerEvent) {
      handleNativePointerMove(event);
    }

    function handlePointerUp(event: PointerEvent) {
      if (pointerIdRef.current !== null && event.pointerId !== pointerIdRef.current) {
        return;
      }

      endPointerDrag();
    }

    window.addEventListener("pointermove", handlePointerMove);
    window.addEventListener("pointerup", handlePointerUp);
    window.addEventListener("pointercancel", handlePointerUp);

    return () => {
      window.removeEventListener("pointermove", handlePointerMove);
      window.removeEventListener("pointerup", handlePointerUp);
      window.removeEventListener("pointercancel", handlePointerUp);
    };
  }, [endPointerDrag, handleNativePointerMove]);

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    if (event.button !== 0) {
      return;
    }

    event.preventDefault();
    stopInertia();
    const target = sectionRef.current ?? event.currentTarget;
    const pointerId = event.pointerId;
    pointerIdRef.current = pointerId;
    target.setPointerCapture(pointerId);

    dragStateRef.current = {
      pointerX: event.clientX,
      pointerY: event.clientY,
      startX: offsetRef.current.x,
      startY: offsetRef.current.y,
    };
    velocityRef.current = { x: 0, y: 0 };
    lastPointerRef.current = {
      x: event.clientX,
      y: event.clientY,
      time: performance.now(),
    };

    setIsDragging(true);
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

  return (
    <main className="min-h-screen bg-background font-sans text-foreground">
      <header className="fixed inset-x-0 top-0 z-20 border-b border-border/70 bg-background/88 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-6 px-4 py-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-1.5 text-left text-sm text-muted-foreground">
            <span className="shrink-0 font-heading text-foreground">BIB WALL</span>
            <span className="shrink-0 text-muted-foreground/60">·</span>
            <span className="truncate [font-family:var(--font-geist-sans)]">
              A collection of race bibs from years of type 2 fun.
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
          className={`relative h-screen overflow-hidden bg-background pt-[57px] ${
            isDragging ? "cursor-grabbing" : "cursor-grab"
          }`}
          onDragStart={(event) => event.preventDefault()}
          onPointerDown={handlePointerDown}
          style={{ touchAction: "none" }}
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
                races.map((item, index) => {
                  const position = getCardPosition(index, gridColumns);

                  return (
                    <GalleryCard
                      key={`${tileX}-${tileY}-${item.slug}`}
                      item={item}
                      x={position.x + tileX * canvasWidth}
                      y={position.y + tileY * canvasHeight}
                    />
                  );
                })
              )
            )}
          </div>

          <div className="pointer-events-none absolute bottom-6 left-6 text-[11px] uppercase text-muted-foreground/80">
            Drag to explore
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
                      {qualifier ? (
                        <span className="text-muted-foreground/80">[{qualifier}]</span>
                      ) : null}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="divide-y divide-border/70">
              {sortedRaces.map((item, index) => (
                <ListRow key={`${listAnimationCycle}-${item.slug}`} item={item} index={index} />
              ))}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
