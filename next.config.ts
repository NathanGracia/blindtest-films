import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Augmenter la limite de taille du body pour les uploads (100MB)
    serverActions: {
      bodySizeLimit: '100mb'
    },
    // Augmenter la limite pour les API routes et middleware (100MB)
    clientMaxBodySize: 100 * 1024 * 1024 // 100MB en bytes
  }
};

export default nextConfig;
