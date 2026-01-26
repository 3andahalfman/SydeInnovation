# SydeInnovation - Copilot Instructions

## Project Overview
SydeInnovation is a landing page for a **design, automation, and mechanical engineering** company specializing in:
- **CAD Services**: Autodesk Inventor, Fusion 360
- **3D Modeling**: Product design and visualization
- **Product Automation**: Inventor iLogic and Autodesk Platform Services (APS)
- **Mechanical Engineering**: Industrial design and manufacturing solutions

## Tech Stack
- **Framework**: React 18 + TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS 3.4 with custom theme
- **Icons**: Lucide React
- **Backend (planned)**: Supabase
- **Font**: Montserrat (Google Fonts)

## Project Structure
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
│   ├── HowItWorksPage.tsx
│   ├── ManufacturingSolutionsPage.tsx
│   ├── PortfolioPage.tsx
│   └── ProcessOptimizationPage.tsx
├── index.css            # Global styles + Tailwind imports
└── main.tsx             # React entry point
```

## Design System & Conventions

### Color Palette
- **Primary**: Blue-900 (`#1e3a5f`) - Navy for headers/professional elements
- **Accent**: Orange-500 (`#f97316`) - CTAs, highlights, hover states
- **Gradients**: `from-blue-900 to-blue-700` (professional), `from-orange-500 to-orange-600` (action)
- **Backgrounds**: White (`#ffffff`), Slate-50/100 for alternating sections

### Component Patterns
1. **Section IDs**: Each section has an `id` attribute for smooth scrolling (`home`, `services`, `products`, `about`)
2. **Scroll Navigation**: Use `scrollToSection(id)` helper pattern found in Header/Hero/Footer
3. **Card Hover Effects**: Apply `hover:-translate-y-2 hover:shadow-xl transition-all duration-300`
4. **Icons**: Use Lucide React icons with consistent sizing (`w-5 h-5` to `w-8 h-8`)
5. **Responsive Grid**: Mobile-first with `grid md:grid-cols-2 lg:grid-cols-4` pattern

### Button Styles
- **Primary CTA**: `bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-semibold`
- **Secondary**: `bg-white/10 backdrop-blur-sm border border-white/20 hover:bg-white/20`
- **Card Button**: `bg-gradient-to-r from-blue-900 to-blue-700 hover:from-blue-800 hover:to-blue-600`

## Development Commands
```bash
npm run dev        # Start dev server (http://localhost:3000)
npm run build      # Production build to dist/
npm run preview    # Preview production build
npm run lint       # ESLint check
npm run typecheck  # TypeScript type checking
```

## Key Implementation Notes

### Adding New Sections
1. Create component in `src/components/NewSection.tsx`
2. Add section `id` attribute for navigation
3. Import and add to `App.tsx` in correct order
4. Update navigation arrays in `Header.tsx` and `Footer.tsx`

### Responsive Behavior
- Header transforms: Transparent → White background on scroll
- Mobile menu: Hamburger icon with slide-down navigation
- Stats/cards collapse to single column on mobile

### Animation Classes
- `animate-pulse` for background blobs in Hero
- `group-hover:scale-110` for icon zoom effects
- `hover:scale-105` for button press effects
- Custom `delay-1000` class for staggered animations

## Business Context
When updating content, reference these core service areas:
- **Design Engineering**: CAD/CAM, 3D modeling, product design
- **Automation**: iLogic rules, APS integration, workflow automation
- **Manufacturing**: Process optimization, industrial control, prototyping
- **Consulting**: Technical analysis, feasibility studies

## Git Workflow
All changes commit to `realms3d/SydeInnovation` on `main` branch.
