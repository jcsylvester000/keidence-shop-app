/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Keep the Neon serverless driver + ws out of the webpack server bundle so
  // the native WebSocket masking (bufferutil) isn't mangled. Required for the
  // Neon adapter to work in the built server and on Netlify.
  serverExternalPackages: [
    "@neondatabase/serverless",
    "@prisma/adapter-neon",
    "ws",
    "@prisma/client",
  ],
};

export default nextConfig;
