import { Box, Cpu, Settings, Wrench } from 'lucide-react';

const products = [
  {
    icon: Cpu,
    title: 'Smart Automation Systems',
    description: 'AI-powered automation solutions for modern manufacturing environments',
    features: ['IoT Integration', 'Real-time Monitoring', 'Predictive Maintenance'],
  },
  {
    icon: Settings,
    title: 'Industrial Control Units',
    description: 'Advanced control systems designed for precision and reliability',
    features: ['High Performance', 'Scalable Design', 'Custom Configuration'],
  },
  {
    icon: Wrench,
    title: 'Engineering Tools Suite',
    description: 'Professional-grade tools for design and analysis workflows',
    features: ['CAD Integration', 'Simulation Tools', 'Data Analytics'],
  },
  {
    icon: Box,
    title: 'Modular Components',
    description: 'Flexible, standardized components for rapid prototyping',
    features: ['Quick Assembly', 'Versatile Design', 'Quality Assured'],
  },
];

export default function Products() {
  return (
    <section id="products" className="py-24 bg-gradient-to-br from-slate-50 to-slate-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="text-center mb-16">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">
            Our Portfolio
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-2 mb-4">
            Featured Products
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Cutting-edge engineering products designed for performance and reliability
          </p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {products.map((product, index) => (
            <div
              key={index}
              className="bg-white rounded-2xl p-8 shadow-lg hover:shadow-2xl transition-all duration-300 group"
            >
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform">
                  <product.icon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">
                    {product.title}
                  </h3>
                  <p className="text-gray-600">{product.description}</p>
                </div>
              </div>

              <div className="border-t border-gray-200 pt-6">
                <div className="flex flex-wrap gap-2">
                  {product.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-50 text-blue-900 text-sm font-medium rounded-full"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>

              <button className="mt-6 w-full py-3 bg-gradient-to-r from-blue-900 to-blue-700 text-white font-semibold rounded-lg hover:from-blue-800 hover:to-blue-600 transition-all duration-300 hover:shadow-lg">
                Learn More
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
