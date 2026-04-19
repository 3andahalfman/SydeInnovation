import { useState, useEffect, FormEvent } from 'react';
import { supabase } from '../lib/supabase';
import type { Project, ProjectInsert } from '../types/project';
import Header from '../components/Header';
import Footer from '../components/Footer';
import { Trash2, Edit3, Plus, LogOut, Upload, X, Save } from 'lucide-react';

const CATEGORIES = ['Design', 'Automation', 'Manufacturing', 'Analysis', 'Simulation'];

function LoginForm({ onLogin }: { onLogin: () => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      onLogin();
    }
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900">
      <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 w-full max-w-md space-y-6">
        <h1 className="text-3xl font-bold text-white text-center">Admin Login</h1>
        {error && <p className="text-red-400 text-sm text-center">{error}</p>}
        <div>
          <label className="block text-gray-300 text-sm mb-1">Email</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            title="Email address"
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <div>
          <label className="block text-gray-300 text-sm mb-1">Password</label>
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            title="Password"
            placeholder="Enter password"
            className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
          />
        </div>
        <button
          type="submit"
          disabled={loading}
          className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign In'}
        </button>
      </form>
    </div>
  );
}

const emptyForm: ProjectInsert = {
  title: '',
  description: '',
  thumbnail_url: null,
  aps_urn: null,
  category: null,
  tech: null,
};

