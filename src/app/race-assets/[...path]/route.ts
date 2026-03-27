import { promises as fs } from "node:fs";
import path from "node:path";

const RACES_DIR = path.join(process.cwd(), "races");

const CONTENT_TYPES: Record<string, string> = {
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".gpx": "application/gpx+xml; charset=utf-8",
  ".jpeg": "image/jpeg",
  ".jpg": "image/jpeg",
  ".json": "application/json; charset=utf-8",
  ".md": "text/markdown; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".webp": "image/webp",
};

function getContentType(filePath: string) {
  return CONTENT_TYPES[path.extname(filePath).toLowerCase()] ?? "application/octet-stream";
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> }
) {
  const resolvedParams = await params;
  const pathSegments = resolvedParams.path ?? [];

  if (pathSegments.length < 2) {
    return new Response("Not found", { status: 404 });
  }

  const assetPath = path.resolve(RACES_DIR, ...pathSegments);
  const racesRoot = `${RACES_DIR}${path.sep}`;

  if (!assetPath.startsWith(racesRoot)) {
    return new Response("Not found", { status: 404 });
  }

  try {
    const file = await fs.readFile(assetPath);

    return new Response(file, {
      headers: {
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Type": getContentType(assetPath),
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
