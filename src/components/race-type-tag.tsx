import { cn } from "@/lib/utils"

const RACE_TYPE_STYLES: Record<string, string> = {
  Trail:
    "bg-[oklch(0.92_0.035_145)] text-[oklch(0.39_0.07_145)] dark:bg-[oklch(0.30_0.035_145)] dark:text-[oklch(0.84_0.045_145)]",
  VK:
    "bg-[oklch(0.93_0.035_235)] text-[oklch(0.40_0.07_235)] dark:bg-[oklch(0.30_0.035_235)] dark:text-[oklch(0.84_0.045_235)]",
  Road:
    "bg-[oklch(0.93_0.04_55)] text-[oklch(0.41_0.075_50)] dark:bg-[oklch(0.30_0.04_55)] dark:text-[oklch(0.85_0.05_55)]",
  Sky:
    "bg-[oklch(0.92_0.035_305)] text-[oklch(0.40_0.07_305)] dark:bg-[oklch(0.30_0.035_305)] dark:text-[oklch(0.85_0.045_305)]",
}

export function RaceTypeTag({
  type,
  className,
}: {
  type: string
  className?: string
}) {
  return (
    <span
      className={cn(
        "inline-flex rounded-[4px] px-2 py-1 text-[12px] font-medium leading-5",
        RACE_TYPE_STYLES[type] ?? "bg-muted text-muted-foreground",
        className,
      )}
    >
      {type}
    </span>
  )
}
