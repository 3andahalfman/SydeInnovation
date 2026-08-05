# SydeFlow Copilot Instructions

## Project Overview
SydeFlow is a **Parametric CAD-to-Commerce Platform** - Express.js API + Next.js Admin Console integrating Autodesk Platform Services (APS) Design Automation. Enables parametric Inventor CAD configuration, automated geometry regeneration, and manufacturable outputs.

## ⚠️ CRITICAL: Server Check After Every Task
**After completing any task, ALWAYS verify the server is running:**
```powershell
# Check if server responds
Invoke-WebRequest -Uri http://localhost:8080/api -UseBasicParsing -TimeoutSec 3
```
If server is down, restart it:
```bash
cd c:\Users\emera\SydeFlow; node server/start.js
```
Run as background process so it doesn't block the terminal.

## Architecture

```
admin-console/           # Next.js 14 SPA (TypeScript + Tailwind)
├── src/app/page.tsx     # View router - ViewType controls sidebar/content
├── src/components/views/ # Feature views (Dashboard, Settings, etc.)
└── out/                 # Static export → served at /admin

server/                  # Express.js API (CommonJS, port 8080)
├── start.js             # Entry point - loads .env, starts HTTP+Socket.IO
├── server.js            # Express app, middleware, route registration
├── config.js            # APS credentials getter (settings.json → env fallback)
├── supabase.js          # Supabase client initialization
├── db.js                # Database helper (Products, Parameters, Configurations)
├── socket.io.js         # Real-time events via global.socketIO
├── routes/              # API modules (see Route Order below)
├── data/                # JSON storage (products, settings, schemas)
└── tests/               # API test suite

skills/                  # AI agent skill definitions (SKILL.md pattern)
```

## Critical Patterns

### Credentials Flow
Credentials resolve dynamically on each request - **never cache `config.credentials`**:
```javascript
// server/config.js - getter checks settings.json first, then .env
const { client_id, client_secret } = config.credentials;  // Always use getter
```
- Primary: `server/data/settings.json` (Admin UI → Settings view)
- Fallback: `.env` with `APS_CLIENT_ID`, `APS_CLIENT_SECRET`
- When credentials change: call `oauth.clearCache()` to invalidate tokens

### Route Registration Order (Critical)
Routes in `server/server.js` **must load in this order** - DesignAutomation has auth middleware that blocks unauthenticated requests:
```javascript
app.use('/api/settings', require('./routes/Settings'));   // No auth - must be first
app.use('/api/products', require('./routes/Products'));
// ... other routes ...
app.use('/api', require('./routes/DesignAutomation'));    // Auth middleware - LAST
```

### Error Handling Pattern
All routes use try/catch with consistent error response format:
```javascript
router.get('/', async (req, res) => {
    try {
        const { data, error } = await supabase.from('table').select('*');
        if (error) throw error;
        res.json({ success: true, data });
    } catch (error) {
        console.error('Context:', error);  // Always log with context
        res.status(500).json({ success: false, error: error.message });
    }
});
```
Global error handler in `server.js` catches unhandled errors to prevent crashes.

### Real-time Updates
Socket.IO broadcasts to all clients via global instance:
```javascript
// Server: emit events anywhere
global.socketIO?.emit('activity', { type: 'workitem', status: 'completed' });

// Admin Console: connect and listen (see DashboardView.tsx)
const socket = io();  // Connects to same origin
socket.on('activity', (data) => { /* update UI */ });
```

### Supabase Database Integration
Database client in `server/supabase.js`, helper module in `server/db.js`:
```javascript
const { Products, Configurations, checkConnection } = require('./db');

// CRUD operations return { data, error }
const { data: product, error } = await Products.getById(id);
if (error) throw error;

// Schema in server/data/supabase-schema.sql
// Tables: products, product_parameters, configurations
```
Environment: `SUPABASE_URL`, `SUPABASE_ANON_KEY` (or hardcoded defaults)

### Product Data Model
Products in Supabase `products` table, parameters in `product_parameters`. TypeScript interfaces in `admin-console/src/types/product.ts`:
- `ConfigurableProduct` - source CAD file (OSS URN), automation config
- `ParameterConfig` - maps Inventor parameters → UI controls with validation rules

## Commands

```bash
# Start server (from project root - loads .env automatically)
node server/start.js

# Build admin console (copies to server/admin-console/out via xcopy)
cd admin-console && npm run export

# Dev mode - Next.js on :3001, proxy to server on :8080
cd admin-console && npm run dev

# Run tests (requires server running)
node server/tests/run-all.js
```

**⚠️ IMPORTANT**: After any changes to `admin-console/src/**`, you MUST rebuild:
```bash
cd admin-console && npm run export
```
Then refresh the browser (Ctrl+Shift+R) to see changes. The server serves static files from `server/admin-console/`.

