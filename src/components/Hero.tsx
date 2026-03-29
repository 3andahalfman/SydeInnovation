import { ArrowRight, Zap } from 'lucide-react';

export default function Hero() {
  const scrollToSection = (id: string) => {
    const element = document.getElementById(id);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth' });
    }
  };

  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center justify-center overflow-hidden"
    >
      {/* Background Image */}
      <div 
        className="absolute inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('https://images.unsplash.com/photo-1581091226825-a6a2a5aee158?q=80&w=2070')" }}
      ></div>
      
      {/* Dark Overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950/90 via-blue-950/85 to-slate-900/90"></div>
      
      <div className="absolute inset-0 bg-grid-pattern opacity-10"></div>

      {/* Liquid blobs */}
      <div className="absolute top-20 left-10 w-72 h-72 bg-orange-500 rounded-full blur-3xl opacity-20 liquid-blob"></div>
      <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-20 liquid-blob" style={{ animationDelay: '-4s' }}></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-purple-500/10 rounded-full blur-3xl liquid-blob" style={{ animationDelay: '-2s' }}></div>

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32 text-center">
        <div className="inline-flex items-center space-x-2 glass rounded-full px-5 py-2.5 mb-8">
          <Zap className="w-4 h-4 text-orange-400" />
          <span className="text-orange-400 text-sm font-medium">CAD & Mechanical Engineering Expert</span>
        </div>

        <h1 className="text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
          Parametric Design
          <br />
          <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">
            Powered by Automation
          </span>
        </h1>

        <p className="text-xl md:text-2xl text-gray-300 mb-12 max-w-3xl mx-auto leading-relaxed">
          Expert mechanical engineering and CAD services—from concept to prototype. 
          Specializing in product design, manufacturing solutions, and design automation.
        </p>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => scrollToSection('services')}
            className="group px-8 py-4 bg-orange-500 text-white rounded-xl font-semibold hover:bg-orange-600 transition-all duration-300 flex items-center justify-center space-x-2 shadow-lg hover:shadow-xl hover:scale-105 hover:-translate-y-1"
          >
            <span>View Services</span>
            <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
          </button>
          <button
            onClick={() => scrollToSection('about')}
            className="px-8 py-4 glass text-white rounded-xl font-semibold hover:bg-white/20 transition-all duration-300 hover:-translate-y-1"
          >
            Learn More
          </button>
        </div>

        <div className="mt-20 grid grid-cols-3 gap-4 max-w-3xl mx-auto">
          <div className="glass rounded-2xl p-5 text-center">
            <div className="text-3xl font-bold text-white mb-1">$30K+</div>
            <div className="text-gray-400 text-sm">Total Earnings</div>
          </div>
          <div className="glass rounded-2xl p-5 text-center">
            <div className="text-3xl font-bold text-white mb-1">80+</div>
            <div className="text-gray-400 text-sm">Jobs Completed</div>
          </div>
          <div className="glass rounded-2xl p-5 text-center">
            <div className="text-3xl font-bold text-white mb-1">100%</div>
            <div className="text-gray-400 text-sm">Job Success</div>
          </div>
        </div>
      </div>
    </section>
  );
}
