# SydeFlow - Design Automation Platform

A comprehensive platform for automating CAD workflows using **Autodesk Platform Services (APS)**, enabling seamless file synchronization from Autodesk Cloud to OSS, Design Automation for Inventor, and a powerful admin console for managing products and configurations.

![Platform Overview](docs/images/platform-overview.png)

---

## 🎯 Project Scope & Objectives

### Vision
Transform mechanical engineering workflows by providing a unified platform that connects Autodesk Cloud storage (ACC/Fusion Team) with automated design processing, enabling:
- **Parametric product configuration** for customers
- **Automated CAD file processing** using Design Automation API
- **Seamless file synchronization** between Autodesk Cloud and OSS
- **Real-time 3D visualization** in the browser

### Core Objectives

1. **File Synchronization (ACC/Fusion → OSS)**
   - Sync files from Autodesk Construction Cloud or Fusion Team to APS Object Storage
   - Support for webhooks to automate sync on file changes
   - Manual sync triggers with progress tracking
   - Visual indicators showing which files are synced

2. **Design Automation for Inventor**
   - Run iLogic rules on Inventor files in the cloud
   - Extract parameters from IPT/IAM files
   - Update parameters and regenerate models
   - Export to various formats (STEP, PDF, etc.)

3. **Product Configuration Management**
   - Define products with configurable parameters
   - Link products to Design Automation activities
   - Manage pricing and parameter constraints
   - Support for parameter groups and validation

4. **Admin Console**
   - Modern React-based dashboard
   - OSS bucket management with 3D viewer
   - Design Automation activity management
   - File sync configuration and monitoring

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SydeFlow Platform                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────────────┐ │
│  │  Admin Console  │    │  Express Server │    │    APS Cloud Services   │ │
│  │   (Next.js)     │◄──►│   (Node.js)     │◄──►│                         │ │
│  │   Port 3001     │    │   Port 8080     │    │  • OSS (Object Storage) │ │
│  └─────────────────┘    └─────────────────┘    │  • Design Automation    │ │
│         │                       │              │  • Model Derivative     │ │
│         │                       │              │  • Data Management API  │ │
│         ▼                       ▼              └─────────────────────────┘ │
│  ┌─────────────────────────────────────────┐                               │
│  │              Socket.IO                   │                               │
│  │     (Real-time sync notifications)       │                               │
│  └─────────────────────────────────────────┘                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│                           Autodesk Cloud                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────┐         ┌─────────────────┐                           │
│  │   Desktop       │         │   ACC / Fusion  │                           │
│  │   Connector     │────────►│   Team Storage  │                           │
│  │   (Local Files) │         │                 │                           │
│  └─────────────────┘         └────────┬────────┘                           │
│                                       │                                     │
│                                       ▼  Webhook / Manual Sync              │
│                              ┌─────────────────┐                           │
│                              │   SydeFlow      │                           │
│                              │   FileSync      │──────► OSS Buckets        │
│                              └─────────────────┘                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## 🛠️ Tech Stack

### Backend
- **Node.js** with Express.js
- **forge-apis** SDK for APS integration
- **Socket.IO** for real-time communication
- **Axios** for HTTP requests

### Frontend (Admin Console)
- **Next.js 14** with App Router
- **TypeScript** for type safety
- **Tailwind CSS** for styling
- **Lucide React** for icons
- **Socket.IO Client** for real-time updates

### APS Services Used
- **Object Storage Service (OSS)** - File storage
- **Model Derivative API** - 3D translation & viewing
- **Design Automation API** - Inventor automation
- **Data Management API** - ACC/Fusion Team access
- **Webhooks API** - Change notifications

---

## 📁 Project Structure

```
SydeIngenis/
├── admin-console/              # Next.js admin dashboard
│   ├── src/
│   │   ├── app/               # Next.js App Router pages
│   │   ├── components/        # React components
│   │   │   ├── views/         # Main view components
│   │   │   │   ├── DashboardView.tsx
│   │   │   │   ├── OSSManagerView.tsx
│   │   │   │   ├── FileSyncView.tsx
│   │   │   │   ├── ProductManagerView.tsx
│   │   │   │   └── DesignAutomationView.tsx
│   │   │   ├── Header.tsx
│   │   │   └── Sidebar.tsx
│   │   └── contexts/          # React contexts
│   └── package.json
│
├── server/                     # Express.js backend
│   ├── routes/
│   │   ├── common/
│   │   │   └── oauth.js       # 2-leg & 3-leg OAuth
│   │   ├── OSS.js             # OSS bucket management
│   │   ├── ModelDerivative.js # Translation & viewing
│   │   ├── DesignAutomation.js # DA activities
│   │   └── FileSync.js        # ACC→OSS sync
│   ├── bundles/               # Design Automation bundles
│   │   └── ExtractParams/     # Parameter extraction
│   ├── data/                  # JSON data storage
│   │   ├── products.json
│   │   └── sync-config.json
│   ├── config.js              # Configuration
│   └── start.js               # Server entry point
│
├── public/                     # Static assets
└── .env                        # Environment variables
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- APS Application credentials (Client ID & Secret)
- Autodesk account with ACC or Fusion Team access

### Environment Setup

Create a `.env` file in the root directory:

```env
APS_CLIENT_ID=your_client_id
APS_CLIENT_SECRET=your_client_secret
APS_CALLBACK_URL=http://localhost:8080/api/auth/callback
PORT=8080
```

### Installation

```bash
# Install server dependencies
npm install

