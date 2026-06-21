import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "1gb",
    },
    proxyClientMaxBodySize: "1gb",
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
