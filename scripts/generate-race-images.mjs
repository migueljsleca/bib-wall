import { createHash, randomUUID } from "node:crypto";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const root = fileURLToPath(new URL("../", import.meta.url));
const widths = JSON.parse(await fs.readFile(path.join(root, "src/lib/race-image-widths.json"), "utf8"));
const options = { quality: 78, effort: 5, alphaQuality: 100 };

async function writeAtomically(filename, data) {
  const temporary = `${filename}.${randomUUID()}.tmp`;
  try {
    await fs.writeFile(temporary, data);
    await fs.rename(temporary, filename);
  } finally {
    await fs.unlink(temporary).catch(() => {});
  }
}

export async function generateRaceImages({
  racesDir = path.join(root, "races"),
  outputDir = path.join(root, "public/race-images"),
  manifestPath = path.join(root, "src/lib/generated/race-images.json"),
} = {}) {
  await fs.mkdir(outputDir, { recursive: true });
  const manifest = {};
  const outputFiles = new Set();
  let generated = 0;
  let reused = 0;
  let sourceBytes = 0;
  let defaultBytes = 0;

  const entries = (await fs.readdir(racesDir, { withFileTypes: true }))
    .filter((entry) => entry.isDirectory())
    .sort((a, b) => a.name.localeCompare(b.name));

  for (const entry of entries) {
    const markdown = await fs.readFile(path.join(racesDir, entry.name, "index.md"), "utf8");
    const frontmatter = markdown.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1] ?? "";
    const bib = frontmatter.match(/^bibImage:\s*(.+)$/m)?.[1].trim();
    const photos = [...(frontmatter.match(/^photos:[ \t]*\r?\n((?:[ \t]+-[^\n]*(?:\n|$))*)/m)?.[1] ?? "")
      .matchAll(/^[ \t]+-[ \t]+(.+)$/gm)].map((match) => match[1].trim());

    for (const asset of new Set([bib, ...photos].filter(Boolean))) {
      // Absolute public URLs keep the existing Next.js fallback.
      if (asset.startsWith("/")) continue;
      const raceDir = path.join(racesDir, entry.name);
      const sourcePath = path.resolve(raceDir, asset);
      if (!sourcePath.startsWith(`${raceDir}${path.sep}`)) {
        throw new Error(`Image path escapes race directory: ${entry.name}/${asset}`);
      }

      const source = await fs.readFile(sourcePath);
      const hash = createHash("sha256")
        .update(JSON.stringify({ widths, options, sharp: sharp.versions }))
        .update(source).digest("hex").slice(0, 24);
      const defaultWidth = asset === bib ? 960 : 1920;
      manifest[`${entry.name}/${asset}`] = `/race-images/${hash}-${defaultWidth}.webp`;
      sourceBytes += source.length;

      for (const width of widths) {
        const filename = `${hash}-${width}.webp`;
        const outputPath = path.join(outputDir, filename);
        outputFiles.add(filename);
        try {
          await fs.access(outputPath);
          reused++;
        } catch {
          // Start with the original, retain transparency, and never enlarge pixels.
          const encoded = await sharp(source).rotate().resize({ width, withoutEnlargement: true })
            .webp(options).toBuffer();
          await writeAtomically(outputPath, encoded);
          generated++;
        }
        if (width === defaultWidth) defaultBytes += (await fs.stat(outputPath)).size;
      }
    }
  }

  // Publish the manifest only after every referenced variant exists.
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  const manifestSource = `${JSON.stringify(manifest, null, 2)}\n`;
  if (await fs.readFile(manifestPath, "utf8").catch(() => "") !== manifestSource) {
    await writeAtomically(manifestPath, manifestSource);
  }
  for (const filename of await fs.readdir(outputDir)) {
    if (/^[a-f0-9]{24}-\d+\.webp$/.test(filename) && !outputFiles.has(filename)) {
      await fs.unlink(path.join(outputDir, filename));
    }
  }
  return { images: Object.keys(manifest).length, generated, reused, sourceBytes, defaultBytes };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  console.log("Race image preparation:", await generateRaceImages());
}
