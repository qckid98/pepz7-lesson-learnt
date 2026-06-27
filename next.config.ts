import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next.js 16 internal proxy default limit is 1MB — must set explicitly
  // for large file uploads via FormData/Route Handlers
  // Without this, files > 1MB get "Chunk Header in chunk body not in expected format"
  experimental: {
    proxyClientMaxBodySize: "250mb",
  },
  // @silurus/ooxml uses ESM-only imports and Web Workers
  transpilePackages: ["@silurus/ooxml"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "s3.biznetgio.com",
      },
      {
        protocol: "https",
        hostname: "nos.wjv-1.neo.id",
      },
    ],
  },
};

export default nextConfig;
