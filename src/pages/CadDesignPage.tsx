import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ArrowLeft, PenTool, CheckCircle, Wrench } from 'lucide-react';

const offerings = [
  {
    title: 'Mechanical Drafting',
    description: 'Detailed technical input for handoff between designers and manufacturers.',
  },
  {
    title: '3D CAD Solid Modeling',
    description: 'Detail-rich 3D CAD solid models that enable clearer design intent communication across stakeholders.',
  },
  {
    title: 'Sheet Metal Design',
    description: 'Outsource sheet metal design drafting for cost-effective fabrication and reduced change orders.',
  },
  {
    title: '3D Product Configurator Development',
    description: 'Develop and deploy 3D product configurators to empower customers for product customization.',
  },
  {
    title: 'iLogic & VB Automation',
    description: 'Custom design automation using iLogic rules and VB scripting to eliminate repetitive tasks and accelerate workflows.',
  },
];

const advantages = [
  'Improved design development',
  'Easy design communication',
  'Quick turnaround time',
  'Design rendering',
  'Faster time to market',
  'Low overall cost',
  'Detailed design analysis',
  'Virtual prototype testing',
];

export default function CadDesignPage() {
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
              <Wrench className="w-8 h-8 text-orange-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              Mechanical Design{' '}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Services</span>
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl leading-relaxed">
            Transforming design briefs into mechanical CAD design files
          </p>
          <Link 
            to="/contact"
            className="mt-8 inline-flex items-center px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            Share your design briefs now
          </Link>
        </div>
      </section>

      {/* One-stop Support Section */}
      <section className="py-20 bg-white flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-start">
            <div>
              <h2 className="text-3xl font-bold text-gray-900 mb-6">
                One-stop support for mechanical design services
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                We partner with manufacturers, design engineers and fabricators to transform 
                complex mechanical product designs into finished manufactured products.
              </p>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                Our deliverables include detailed CAD drafting, drawings and 3D models to 
                reduce errors and interruptions during manufacturing. We also offer mechanical 
                CAD conversion services to preserve legacy designs, reduce overall costs, 
                faster turnaround times and get highly quality CAD files.
              </p>
              <Link 
                to="/contact"
                className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300"
              >
                Request a Quote Now
              </Link>
            </div>

            <div className="bg-slate-50 rounded-2xl p-8 shadow-lg">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Software & Tools</h3>
              <div className="space-y-4">
                {[
                  'AutoCAD',
                  'Autodesk Inventor',
                  'SolidWorks',
                  'Onshape',
                  'Fusion 360',
                  'Revit',
                  'Plant 3D',
                  'Advance Steel',
                ].map((item, index) => (
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

      {/* Offerings Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Our mechanical design services offerings
          </h2>
          <p className="text-lg text-gray-600 mb-12 max-w-4xl">
            Our experts partner with your design engineers and industrial product designers to develop 
            comprehensive CAD models and drawings. Our mechanical engineering design services include:
          </p>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {offerings.map((offering, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                <div className="flex items-start space-x-3 mb-3">
                  <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-1" />
                  <h3 className="text-lg font-bold text-gray-900">{offering.title}</h3>
                </div>
                <p className="text-gray-600 text-sm leading-relaxed pl-8">{offering.description}</p>
              </div>
            ))}
          </div>

          <div className="mt-12 bg-white rounded-2xl p-8 shadow-md">
            <p className="text-lg text-gray-600 leading-relaxed mb-6">
              Our team uses leading CAD tools like AutoCAD, Autodesk Inventor, SolidWorks, Onshape, 
              Fusion 360, Revit, Plant 3D and Advance Steel to deliver comprehensive 2D drafting and 
              custom 3D CAD modeling services and design automation services.
            </p>
            {/* Software Logo Badges */}
            <div className="flex flex-wrap gap-4 items-center mb-6">
              {[
                { name: 'AutoCAD', brand: 'AUTODESK', color: 'bg-red-600' },
                { name: 'Inventor', brand: 'AUTODESK', color: 'bg-amber-600' },
                { name: 'SolidWorks', brand: 'DASSAULT', color: 'bg-red-700' },
                { name: 'Onshape', brand: 'PTC', color: 'bg-green-600' },
                { name: 'Fusion 360', brand: 'AUTODESK', color: 'bg-orange-500' },
                { name: 'Revit', brand: 'AUTODESK', color: 'bg-blue-600' },
                { name: 'Plant 3D', brand: 'AUTODESK', color: 'bg-teal-600' },
                { name: 'Advance Steel', brand: 'AUTODESK', color: 'bg-slate-700' },
              ].map((tool, index) => (
                <div key={index} className="flex items-center bg-white border border-gray-200 rounded-xl px-4 py-2.5 shadow-sm hover:shadow-md transition-shadow">
                  <div className={`w-7 h-7 ${tool.color} rounded-lg flex items-center justify-center mr-2.5`}>
                    <span className="text-white text-[10px] font-bold">{tool.name.charAt(0)}</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-gray-400 font-semibold uppercase tracking-wider leading-none">{tool.brand}</span>
                    <span className="text-xs font-bold text-gray-900 leading-tight">{tool.name}</span>
                  </div>
                </div>
              ))}
            </div>
            <Link 
              to="/contact"
              className="mt-6 inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300"
            >
              Share your requirements with us
            </Link>
          </div>
        </div>
      </section>

      {/* Portfolio CTA */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Explore our engineering design portfolio
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-2xl mx-auto">
            See examples of our mechanical design, drafting, and automation work across various industries.
          </p>
          <Link 
            to="/portfolio"
            className="inline-flex items-center px-8 py-4 bg-gradient-to-r from-blue-900 to-blue-700 text-white rounded-lg font-semibold hover:from-blue-800 hover:to-blue-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            View Our Portfolio
          </Link>
        </div>
      </section>

      {/* Advantages Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            What are the advantages of mechanical design services?
          </h2>
          <p className="text-lg text-gray-600 mb-10 max-w-4xl">
            Mechanical engineering design services help transform conceptual design sketches into 
            detailed 2D or 3D CAD files for seamless design communication.
          </p>
          <div className="grid md:grid-cols-2 gap-4">
            {advantages.map((advantage, index) => (
              <div key={index} className="bg-blue-50 rounded-xl px-6 py-4 text-gray-800 font-medium hover:bg-blue-100 transition-colors">
                {advantage}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-950 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Need Mechanical Design Support?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Let us transform your design briefs into production-ready CAD files
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
