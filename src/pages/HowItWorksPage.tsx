import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  CheckCircle2, 
  Monitor, 
  Download, 
  Settings, 
  Layers,
  Home,
  Sparkles
} from 'lucide-react';

export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/sydeflow" 
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Back to SydeFlow"
            >
              <Home className="w-5 h-5 text-gray-400" />
            </Link>
            <Link to="/sydeflow" className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">SydeFlow</h1>
                <p className="text-xs text-gray-500">Design Configurator</p>
              </div>
            </Link>
          </div>
          <nav className="flex items-center gap-6">
            <Link to="/sydeflow" className="text-sm text-gray-400 hover:text-white transition-colors">
              Categories
            </Link>
            <Link to="/how-it-works" className="text-sm text-orange-400 font-medium transition-colors">
              How It Works
            </Link>
            <Link to="/" className="text-sm text-gray-400 hover:text-white transition-colors">
              Main Site
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative py-24 overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-4xl mx-auto px-6 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Powered by Autodesk Design Automation
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6">
            How It Works
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto">
            From concept to construction-ready files in 4 simple steps. 
            No CAD experience required.
          </p>
        </div>
      </section>

      {/* Steps Section */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <div className="space-y-32">

            {/* Step 1 */}
            <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
              <div className="flex-1">
                <div className="inline-block bg-orange-500/10 text-orange-400 font-bold text-sm px-4 py-2 rounded-full mb-6 border border-orange-500/20">
                  STEP 1
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Choose Your Category</h2>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  Select from our professionally designed templates: <strong className="text-white">Wardrobes</strong>, <strong className="text-white">TV Consoles</strong>, <strong className="text-white">Tables & Chairs</strong>, or <strong className="text-white">Parametric Wall Designs</strong>. Each template is optimized for manufacturing and fully customizable.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">Browse pre-designed templates by category</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">View 3D previews before customizing</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">Filter by style, size, and complexity</span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 rounded-2xl p-12 shadow-xl border border-slate-700/50 backdrop-blur-sm">
                  <Layers className="w-32 h-32 text-orange-500 mx-auto" />
                </div>
              </div>
            </div>

            {/* Step 2 */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-16">
              <div className="flex-1">
                <div className="inline-block bg-orange-500/10 text-orange-400 font-bold text-sm px-4 py-2 rounded-full mb-6 border border-orange-500/20">
                  STEP 2
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Customize Every Parameter</h2>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  Use our powerful <strong className="text-white">Design Configurator</strong> powered by Autodesk Design Automation to adjust every aspect of your design in real-time. Watch your changes update instantly in 3D.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Settings className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">Dimensions:</strong>
                      <span className="text-gray-400"> Width, height, depth, thickness</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Settings className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">Materials:</strong>
                      <span className="text-gray-400"> Wood types, metals, composites</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Settings className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">Finishes:</strong>
                      <span className="text-gray-400"> Colors, stains, coatings, textures</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Settings className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">Components:</strong>
                      <span className="text-gray-400"> Doors, drawers, shelves, hardware</span>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 rounded-2xl p-12 shadow-xl border border-slate-700/50 backdrop-blur-sm">
                  <Settings className="w-32 h-32 text-orange-500 mx-auto" />
                </div>
              </div>
            </div>

            {/* Step 3 */}
            <div className="flex flex-col md:flex-row items-center gap-12 md:gap-16">
              <div className="flex-1">
                <div className="inline-block bg-orange-500/10 text-orange-400 font-bold text-sm px-4 py-2 rounded-full mb-6 border border-orange-500/20">
                  STEP 3
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Review & Visualize</h2>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  See your custom design rendered in photorealistic 3D. Rotate, zoom, and inspect every detail. Get instant cost estimates based on your specifications.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">Real-time 3D visualization powered by Autodesk Viewer</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">Automatic material cost calculations</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <CheckCircle2 className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <span className="text-gray-300">Dimension verification and validation</span>
                  </li>
                </ul>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 rounded-2xl p-12 shadow-xl border border-slate-700/50 backdrop-blur-sm">
                  <Monitor className="w-32 h-32 text-orange-500 mx-auto" />
                </div>
              </div>
            </div>

            {/* Step 4 */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 md:gap-16">
              <div className="flex-1">
                <div className="inline-block bg-orange-500/10 text-orange-400 font-bold text-sm px-4 py-2 rounded-full mb-6 border border-orange-500/20">
                  STEP 4
                </div>
                <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Download Production Files</h2>
                <p className="text-lg text-gray-400 mb-8 leading-relaxed">
                  Receive professional CAD files ready for manufacturing. Take directly to your fabricator or manufacturer with complete specifications.
                </p>
                <ul className="space-y-4">
                  <li className="flex items-start gap-3">
                    <Download className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">DWG/DXF Files:</strong>
                      <span className="text-gray-400"> 2D technical drawings</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Download className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">3D Models:</strong>
                      <span className="text-gray-400"> IPT, RVT, or OBJ formats</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Download className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">Specifications:</strong>
                      <span className="text-gray-400"> PDF with materials, dimensions, assembly</span>
                    </div>
                  </li>
                  <li className="flex items-start gap-3">
                    <Download className="w-6 h-6 text-orange-500 flex-shrink-0 mt-1" />
                    <div>
                      <strong className="text-white">Bill of Materials:</strong>
                      <span className="text-gray-400"> Complete parts and quantities list</span>
                    </div>
                  </li>
                </ul>
              </div>
              <div className="flex-1 w-full">
                <div className="bg-gradient-to-br from-slate-800/50 to-slate-700/30 rounded-2xl p-12 shadow-xl border border-slate-700/50 backdrop-blur-sm">
                  <Download className="w-32 h-32 text-orange-500 mx-auto" />
                </div>
              </div>
            </div>

          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-24 border-t border-slate-700/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">Ready to Design?</h2>
          <p className="text-xl text-gray-400 mb-12 leading-relaxed">
            Start creating your custom furniture design in minutes. No CAD experience required.
          </p>
          <div className="flex items-center justify-center gap-4 flex-wrap">
            <Link 
              to="/sydeflow"
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 flex items-center gap-2"
            >
              Start Designing Now
              <ArrowRight className="w-5 h-5" />
            </Link>
            <Link 
              to="/"
              className="px-8 py-4 bg-slate-800/50 hover:bg-slate-700/50 text-white font-semibold rounded-xl transition-all duration-300 border border-slate-600/50"
            >
              Back to Home
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-700/50 bg-slate-900/50">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <span className="text-white font-semibold">SydeIngenis</span>
            </div>
            <p className="text-gray-500 text-sm">
              © 2026 SydeIngenis. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