# Install admin console dependencies
cd admin-console
npm install
```

### Running the Platform

```bash
# Terminal 1: Start the backend server
node server/start.js

# Terminal 2: Start the admin console
cd admin-console
npm run dev
```

Access the admin console at: **http://localhost:3001**

---

## 📋 Features

### 1. OSS Manager
- Browse and manage OSS buckets
- Upload/download files
- Integrated 3D viewer (Autodesk Viewer SDK)
- Visual indicators for synced files
- File translation management

### 2. File Sync
- Configure sync mappings (ACC folder → OSS bucket)
- Manual sync trigger with progress indicator
- Real-time sync status via Socket.IO
- Webhook support for automated sync
- Edit existing sync configurations

### 3. Product Manager
- Create products linked to Inventor files
- Define configurable parameters
- Set parameter constraints (min/max/options)
- Pricing configuration
- Link to Design Automation activities

### 4. Design Automation
- View/create App Bundles
- Configure Activities with command lines
- Monitor WorkItems
- Upload iLogic bundles

---

## 🔐 Authentication

### 2-Legged OAuth (App Context)
Used for:
- OSS operations (bucket management)
- Design Automation API
- Model Derivative API

### 3-Legged OAuth (User Context)
Used for:
- Data Management API (ACC/Fusion Team)
- Accessing user's cloud storage
- File sync from user's projects

---

## 📡 API Endpoints

### File Sync API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/filesync/auth/status` | Check authentication status |
| GET | `/api/filesync/auth/login` | Get Autodesk login URL |
| GET | `/api/filesync/hubs` | List user's hubs |
| GET | `/api/filesync/config` | Get sync configurations |
| POST | `/api/filesync/config` | Create sync config |
| PUT | `/api/filesync/config/:id` | Update sync config |
| DELETE | `/api/filesync/config/:id` | Delete sync config |
| POST | `/api/filesync/sync/trigger` | Manual sync trigger |

### OSS API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/aps/oss/buckets` | List buckets |
| POST | `/api/aps/oss/buckets` | Create bucket |
| GET | `/api/aps/oss/buckets/:id/objects` | List objects |
| POST | `/api/aps/oss/objects` | Upload object |

### Design Automation API
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/aps/designautomation/engines` | List engines |
| GET | `/api/aps/designautomation/appbundles` | List bundles |
| GET | `/api/aps/designautomation/activities` | List activities |
| POST | `/api/aps/designautomation/workitems` | Create workitem |

---

## 🎨 UI Theme

The admin console features a modern dark theme with:
- **Background**: Slate-900/950 gradients
- **Accent**: Cyan/Orange highlights
- **Cards**: Glassmorphism with backdrop blur
- **Badges**: Liquid water glass effect

---

## 📦 Design Automation Bundles

### ExtractParams Bundle
Extracts user parameters from Inventor files (IPT/IAM):
- Parameter names and types
- Default values and units
- Min/max constraints
- Auto-grouped by category

### UpdateIPTParam Bundle
Updates parameters in Inventor files:
- Accepts JSON parameter input
- Regenerates model
- Outputs updated file

---

## 🔄 Sync Workflow

1. **User connects Autodesk account** (3-legged OAuth)
2. **Browse ACC/Fusion Team projects** in admin console
3. **Create sync configuration** mapping folder to bucket
4. **Trigger manual sync** or wait for webhook
5. **Files download from ACC** using user's token
6. **Files upload to OSS** using app token
7. **Real-time notifications** via Socket.IO

---

## 📝 License

Proprietary - SydeIngenis © 2026

---

## 🤝 Contributing

Internal development only. Contact the development team for access.

---

## 📞 Support

For issues or questions, contact the SydeIngenis development team.
