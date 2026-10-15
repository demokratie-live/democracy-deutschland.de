import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH ?? "";

const nextConfig: NextConfig = {
  output: "export",
  // Clean URLs as in the spec: /ueber-uns/ is exported as ueber-uns/index.html.
  trailingSlash: true,
  basePath: basePath || undefined,
  assetPrefix: basePath || undefined,
  images: {
    unoptimized: true,
  },
  experimental: {
    // Two root layouts (website and blog): the 404 page needs its own document.
    globalNotFound: true,
  },
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
