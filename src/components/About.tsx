import { Link } from 'react-router-dom';
import { Award, Target, Users, Zap, CheckCircle } from 'lucide-react';

const values = [
  {
    icon: Target,
    title: 'Precision',
    description: 'Meticulous attention to detail in every design and analysis',
  },
  {
    icon: Zap,
    title: 'Innovation',
    description: 'Creative solutions using the latest CAD and simulation tools',
  },
  {
    icon: Users,
    title: 'Collaboration',
    description: 'Working closely with you from concept to final delivery',
  },
  {
    icon: Award,
    title: 'Excellence',
    description: 'Committed to delivering high-quality engineering solutions',
  },
];

const software = [
  'Autodesk Inventor',
  'Fusion 360',
  'SolidWorks',
  'Onshape',
  'AutoCAD',
  'ANSYS Mechanical',
];

export default function About() {
  return (
    <section id="about" className="py-24 bg-gradient-to-b from-white to-slate-50 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/3 left-0 w-96 h-96 bg-blue-200/20 rounded-full blur-3xl liquid-blob"></div>
      <div className="absolute bottom-1/3 right-0 w-96 h-96 bg-orange-200/20 rounded-full blur-3xl liquid-blob" style={{ animationDelay: '-4s' }}></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="grid lg:grid-cols-2 gap-16 items-center">
          <div>
            <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">
              About Us
            </span>
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-2 mb-6">
              Your CAD & Engineering Partner
            </h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              With over <strong>8 years of experience</strong> in computer-aided design and mechanical engineering, 
              SydeInnovation specializes in turning ideas into manufacturable products. Our expertise spans mechanical 
              design, machine design, furniture design, and consumer product development.
            </p>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              We offer end-to-end solutions from initial concept through prototyping—including 
              <strong> 3D printing, CNC manufacturing, and injection molding</strong> preparation. 
              Our engineering analysis services include FEA for structural and mechanical validation, 
              plus topology optimization to reduce weight and material costs.
            </p>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Beyond design, SydeInnovation specializes in <strong>product customization and automation</strong> using 
              iLogic and VB scripting in Autodesk Inventor and Fusion 360—creating configurators and 
              automated workflows that save time and reduce errors.
            </p>

            <div className="mb-8">
              <h4 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-3">Software Expertise</h4>
              <div className="flex flex-wrap gap-2">
                {software.map((item, index) => (
                  <span 
                    key={index}
                    className="inline-flex items-center px-3 py-1.5 bg-blue-100 text-blue-800 text-sm font-medium rounded-full"
                  >
                    <CheckCircle className="w-3.5 h-3.5 mr-1.5" />
                    {item}
                  </span>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap gap-4">
              <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white px-6 py-3 rounded-xl shadow-lg">
                <div className="text-2xl font-bold">8+</div>
                <div className="text-sm opacity-90">Years Exp.</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl shadow-lg">
                <div className="text-2xl font-bold">FEA</div>
                <div className="text-sm opacity-90">Certified</div>
              </div>
              <div className="bg-gradient-to-br from-slate-700 to-slate-600 text-white px-6 py-3 rounded-xl shadow-lg">
                <div className="text-2xl font-bold">iLogic</div>
                <div className="text-sm opacity-90">Expert</div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-6">
            {values.map((value, index) => (
              <div
                key={index}
                className="glass-light rounded-2xl p-6 hover:shadow-xl transition-all duration-500 hover:-translate-y-2 glass-shine"
              >
                <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mb-4 shadow-lg">
                  <value.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-20 rounded-3xl p-12 text-center text-white bg-gradient-to-r from-blue-900 to-blue-700 shadow-xl">
          <h3 className="text-3xl font-bold mb-4">Ready to Start Your Project?</h3>
          <p className="text-xl mb-8 opacity-90">
            Let's collaborate to bring your engineering vision to life—from design to prototype
          </p>
          <Link to="/contact" className="inline-block px-8 py-4 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 hover:-translate-y-1">
            Get in Touch
          </Link>
        </div>
      </div>
    </section>
  );
}
