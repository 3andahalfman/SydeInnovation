import { Boxes } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Products() {
  return (
    <section id="products" className="py-24 bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
      {/* Background decoration */}
      <div className="absolute top-1/4 right-0 w-72 h-72 bg-orange-300/20 rounded-full blur-3xl liquid-blob"></div>
      <div className="absolute bottom-1/4 left-0 w-72 h-72 bg-blue-300/20 rounded-full blur-3xl liquid-blob" style={{ animationDelay: '-4s' }}></div>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 relative z-10">
        <div className="text-center mb-16">
          <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">
            Our Product
          </span>
          <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mt-2 mb-4">
            Featured Product
          </h2>
          <p className="text-xl text-gray-600 max-w-2xl mx-auto">
            Streamline your design workflow with our flagship solution
          </p>
        </div>

        <div className="max-w-3xl mx-auto">
          <div className="glass-light rounded-3xl p-8 hover:shadow-2xl transition-all duration-500 group glass-shine">
            <div className="flex items-start space-x-4 mb-6">
              <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center flex-shrink-0 group-hover:scale-110 transition-transform shadow-lg">
                <Boxes className="w-8 h-8 text-white" />
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900 mb-2">
                  SydeFlow: 3D Design Planner
                </h3>
                <p className="text-gray-600">
                  An intelligent 3D design planning tool that streamlines your CAD workflow, 
                  from concept to production-ready models. Powered by Autodesk Platform Services.
                </p>
              </div>
            </div>

            <div className="border-t border-white/50 pt-6">
              <div className="flex flex-wrap gap-2">
                {['APS Integration', '3D Visualization', 'Design Automation', 'iLogic Support', 'Real-time Updates'].map((feature, idx) => (
                  <span
                    key={idx}
                    className="px-4 py-1.5 bg-blue-100 text-blue-900 text-sm font-medium rounded-full border border-blue-200"
                  >
                    {feature}
                  </span>
                ))}
              </div>
            </div>

            <Link 
              to="/sydeflow"
              className="mt-6 w-full py-3 bg-gradient-to-r from-orange-500 to-orange-600 text-white font-semibold rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 flex items-center justify-center gap-2"
            >
              <Boxes className="w-5 h-5" />
              Launch SydeFlow
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
