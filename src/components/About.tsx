import { Award, Target, Users, Zap } from 'lucide-react';

const values = [
  {
    icon: Target,
    title: 'Precision',
    description: 'Meticulous attention to detail in every project we undertake',
  },
  {
    icon: Zap,
    title: 'Innovation',
    description: 'Pushing boundaries with cutting-edge technology and methodologies',
  },
  {
    icon: Users,
    title: 'Collaboration',
    description: 'Working closely with clients to achieve exceptional outcomes',
  },
  {
    icon: Award,
    title: 'Excellence',
    description: 'Committed to delivering the highest quality in engineering solutions',
  },
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
              Engineering the Future, Today
            </h2>
            <p className="text-lg text-gray-600 mb-6 leading-relaxed">
              At SydeIngenis, we are a team of passionate engineers and designers committed to
              transforming complex challenges into elegant solutions. With over 15 years of
              experience in the industry, we combine technical expertise with creative innovation.
            </p>
            <p className="text-lg text-gray-600 mb-8 leading-relaxed">
              Our multidisciplinary approach brings together mechanical engineering, industrial
              design, and advanced manufacturing to deliver products and services that exceed
              expectations. We believe in building lasting partnerships with our clients, ensuring
              every project is a collaborative success.
            </p>

            <div className="flex flex-wrap gap-4">
              <div className="bg-gradient-to-br from-blue-900 to-blue-700 text-white px-6 py-3 rounded-xl shadow-lg">
                <div className="text-2xl font-bold">ISO 9001</div>
                <div className="text-sm opacity-90">Certified</div>
              </div>
              <div className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-6 py-3 rounded-xl shadow-lg">
                <div className="text-2xl font-bold">Award</div>
                <div className="text-sm opacity-90">Winning</div>
              </div>
              <div className="bg-gradient-to-br from-slate-700 to-slate-600 text-white px-6 py-3 rounded-xl shadow-lg">
                <div className="text-2xl font-bold">24/7</div>
                <div className="text-sm opacity-90">Support</div>
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
            Let's collaborate to bring your engineering vision to life
          </p>
          <button className="px-8 py-4 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105 hover:-translate-y-1">
            Get in Touch
          </button>
        </div>
      </div>
    </section>
  );
}
