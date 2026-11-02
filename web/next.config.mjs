/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  // On a test computer the website also answers /api and /media by passing them to the API (like nginx does
  // on the real server), so the desktop app can use one address for both: --server http://127.0.0.1:5000
  async rewrites() {
    const api = (process.env.API_PROXY_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/media/:path*', destination: `${api}/media/:path*` },
    ];
  },
};
export default nextConfig;
