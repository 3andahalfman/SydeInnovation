import { Link } from 'react-router-dom';
import { 
  ArrowRight, 
  Sparkles, 
  Box, 
  Tv, 
  Table2, 
  Armchair, 
  Grid3x3,
  Home,
  Zap,
  Shield,
  Clock
} from 'lucide-react';

interface CategoryCard {
  id: string;
  name: string;
  description: string;
  features: string[];
  image: string;
  icon: React.ElementType;
  startingPrice: string;
  enabled: boolean;
}

const categories: CategoryCard[] = [
  {
    id: 'wardrobes',
    name: 'Wardrobes',
    description: 'Design custom wardrobes with adjustable shelves, drawers, and hanging space tailored to your exact needs.',
    features: ['Sliding & Hinged Doors', 'Custom Organizers', 'Premium Materials'],
    image: 'https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=800',
    icon: Box,
    startingPrice: '$1',
    enabled: true
  },
  {
    id: 'tv-consoles',
    name: 'TV Consoles',
    description: 'Create entertainment units with customizable storage, cable management, and sleek modern designs.',
    features: ['Cable Management', 'Integrated Lighting', 'Modular Compartments'],
    image: 'https://images.pexels.com/photos/1866149/pexels-photo-1866149.jpeg?auto=compress&cs=tinysrgb&w=800',
    icon: Tv,
    startingPrice: '$1',
    enabled: false
  },
  {
    id: 'tables',
    name: 'Tables',
    description: 'Configure dining and office tables to your exact specifications with various leg styles and extensions.',
    features: ['Extendable Options', 'Multiple Leg Styles', 'Custom Dimensions'],
    image: 'https://images.pexels.com/photos/1884584/pexels-photo-1884584.jpeg?auto=compress&cs=tinysrgb&w=800',
    icon: Table2,
    startingPrice: '$1',
    enabled: false
  },
  {
    id: 'chairs',
    name: 'Chairs',
    description: 'Design comfortable seating with custom dimensions, upholstery options, and ergonomic features.',
    features: ['Ergonomic Design', 'Premium Upholstery', 'Custom Comfort'],
    image: 'https://images.pexels.com/photos/116910/pexels-photo-116910.jpeg?auto=compress&cs=tinysrgb&w=800',
    icon: Armchair,
    startingPrice: '$1',
    enabled: false
  },
  {
    id: 'parametric-walls',
    name: 'Parametric Walls',
    description: 'Design architectural wall features with stunning 3D patterns, textures, and integrated lighting.',
    features: ['3D Patterns', 'LED Integration', 'Acoustic Options'],
    image: 'https://images.pexels.com/photos/271816/pexels-photo-271816.jpeg?auto=compress&cs=tinysrgb&w=800',
    icon: Grid3x3,
    startingPrice: '$1',
    enabled: false
  }
];

const features = [
  {
    icon: Zap,
    title: 'Real-Time 3D Preview',
    description: 'See your designs come to life instantly with our Autodesk-powered viewer'
  },
  {
    icon: Shield,
    title: 'Professional CAD Output',
    description: 'Export production-ready CAD files for manufacturing'
  },
  {
    icon: Clock,
    title: 'Instant Pricing',
    description: 'Get accurate pricing as you customize every detail'
  }
];

