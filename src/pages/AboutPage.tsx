import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Award, Target, Users, Zap, ArrowLeft, CheckCircle } from 'lucide-react';
import { useCountUp } from '../hooks/useCountUp';
import Header from '../components/Header';
import Footer from '../components/Footer';

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

const expertise = [
  'Autodesk Inventor Professional',
  'Fusion 360 Design & Simulation',
  'iLogic Automation & Rules',
  'Autodesk Platform Services (APS)',
  '3D Modeling & Visualization',
  'Product Configuration Systems',
  'Manufacturing Process Optimization',
  'Technical Documentation',
];

export default function AboutPage() {
  const aboutClients = useCountUp(70);
  const aboutJobs = useCountUp(80);
  const aboutSuccess = useCountUp(100);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, []);

  return (
    <div className="min-h-screen">
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
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6">
            About <span className="bg-gradient-to-r from-orange-400 to-orange-600 bg-clip-text text-transparent">SydeInnovation</span>
          </h1>
          <p className="text-xl text-gray-300 max-w-3xl leading-relaxed">
            We are a team of passionate engineers and designers committed to transforming 
            complex challenges into elegant solutions through innovative design and automation.
          </p>
        </div>
      </section>

      {/* Our Story */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid lg:grid-cols-2 gap-16 items-center">
            <div>
              <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">
                Our Story
              </span>
              <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-6">
                Engineering the Future, Today
              </h2>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                At SydeInnovation, we specialize in CAD design, 3D modeling, and product automation 
                using Autodesk Inventor and Fusion 360. Our expertise in iLogic programming and 
                Autodesk Platform Services (APS) enables us to create intelligent, automated 
                design solutions that transform how businesses approach product development.
              </p>
              <p className="text-lg text-gray-600 mb-6 leading-relaxed">
                With years of experience in mechanical engineering and design automation, we 
                understand the challenges of modern manufacturing. Our solutions bridge the gap 
                between design intent and production reality, helping companies reduce time-to-market 
                while maintaining the highest quality standards.
              </p>
              <p className="text-lg text-gray-600 leading-relaxed">
                We believe in building lasting partnerships with our clients, ensuring every 
                project is a collaborative success that delivers measurable results.
              </p>
            </div>

            <div className="bg-gradient-to-br from-slate-50 to-slate-100 rounded-2xl p-8">
              <h3 className="text-2xl font-bold text-gray-900 mb-6">Our Expertise</h3>
              <div className="grid grid-cols-1 gap-3">
                {expertise.map((item, index) => (
                  <div key={index} className="flex items-center space-x-3">
                    <CheckCircle className="w-5 h-5 text-orange-500 flex-shrink-0" />
                    <span className="text-gray-700">{item}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Our Values */}
      <section className="py-20 bg-gradient-to-br from-slate-50 to-slate-100">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <span className="text-orange-500 font-semibold text-sm uppercase tracking-wider">
              What Drives Us
            </span>
            <h2 className="text-4xl font-bold text-gray-900 mt-2 mb-4">
              Our Core Values
            </h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              The principles that guide everything we do
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {values.map((value, index) => (
              <div
                key={index}
                className="bg-white rounded-xl p-6 shadow-lg hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className="w-12 h-12 bg-orange-500 rounded-lg flex items-center justify-center mb-4">
                  <value.icon className="w-6 h-6 text-white" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 mb-2">{value.title}</h3>
                <p className="text-sm text-gray-600 leading-relaxed">{value.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Credentials */}
      <section className="py-20 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Why Choose Us
            </h2>
          </div>
          <div className="flex flex-wrap justify-center gap-6">
            <div ref={aboutClients.ref} className="bg-gradient-to-br from-blue-950 to-blue-800 text-white px-8 py-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">{aboutClients.count}+</div>
              <div className="text-sm opacity-90">Global Clients</div>
            </div>
            <div ref={aboutJobs.ref} className="bg-gradient-to-br from-orange-500 to-orange-600 text-white px-8 py-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">{aboutJobs.count}+</div>
              <div className="text-sm opacity-90">Jobs Completed</div>
            </div>
            <div ref={aboutSuccess.ref} className="bg-gradient-to-br from-slate-700 to-slate-600 text-white px-8 py-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">{aboutSuccess.count}%</div>
              <div className="text-sm opacity-90">Job Success</div>
            </div>
            <div className="bg-gradient-to-br from-blue-950 to-blue-800 text-white px-8 py-6 rounded-xl text-center">
              <div className="text-3xl font-bold mb-1">24/7</div>
              <div className="text-sm opacity-90">Support Available</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 bg-gradient-to-r from-blue-950 to-blue-800">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl md:text-4xl font-bold text-white mb-4">
            Ready to Start Your Project?
          </h2>
          <p className="text-xl text-gray-300 mb-8">
            Let's collaborate to bring your engineering vision to life
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link to="/contact" className="px-8 py-4 bg-orange-500 text-white rounded-lg font-semibold hover:bg-orange-600 transition-all duration-300 shadow-lg hover:shadow-xl hover:scale-105">
              Get in Touch
            </Link>
            <Link 
              to="/"
              className="px-8 py-4 bg-white/10 backdrop-blur-sm text-white rounded-lg font-semibold hover:bg-white/20 transition-all duration-300 border border-white/20"
            >
              View Our Services
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
