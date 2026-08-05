# AGENTS.md

## Cursor Cloud specific instructions

### What this repo is
A single React 18 + Vite 5 + TypeScript SPA (the SydeInnovation marketing site). It has one dynamic feature: a portfolio/admin CMS backed by **Supabase** (auth + Postgres + storage). The contact form posts to Formspree (external). Standard commands live in `package.json` and `README.md`; only the non-obvious caveats are captured here.

Ignore the `dev:server`, `start`, `build:admin`, and `build:all` scripts in `package.json` and everything in `PROJECT_SUMMARY.txt` about an Express/Socket.IO/Autodesk-APS backend — those reference `server/` and `admin-console/` directories that do not exist in this repo. `src/components/APSViewer.tsx` and `src/components/DesignAutomation.tsx` are orphaned (never imported).

### Commands
- `npm run dev` — Vite dev server on port 3000 (the app).
- `npm run build` / `npm run preview` — production build / preview. `build` is `vite build` (esbuild), so it does NOT type-check.
- `npm run typecheck` — `tsc --noEmit`. `npm run lint` — ESLint.
- Note: `lint` and `typecheck` currently report pre-existing errors (unused imports / `any` in orphaned files like `APSViewer.tsx`, `DesignAutomation.tsx`, plus a couple of unused imports). These are pre-existing repo issues, not environment breakage.

### The app REQUIRES Supabase env vars to even boot
`src/lib/supabase.ts` throws `Missing Supabase environment variables` at module load if `VITE_SUPABASE_URL` or `VITE_SUPABASE_ANON_KEY` are unset. Because `App.tsx` transitively imports it, the **entire SPA renders blank (throws in the browser) without these two vars** — even the purely static marketing pages. They are read from a `.env` file at the repo root (git-ignored). `vite build` succeeds without them (the throw only runs in the browser), but `npm run dev`/`preview` will show a blank page.

You have two ways to provide them:
1. Point at a hosted Supabase project: put its `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` in `.env` (or as env vars). That project must have a `projects` table + `project-thumbnails` storage bucket.
2. Use the local Supabase stack committed under `supabase/` (below).

### Local Supabase backend (for full portfolio/admin functionality)
This is NOT started by the update script and does NOT auto-start on boot. Bring it up manually:
1. Start the Docker daemon if it isn't running: `sudo dockerd &` then `sudo chmod 666 /var/run/docker.sock`. Docker 29 here uses the `fuse-overlayfs` storage driver with the containerd snapshotter disabled (`/etc/docker/daemon.json`) and `iptables-legacy`.
2. `supabase start` (from the repo root). This applies `supabase/migrations/` and `supabase/seed.sql` automatically. API is at `http://127.0.0.1:54321`, Studio at `http://127.0.0.1:54323`.
3. Ensure `.env` points at it:
   - `VITE_SUPABASE_URL=http://127.0.0.1:54321`
   - `VITE_SUPABASE_ANON_KEY=` the `ANON_KEY` printed by `supabase start` (or `supabase status -o env`). The local anon key is the deterministic demo JWT.
4. Restart `npm run dev` after changing `.env` (Vite only reads env at startup).

The `supabase/` directory is local-development scaffolding added for this environment (Supabase is only "planned" in the app's own docs). The migration creates the `projects` table (RLS + role grants), the public `project-thumbnails` bucket, and storage policies. The seed creates a login for the admin console and a sample project:
- Admin login: `admin@sydeinnovation.test` / `admin123456`
- Reset local data any time with `supabase db reset` (re-runs migration + seed).

Docker and the Supabase CLI were installed during initial environment setup; if a fresh VM lacks them, reinstall before running the steps above.

### Hello-world / smoke test
Open `http://localhost:3000/admin`, log in with the seeded admin credentials, click "Add Project", fill Title + Description, and create it. The new project appears in the admin list and on `http://localhost:3000/portfolio`.
