"use client";

import NumberFlow, { NumberFlowGroup } from "@number-flow/react";
import Image from "next/image";
import Link from "next/link";
import type { MouseEvent } from "react";

import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

export type CollectionView = "grid" | "list" | "timeline";
export type WallView = Exclude<CollectionView, "timeline">;

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

function LogoContent() {
  return (
    <>
      <Image
        src="/logo.svg"
        alt="BIB WALL"
        width={807}
        height={577}
        priority
        className="h-7 w-auto shrink-0"
      />
      <span className="shrink-0 font-heading text-foreground">BIB WALL</span>
    </>
  );
}

function getViewHref(view: WallView) {
  return view === "list" ? "/?view=list" : "/?view=grid";
}

export function CollectionHeader({
  activeView,
  count,
  distance,
  elevation,
  distancePrecision,
  onHomeClick,
  onViewChange,
}: {
  activeView: CollectionView;
  count: number;
  distance: number;
  elevation: number;
  distancePrecision: number;
  onHomeClick?: () => void;
  onViewChange?: (view: WallView, interactionDetail: number) => void;
}) {
  const logoClassName =
    "flex min-h-10 shrink-0 items-center gap-2 rounded-md transition-opacity hover:opacity-75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35";

  function handleViewClick(
    event: MouseEvent<HTMLButtonElement>,
    view: WallView,
  ) {
    onViewChange?.(view, event.detail);
  }

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/70 bg-background/88 backdrop-blur-xl">
      <div
        data-site-nav-inner
        className="flex items-center justify-between gap-3 px-4 py-2 sm:px-6"
      >
        <div className="flex min-w-0 items-center gap-1.5 text-left text-sm text-muted-foreground">
          {onHomeClick ? (
            <button
              type="button"
              onClick={onHomeClick}
              aria-label="Go to home grid view"
              data-site-nav-logo
              className={logoClassName}
            >
              <LogoContent />
            </button>
          ) : (
            <Link
              href="/?view=grid"
              aria-label="Go to home grid view"
              data-site-nav-logo
              className={logoClassName}
            >
              <LogoContent />
            </Link>
          )}

          <span className="hidden shrink-0 text-muted-foreground/60 min-[900px]:inline">
            ·
          </span>
          <span className="hidden min-w-0 items-center [font-family:var(--font-geist-sans)] min-[900px]:flex">
            <span className="truncate">
              A collection of race bibs from years of&nbsp;
            </span>
            <Tooltip>
              <TooltipTrigger asChild>
                <button
                  type="button"
                  className="shrink-0 underline decoration-foreground/30 underline-offset-[3px] transition-colors hover:text-foreground hover:decoration-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35"
                >
                  type 2 fun
                </button>
              </TooltipTrigger>
              <TooltipContent sideOffset={8}>
                Not always fun in the moment, but somehow you sign up for
                another race right after.
              </TooltipContent>
            </Tooltip>
            <span className="shrink-0">.</span>
          </span>
        </div>

        <div className="flex shrink-0 items-center gap-3 text-xs uppercase text-muted-foreground sm:gap-6">
          <div className="hidden min-[760px]:block">
            <NumberFlowGroup>
              <div className="flex items-center gap-5">
                <span className="inline-flex items-center gap-1.5 transition-colors hover:text-foreground">
                  <NumberFlow
                    value={count}
                    format={{ useGrouping: false }}
                    className="tabular-nums"
                  />
                  <span>races</span>
                </span>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="inline-flex items-center gap-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35"
                    >
                      <DistanceIcon />
                      <NumberFlow
                        value={distance}
                        format={{
                          minimumFractionDigits: distancePrecision,
                          maximumFractionDigits: distancePrecision,
                          useGrouping: false,
                        }}
                        suffix="km"
                        className="tabular-nums"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>Total distance</TooltipContent>
                </Tooltip>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <span
                      tabIndex={0}
                      className="inline-flex items-center gap-2 transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-foreground/35"
                    >
                      <ElevationIcon />
                      <NumberFlow
                        value={elevation}
                        format={{ maximumFractionDigits: 0, useGrouping: false }}
                        suffix="m"
                        className="tabular-nums"
                      />
                    </span>
                  </TooltipTrigger>
                  <TooltipContent sideOffset={8}>Elevation gain</TooltipContent>
                </Tooltip>
              </div>
            </NumberFlowGroup>
          </div>

          <div
            role="group"
            aria-label="Choose collection view"
            className="flex h-10 items-stretch text-[11px] normal-case tracking-[0.04em]"
          >
            {(
              [
                { id: "grid", label: "Canvas" },
                { id: "list", label: "List" },
                { id: "timeline", label: "Timeline" },
              ] as const
            ).map((option) => {
              const isActive = activeView === option.id;
              const className = `inline-flex min-h-10 items-center justify-center whitespace-nowrap rounded-[4px] px-3 transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.96] focus-visible:outline-2 focus-visible:outline-offset-2 ${
                isActive
                  ? "bg-muted text-foreground"
                  : "text-muted-foreground hover:text-foreground"
              }`;

              if (isActive) {
                return (
                  <span
                    key={option.id}
                    aria-current="page"
                    className={className}
                  >
                    {option.label}
                  </span>
                );
              }

              if (option.id === "timeline") {
                return (
                  <Link
                    key={option.id}
                    href="/timeline"
                    className={className}
                  >
                    {option.label}
                  </Link>
                );
              }

              if (onViewChange) {
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={(event) => handleViewClick(event, option.id)}
                    className={className}
                  >
                    {option.label}
                  </button>
                );
              }

              return (
                <Link
                  key={option.id}
                  href={getViewHref(option.id)}
                  className={className}
                >
                  {option.label}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </header>
  );
}
