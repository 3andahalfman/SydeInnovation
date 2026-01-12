import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ArrowLeft, Cog, CheckCircle } from 'lucide-react';

const features = [
  'Production Line Design & Layout',
  'Automated Assembly Systems',
  'Custom Machinery Development',
  'Tooling & Fixture Design',
  'Quality Control Systems',
  'Lean Manufacturing Implementation',
];

export default function ManufacturingSolutionsPage() {
  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      
      {/* Hero Section */}
      <section className="relative pt-32 pb-20 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
        <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link 
            to="/" 
            className="inline-flex items-center space-x-2 text-orange-400 hover:text-orange-300 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-white/20 backdrop-blur-md border border-white/30 rounded-2xl flex items-center justify-center">
              <Cog className="w-8 h-8 text-orange-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              Manufacturing <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Solutions</span>
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl leading-relaxed">
            Advanced manufacturing processes and automation systems that optimize 
            production efficiency and quality.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Optimized Production Systems
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                We design and implement manufacturing solutions that maximize efficiency 
                while maintaining the highest quality standards. Our expertise spans 
                from custom machinery design to complete production line optimization.
              </p>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Using advanced simulation tools and iLogic automation, we help you 
                visualize and test manufacturing processes before implementation, 
                reducing costly errors and accelerating time-to-production.
              </p>
              <Link 
                to="/about"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300"
              >
                Learn More About Us
              </Link>
            </div>

            <div className="bg-white/20 backdrop-blur-md border border-gray-200 shadow-xl rounded-2xl p-8" style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)' }}>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Our Solutions</h3>
              <div className="space-y-4">
                {features.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-950 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Optimize Your Manufacturing?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Let's design a solution that fits your production needs
          </p>
          <button className="px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
            Get in Touch
          </button>
        </div>
      </section>

      <Footer />
    </div>
  );
}
