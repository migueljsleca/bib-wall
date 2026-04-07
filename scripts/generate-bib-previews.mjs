import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, "..");
const racesDir = path.join(projectRoot, "races");

const PREVIEW_WIDTH = 720;
const PREVIEW_SUFFIX = ".preview.png";

function extractBibImage(markdownSource) {
  const match = markdownSource.match(/^bibImage:\s*(.+)$/m);
  return match?.[1]?.trim();
}

function runSips(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    const child = spawn("sips", [
      "-Z",
      String(PREVIEW_WIDTH),
      "-s",
      "format",
      "png",
      inputPath,
      "--out",
      outputPath,
    ]);

    let stderr = "";

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("close", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(new Error(stderr.trim() || `sips exited with code ${code}`));
    });
  });
}

async function shouldGeneratePreview(sourcePath, previewPath) {
  try {
    const [sourceStats, previewStats] = await Promise.all([
      fs.stat(sourcePath),
      fs.stat(previewPath),
    ]);

    return sourceStats.mtimeMs > previewStats.mtimeMs;
  } catch {
    return true;
  }
}

async function main() {
  const entries = await fs.readdir(racesDir, { withFileTypes: true });
  let generatedCount = 0;
  let skippedCount = 0;

  for (const entry of entries) {
    if (!entry.isDirectory()) {
      continue;
    }

    const raceDir = path.join(racesDir, entry.name);
    const indexPath = path.join(raceDir, "index.md");

    try {
      const source = await fs.readFile(indexPath, "utf8");
      const bibImage = extractBibImage(source);

      if (!bibImage) {
        continue;
      }

      const sourcePath = path.join(raceDir, bibImage);
      const parsedPath = path.parse(sourcePath);
      const previewPath = path.join(parsedPath.dir, `${parsedPath.name}${PREVIEW_SUFFIX}`);

      if (!(await shouldGeneratePreview(sourcePath, previewPath))) {
        skippedCount += 1;
        continue;
      }

      await runSips(sourcePath, previewPath);
      generatedCount += 1;
      console.log(`Generated ${path.relative(projectRoot, previewPath)}`);
    } catch (error) {
      console.error(`Failed for ${entry.name}:`, error instanceof Error ? error.message : error);
      process.exitCode = 1;
    }
  }

  console.log(`Done. Generated ${generatedCount} previews, skipped ${skippedCount}.`);
}

await main();
