import { promises as fs } from "node:fs";
import os from "node:os";
import path from "node:path";
import sharp from "sharp";
import { expect, it } from "vitest";

import { generateRaceImages } from "./generate-race-images.mjs";

it("builds portable responsive images, reuses them, and refreshes replaced originals", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bib-images-"));
  try {
    const racesDir = path.join(root, "races");
    const raceDir = path.join(racesDir, "test-race");
    const outputDir = path.join(root, "public");
    const manifestPath = path.join(root, "manifest.json");
    await fs.mkdir(raceDir, { recursive: true });
    await fs.writeFile(path.join(raceDir, "index.md"),
      "---\nbibImage: bib.png\nphotos:\n  - photo.jpg\n---\nphotos:\n  - not-a-real-photo.jpg\n");
    const bibPath = path.join(raceDir, "bib.png");
    await sharp({ create: { width: 800, height: 400, channels: 4, background: "#ff000080" } })
      .png().toFile(bibPath);
    await sharp({ create: { width: 600, height: 900, channels: 3, background: "blue" } })
      .jpeg().toFile(path.join(raceDir, "photo.jpg"));
    const options = { racesDir, outputDir, manifestPath };
    const first = await generateRaceImages(options);
    expect(first.images).toBe(2);
    expect(first.generated).toBe(10);
    const manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    const bibUrl = manifest["test-race/bib.png"];
    const outputPath = path.join(outputDir, path.basename(bibUrl));
    const meta = await sharp(outputPath).metadata();
    expect(meta).toMatchObject({ width: 800, height: 400, format: "webp", hasAlpha: true });
    const small = await sharp(outputPath.replace("-960.webp", "-320.webp")).metadata();
    expect(small).toMatchObject({ width: 320, height: 160 });
    const before = (await fs.stat(outputPath)).mtimeMs;
    const second = await generateRaceImages(options);
    expect(second).toMatchObject({ generated: 0, reused: 10 });
    expect((await fs.stat(outputPath)).mtimeMs).toBe(before);
    await sharp({ create: { width: 800, height: 400, channels: 4, background: "green" } })
      .png().toFile(bibPath);
    await generateRaceImages(options);
    const updated = JSON.parse(await fs.readFile(manifestPath, "utf8"));
    expect(updated["test-race/bib.png"]).not.toBe(bibUrl);
    expect(updated["test-race/photo.jpg"]).toBe(manifest["test-race/photo.jpg"]);
    await expect(fs.access(outputPath)).rejects.toThrow();
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
