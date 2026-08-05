# SydeFlow Production Deploy

## Live

| Service | URL |
|---------|-----|
| **Vercel (admin UI)** | https://sydeflow.vercel.app |
| **Railway (API)** | https://sydeflow-production.up.railway.app |
| Railway project | `gallant-vision` → service `SydeFlow` |
| Vercel project | `sydeflow` |

## Environment

### Railway (`SydeFlow` service)
- `NODE_ENV=production`
- `PORT=8080`
- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `JWT_SECRET`
- `COOKIE_SESSION_SECRET`
- `CORS_ORIGINS=https://sydeflow.vercel.app,...`
- `APS_CALLBACK_URL=https://sydeflow-production.up.railway.app/api/aps/callback/oauth`
- Optional: `APS_CLIENT_ID`, `APS_CLIENT_SECRET` (or set in Admin → Settings)

### Vercel (`sydeflow` project) — required for login proxy
```
NEXT_PUBLIC_API_URL=https://sydeflow-production.up.railway.app
SYDEFLOW_API_URL=https://sydeflow-production.up.railway.app
```
Then redeploy the admin console so `/api` rewrites and Socket.IO point at Railway.

## Local structure
- Frontend: `SydeFlow/admin-console` (Vercel)
- Backend: `SydeFlow/server` (Railway)
