import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/race-images/:path*",
      headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
    }];
  },
  images: {
    localPatterns: [
      // Content hashes vary per race image, so allow their version query strings.
      { pathname: "/race-assets/**" },
      { pathname: "/logo.svg", search: "" },
    ],
    // Fallback for images outside the prepared race-image pipeline.
    minimumCacheTTL: 60 * 60 * 24 * 31,
    // Cover 290px bibs, small avatars, and responsive race photos up to 3x DPR.
    imageSizes: [32, 64, 96, 320],
    deviceSizes: [640, 960, 1280, 1920],
    qualities: [75],
    formats: ["image/webp"],
  },
};

export default nextConfig;
