
import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import type { Project } from '../types/project';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Link } from 'react-router-dom';
import { ArrowLeft, Eye, EyeOff, Loader2 } from 'lucide-react';

export default function PortfolioPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [filterCategory, setFilterCategory] = useState<string | null>(null);

  useEffect(() => {
    const fetchProjects = async () => {
      const { data } = await supabase
        .from('projects')
        .select('*')
        .order('created_at', { ascending: false });
      setProjects(data || []);
      setLoading(false);
    };
    fetchProjects();
  }, []);

  const categories = [...new Set(projects.map((p) => p.category).filter(Boolean))];
  const filtered = filterCategory
    ? projects.filter((p) => p.category === filterCategory)
    : projects;

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
            Explore interactive 3D models, CAD projects, and engineering visualizations powered by the Autodesk Viewer SDK. This portfolio demonstrates real-world applications of SydeInnovation automation and design expertise.
          </p>

          {/* Category filters */}
          {categories.length > 0 && !selectedProject && (
            <div className="flex flex-wrap gap-2 mb-8">
              <button
                onClick={() => setFilterCategory(null)}
                className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${!filterCategory ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
              >
                All
              </button>
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setFilterCategory(cat!)}
                  className={`px-4 py-2 rounded-xl text-sm font-medium transition-colors ${filterCategory === cat ? 'bg-orange-500 text-white' : 'bg-white/10 text-gray-300 hover:bg-white/20'}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          )}

          {/* Loading state */}
          {loading && (
            <div className="flex items-center justify-center py-24">
              <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
            </div>
          )}

          {/* Empty state */}
          {!loading && projects.length === 0 && (
            <div className="text-center py-24">
              <p className="text-gray-400 text-lg">No projects yet. Check back soon!</p>
            </div>
          )}

          {/* Project List or Viewer */}
          {!loading && !selectedProject ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filtered.map((project) => (
                <div
                  key={project.id}
                  className="group relative bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl overflow-hidden transition-all duration-300 hover:-translate-y-2 hover:shadow-2xl"
                >
                  {project.thumbnail_url ? (
                    <img
                      src={project.thumbnail_url}
                      alt={project.title}
                      className="w-full h-48 object-cover"
                    />
                  ) : (
                    <div className="w-full h-48 bg-gradient-to-br from-blue-900/50 to-slate-800/50 flex items-center justify-center">
                      <Eye className="w-10 h-10 text-gray-500" />
                    </div>
                  )}
                  <div className="p-5">
                    <h3 className="text-lg font-bold text-white mb-2">{project.title}</h3>
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">{project.description}</p>
                    <div className="flex flex-wrap gap-2 mb-4">
                      {project.category && (
                        <span className="px-2.5 py-1 bg-blue-500/20 text-blue-300 text-xs rounded-full">
                          {project.category}
                        </span>
                      )}
                      {project.tech && (
                        <span className="px-2.5 py-1 bg-orange-500/20 text-orange-300 text-xs rounded-full">
                          {project.tech}
                        </span>
                      )}
                    </div>
                    {project.aps_urn && (
                      <button
                        className="w-full px-4 py-2 bg-orange-500/90 backdrop-blur text-white rounded-xl font-semibold hover:bg-orange-600 transition-all duration-300 flex items-center gap-2 justify-center hover:scale-105"
                        onClick={() => setSelectedProject(project)}
                      >
                        <Eye className="w-4 h-4" /> View in 3D
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : selectedProject ? (
            <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-2xl p-4 md:p-8 mb-8 flex flex-col items-center justify-center min-h-[80vh]">
              <button
                className="mb-6 px-4 py-2 bg-white/10 text-white rounded-xl font-semibold hover:bg-white/20 transition-all duration-300 flex items-center gap-2"
                onClick={() => setSelectedProject(null)}
              >
                <EyeOff className="w-4 h-4" /> Back to Projects
              </button>
              <h2 className="text-2xl font-bold text-white mb-4">{selectedProject.title}</h2>
              <div className="w-full h-[65vh] md:h-[75vh] bg-white/5 rounded-xl flex items-center justify-center text-gray-300">
                {/* Embed Autodesk Viewer SDK */}
                <span>3D Viewer for <b>{selectedProject.title}</b> — loading URN...</span>
              </div>
            </div>
          ) : null}
        </div>
      </main>
      <Footer />
    </div>
  );
}
