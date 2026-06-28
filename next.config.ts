import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Next.js 16 internal proxy — allow large multipart uploads
  experimental: {
    proxyClientMaxBodySize: "250mb",
  },
  // @silurus/ooxml uses ESM-only imports and Web Workers
  transpilePackages: ["@silurus/ooxml"],
  // Security: disable source maps in production
  productionBrowserSourceMaps: false,
  // Security: powered by header
  poweredByHeader: false,
  // Security headers (nginx also sets these — belt and suspenders)
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "X-XSS-Protection", value: "0" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
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
