# SydeFlow - Design Automation Platform

## Project Overview
SydeFlow is an Admin Console and API server for **Autodesk Platform Services (APS) Design Automation**. It provides a modern web interface to manage design automation workflows, product configurations, and APS credentials.

## Tech Stack
- **Frontend**: Next.js 14 + TypeScript + Tailwind CSS
- **Backend**: Express.js + Node.js
- **Real-time**: Socket.IO for live activity updates
- **Icons**: Lucide React
- **API**: Autodesk Platform Services (APS) / Forge APIs

## Project Structure
```
sydeflow/
├── admin-console/              # Next.js Admin UI
│   ├── src/
│   │   ├── app/
│   │   │   └── page.tsx        # Main app with routing, header, user account
│   │   └── components/
│   │       ├── Sidebar.tsx     # Navigation sidebar
│   │       └── views/
│   │           ├── DashboardView.tsx      # Main dashboard with stats, banners
│   │           ├── SettingsView.tsx       # APS credentials configuration
│   │           ├── AutomationDashboard.tsx
│   │           ├── ActivityView.tsx
│   │           ├── BundlesView.tsx
│   │           ├── OSSManagerView.tsx
│   │           ├── FileSyncView.tsx
│   │           └── ProductPipeline.tsx
│   └── out/                    # Static build output
├── server/
│   ├── start.js                # Server entry point
│   ├── server.js               # Express server setup
│   ├── config.js               # Dynamic credentials loader
│   ├── routes/
│   │   ├── Settings.js         # Settings API (save, load, test connection)
│   │   ├── DesignAutomation.js # APS Design Automation routes
│   │   ├── Products.js         # Product configuration routes
│   │   └── common/
│   │       └── oauth.js        # OAuth token management with cache
│   └── data/
│       ├── settings.json       # Stored APS credentials
│       └── product-schemas/    # Product configuration schemas
└── .env                        # Environment variables
```

## Key Features Implemented

### 1. Settings Management
- **Dynamic credentials loading** from `settings.json` file
- **APS Client ID & Secret** configuration via UI
- **Secret reveal/hide toggle** with secure server-side storage
- **Connection test** to validate APS credentials
- **OAuth cache clearing** when credentials change

### 2. Dashboard
- **Server status indicator** (Online/Offline/Checking)
- **APS connection status banners**:
  - Green: "APS Connected" - Successfully connected
  - Yellow: "APS Not Configured" - Missing credentials
  - Red: "APS Disconnected" - Connection failed
- **Auto-dismiss banners** after 5 seconds for success
- **Dismiss button** (✕) on all banners
- **Stats cards**: App Bundles, Activities, Work Items, Buckets
- **Product List** section with product cards
- **Activity Log** with real-time Socket.IO updates
- **Server Information** panel with Settings link

### 3. Header & User Account
- **Page title** that changes based on active view
- **APS Server status pill** (green/red/yellow)
- **Autodesk account status** (Connected/Sign in)
- **Notification bell** icon
- **User account section**: Avatar, name, role, dropdown

### 4. API Endpoints (Settings.js)
- `GET /api/settings` - Load settings (masked secret)
- `POST /api/settings` - Save settings
- `GET /api/settings/reveal-secret` - Get actual secret for reveal
- `POST /api/settings/test-connection` - Test APS credentials
- `GET /api/settings/aps-status` - Get APS connection status
- `POST /api/settings/clear-cache` - Clear OAuth cache

### 5. Server Improvements
- Server runs without crashing when credentials are missing
- Global error handler for unhandled routes
- Null checks in DesignAutomation.js for missing OAuth client
- Settings routes loaded before DesignAutomation routes

## Design System

### Colors
- **Primary**: Orange-500 (`#f97316`) - CTAs, accents, avatar
- **Background**: Slate-900/950 gradient
- **Cards**: `bg-slate-800/30 backdrop-blur-lg border-slate-700/50`
- **Success**: Green-400/500
- **Warning**: Yellow-400/500
- **Error**: Red-400/500
- **Info**: Blue-400/500

### Component Patterns
- **Banners**: Rounded-xl with colored background/border, icon, text, action buttons
- **Cards**: Glassmorphism style with backdrop blur
- **Buttons**: Rounded-lg with hover states and transitions
- **Status Pills**: Rounded-full with colored dot indicator

## Development Commands

```bash
# Start the server (from sydeflow folder)
cd sydeflow
node server/start.js

# Build admin console (from admin-console folder)
cd sydeflow/admin-console
npm run build

# Server URLs
# Status Page:    http://localhost:8080
# Admin Console:  http://localhost:8080/admin
# API Endpoint:   http://localhost:8080/api
```

## Environment Variables (.env)
```
APS_CLIENT_ID=your_client_id
APS_CLIENT_SECRET=your_client_secret
APS_CALLBACK_URL=http://localhost:8080/api/aps/callback/oauth
```

## Settings Storage
Settings are stored in `server/data/settings.json`:
```json
{
  "apsClientId": "your_client_id",
  "apsClientSecret": "your_secret",
  "callbackUrl": "http://localhost:8080/api/aps/callback/oauth",
  "webhookUrl": "",
  "bucketKey": "",
  "activityId": "",
  "appBundleId": ""
}
```

## UI Changes Made

### Removed
- Products tab from sidebar navigation
- Quick Actions section from Dashboard
- Design Automation settings section from Settings page

### Added
- Product List section on Dashboard
- APS connection status banners (Dashboard & Settings)
- Settings link on APS Connection info row
- User account in header (bell, avatar, name, dropdown)
- Secret reveal functionality with server endpoint
- Auto-dismiss for success banners

## Notes
- The admin console is built as static files in `out/` folder
- Server serves the static admin console at `/admin`
- Socket.IO provides real-time activity updates
- OAuth tokens are cached and cleared when credentials change