export default function AdminPage() {
  const [session, setSession] = useState<boolean | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState<ProjectInsert>(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(!!data.session);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(!!session);
    });
    return () => listener.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (session) fetchProjects();
  }, [session]);

  const fetchProjects = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('projects')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      showMessage('error', error.message);
    } else {
      setProjects(data || []);
    }
    setLoading(false);
  };

  const showMessage = (type: 'success' | 'error', text: string) => {
    setMessage({ type, text });
    setTimeout(() => setMessage(null), 4000);
  };

  const handleThumbnailUpload = async (file: File) => {
    setUploading(true);
    const fileExt = file.name.split('.').pop();
    const fileName = `${Date.now()}-${Math.random().toString(36).substring(2)}.${fileExt}`;
    const filePath = `thumbnails/${fileName}`;

    const { error: uploadError } = await supabase.storage
      .from('project-thumbnails')
      .upload(filePath, file);

    if (uploadError) {
      showMessage('error', `Upload failed: ${uploadError.message}`);
      setUploading(false);
      return;
    }

    const { data: urlData } = supabase.storage
      .from('project-thumbnails')
      .getPublicUrl(filePath);

    setFormData((prev) => ({ ...prev, thumbnail_url: urlData.publicUrl }));
    setUploading(false);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);

    if (editingId) {
      const { error } = await supabase
        .from('projects')
        .update({
          title: formData.title,
          description: formData.description,
          thumbnail_url: formData.thumbnail_url,
          aps_urn: formData.aps_urn,
          category: formData.category,
          tech: formData.tech,
          updated_at: new Date().toISOString(),
        })
        .eq('id', editingId);

      if (error) {
        showMessage('error', error.message);
      } else {
        showMessage('success', 'Project updated');
      }
    } else {
      const { error } = await supabase.from('projects').insert([formData]);
      if (error) {
        showMessage('error', error.message);
      } else {
        showMessage('success', 'Project created');
      }
    }

    setSaving(false);
    setFormData(emptyForm);
    setEditingId(null);
    setShowForm(false);
    fetchProjects();
  };

  const handleEdit = (project: Project) => {
    setFormData({
      title: project.title,
      description: project.description,
      thumbnail_url: project.thumbnail_url,
      aps_urn: project.aps_urn,
      category: project.category,
      tech: project.tech,
    });
    setEditingId(project.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this project?')) return;
    const { error } = await supabase.from('projects').delete().eq('id', id);
    if (error) {
      showMessage('error', error.message);
    } else {
      showMessage('success', 'Project deleted');
      fetchProjects();
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setSession(false);
  };

  if (session === null) return null;
  if (!session) return <LoginForm onLogin={() => setSession(true)} />;

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 pt-28 pb-16">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          {/* Header bar */}
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl font-bold text-white">Project Manager</h1>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowForm(!showForm); setEditingId(null); setFormData(emptyForm); }}
                className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
              >
                {showForm ? <X className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
                {showForm ? 'Cancel' : 'Add Project'}
              </button>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors"
              >
                <LogOut className="w-4 h-4" /> Logout
              </button>
            </div>
          </div>

          {/* Message */}
          {message && (
            <div className={`mb-6 px-4 py-3 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-500/20 text-green-300' : 'bg-red-500/20 text-red-300'}`}>
              {message.text}
            </div>
          )}

          {/* Form */}
          {showForm && (
            <form onSubmit={handleSubmit} className="bg-white/10 backdrop-blur-lg rounded-2xl p-6 mb-8 space-y-5">
              <h2 className="text-xl font-bold text-white">
                {editingId ? 'Edit Project' : 'New Project'}
              </h2>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Title *</label>
                  <input
                    type="text"
                    required
                    value={formData.title}
                    onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. Automated Conveyor System"
                  />
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Tech Used</label>
                  <input
                    type="text"
                    value={formData.tech || ''}
                    onChange={(e) => setFormData({ ...formData, tech: e.target.value })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="e.g. Inventor + APS"
                  />
                </div>
              </div>

              <div>
                <label className="block text-gray-300 text-sm mb-1">Description *</label>
                <textarea
                  required
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
                  placeholder="Describe the project..."
                />
              </div>

              <div className="grid md:grid-cols-2 gap-5">
                <div>
                  <label className="block text-gray-300 text-sm mb-1">Category</label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData({ ...formData, category: e.target.value || null })}
                    title="Project category"
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white focus:outline-none focus:ring-2 focus:ring-orange-500"
                  >
                    <option value="" className="bg-slate-900">Select category</option>
                    {CATEGORIES.map((cat) => (
                      <option key={cat} value={cat} className="bg-slate-900">{cat}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-gray-300 text-sm mb-1">APS Viewer URN</label>
                  <input
                    type="text"
                    value={formData.aps_urn || ''}
                    onChange={(e) => setFormData({ ...formData, aps_urn: e.target.value || null })}
                    className="w-full px-4 py-2.5 rounded-xl bg-white/10 border border-white/20 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-orange-500"
                    placeholder="dXJuOmFk... (base64 encoded URN)"
                  />
                </div>
              </div>

              {/* Thumbnail upload */}
              <div>
                <label className="block text-gray-300 text-sm mb-1">Thumbnail</label>
                <div className="flex items-center gap-4">
                  {formData.thumbnail_url && (
                    <img src={formData.thumbnail_url} alt="Thumbnail" className="w-20 h-20 rounded-xl object-cover" />
                  )}
                  <label className="flex items-center gap-2 px-4 py-2.5 bg-white/10 border border-white/20 rounded-xl text-white cursor-pointer hover:bg-white/20 transition-colors">
                    <Upload className="w-4 h-4" />
                    {uploading ? 'Uploading...' : 'Upload Image'}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleThumbnailUpload(file);
                      }}
                    />
                  </label>
                  {formData.thumbnail_url && (
                    <button
                      type="button"
                      onClick={() => setFormData({ ...formData, thumbnail_url: null })}
                      className="text-gray-400 hover:text-red-400 transition-colors"
                      title="Remove thumbnail"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              <button
                type="submit"
                disabled={saving}
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors disabled:opacity-50"
              >
                <Save className="w-4 h-4" />
                {saving ? 'Saving...' : editingId ? 'Update Project' : 'Create Project'}
              </button>
            </form>
          )}

          {/* Project list */}
          {loading ? (
            <p className="text-gray-400 text-center py-12">Loading projects...</p>
          ) : projects.length === 0 ? (
            <div className="text-center py-16">
              <p className="text-gray-400 text-lg mb-4">No projects yet</p>
              <button
                onClick={() => setShowForm(true)}
                className="px-6 py-3 bg-orange-500 hover:bg-orange-600 text-white rounded-xl font-semibold transition-colors"
              >
                Add Your First Project
              </button>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-6">
              {projects.map((project) => (
                <div key={project.id} className="bg-white/10 backdrop-blur-lg rounded-2xl overflow-hidden group">
                  {project.thumbnail_url && (
                    <img
                      src={project.thumbnail_url}
                      alt={project.title}
                      className="w-full h-48 object-cover"
                    />
                  )}
                  <div className="p-5">
                    <div className="flex items-start justify-between mb-2">
                      <h3 className="text-lg font-bold text-white">{project.title}</h3>
                      <div className="flex gap-2 flex-shrink-0">
                        <button
                          onClick={() => handleEdit(project)}
                          className="p-2 text-gray-400 hover:text-orange-400 transition-colors"
                          title="Edit"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDelete(project.id)}
                          className="p-2 text-gray-400 hover:text-red-400 transition-colors"
                          title="Delete"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-3 line-clamp-2">{project.description}</p>
                    <div className="flex flex-wrap gap-2">
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
                      {project.aps_urn && (
                        <span className="px-2.5 py-1 bg-green-500/20 text-green-300 text-xs rounded-full">
                          3D Model
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
