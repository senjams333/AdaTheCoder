/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: { ignoreDuringBuilds: true },
  images: { unoptimized: true },
  // On a test computer the website also answers /api and /media by passing them to the API (like nginx does
  // on the real server), so the desktop app can use one address for both: --server http://127.0.0.1:5000
  // /learn runs children's Python in the browser. input(), time.sleep() and Stop need shared memory, which browsers
  // allow only on a page that is "cross-origin isolated" by these two headers (also on Python's own files).
  async headers() {
    const iso = [
      { key: 'Cross-Origin-Opener-Policy', value: 'same-origin' },
      { key: 'Cross-Origin-Embedder-Policy', value: 'require-corp' },
    ];
    return [
      { source: '/learn', headers: iso },
      { source: '/learn/:path*', headers: iso },
      { source: '/pyodide/:path*', headers: [...iso, { key: 'Cache-Control', value: 'public, max-age=604800' }] },
      // the desktop app's screens, pictures and emojis for /learn (desktop_app/webhost/build.py)
      { source: '/appweb/:path*', headers: [...iso, { key: 'Cache-Control', value: 'public, max-age=86400' }] },
    ];
  },
  async rewrites() {
    const api = (process.env.API_PROXY_URL || 'http://127.0.0.1:3000').replace(/\/$/, '');
    return [
      { source: '/api/:path*', destination: `${api}/api/:path*` },
      { source: '/media/:path*', destination: `${api}/media/:path*` },
    ];
  },
};
export default nextConfig;
