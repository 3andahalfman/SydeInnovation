import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { ArrowLeft, Settings, CheckCircle, Repeat, Clock, TrendingUp, Award, Package, Cog, FileText, Link2, MonitorSmartphone, Factory, Building2, Armchair, Pipette, ShoppingBag } from 'lucide-react';

const benefits = [
  { icon: Repeat, title: 'Reduced Rework', description: 'Eliminate repetitive manual tasks and reduce errors in your design process' },
  { icon: Clock, title: 'Eliminated Backlogs & Delays', description: 'Speed up design cycles by automating time-consuming workflows' },
  { icon: TrendingUp, title: 'Larger Profit Margins', description: 'Lower engineering costs while increasing output and throughput' },
  { icon: Award, title: 'Higher Quality', description: 'Consistent, error-free outputs with automated validation checks' },
  { icon: Package, title: 'Product Value Additions', description: 'Offer mass customization capabilities to your customers' },
];

const softwareTools = [
  { name: 'Inventor iLogic', brand: 'AUTODESK', color: 'bg-amber-600' },
  { name: 'VB.NET', brand: 'MICROSOFT', color: 'bg-purple-600' },
  { name: 'Fusion 360', brand: 'AUTODESK', color: 'bg-orange-500' },
  { name: 'DriveWorks', brand: 'SOLIDWORKS', color: 'bg-red-700' },
  { name: 'APS', brand: 'AUTODESK', color: 'bg-blue-600' },
];

const competitiveAdvantages = [
  {
    icon: Cog,
    title: 'Product Configuration',
    description: 'Avoid excessive design errors and minimize change orders by allowing customers to customize products from a set of validated rules and parameters.',
  },
  {
    icon: Link2,
    title: 'System Integration',
    description: 'Integrate your existing ERP, CRM, and CAD systems with design automation to accelerate sales quotes and pricing data.',
  },
  {
    icon: FileText,
    title: 'BOM Generation',
    description: 'By integrating your CAD systems with automation, we help you generate custom CAD drawings, BOMs, and PDFs faster than manual work.',
  },
  {
    icon: MonitorSmartphone,
    title: 'Drawing Automation',
    description: 'We automate 2D manufacturing drawings with BOM and custom 3D models by deploying a CAD configurator and creating repetitive tasks.',
  },
  {
    icon: FileText,
    title: 'Document Generation',
    description: 'Whether you need a custom PDF document for sales quotes, 3D model files, or assembly and installation guides — we help you create it with a single click.',
  },
  {
    icon: Settings,
    title: 'Custom Add-ins',
    description: 'Purpose-built plugins and add-ins for Autodesk Inventor and Fusion 360 that extend functionality and automate your unique workflows.',
  },
];

const industries = [
  { icon: Factory, title: 'Industrial Equipment' },
  { icon: Building2, title: 'Building Products' },
  { icon: Armchair, title: 'Furniture Products' },
  { icon: Pipette, title: 'Pipe Fittings' },
  { icon: ShoppingBag, title: 'Commercial Products' },
];

