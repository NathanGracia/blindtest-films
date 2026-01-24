import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Augmenter la limite de taille du body pour les uploads (50MB)
    serverActions: {
      bodySizeLimit: '50mb'
    }
  }
};

export default nextConfig;
