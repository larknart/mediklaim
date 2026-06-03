import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    serverActions: {
      bodySizeLimit: "11mb", // allow up to 10MB file uploads via server actions
    },
  },
};

export default nextConfig;
