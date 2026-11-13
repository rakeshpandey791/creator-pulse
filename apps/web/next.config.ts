import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // Keep an open dev server isolated from production builds. A build running
  // during local development must not replace the dev manifest mid-request.
  distDir: process.env.NODE_ENV === "development" ? ".next-dev" : ".next",
};

export default nextConfig;