export default function SydeFlowLandingPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link 
              to="/" 
              className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              title="Return to Home"
            >
              <Home className="w-5 h-5 text-gray-400" />
            </Link>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-orange-500/20">
                <Sparkles className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">SydeFlow</h1>
                <p className="text-xs text-gray-500">Design Configurator</p>
              </div>
            </div>
          </div>
          <nav className="flex items-center gap-6">
            <a href="#categories" className="text-sm text-gray-400 hover:text-white transition-colors">
              Categories
            </a>
            <Link 
              to="/how-it-works"
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              How It Works
            </Link>
            <Link 
              to="/"
              className="px-4 py-2 text-sm text-gray-300 hover:text-white transition-colors"
            >
              Back to Site
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden">
        {/* Background Effects */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-1/4 w-96 h-96 bg-orange-500/10 rounded-full blur-3xl" />
          <div className="absolute bottom-0 right-1/4 w-80 h-80 bg-blue-500/10 rounded-full blur-3xl" />
        </div>

        <div className="relative max-w-7xl mx-auto px-6 py-20 text-center">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500/10 border border-orange-500/20 rounded-full text-orange-400 text-sm font-medium mb-6">
            <Sparkles className="w-4 h-4" />
            Powered by Autodesk Design Automation
          </div>
          
          <h1 className="text-5xl md:text-6xl font-bold text-white mb-6 leading-tight">
            Design Your Perfect
            <span className="block bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
              Custom Furniture
            </span>
          </h1>
          
          <p className="text-xl text-gray-400 max-w-2xl mx-auto mb-10">
            Configure, visualize, and order bespoke furniture with our interactive 3D design tool. 
            Real-time previews, instant pricing, and professional CAD exports.
          </p>

          <div className="flex items-center justify-center gap-4">
            <a 
              href="#categories"
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/25 hover:shadow-orange-500/40 flex items-center gap-2"
            >
              Start Designing
              <ArrowRight className="w-5 h-5" />
            </a>
            <Link 
              to="/how-it-works"
              className="px-8 py-4 bg-slate-800/50 hover:bg-slate-700/50 text-white font-semibold rounded-xl transition-all duration-300 border border-slate-600/50"
            >
              How It Works
            </Link>
          </div>
        </div>
      </section>

      {/* Features Bar */}
      <section id="features" className="border-y border-slate-700/50 bg-slate-900/30">
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {features.map((feature) => {
              const Icon = feature.icon;
              return (
                <div key={feature.title} className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-orange-500/10 rounded-xl flex items-center justify-center flex-shrink-0">
                    <Icon className="w-6 h-6 text-orange-500" />
                  </div>
                  <div>
                    <h3 className="font-semibold text-white">{feature.title}</h3>
                    <p className="text-sm text-gray-500">{feature.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Categories Grid */}
      <section id="categories" className="py-20">
        <div className="max-w-7xl mx-auto px-6">
          <div className="text-center mb-12">
            <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
              Choose Your Category
            </h2>
            <p className="text-gray-400 max-w-xl mx-auto">
              Select a product category to begin designing. Each category offers unique customization options and features.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {categories.map((category) => {
              const Icon = category.icon;
              
              if (!category.enabled) {
                // Disabled/Coming Soon card
                return (
                  <div
                    key={category.id}
                    className="relative bg-slate-800/30 backdrop-blur-lg rounded-2xl overflow-hidden border border-slate-700/30 opacity-60 cursor-not-allowed"
                  >
                    {/* Coming Soon Badge */}
                    <div className="absolute inset-0 z-10 flex items-center justify-center">
                      <div className="bg-slate-900/90 backdrop-blur-sm px-6 py-3 rounded-xl border border-slate-600/50">
                        <span className="text-gray-400 font-semibold text-lg">Coming Soon</span>
                      </div>
                    </div>

                    {/* Image */}
                    <div className="aspect-[4/3] overflow-hidden relative">
                      <img
                        src={category.image}
                        alt={category.name}
                        className="w-full h-full object-cover grayscale"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/70 to-slate-900/30" />
                      
                      {/* Icon Badge */}
                      <div className="absolute top-4 left-4 w-10 h-10 bg-slate-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center border border-slate-700/50">
                        <Icon className="w-5 h-5 text-gray-500" />
                      </div>
                    </div>

                    {/* Content */}
                    <div className="p-6">
                      <h3 className="text-xl font-bold text-gray-500 mb-2">
                        {category.name}
                      </h3>
                      <p className="text-gray-600 text-sm mb-4 line-clamp-2">
                        {category.description}
                      </p>

                      {/* Features */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        {category.features.map((feature) => (
                          <span 
                            key={feature}
                            className="px-2 py-1 bg-slate-700/30 text-gray-600 text-xs rounded-md"
                          >
                            {feature}
                          </span>
                        ))}
                      </div>

                      {/* CTA */}
                      <div className="flex items-center justify-between pt-4 border-t border-slate-700/30">
                        <span className="text-sm text-gray-600">Coming soon</span>
                        <div className="w-10 h-10 bg-slate-700/30 rounded-lg flex items-center justify-center">
                          <ArrowRight className="w-5 h-5 text-gray-600" />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              }

              // Enabled card
              return (
                <Link
                  key={category.id}
                  to={`/sydeflow/configure?category=${encodeURIComponent(category.name)}`}
                  className="group relative bg-slate-800/30 backdrop-blur-sm rounded-2xl overflow-hidden border border-slate-700/50 hover:border-orange-500/50 transition-all duration-500 hover:-translate-y-2 hover:shadow-2xl hover:shadow-orange-500/10"
                >
                  {/* Image */}
                  <div className="aspect-[4/3] overflow-hidden relative">
                    <img
                      src={category.image}
                      alt={category.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 via-slate-900/50 to-transparent" />
                    
                    {/* Price Badge */}
                    <div className="absolute top-4 right-4 bg-orange-500 text-white font-bold px-3 py-1.5 rounded-lg text-sm shadow-lg">
                      From {category.startingPrice}
                    </div>

                    {/* Icon Badge */}
                    <div className="absolute top-4 left-4 w-10 h-10 bg-slate-900/80 backdrop-blur-sm rounded-lg flex items-center justify-center border border-slate-700/50">
                      <Icon className="w-5 h-5 text-orange-500" />
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-white mb-2 group-hover:text-orange-400 transition-colors">
                      {category.name}
                    </h3>
                    <p className="text-gray-400 text-sm mb-4 line-clamp-2">
                      {category.description}
                    </p>

                    {/* Features */}
                    <div className="flex flex-wrap gap-2 mb-4">
                      {category.features.map((feature) => (
                        <span 
                          key={feature}
                          className="px-2 py-1 bg-slate-700/50 text-gray-400 text-xs rounded-md"
                        >
                          {feature}
                        </span>
                      ))}
                    </div>

                    {/* CTA */}
                    <div className="flex items-center justify-between pt-4 border-t border-slate-700/50">
                      <span className="text-sm text-gray-500">Click to configure</span>
                      <div className="w-10 h-10 bg-orange-500/10 group-hover:bg-orange-500 rounded-lg flex items-center justify-center transition-all duration-300">
                        <ArrowRight className="w-5 h-5 text-orange-500 group-hover:text-white transition-colors" />
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 border-t border-slate-700/50">
        <div className="max-w-4xl mx-auto px-6 text-center">
          <h2 className="text-3xl font-bold text-white mb-4">
            Ready to Create Something Unique?
          </h2>
          <p className="text-gray-400 mb-8">
            Our design configurator makes it easy to bring your vision to life. 
            Start with any category and customize every detail.
          </p>
          <div className="flex items-center justify-center gap-4">
            <a 
              href="#categories"
              className="px-8 py-4 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl transition-all duration-300 shadow-lg shadow-orange-500/25"
            >
              Browse Categories
            </a>
            <Link 
              to="/"
              className="px-8 py-4 text-gray-400 hover:text-white font-semibold transition-colors"
            >
              Return Home
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
              <span className="text-white font-semibold">SydeFlow</span>
              <span className="text-gray-500 text-sm">by SydeIngenis</span>
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
