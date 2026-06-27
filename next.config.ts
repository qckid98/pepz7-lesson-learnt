import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  // Remove experimental.serverActions.bodySizeLimit — Next.js 16 internal proxy
  // corrupts multipart body for large uploads when this is set.
  // Nginx handles body size limit (client_max_body_size 1g).
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
