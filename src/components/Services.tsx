import { Cpu, Settings, GraduationCap, Factory, PenTool } from 'lucide-react';

const services = [
  {
    icon: PenTool,
    title: 'CAD Design',
    description:
      'Professional computer-aided design services using industry-leading software. From 3D modeling to technical documentation for manufacturing.',
    features: ['3D Modeling', '2D Drawings', 'Assembly Design', 'Technical Documentation'],
  },
  {
    icon: Factory,
    title: 'Manufacturing',
    description:
      'End-to-end manufacturing support including 3D printing, CNC machining preparation, and injection molding design. From rapid prototypes to production-ready outputs.',
    features: ['3D Printing', 'CNC Prep', 'Injection Molding', 'DFM Analysis'],
  },
  {
    icon: Cpu,
    title: 'Simulation',
    description:
      'Finite Element Analysis for mechanical and structural validation using ANSYS. Topology optimization to reduce weight and material costs while maintaining performance.',
    features: ['FEA Analysis', 'Stress Testing', 'Topology Optimization', 'Thermal Analysis'],
  },
  {
    icon: Settings,
    title: 'Automation',
    description:
      'Custom design automation using iLogic and VB scripting in Autodesk Inventor and Fusion 360. Build configurators, automate workflows, and eliminate repetitive tasks.',
    features: ['iLogic Rules', 'VB Scripting', 'Configurators', 'Workflow Automation'],
  },
];

export default function Services() {
  return (
    <section id="services" className="py-24 bg-gradient-to-b from-slate-50 to-white relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-0 left-1/4 w-96 h-96 bg-blue-200/30 rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-orange-200/30 rounded-full blur-3xl"></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">
            What We Offer
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-2 mb-4">
            Engineering Services
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Comprehensive CAD and mechanical engineering solutions tailored to bring your ideas to life
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {services.map((service, index) => (
            <div
              key={index}
              className="group glass-light rounded-2xl p-6 hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 glass-shine"
            >
              <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform bg-gradient-to-br from-blue-900 to-blue-700 shadow-lg">
                <service.icon className="w-6 h-6 text-white" />
              </div>
              <h3 className="text-lg font-bold text-gray-900 mb-2">
                {service.title}
              </h3>
              <p className="text-gray-600 text-sm leading-relaxed mb-4">{service.description}</p>
              <div className="flex flex-wrap gap-1.5">
                {service.features.map((feature, idx) => (
                  <span key={idx} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs font-medium rounded-full">
                    {feature}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Tutoring Section */}
        <div className="glass-light rounded-3xl p-8 md:p-10 flex flex-col md:flex-row items-center gap-8">
          <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-gradient-to-br from-orange-500 to-orange-600 shadow-lg flex-shrink-0">
            <GraduationCap className="w-8 h-8 text-white" />
          </div>
          <div className="flex-1 text-center md:text-left">
            <h3 className="text-2xl font-bold text-gray-900 mb-2">Tutoring & Training</h3>
            <p className="text-gray-600 leading-relaxed">
              One-on-one and group training sessions on CAD software (Inventor, Fusion 360, SolidWorks), 
              design automation, engineering fundamentals, and best practices. Perfect for individuals, 
              teams, or academic institutions looking to level up their skills.
            </p>
          </div>
          <div className="flex flex-wrap justify-center md:justify-end gap-2">
            <span className="px-3 py-1.5 bg-orange-100 text-orange-800 text-sm font-medium rounded-full">CAD Training</span>
          </div>
        </div>
      </div>
    </section>
  );
}