**Access Points** (default port 8080):
- Admin Console: `http://localhost:8080/admin`
- API: `http://localhost:8080/api`
- API Status: `GET /api` returns endpoint list

## API Routes Quick Reference
| Prefix | Module | Auth | Purpose |
|--------|--------|------|---------|
| `/api/settings` | Settings.js | ❌ | Credentials CRUD, connection test |
| `/api/products` | Products.js | ❌ | Product CRUD, parameter schemas |
| `/api/configurations` | Configurations.js | ❌ | User configurations, regeneration jobs |
| `/api/workflow` | ParameterWorkflow.js | ✅ | DA job orchestration |
| `/api/aps/*` | DesignAutomation.js | ✅ | APS bundles, activities, work items |

## Admin Console Conventions
- **View routing**: `ViewType` in `page.tsx` controls active view
- **Icons**: Lucide React only (`import { Icon } from 'lucide-react'`)
- **Styling**: Tailwind - Orange-500 primary, Slate-900/950 backgrounds, glassmorphism cards
- **State**: Local useState/useEffect, no global state library
- **API calls**: Direct fetch to `/api/*` (same-origin in production)

## APS Integration
- Packages: `forge-apis`, `autodesk.forge.designautomation`
- Auth: Two-legged for server ops, three-legged for user file access
- Scopes: `bucket:*`, `data:*`, `code:all` (internal), `viewables:read` (public)
- Work items are async - poll `/api/aps/workitems/:id` or use webhook callbacks

## Skills System
AI skills provide specialized knowledge for different aspects of the platform. Located in `C:\Users\emera\.agents\skills\<name>\SKILL.md`.

**⚠️ IMPORTANT: Before starting any task, always check for relevant skills and read them using `read_file`.** Match the task to the skill descriptions below and load the SKILL.md file to get detailed patterns, code examples, and step-by-step guidance.

### Skill Structure
```yaml
---
name: skill-name
description: 'Trigger phrases and use cases for this skill...'
---
# Skill Title
Detailed instructions, code patterns, and examples.
```

### Available Skills
| Skill | Path | Purpose | Use When Asked To... |
|-------|------|---------|---------------------|
| `sydeflow-architecture` | `C:\Users\emera\.agents\skills\sydeflow-architecture\SKILL.md` | System design, API contracts | "design architecture", "define service boundaries" |
| `sydeflow-node-api` | `C:\Users\emera\.agents\skills\sydeflow-node-api\SKILL.md` | Express route scaffolding | "create API endpoint", "add route", "implement auth" |
| `sydeflow-admin-ui` | `C:\Users\emera\.agents\skills\sydeflow-admin-ui\SKILL.md` | Next.js UI components | "create admin dashboard", "build configurator UI" |
| `sydeflow-database` | `C:\Users\emera\.agents\skills\sydeflow-database\SKILL.md` | Supabase schema, queries | "design database", "add table", "query data" |
| `sydeflow-aps-worker` | `C:\Users\emera\.agents\skills\sydeflow-aps-worker\SKILL.md` | APS Design Automation | "run work item", "extract parameters" |
| `sydeflow-parameters` | `C:\Users\emera\.agents\skills\sydeflow-parameters\SKILL.md` | Parameter extraction/validation | "extract CAD parameters", "validate config" |
| `sydeflow-caching` | `C:\Users\emera\.agents\skills\sydeflow-caching\SKILL.md` | Caching & idempotency | "add caching", "prevent duplicate requests" |
| `sydeflow-devops` | `C:\Users\emera\.agents\skills\sydeflow-devops\SKILL.md` | Observability, CI/CD, security | "add logging", "set up CI/CD", "add rate limiting" |
| `sydeflow-job-queue` | `C:\Users\emera\.agents\skills\sydeflow-job-queue\SKILL.md` | Job queues & state machines | "create job", "track work item status" |
| `sydeflow-output-pipeline` | `C:\Users\emera\.agents\skills\sydeflow-output-pipeline\SKILL.md` | Signed URLs, file delivery | "generate download URL", "export CAD files" |

### Creating New Skills
1. Create `C:\Users\emera\.agents\skills\<name>\SKILL.md`
2. Add YAML frontmatter with `name` and `description`
3. Include: prerequisites, step-by-step instructions, code examples, error handling
4. Keep `description` specific - it's used for automatic skill discovery

## Testing
Test files in `server/tests/`. Run with server active:
```bash
node server/tests/run-all.js      # All tests
node server/tests/settings.test.js  # Settings API only
node server/tests/products.test.js  # Products API only
```
Tests use Node.js assert + http - no external test framework required.
