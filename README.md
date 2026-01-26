# SydeInnovation - Design, Automation & Engineering

A modern landing page for **SydeInnovation**, a design, automation, and mechanical engineering company specializing in CAD services, 3D modeling, product automation, and manufacturing solutions.

![SydeInnovation](https://img.shields.io/badge/React-18-blue) ![TypeScript](https://img.shields.io/badge/TypeScript-5-blue) ![Vite](https://img.shields.io/badge/Vite-5-purple) ![Tailwind](https://img.shields.io/badge/Tailwind-3.4-cyan)

---

## 🎯 About

SydeInnovation provides professional engineering services including:

- **CAD Services**: Autodesk Inventor, Fusion 360
- **3D Modeling**: Product design and visualization
- **Product Automation**: Inventor iLogic and Autodesk Platform Services (APS)
- **Mechanical Engineering**: Industrial design and manufacturing solutions

---

## 🛠️ Tech Stack

- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3.4 with custom theme
- **Icons**: Lucide React
- **Font**: Montserrat (Google Fonts)

---

## 📁 Project Structure

```
src/
├── App.tsx              # Main app - routing and layout
├── components/          # Reusable UI components
│   ├── Header.tsx       # Fixed navbar with scroll detection
│   ├── Hero.tsx         # Landing section with stats
│   ├── Services.tsx     # Service cards grid
│   ├── Products.tsx     # Product showcase cards
│   ├── About.tsx        # Company values + CTA
│   ├── Footer.tsx       # Contact info + social links
│   ├── APSViewer.tsx    # Autodesk Platform Services viewer
│   └── DesignAutomation.tsx  # Design automation component
├── pages/               # Full page components
│   ├── AboutPage.tsx
│   ├── CadCamServicesPage.tsx
│   ├── DesignEngineeringPage.tsx
│   ├── ManufacturingSolutionsPage.tsx
│   ├── PortfolioPage.tsx
│   └── ProcessOptimizationPage.tsx
├── index.css            # Global styles + Tailwind imports
└── main.tsx             # React entry point
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm or yarn

### Installation

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The site will be available at: **http://localhost:3000**

### Build for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

---

## 📋 Available Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Start development server (http://localhost:3000) |
| `npm run build` | Create production build to `dist/` |
| `npm run preview` | Preview production build |
| `npm run lint` | Run ESLint check |
| `npm run typecheck` | Run TypeScript type checking |

---

## 🎨 Design System

### Color Palette
- **Primary**: Blue-900 (`#1e3a5f`) - Navy for professional elements
- **Accent**: Orange-500 (`#f97316`) - CTAs and highlights
- **Gradients**: `from-blue-900 to-blue-700` (professional), `from-orange-500 to-orange-600` (action)

### Button Styles
- **Primary CTA**: `bg-orange-500 hover:bg-orange-600 text-white`
- **Secondary**: `bg-white/10 backdrop-blur-sm border border-white/20`
- **Card Button**: `bg-gradient-to-r from-blue-900 to-blue-700`

---

## 📄 License

© 2026 SydeInnovation. All rights reserved.
