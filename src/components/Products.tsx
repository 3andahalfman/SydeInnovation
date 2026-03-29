import { Boxes, Wrench, Cpu, Printer, Factory, Layers } from 'lucide-react';

export default function Products() {
  const capabilities = [
    {
      icon: Boxes,
      title: 'Product Design',
      description: 'From initial sketches to functional prototypes. We design furniture, consumer products, and mechanical components ready for manufacturing.',
      features: ['Concept Development', 'Detailed 3D Models', 'Prototype Support'],
      category: 'Design'
    },
    {
      icon: Printer,
      title: '3D Printing & Rapid Prototyping',
      description: 'Quick turnaround prototypes using FDM and resin printing technologies. Perfect for form validation and functional testing.',
      features: ['FDM Printing', 'Resin Printing', 'Multi-material'],
      category: 'Manufacturing'
    },
    {
      icon: Factory,
      title: 'CNC & Injection Molding Prep',
      description: 'Design-for-manufacturing expertise for CNC machining and injection molding. Get production-ready files and DFM analysis.',
      features: ['CNC Optimization', 'Mold Design', 'DFM Analysis'],
      category: 'Manufacturing'
    },
    {
      icon: Cpu,
      title: 'FEA & Structural Analysis',
      description: 'Mechanical and structural FEA using ANSYS. Validate your designs under real-world loading conditions before manufacturing.',
      features: ['Stress Analysis', 'Modal Analysis', 'Thermal Analysis'],
      category: 'Analysis'
    },
    {
      icon: Layers,
      title: 'Topology Optimization',
      description: 'Reduce weight and material costs while maintaining structural integrity. Ideal for additive manufacturing and lightweighting projects.',
      features: ['Weight Reduction', 'Material Savings', 'AM-Optimized'],
      category: 'Analysis'
    },
    {
      icon: Wrench,
      title: 'Design Automation (iLogic)',
      description: 'Custom automation workflows using iLogic and VB in Autodesk Inventor and Fusion 360. Build configurators and automate repetitive tasks.',
      features: ['iLogic Rules', 'VB Scripting', 'Configurators'],
      category: 'Automation'
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
            Capabilities
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-2 mb-4">
            What We Deliver
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            End-to-end engineering solutions from concept through production
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
          {capabilities.map((item, index) => (
            <div key={index} className="glass-light rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 group glass-shine">
              <div className="flex items-start space-x-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                  <item.icon className="w-7 h-7 text-white" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 mb-1">
                    {item.title}
                  </h3>
                  <span className="inline-block px-2.5 py-0.5 bg-blue-100 text-blue-700 text-xs font-semibold rounded-full">
                    {item.category}
                  </span>
                </div>
              </div>
              
              <p className="text-gray-600 mb-6 text-sm leading-relaxed">
                {item.description}
              </p>

              <div className="border-t border-white/50 pt-5">
                <div className="flex flex-wrap gap-2">
                  {item.features.map((feature, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 bg-blue-100 text-blue-900 text-xs font-medium rounded-full border border-blue-200"
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
