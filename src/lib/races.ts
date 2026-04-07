import { promises as fs } from "node:fs";
import path from "node:path";
import { cache } from "react";

import type { RaceEntry } from "@/lib/race-types";

const RACES_DIR = path.join(process.cwd(), "races");

type FrontmatterValue = string | string[];

function parseFrontmatter(source: string): {
  frontmatter: Record<string, FrontmatterValue>;
  content: string;
} {
  if (!source.startsWith("---\n")) {
    return { frontmatter: {}, content: source.trim() };
  }

  const closingIndex = source.indexOf("\n---\n", 4);

  if (closingIndex === -1) {
    return { frontmatter: {}, content: source.trim() };
  }

  const rawFrontmatter = source.slice(4, closingIndex).trim();
  const content = source.slice(closingIndex + 5).trim();
  const frontmatter: Record<string, FrontmatterValue> = {};
  let currentArrayKey: string | null = null;

  for (const line of rawFrontmatter.split("\n")) {
    const arrayMatch = line.match(/^\s*-\s+(.*)$/);

    if (arrayMatch && currentArrayKey) {
      const currentValue = frontmatter[currentArrayKey];
      const nextValue = arrayMatch[1].trim();
      frontmatter[currentArrayKey] = Array.isArray(currentValue)
        ? [...currentValue, nextValue]
        : [nextValue];
      continue;
    }

    const keyMatch = line.match(/^([A-Za-z0-9_]+):\s*(.*)$/);

    if (!keyMatch) {
      currentArrayKey = null;
      continue;
    }

    const [, key, rawValue] = keyMatch;
    const value = rawValue.trim();

    if (value === "") {
      frontmatter[key] = [];
      currentArrayKey = key;
    } else {
      frontmatter[key] = value;
      currentArrayKey = null;
    }
  }

  return { frontmatter, content };
}

function toOptionalString(value: FrontmatterValue | undefined) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function toStringArray(value: FrontmatterValue | undefined) {
  return Array.isArray(value) ? value : [];
}

function getSortValue(dateLabel: string) {
  const fullDateMatch = dateLabel.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);

  if (fullDateMatch) {
    const [, day, month, year] = fullDateMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
  }

  const parsed = new Date(`${dateLabel} 1`);
  return Number.isNaN(parsed.getTime()) ? 0 : parsed.getTime();
}

function toAssetUrl(slug: string, assetPath: string | undefined) {
  if (!assetPath) {
    return undefined;
  }

  if (assetPath.startsWith("/")) {
    return assetPath;
  }

  const encodedPath = assetPath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  return `/race-assets/${encodeURIComponent(slug)}/${encodedPath}`;
}

async function pathExists(filePath: string) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function resolveBibAssetPath(directoryName: string, assetPath: string | undefined) {
  if (!assetPath) {
    return undefined;
  }

  const parsedPath = path.parse(assetPath);
  const previewCandidates = [
    `${parsedPath.name}.preview.avif`,
    `${parsedPath.name}.preview.webp`,
    `${parsedPath.name}.preview.jpg`,
    `${parsedPath.name}.preview.jpeg`,
    `${parsedPath.name}.preview.png`,
  ];

  for (const previewFileName of previewCandidates) {
    const previewRelativePath = path.join(parsedPath.dir, previewFileName);
    const previewAbsolutePath = path.join(RACES_DIR, directoryName, previewRelativePath);

    if (await pathExists(previewAbsolutePath)) {
      return toAssetUrl(directoryName, previewRelativePath);
    }
  }

  return toAssetUrl(directoryName, assetPath);
}

async function readRaceDirectory(directoryName: string): Promise<RaceEntry> {
  const fullPath = path.join(RACES_DIR, directoryName, "index.md");
  const source = await fs.readFile(fullPath, "utf8");
  const { frontmatter, content } = parseFrontmatter(source);

  const requiredFields = [
    "raceName",
    "raceType",
    "distance",
    "elevation",
    "date",
  ] as const;

  for (const field of requiredFields) {
    if (typeof frontmatter[field] !== "string" || frontmatter[field].length === 0) {
      throw new Error(`Missing required field "${field}" in ${directoryName}/index.md`);
    }
  }

  return {
    slug: directoryName,
    raceName: frontmatter.raceName as string,
    raceType: frontmatter.raceType as string,
    distance: frontmatter.distance as string,
    elevation: frontmatter.elevation as string,
    date: frontmatter.date as string,
    bibImage: await resolveBibAssetPath(
      directoryName,
      toOptionalString(frontmatter.bibImage)
    ),
    gpxFile: toAssetUrl(directoryName, toOptionalString(frontmatter.gpxFile)),
    photos: toStringArray(frontmatter.photos).map((photo) => toAssetUrl(directoryName, photo)!),
    notes: content,
  };
}

export const getRaceEntries = cache(async () => {
  const entries = await fs.readdir(RACES_DIR, { withFileTypes: true });
  const raceDirectories = entries
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name);

  const races = await Promise.all(raceDirectories.map(readRaceDirectory));

  return races.sort((a, b) => getSortValue(b.date) - getSortValue(a.date));
});
