import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ArrowLeft, Ruler, CheckCircle } from 'lucide-react';

const features = [
  '3D CAD Modeling (Inventor, Fusion 360)',
  '2D Technical Drawings & Drafting',
  'Assembly Design & Documentation',
  'CAM Programming & Toolpath Generation',
  'Sheet Metal Design & Unfolding',
  'Reverse Engineering & 3D Scanning',
];

export default function CadCamServicesPage() {
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
              <Ruler className="w-8 h-8 text-orange-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              CAD/CAM <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Services</span>
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl leading-relaxed">
            Precision 3D modeling, simulation, and computer-aided manufacturing 
            for complex engineering projects.
          </p>
        </div>
      </section>

      {/* Content Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                Expert CAD/CAM Solutions
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Our CAD/CAM services leverage the full power of Autodesk Inventor and Fusion 360 
                to deliver precise, production-ready designs. From complex assemblies to detailed 
                manufacturing drawings, we handle projects of any scale.
              </p>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                We specialize in parametric modeling, allowing rapid design iterations and 
                customization. Our iLogic automation expertise means we can create intelligent 
                models that adapt to your specifications automatically.
              </p>
              <Link 
                to="/portfolio"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300"
              >
                View Our Portfolio
              </Link>
            </div>

            <div className="bg-white/20 backdrop-blur-md border border-gray-200 shadow-xl rounded-2xl p-8" style={{ boxShadow: '0 8px 32px 0 rgba(31, 38, 135, 0.1)' }}>
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Our Capabilities</h3>
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
            Need CAD/CAM Support?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Let us handle your modeling and manufacturing documentation
          </p>
          <Link to="/contact" className="inline-block px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
            Get in Touch
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
