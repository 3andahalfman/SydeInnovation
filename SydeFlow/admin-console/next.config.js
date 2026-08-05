/** @type {import('next').NextConfig} */
const isVercel = process.env.VERCEL === '1';
const apiProxy = process.env.SYDEFLOW_API_URL || process.env.NEXT_PUBLIC_API_URL;

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  // Local/Express static export keeps /admin basePath.
  // On Vercel we host at the domain root and proxy /api to Railway.
  ...(isVercel
    ? {
        async rewrites() {
          if (!apiProxy) return [];
          const base = apiProxy.replace(/\/$/, '');
          return [
            { source: '/api/:path*', destination: `${base}/api/:path*` },
          ];
        },
      }
    : {
        output: 'export',
        trailingSlash: true,
        basePath: '/admin',
      }),
};

module.exports = nextConfig;
