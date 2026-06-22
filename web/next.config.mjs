import { fileURLToPath } from "node:url";
import { dirname } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Pin the workspace root to this app. Without this, Next can pick a stray
  // lockfile elsewhere on the machine as the root and warn during build.
  outputFileTracingRoot: __dirname,
};

export default nextConfig;
