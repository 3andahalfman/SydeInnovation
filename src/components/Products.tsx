import { Boxes, Wrench, Cpu } from 'lucide-react';

export default function Products() {
  const products = [
    {
      icon: Boxes,
      title: '3D Product Configurator',
      description: 'Interactive 3D configurators for custom product visualization. Let your customers design and preview products in real-time.',
      features: ['APS Integration', '3D Visualization', 'Real-time Updates'],
      status: 'Coming Soon'
    },
    {
      icon: Wrench,
      title: 'Design Automation Tools',
      description: 'Custom iLogic rules and automation workflows for Autodesk Inventor that streamline your design processes.',
      features: ['iLogic Rules', 'Batch Processing', 'Custom Workflows'],
      status: 'Coming Soon'
    },
    {
      icon: Cpu,
      title: 'CAD Integration Solutions',
      description: 'Seamless integration between your CAD systems and business applications using Autodesk Platform Services.',
      features: ['API Integration', 'Data Sync', 'Cloud Processing'],
      status: 'Coming Soon'
    }
  ];

  return (
    <section id="products" className="py-24 bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 right-0 w-72 h-72 bg-orange-300/20 rounded-full blur-3xl liquid-blob"></div>
      <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl liquid-blob" style={{ animationDelay: '-4s' }}></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">
            Our Products
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-2 mb-4">
            Automation Solutions
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Powerful tools to streamline your design and manufacturing workflows
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {products.map((product, index) => (
            <div key={index} className="glass-light rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 group glass-shine">
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                  <product.icon className="w-8 h-8 text-white" />
                </div>
                <div>
                  <h3 className="text-xl font-bold text-gray-900 mb-2">
                    {product.title}
                  </h3>
                  <span className="inline-block px-3 py-1 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    {product.status}
                  </span>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6">
                {product.description}
              </p>

              <div className="border-t border-white/50 pt-6">
                <div className="flex flex-wrap gap-2">
                  {product.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1.5 bg-blue-100 text-blue-900 text-sm font-medium rounded-full border border-blue-200"
                    >
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
