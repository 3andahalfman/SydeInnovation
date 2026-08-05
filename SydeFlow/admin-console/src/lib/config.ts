/**
 * Client-side server URL for Socket.IO and absolute API calls.
 * Prefer NEXT_PUBLIC_API_URL (Railway) when the UI is hosted separately on Vercel.
 * Otherwise use the current origin (Express serving /admin).
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || '';

export const SERVER_URL =
  process.env.NEXT_PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : process.env.NEXT_PUBLIC_SERVER_URL || 'http://localhost:8080');

/** Prefix app paths when hosted under /sydeflow (raw <a href> does not get basePath). */
export function appPath(path: string): string {
  const normalized = path.startsWith('/') ? path : `/${path}`;
  return `${BASE_PATH}${normalized}`;
}