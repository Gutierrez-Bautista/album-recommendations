import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  agentRules: false,
  allowedDevOrigins: ['127.0.0.1'],
  images: {
    remotePatterns: [new URL('https://i.scdn.co/image/**')]
  }
};

export default nextConfig;
