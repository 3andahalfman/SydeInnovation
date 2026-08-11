/** @type {import('next').NextConfig} */
const isVercel = process.env.VERCEL === '1';
const apiProxy = process.env.SYDEFLOW_API_URL || process.env.NEXT_PUBLIC_API_URL;
// Host under the SydeInnovation brand path: sydeinovation.com/sydeflow
const basePath = isVercel ? '/sydeflow' : undefined;

const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  ...(basePath
    ? {
        basePath,
        env: {
          NEXT_PUBLIC_BASE_PATH: basePath,
        },
        async rewrites() {
          if (!apiProxy) return [];
          const base = apiProxy.replace(/\/$/, '');
          return [
            // Domain-root /api (fetch('/api/...')) — not prefixed by basePath.
            {
              source: '/api/:path*',
              destination: `${base}/api/:path*`,
              basePath: false,
            },
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
