
import { useState } from 'react';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff } from 'lucide-react';

const projects = [
  {
    id: 'project1',
    name: 'Automated Conveyor System',
    description: 'Automated conveyor system with real-time simulation and iLogic-driven configuration.',
    tech: 'Inventor + APS',
  },
  {
    id: 'project2',
    name: 'Modular Enclosure Configurator',
    description: 'Custom product configurator for modular enclosures, visualized in 3D.',
    tech: 'Fusion 360 + Viewer SDK',
  },
];

export default function PortfolioPage() {
  const [selectedProject, setSelectedProject] = useState<string | null>(null);

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="relative flex-1 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 pt-32 pb-8 overflow-hidden">
        {/* Liquid blobs */}
        <div className="absolute top-20 left-10 w-80 h-80 bg-orange-500 rounded-full blur-3xl opacity-15 liquid-blob"></div>
        <div className="absolute bottom-20 right-10 w-96 h-96 bg-blue-500 rounded-full blur-3xl opacity-15 liquid-blob" style={{ animationDelay: '-4s' }}></div>
        <div className="absolute top-1/2 right-1/4 w-64 h-64 bg-purple-500 rounded-full blur-3xl opacity-10 liquid-blob" style={{ animationDelay: '-2s' }}></div>

        <div className="relative max-w-6xl mx-auto px-2 sm:px-6 lg:px-8">
          <Link
            to="/"
            className="inline-flex items-center space-x-2 text-orange-400 hover:text-orange-300 transition-colors mb-8"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Home</span>
          </Link>
          <h1 className="text-4xl md:text-6xl font-bold text-white mb-6 flex items-center gap-3">
            <Eye className="w-8 h-8 text-orange-500" /> Portfolio: Viewer SDK
          </h1>
          <p className="text-xl text-gray-300 mb-10 max-w-2xl">
            Explore interactive 3D models, CAD projects, and engineering visualizations powered by the Autodesk Viewer SDK. This portfolio demonstrates real-world applications of SydeIngenis automation and design expertise.
          </p>

          {/* Project List or Viewer */}
          {!selectedProject ? (
            <div className="grid md:grid-cols-2 gap-8" style={{ minHeight: '60vh' }}>
              {projects.map((project) => (
                <div
                  key={project.id}
                  className="group relative glass rounded-2xl p-6 flex flex-col justify-between overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                >
                  <div className="glass-shine"></div>
                  <div className="relative z-10">
                    <h3 className="text-lg font-bold text-white mb-2">{project.name}</h3>
                    <p className="text-gray-300 mb-2">{project.description}</p>
                    <span className="inline-block px-3 py-1 glass text-white text-xs rounded-full mb-4">{project.tech}</span>
                  </div>
                  <button
                    className="relative z-10 mt-auto px-4 py-2 bg-orange-500/90 backdrop-blur text-white rounded-xl font-semibold hover:bg-orange-600 transition-all duration-300 flex items-center gap-2 justify-center hover:scale-105"
                    onClick={() => setSelectedProject(project.id)}
                  >
                    <Eye className="w-4 h-4" /> View in 3D
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="glass rounded-2xl p-4 md:p-8 mb-8 flex flex-col items-center justify-center" style={{ minHeight: '80vh' }}>
              <button
                className="mb-6 px-4 py-2 glass text-white rounded-xl font-semibold hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
                onClick={() => setSelectedProject(null)}
              >
                <EyeOff className="w-4 h-4" /> Back to Projects
              </button>
              <h2 className="text-2xl font-bold text-white mb-4">Live 3D Viewer Demo</h2>
              <div className="w-full h-[65vh] md:h-[75vh] glass rounded-xl flex items-center justify-center text-gray-300">
                {/* Embed Autodesk Viewer SDK or placeholder */}
                <span>3D Viewer for <b>{projects.find(p => p.id === selectedProject)?.name}</b> coming soon...</span>
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
