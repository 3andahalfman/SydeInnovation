# SydeFlow Production Deploy

## Live URLs

| Service | URL |
|---------|-----|
| **Brand path (preferred)** | https://sydeinovation.com/sydeflow |
| Vercel project (admin UI) | https://sydeflow.vercel.app/sydeflow |
| Railway (API) | https://sydeflow-production.up.railway.app |
| Landing site | https://sydeinovation.com |

## How routing works

1. **Landing site** (`sydeinnovation` Vercel project) owns `sydeinovation.com`
2. `vercel.json` rewrites:
   - `/sydeflow` → SydeFlow Next.js app (`basePath: /sydeflow`)
   - `/api/*` → Railway API
   - everything else → SPA `index.html`
3. SydeFlow admin is built with `basePath: '/sydeflow'` so assets and routes live under that path

## Environment

### Railway (`SydeFlow` service)
- `NODE_ENV=production`
- `PORT=8080`
- `SUPABASE_URL` / `SUPABASE_ANON_KEY` / `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET` / `COOKIE_SESSION_SECRET`
- `CORS_ORIGINS=https://sydeinovation.com,https://sydeflow.vercel.app,...`
- `APS_CALLBACK_URL=https://sydeflow-production.up.railway.app/api/aps/callback/oauth`
- Optional: `APS_CLIENT_ID`, `APS_CLIENT_SECRET`

### Vercel (`sydeflow` project)
```
NEXT_PUBLIC_API_URL=https://sydeflow-production.up.railway.app
SYDEFLOW_API_URL=https://sydeflow-production.up.railway.app
```

## Local structure
- Frontend: `SydeFlow/admin-console` (Vercel)
- Backend: `SydeFlow/server` (Railway)
- Landing: repo root (Vercel `sydeinnovation`)
