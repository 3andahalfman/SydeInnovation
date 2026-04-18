import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ArrowLeft, CheckCircle, Ruler, Clock, Shield, Users, Globe, Zap } from 'lucide-react';

const expertiseAreas = [
  '2D and 3D CAD Drafting & Drawings',
  'CAD Conversion (PDF to CAD, 2D to 3D)',
  'Architectural Drafting Services',
  'Fabrication Drawings',
  'Assembly Drawings with BOM',
  'Manufacturing Detail Drawings',
  'Sheet Metal Design Drafting',
  'Create 3D Model from Existing Drawings',
  'MEP Drafting Drawings',
  'Mechanical Drafting Services',
  'Millwork Drafting Services',
];

const targetIndustries = [
  'Furniture Manufacturers',
  'Architectural Design Firms',
  'Fabricators and Manufacturing Firms',
  'Civil and Structural Engineers',
  'Trade and General Contractors',
  'Industrial / Plant Owners',
];

const strengths = [
  { icon: Shield, title: 'Deep Domain Expertise', description: 'Years of experience across multiple industries and CAD platforms' },
  { icon: Clock, title: 'On Time Delivery', description: 'Reliable turnaround times to keep your projects on schedule' },
  { icon: Zap, title: 'Fast and Reliable', description: 'Efficient workflows to deliver quality output quickly' },
  { icon: CheckCircle, title: 'Quality Assurance', description: 'Rigorous checks to ensure accuracy in every deliverable' },
  { icon: Users, title: 'Dedicated Resources', description: 'Committed team members assigned to your project' },
  { icon: Globe, title: 'Global Presence', description: 'Serving clients across industries worldwide' },
];

const softwareTools = [
  { name: 'AutoCAD', brand: 'AUTODESK', color: 'bg-red-600' },
  { name: 'Revit', brand: 'AUTODESK', color: 'bg-blue-600' },
  { name: 'Inventor', brand: 'AUTODESK', color: 'bg-amber-600' },
  { name: 'SolidWorks', brand: 'DASSAULT', color: 'bg-red-700' },
];

export default function CadDraftingPage() {
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
              CAD Drafting{' '}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Services</span>
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl leading-relaxed">
            We deliver full-range and high-quality CAD drafting services that encompass 2D and 3D 
            technical drawings as well as production drawings for manufacturing and construction.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            Request a Quote
          </Link>
        </div>
      </section>

      {/* Intro + Expertise Section */}
      <section className="py-20 bg-white flex-1">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-4xl mb-12">
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              Our CAD drafters partner with architects, contractors, fabricators, design professionals, 
              and engineering design and drafting companies to deliver high-quality CAD drafting work 
              and production-ready 2D and 3D drawings. We provide outsourcing CAD drawing services to 
              develop architectural drawings, shop drawings, and fabrication drawings of superior quality 
              from your design concepts and 3D models.
            </p>
          </div>

          <h2 className="text-3xl font-bold text-gray-900 mb-8">
            Areas of our expertise in CAD Drafting Services
          </h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
            {expertiseAreas.map((area, index) => (
              <div key={index} className="flex items-start space-x-3 bg-slate-50 rounded-xl p-4 hover:bg-slate-100 transition-colors">
                <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0 mt-0.5" />
                <span className="text-gray-700 font-medium">{area}</span>
              </div>
            ))}
          </div>

          {/* Software Logos */}
          <div className="flex flex-wrap gap-4 items-center mb-8">
            {softwareTools.map((tool, index) => (
              <div key={index} className="flex items-center bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-8 h-8 ${tool.color} rounded-lg flex items-center justify-center mr-3`}>
                  <span className="text-white text-xs font-bold">
                    {tool.name.charAt(0)}
                  </span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none">{tool.brand}</span>
                  <span className="text-sm font-bold text-gray-900 leading-tight">{tool.name}</span>
                </div>
              </div>
            ))}
          </div>

          <Link
            to="/contact"
            className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300"
          >
            Hire Our Inhouse CAD Drafters
          </Link>
        </div>
      </section>

      {/* Pricing Section */}
      <section className="py-16 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Flexible pricing for CAD drafting services
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-4xl">
            We offer flexible pricing models tailored to the scope and complexity of your project. 
            Whether you need a one-off drawing or ongoing drafting support, we provide competitive 
            rates with transparent billing — no hidden fees.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {['Scope of Work', 'Project Complexity', 'CAD Tools Required'].map((factor, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-md text-center">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <CheckCircle className="w-6 h-6 text-blue-900" />
                </div>
                <h3 className="font-bold text-gray-900">{factor}</h3>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Why Outsource Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Why outsource CAD drafting services to us?
          </h2>
          <p className="text-lg text-gray-600 mb-6 max-w-4xl leading-relaxed">
            We deliver standardized submittal drawings with accurate geometrical dimensioning and 
            tolerances as per international and industry-specific design and drafting standards. 
            Our CAD drafters are equipped to handle projects of any complexity and scope and deliver 
            top-quality drafting services at a much more competitive rate.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 mb-12"
          >
            Request a Quote
          </Link>

          {/* Strengths Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {strengths.map((strength, index) => (
              <div key={index} className="flex items-start space-x-4 p-4">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                  <strength.icon className="w-6 h-6 text-blue-900" />
                </div>
                <div>
                  <h3 className="font-bold text-gray-900 mb-1">{strength.title}</h3>
                  <p className="text-gray-600 text-sm">{strength.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Target Industries */}
          <h3 className="text-2xl font-bold text-gray-900 mb-6">Our global customer base includes:</h3>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-3">
            {targetIndustries.map((industry, index) => (
              <div key={index} className="flex items-center space-x-3 bg-slate-50 rounded-xl px-5 py-3">
                <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                <span className="text-gray-700 font-medium">{industry}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-950 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Need help on an ongoing basis?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            We establish long-term business relationships with clients and are committed to total customer satisfaction.
          </p>
          <Link to="/contact" className="inline-block px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
            Get a Quote
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
