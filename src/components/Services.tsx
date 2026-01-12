import { Cog, Lightbulb, Ruler, Workflow } from 'lucide-react';

const services = [
  {
    icon: Lightbulb,
    title: 'Design Engineering',
    description:
      'Innovative product design solutions that blend aesthetics with functionality, creating engineered excellence.',
  },
  {
    icon: Cog,
    title: 'Manufacturing Solutions',
    description:
      'Advanced manufacturing processes and automation systems that optimize production efficiency and quality.',
  },
  {
    icon: Ruler,
    title: 'CAD/CAM Services',
    description:
      'Precision 3D modeling, simulation, and computer-aided manufacturing for complex engineering projects.',
  },
  {
    icon: Workflow,
    title: 'Process Optimization',
    description:
      'Streamline operations and enhance productivity through systematic analysis and engineering improvements.',
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
            Our Services
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Comprehensive engineering solutions tailored to meet your unique challenges
          </p>
        </div>

        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
          {services.map((service, index) => (
            <div
              key={index}
              className="group glass-light rounded-2xl p-8 hover:shadow-2xl transition-all duration-500 hover:-translate-y-3 glass-shine"
            >
              <div className="w-14 h-14 rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform bg-gradient-to-br from-blue-900 to-blue-700 shadow-lg">
                <service.icon className="w-7 h-7 text-white" />
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-3">
                {service.title}
              </h3>
              <p className="text-gray-600 leading-relaxed">{service.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