export default function AutomationPage() {
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
              <Settings className="w-8 h-8 text-orange-400" />
            </div>
            <h1 className="text-4xl md:text-6xl font-bold text-white">
              Design{' '}
              <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Automation</span>
            </h1>
          </div>
          <p className="text-xl text-gray-300 max-w-3xl leading-relaxed">
            Automate repetitive tasks to accelerate engineering lead times
          </p>
          <p className="text-gray-400 mt-4 max-w-3xl leading-relaxed">
            Design automation helps you achieve up to 70% faster design cycles by replacing manual, 
            repetitive tasks. Implement design automation and get the benefits of mass customization 
            to offer personalized products to your customers.
          </p>
          <Link
            to="/contact"
            className="mt-8 inline-flex items-center px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
          >
            Explore our design automation capabilities
          </Link>
        </div>
      </section>

      {/* Speed-up Customization Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-4 text-center">
            Speed-up design customization with design automation software
          </h2>
          <p className="text-lg text-gray-600 mb-12 max-w-4xl mx-auto text-center leading-relaxed">
            Our automation experts develop CAD product configurators and macros to automate 2D drawings, 
            3D models, BOM generation, and minimize change orders for mass production. Our robust design 
            automation solutions free up designers from costly, repetitive, time-consuming tasks for enhanced 
            product customization.
          </p>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-6">
            {benefits.map((benefit, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 bg-blue-100 rounded-2xl flex items-center justify-center mx-auto mb-4 group-hover:bg-blue-200 transition-colors group-hover:scale-110 transition-transform duration-300">
                  <benefit.icon className="w-7 h-7 text-blue-900" />
                </div>
                <h3 className="font-bold text-gray-900 text-sm mb-1">{benefit.title}</h3>
                <p className="text-gray-500 text-xs leading-relaxed">{benefit.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              to="/contact"
              className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300"
            >
              Automate your design and sales process
            </Link>
          </div>
        </div>
      </section>

      {/* Software Tools Section */}
      <section className="py-12 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-8">
            Software <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">Tools</span>
          </h2>
          <div className="flex flex-wrap justify-center gap-4">
            {softwareTools.map((tool, index) => (
              <div key={index} className="flex items-center bg-white border border-gray-200 rounded-xl px-5 py-3 shadow-sm hover:shadow-md transition-shadow">
                <div className={`w-8 h-8 ${tool.color} rounded-lg flex items-center justify-center mr-3`}>
                  <span className="text-white text-xs font-bold">{tool.name.charAt(0)}</span>
                </div>
                <div className="flex flex-col">
                  <span className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider leading-none">{tool.brand}</span>
                  <span className="text-sm font-bold text-gray-900 leading-tight">{tool.name}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Boost Profitability Section */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">
            Design automation solutions to help manufacturers boost profitability
          </h2>
          <p className="text-lg text-gray-600 mb-8 max-w-3xl mx-auto">
            Our design automation solutions have helped manufacturers reduce design cycle times by up to 70%, 
            improve quality, and lower costs of production to achieve higher customer satisfaction.
          </p>
          <Link
            to="/contact"
            className="inline-flex items-center px-6 py-3 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300"
          >
            Read detailed case studies
          </Link>
        </div>
      </section>

      {/* Competitive Advantages Section */}
      <section className="py-20 bg-slate-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <p className="text-gray-500 font-medium mb-2">Competitive advantage to</p>
            <h2 className="text-3xl font-bold text-gray-900">
              manufacturers with design automation
            </h2>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {competitiveAdvantages.map((advantage, index) => (
              <div key={index} className="bg-white rounded-2xl p-6 shadow-md hover:shadow-xl hover:-translate-y-2 transition-all duration-300">
                <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mb-4">
                  <advantage.icon className="w-6 h-6 text-blue-900" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{advantage.title}</h3>
                <p className="text-gray-600 text-sm leading-relaxed">{advantage.description}</p>
              </div>
            ))}
          </div>
          <div className="text-center mt-10">
            <Link
              to="/contact"
              className="inline-flex items-center px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105"
            >
              Bring design automation into your process
            </Link>
          </div>
        </div>
      </section>

      {/* Industries Section */}
      <section className="py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-10 text-center">
            Industries we engage with
          </h2>
          <div className="flex flex-wrap justify-center gap-8">
            {industries.map((industry, index) => (
              <div key={index} className="text-center group">
                <div className="w-16 h-16 bg-slate-100 rounded-2xl flex items-center justify-center mx-auto mb-3 group-hover:bg-blue-100 transition-colors group-hover:scale-110 transition-transform duration-300">
                  <industry.icon className="w-7 h-7 text-gray-700 group-hover:text-blue-900 transition-colors" />
                </div>
                <span className="text-sm font-medium text-gray-700">{industry.title}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 bg-gradient-to-r from-orange-500 to-orange-600">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Automation is the new Customization
          </h2>
          <p className="text-xl text-white/90 mb-8">
            Our team of experts can help speed up your product configurations, increase sales & profitability.
          </p>
          <Link to="/contact" className="inline-block px-8 py-4 bg-white text-orange-600 rounded-lg font-semibold hover:bg-gray-100 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
            Get in Touch
          </Link>
        </div>
      </section>

      <Footer />
    </div>
  );
}
