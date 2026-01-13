'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Plus, Edit, Trash2, Eye, Play, ChevronRight, ChevronDown,
  Package, Box, Tv, Table2, Armchair, Grid3x3, Save, X,
  AlertCircle, CheckCircle, Clock, Loader2, Upload, RefreshCw,
  FileCode, Settings, Layers, Database, TestTube, Rocket,
  Wand2, Sparkles, Download
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';

// Types
interface Parameter {
  name: string;
  displayName: string;
  type: 'number' | 'text' | 'boolean' | 'select';
  unit?: string;
  defaultValue: number | string | boolean;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  group?: string;
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  ossBucket: string;
  ossObjectKey: string;
  activityId: string;
  status: 'draft' | 'testing' | 'live';
  thumbnail?: string;
  parameters: Parameter[];
  pricing?: {
    basePrice: number;
    pricePerUnit?: number;
  };
  createdAt: string;
  updatedAt: string;
}

interface Category {
  id: string;
  name: string;
  icon: string;
}

interface OSSBucket {
  bucketKey: string;
  createdDate: string;
  policyKey: string;
}

interface OSSObject {
  objectKey: string;
  size: number;
  objectId: string;
}

const categoryIcons: Record<string, React.ElementType> = {
  'Box': Box,
  'Tv': Tv,
  'Table2': Table2,
  'Armchair': Armchair,
  'Grid3x3': Grid3x3,
};

const statusColors = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  testing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30'
};

const statusIcons = {
  draft: Clock,
  testing: TestTube,
  live: Rocket
};

export default function ProductManagerView() {
  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showTestModal, setShowTestModal] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  
  // Form state
  const [formData, setFormData] = useState<Partial<Product>>({
    name: '',
    description: '',
    category: '',
    ossBucket: '',
    ossObjectKey: '',
    activityId: '',
    status: 'draft',
    parameters: [],
    pricing: { basePrice: 100 }
  });
  
  // Available options
  const [buckets, setBuckets] = useState<OSSBucket[]>([]);
  const [bucketObjects, setBucketObjects] = useState<OSSObject[]>([]);
  const [activities, setActivities] = useState<string[]>([]);
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);
  const [loadingActivities, setLoadingActivities] = useState(false);
  
  // Test state
  const [testParams, setTestParams] = useState<Record<string, any>>({});
  const [testStatus, setTestStatus] = useState<string>('');
  const [testRunning, setTestRunning] = useState(false);
  const [testUrn, setTestUrn] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Parameter extraction state
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState<string>('');

  // Fetch products and categories
  useEffect(() => {
    fetchProducts();
    fetchCategories();
    fetchBuckets(); // Pre-fetch buckets so they're ready
  }, []);

  // Socket.IO setup
  useEffect(() => {
    socketRef.current = io('http://localhost:8080');

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current?.id);
    });

    socketRef.current.on('onComplete', (message: any) => {
      if (typeof message === 'string') {
        setTestStatus(message);
      } else if (message.status) {
        setTestStatus(`Status: ${message.status} ${message.progress || ''}`);
        if (message.status === 'success') {
          setTestRunning(false);
          // Extract URN from response if available
        }
      }
    });

    socketRef.current.on('workitemComplete', (data: { urn: string }) => {
      setTestStatus('Complete! Loading preview...');
      setTestUrn(data.urn);
      setTestRunning(false);
    });

    socketRef.current.on('onError', (error: string) => {
      setTestStatus('Error: ' + error);
      setTestRunning(false);
    });

    // Parameter extraction events
    socketRef.current.on('extractionProgress', (data: { status: string; progress?: string }) => {
      setExtractionStatus(`Extracting: ${data.status} ${data.progress || ''}`);
    });

    socketRef.current.on('extractionComplete', (data: { success: boolean; parameters?: Parameter[]; error?: string }) => {
      setExtracting(false);
      if (data.success && data.parameters) {
        setExtractionStatus(`Found ${data.parameters.length} parameters!`);
        // Merge extracted parameters with existing ones
        setFormData(prev => ({
          ...prev,
          parameters: data.parameters
        }));
      } else {
        setExtractionStatus(`Extraction failed: ${data.error || 'Unknown error'}`);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  const fetchProducts = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/products');
      const data = await response.json();
      setProducts(data.products || []);
    } catch (ex) {
      setError('Failed to load products');
      console.error(ex);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories');
      const data = await response.json();
      setCategories(data || []);
    } catch (ex) {
      console.error('Failed to load categories:', ex);
    }
  };

  const fetchBuckets = async () => {
    console.log('fetchBuckets called');
    setLoadingBuckets(true);
    try {
      const response = await fetch('/api/oss/buckets');
      console.log('Buckets response status:', response.status);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const data = await response.json();
      console.log('Buckets raw data:', data);
      // Handle different response formats
      let bucketList: OSSBucket[] = [];
      if (Array.isArray(data)) {
        bucketList = data;
      } else if (data.items && Array.isArray(data.items)) {
        bucketList = data.items;
      } else if (data.value && Array.isArray(data.value)) {
        bucketList = data.value;
      }
      console.log('Setting buckets:', bucketList.length, 'items');
      setBuckets(bucketList);
    } catch (ex) {
      console.error('Failed to load buckets:', ex);
    } finally {
      setLoadingBuckets(false);
    }
  };

  const fetchBucketObjects = async (bucketKey: string) => {
    if (!bucketKey) {
      setBucketObjects([]);
      return;
    }
    setLoadingObjects(true);
    try {
      const response = await fetch(`/api/oss/buckets/${bucketKey}/objects`);
      const data = await response.json();
      console.log('Objects response:', data);
      // Handle different response formats
      let objectList: OSSObject[] = [];
      if (Array.isArray(data)) {
        objectList = data;
      } else if (data.items && Array.isArray(data.items)) {
        objectList = data.items;
      } else if (data.value && Array.isArray(data.value)) {
        objectList = data.value;
      }
      console.log('Setting objects:', objectList);
      setBucketObjects(objectList);
    } catch (ex) {
      console.error('Failed to load objects:', ex);
    } finally {
      setLoadingObjects(false);
    }
  };

  const fetchActivities = async () => {
    setLoadingActivities(true);
    try {
      const response = await fetch('/api/aps/designautomation/activities');
      const data = await response.json();
      setActivities(data || []);
    } catch (ex) {
      console.error('Failed to load activities:', ex);
    } finally {
      setLoadingActivities(false);
    }
  };

  const openCreateModal = () => {
    setFormData({
      name: '',
      description: '',
      category: categories[0]?.id || '',
      ossBucket: '',
      ossObjectKey: '',
      activityId: '',
      status: 'draft',
      parameters: [],
      pricing: { basePrice: 100 }
    });
    setShowCreateModal(true);
    fetchBuckets();
    fetchActivities();
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({ ...product });
    setShowEditModal(true);
    fetchBuckets();
    fetchActivities();
    if (product.ossBucket) {
      fetchBucketObjects(product.ossBucket);
    }
  };

  const openTestModal = (product: Product) => {
    setSelectedProduct(product);
    // Initialize test params with default values
    const initialParams: Record<string, any> = {};
    product.parameters.forEach(p => {
      initialParams[p.name] = p.defaultValue;
    });
    setTestParams(initialParams);
    setTestStatus('');
    setTestUrn(null);
    setShowTestModal(true);
  };

  const handleCreateProduct = async () => {
    try {
      const response = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error('Failed to create product');
      await fetchProducts();
      setShowCreateModal(false);
    } catch (ex) {
      console.error(ex);
      alert('Failed to create product');
    }
  };

  const handleUpdateProduct = async () => {
    if (!selectedProduct) return;
    try {
      const response = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (!response.ok) throw new Error('Failed to update product');
      await fetchProducts();
      setShowEditModal(false);
    } catch (ex) {
      console.error(ex);
      alert('Failed to update product');
    }
  };

  const handleDeleteProduct = async (id: string) => {
    if (!confirm('Are you sure you want to delete this product?')) return;
    try {
      const response = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Failed to delete product');
      await fetchProducts();
    } catch (ex) {
      console.error(ex);
      alert('Failed to delete product');
    }
  };

  const handleStatusChange = async (id: string, status: 'draft' | 'testing' | 'live') => {
    try {
      const response = await fetch(`/api/products/${id}/status`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status })
      });
      if (!response.ok) throw new Error('Failed to update status');
      await fetchProducts();
    } catch (ex) {
      console.error(ex);
      alert('Failed to update status');
    }
  };

  const handleRunTest = async () => {
    if (!selectedProduct || !socketRef.current?.id) return;
    
    setTestRunning(true);
    setTestStatus('Starting test...');
    setTestUrn(null);

    try {
      const response = await fetch(`/api/products/${selectedProduct.id}/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          parameterValues: testParams,
          browserConnectionId: socketRef.current.id
        })
      });
      
      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.diagnostic || 'Test failed');
      }
      
      const data = await response.json();
      setTestStatus(`Workitem started: ${data.workItemId}`);
    } catch (ex: any) {
      setTestStatus('Error: ' + ex.message);
      setTestRunning(false);
    }
  };

  // Add parameter
  const addParameter = () => {
    setFormData(prev => ({
      ...prev,
      parameters: [
        ...(prev.parameters || []),
        {
          name: '',
          displayName: '',
          type: 'number',
          defaultValue: 0,
          group: 'Dimensions'
        }
      ]
    }));
  };

  const updateParameter = (index: number, updates: Partial<Parameter>) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters?.map((p, i) => i === index ? { ...p, ...updates } : p) || []
    }));
  };

  const removeParameter = (index: number) => {
    setFormData(prev => ({
      ...prev,
      parameters: prev.parameters?.filter((_, i) => i !== index) || []
    }));
  };

  // Extract parameters from Inventor file
  const extractParameters = async (useSimple: boolean = false) => {
    if (!formData.ossBucket || !formData.ossObjectKey) {
      alert('Please select an OSS bucket and file first');
      return;
    }

    setExtracting(true);
    setExtractionStatus('Starting parameter extraction...');

    try {
      const endpoint = useSimple ? '/api/extract-parameters-simple' : '/api/extract-parameters';
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ossBucket: formData.ossBucket,
          ossObjectKey: formData.ossObjectKey,
          browserConnectionId: socketRef.current?.id
        })
      });

      const data = await response.json();

      if (!response.ok) {
        if (data.hint) {
          setExtractionStatus(`${data.diagnostic}\n${data.hint}`);
        } else {
          setExtractionStatus(`Error: ${data.diagnostic}`);
        }
        setExtracting(false);
        return;
      }

      // For simple extraction, results come directly
      if (useSimple && data.success) {
        setExtractionStatus(`Found ${data.parameters.length} parameters from ${data.source}`);
        setFormData(prev => ({
          ...prev,
          parameters: data.parameters
        }));
        setExtracting(false);
      } else if (useSimple && !data.success) {
        setExtractionStatus(data.message || 'No parameters found');
        setExtracting(false);
      } else {
        // Full extraction uses socket for progress
        setExtractionStatus(data.message || 'Extraction started...');
      }
    } catch (ex: any) {
      setExtractionStatus(`Error: ${ex.message}`);
      setExtracting(false);
    }
  };

  // Get iLogic template for parameter extraction
  const downloadExtractionTemplate = async () => {
    try {
      const response = await fetch('/api/extract-parameters/template');
      const data = await response.json();
      
      // Create downloadable file
      const blob = new Blob([data.code], { type: 'text/plain' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'ExtractParams.iLogicVb';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      
      // Show instructions
      alert(`iLogic template downloaded!\n\nInstructions:\n1. ${data.instructions.step1}\n2. ${data.instructions.step2}\n3. ${data.instructions.step3}\n4. ${data.instructions.step4}\n5. ${data.instructions.step5}`);
    } catch (ex: any) {
      alert('Failed to download template: ' + ex.message);
    }
  };

  // Group products by category
  const productsByCategory = products.reduce((acc, product) => {
    const cat = product.category || 'uncategorized';
    if (!acc[cat]) acc[cat] = [];
    acc[cat].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Product Manager</h2>
          <p className="text-gray-400 text-sm mt-1">
            Configure products, link to OSS files, and manage Design Automation
          </p>
        </div>
        <button
          onClick={openCreateModal}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
        >
          <Plus className="w-5 h-5" />
          New Product
        </button>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-500/20 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-400" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-500/20 rounded-lg flex items-center justify-center">
              <Package className="w-5 h-5 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{products.length}</p>
              <p className="text-xs text-gray-500">Total Products</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-gray-500/20 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-gray-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {products.filter(p => p.status === 'draft').length}
              </p>
              <p className="text-xs text-gray-500">Draft</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
              <TestTube className="w-5 h-5 text-yellow-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {products.filter(p => p.status === 'testing').length}
              </p>
              <p className="text-xs text-gray-500">Testing</p>
            </div>
          </div>
        </div>
        <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-500/20 rounded-lg flex items-center justify-center">
              <Rocket className="w-5 h-5 text-green-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">
                {products.filter(p => p.status === 'live').length}
              </p>
              <p className="text-xs text-gray-500">Live</p>
            </div>
          </div>
        </div>
      </div>

      {/* Products List */}
      {products.length === 0 ? (
        <div className="bg-slate-800/50 rounded-xl p-12 border border-slate-700/50 text-center">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No Products Yet</h3>
          <p className="text-gray-400 mb-4">Create your first product to get started</p>
          <button
            onClick={openCreateModal}
            className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
          >
            Create Product
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {Object.entries(productsByCategory).map(([categoryId, categoryProducts]) => {
            const category = categories.find(c => c.id === categoryId);
            const IconComponent = categoryIcons[category?.icon || 'Box'] || Box;
            
            return (
              <div key={categoryId} className="bg-slate-800/50 rounded-xl border border-slate-700/50 overflow-hidden">
                <div className="px-4 py-3 bg-slate-900/50 border-b border-slate-700/50 flex items-center gap-3">
                  <IconComponent className="w-5 h-5 text-orange-400" />
                  <h3 className="font-semibold text-white">{category?.name || categoryId}</h3>
                  <span className="text-xs text-gray-500">({categoryProducts.length})</span>
                </div>
                <div className="divide-y divide-slate-700/50">
                  {categoryProducts.map(product => {
                    const StatusIcon = statusIcons[product.status];
                    return (
                      <div key={product.id} className="p-4 hover:bg-slate-700/20 transition-colors">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-4">
                            <div className="w-12 h-12 bg-slate-700/50 rounded-lg flex items-center justify-center">
                              <FileCode className="w-6 h-6 text-gray-400" />
                            </div>
                            <div>
                              <h4 className="font-semibold text-white">{product.name}</h4>
                              <p className="text-sm text-gray-400">{product.description}</p>
                              <div className="flex items-center gap-3 mt-1">
                                <span className="text-xs text-gray-500">
                                  {product.ossObjectKey || 'No file linked'}
                                </span>
                                <span className="text-xs text-gray-600">•</span>
                                <span className="text-xs text-gray-500">
                                  {product.parameters?.length || 0} parameters
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {/* Status Badge */}
                            <div className={`flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium border ${statusColors[product.status]}`}>
                              <StatusIcon className="w-3.5 h-3.5" />
                              {product.status}
                            </div>
                            
                            {/* Status Dropdown */}
                            <select
                              value={product.status}
                              onChange={(e) => handleStatusChange(product.id, e.target.value as any)}
                              className="bg-slate-700/50 border border-slate-600 rounded-lg px-2 py-1 text-sm text-white"
                            >
                              <option value="draft">Draft</option>
                              <option value="testing">Testing</option>
                              <option value="live">Live</option>
                            </select>

                            {/* Actions */}
                            <button
                              onClick={() => openTestModal(product)}
                              className="p-2 hover:bg-slate-600/50 rounded-lg transition-colors text-yellow-400"
                              title="Test Product"
                            >
                              <Play className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => openEditModal(product)}
                              className="p-2 hover:bg-slate-600/50 rounded-lg transition-colors text-blue-400"
                              title="Edit Product"
                            >
                              <Edit className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => handleDeleteProduct(product.id)}
                              className="p-2 hover:bg-slate-600/50 rounded-lg transition-colors text-red-400"
                              title="Delete Product"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Create/Edit Modal */}
      {(showCreateModal || showEditModal) && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden border border-slate-700">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <h3 className="text-xl font-bold text-white">
                {showCreateModal ? 'Create New Product' : 'Edit Product'}
              </h3>
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto max-h-[calc(90vh-140px)] space-y-6">
              {/* Basic Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Product Name</label>
                  <input
                    type="text"
                    value={formData.name || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    placeholder="Modern Sliding Wardrobe"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-400 mb-2">Category</label>
                  <select
                    value={formData.category || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                    className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Select category...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-400 mb-2">Description</label>
                <textarea
                  value={formData.description || ''}
                  onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white h-20"
                  placeholder="Product description..."
                />
              </div>

              {/* OSS Configuration */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Database className="w-5 h-5 text-orange-400" />
                  OSS File Configuration
                  {loadingBuckets && <Loader2 className="w-4 h-4 animate-spin text-orange-400" />}
                  <span className="text-xs text-gray-500 ml-auto">({buckets.length} buckets)</span>
                </h4>
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">OSS Bucket</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.ossBucket || ''}
                        onChange={(e) => {
                          setFormData(prev => ({ ...prev, ossBucket: e.target.value, ossObjectKey: '' }));
                          fetchBucketObjects(e.target.value);
                        }}
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white truncate"
                      >
                        <option value="">Select bucket...</option>
                        {buckets.map(bucket => (
                          <option key={bucket.bucketKey} value={bucket.bucketKey}>{bucket.bucketKey}</option>
                        ))}
                      </select>
                      <button
                        onClick={fetchBuckets}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex-shrink-0"
                        title="Refresh buckets"
                      >
                        <RefreshCw className={`w-5 h-5 text-gray-400 ${loadingBuckets ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Source File (IPT/IAM/DWG)</label>
                    <div className="flex gap-2">
                      <select
                        value={formData.ossObjectKey || ''}
                        onChange={(e) => setFormData(prev => ({ ...prev, ossObjectKey: e.target.value }))}
                        className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white truncate"
                        disabled={!formData.ossBucket}
                      >
                        <option value="">Select file...</option>
                        {bucketObjects.map(obj => (
                          <option key={obj.objectKey} value={obj.objectKey}>{obj.objectKey}</option>
                        ))}
                      </select>
                      <button
                        onClick={() => formData.ossBucket && fetchBucketObjects(formData.ossBucket)}
                        className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors flex-shrink-0"
                        title="Refresh files"
                        disabled={!formData.ossBucket}
                      >
                        <RefreshCw className={`w-5 h-5 text-gray-400 ${loadingObjects ? 'animate-spin' : ''}`} />
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              {/* Activity Configuration */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h4 className="font-semibold text-white mb-4 flex items-center gap-2">
                  <Settings className="w-5 h-5 text-orange-400" />
                  Design Automation Activity
                </h4>
                <div className="flex gap-2">
                  <select
                    value={formData.activityId || ''}
                    onChange={(e) => setFormData(prev => ({ ...prev, activityId: e.target.value }))}
                    className="flex-1 bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
                  >
                    <option value="">Select activity...</option>
                    {activities.map(activity => (
                      <option key={activity} value={activity}>{activity}</option>
                    ))}
                  </select>
                  <button
                    onClick={fetchActivities}
                    className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg transition-colors"
                    title="Refresh activities"
                  >
                    <RefreshCw className={`w-5 h-5 text-gray-400 ${loadingActivities ? 'animate-spin' : ''}`} />
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-2">
                  Select the Design Automation activity that will process this product's parameters
                </p>
              </div>

              {/* Parameters */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <div className="flex items-center justify-between mb-4">
                  <h4 className="font-semibold text-white flex items-center gap-2">
                    <Layers className="w-5 h-5 text-orange-400" />
                    Parameters ({formData.parameters?.length || 0})
                  </h4>
                  <div className="flex items-center gap-2">
                    {/* Extract Parameters Buttons */}
                    <button
                      onClick={() => extractParameters(true)}
                      disabled={!formData.ossBucket || !formData.ossObjectKey || extracting}
                      className="flex items-center gap-1 px-3 py-1 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Quick extraction from translated model (requires file to be translated first)"
                    >
                      {extracting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Sparkles className="w-4 h-4" />
                      )}
                      Quick Extract
                    </button>
                    <button
                      onClick={() => extractParameters(false)}
                      disabled={!formData.ossBucket || !formData.ossObjectKey || extracting}
                      className="flex items-center gap-1 px-3 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded-lg text-sm transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      title="Full extraction using Design Automation (requires ExtractParamsActivity)"
                    >
                      {extracting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Wand2 className="w-4 h-4" />
                      )}
                      DA Extract
                    </button>
                    <button
                      onClick={downloadExtractionTemplate}
                      className="flex items-center gap-1 px-3 py-1 bg-slate-600/50 hover:bg-slate-600 text-gray-300 rounded-lg text-sm transition-colors"
                      title="Download iLogic template for creating extraction activity"
                    >
                      <Download className="w-4 h-4" />
                    </button>
                    <button
                      onClick={addParameter}
                      className="flex items-center gap-1 px-3 py-1 bg-orange-500/20 hover:bg-orange-500/30 text-orange-400 rounded-lg text-sm transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                      Add Manual
                    </button>
                  </div>
                </div>

                {/* Extraction Status */}
                {extractionStatus && (
                  <div className={`mb-4 p-3 rounded-lg text-sm ${
                    extractionStatus.includes('Error') || extractionStatus.includes('failed')
                      ? 'bg-red-500/20 border border-red-500/30 text-red-400'
                      : extractionStatus.includes('Found')
                        ? 'bg-green-500/20 border border-green-500/30 text-green-400'
                        : 'bg-blue-500/20 border border-blue-500/30 text-blue-400'
                  }`}>
                    <div className="flex items-center gap-2">
                      {extracting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span className="whitespace-pre-wrap">{extractionStatus}</span>
                    </div>
                  </div>
                )}
                
                {formData.parameters?.length === 0 ? (
                  <div className="text-center py-6">
                    <Wand2 className="w-10 h-10 text-gray-600 mx-auto mb-3" />
                    <p className="text-gray-500 text-sm mb-2">
                      No parameters configured yet.
                    </p>
                    <p className="text-gray-600 text-xs">
                      Select a file above, then use "Quick Extract" to auto-discover parameters,<br />
                      or "Add Manual" to enter them by hand.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {formData.parameters?.map((param, index) => (
                      <div key={index} className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/30">
                        <div className="grid grid-cols-6 gap-3">
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Name (Inventor)</label>
                            <input
                              type="text"
                              value={param.name}
                              onChange={(e) => updateParameter(index, { name: e.target.value })}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              placeholder="d0"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                            <input
                              type="text"
                              value={param.displayName}
                              onChange={(e) => updateParameter(index, { displayName: e.target.value })}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              placeholder="Width"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Type</label>
                            <select
                              value={param.type}
                              onChange={(e) => updateParameter(index, { type: e.target.value as any })}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                            >
                              <option value="number">Number</option>
                              <option value="text">Text</option>
                              <option value="boolean">Boolean</option>
                              <option value="select">Select</option>
                            </select>
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Default</label>
                            <input
                              type={param.type === 'number' ? 'number' : 'text'}
                              value={param.defaultValue as any}
                              onChange={(e) => updateParameter(index, { 
                                defaultValue: param.type === 'number' ? parseFloat(e.target.value) : e.target.value 
                              })}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                            />
                          </div>
                          <div>
                            <label className="block text-xs text-gray-500 mb-1">Unit</label>
                            <input
                              type="text"
                              value={param.unit || ''}
                              onChange={(e) => updateParameter(index, { unit: e.target.value })}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              placeholder="mm"
                            />
                          </div>
                          <div className="flex items-end">
                            <button
                              onClick={() => removeParameter(index)}
                              className="p-1 hover:bg-red-500/20 rounded text-red-400"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                        {param.type === 'number' && (
                          <div className="grid grid-cols-3 gap-3 mt-2">
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Min</label>
                              <input
                                type="number"
                                value={param.min || ''}
                                onChange={(e) => updateParameter(index, { min: parseFloat(e.target.value) || undefined })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Max</label>
                              <input
                                type="number"
                                value={param.max || ''}
                                onChange={(e) => updateParameter(index, { max: parseFloat(e.target.value) || undefined })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              />
                            </div>
                            <div>
                              <label className="block text-xs text-gray-500 mb-1">Step</label>
                              <input
                                type="number"
                                value={param.step || ''}
                                onChange={(e) => updateParameter(index, { step: parseFloat(e.target.value) || undefined })}
                                className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              />
                            </div>
                          </div>
                        )}
                        {param.type === 'select' && (
                          <div className="mt-2">
                            <label className="block text-xs text-gray-500 mb-1">Options (comma separated)</label>
                            <input
                              type="text"
                              value={param.options?.join(', ') || ''}
                              onChange={(e) => updateParameter(index, { options: e.target.value.split(',').map(s => s.trim()) })}
                              className="w-full bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white"
                              placeholder="Option 1, Option 2, Option 3"
                            />
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Pricing */}
              <div className="bg-slate-800/50 rounded-xl p-4 border border-slate-700/50">
                <h4 className="font-semibold text-white mb-4">Pricing</h4>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-400 mb-2">Base Price ($)</label>
                    <input
                      type="number"
                      value={formData.pricing?.basePrice || 0}
                      onChange={(e) => setFormData(prev => ({ 
                        ...prev, 
                        pricing: { ...prev.pricing, basePrice: parseFloat(e.target.value) || 0 } 
                      }))}
                      className="w-full bg-slate-800 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-slate-700/50 flex items-center justify-end gap-3">
              <button
                onClick={() => { setShowCreateModal(false); setShowEditModal(false); }}
                className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg font-medium transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={showCreateModal ? handleCreateProduct : handleUpdateProduct}
                className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <Save className="w-5 h-5" />
                {showCreateModal ? 'Create Product' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Test Modal */}
      {showTestModal && selectedProduct && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl w-full max-w-5xl max-h-[90vh] overflow-hidden border border-slate-700">
            <div className="p-6 border-b border-slate-700/50 flex items-center justify-between">
              <div>
                <h3 className="text-xl font-bold text-white">Test: {selectedProduct.name}</h3>
                <p className="text-sm text-gray-400">Configure parameters and run Design Automation</p>
              </div>
              <button
                onClick={() => setShowTestModal(false)}
                className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors"
              >
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>
            
            <div className="flex h-[calc(90vh-140px)]">
              {/* Parameters Panel */}
              <div className="w-80 border-r border-slate-700/50 p-4 overflow-y-auto">
                <h4 className="font-semibold text-white mb-4">Parameters</h4>
                
                {selectedProduct.parameters.length === 0 ? (
                  <p className="text-gray-500 text-sm">No parameters configured for this product.</p>
                ) : (
                  <div className="space-y-4">
                    {selectedProduct.parameters.map((param, index) => (
                      <div key={index}>
                        <label className="block text-sm font-medium text-gray-400 mb-1">
                          {param.displayName || param.name}
                          {param.unit && <span className="text-gray-500 ml-1">({param.unit})</span>}
                        </label>
                        {param.type === 'number' && (
                          <div>
                            <input
                              type="number"
                              min={param.min}
                              max={param.max}
                              step={param.step || 1}
                              value={testParams[param.name] ?? param.defaultValue}
                              onChange={(e) => setTestParams(prev => ({ 
                                ...prev, 
                                [param.name]: parseFloat(e.target.value) 
                              }))}
                              className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                            />
                            {param.min !== undefined && param.max !== undefined && (
                              <input
                                type="range"
                                min={param.min}
                                max={param.max}
                                step={param.step || 1}
                                value={testParams[param.name] ?? param.defaultValue}
                                onChange={(e) => setTestParams(prev => ({ 
                                  ...prev, 
                                  [param.name]: parseFloat(e.target.value) 
                                }))}
                                className="w-full mt-2 accent-orange-500"
                              />
                            )}
                          </div>
                        )}
                        {param.type === 'text' && (
                          <input
                            type="text"
                            value={testParams[param.name] ?? param.defaultValue}
                            onChange={(e) => setTestParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                          />
                        )}
                        {param.type === 'select' && (
                          <select
                            value={testParams[param.name] ?? param.defaultValue}
                            onChange={(e) => setTestParams(prev => ({ ...prev, [param.name]: e.target.value }))}
                            className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-white"
                          >
                            {param.options?.map(opt => (
                              <option key={opt} value={opt}>{opt}</option>
                            ))}
                          </select>
                        )}
                        {param.type === 'boolean' && (
                          <label className="flex items-center gap-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={testParams[param.name] ?? param.defaultValue}
                              onChange={(e) => setTestParams(prev => ({ ...prev, [param.name]: e.target.checked }))}
                              className="w-5 h-5 rounded border-slate-600 bg-slate-800 text-orange-500"
                            />
                            <span className="text-white">Enabled</span>
                          </label>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 space-y-3">
                  <button
                    onClick={handleRunTest}
                    disabled={testRunning || selectedProduct.parameters.length === 0}
                    className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                  >
                    {testRunning ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Running...
                      </>
                    ) : (
                      <>
                        <Play className="w-5 h-5" />
                        Run Test
                      </>
                    )}
                  </button>
                </div>

                {/* Status */}
                {testStatus && (
                  <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700/50">
                    <p className="text-sm text-gray-400 font-mono">{testStatus}</p>
                  </div>
                )}
              </div>

              {/* Preview Panel */}
              <div className="flex-1 bg-slate-950 flex items-center justify-center">
                {testUrn ? (
                  <div className="w-full h-full">
                    {/* Autodesk Viewer would go here */}
                    <div className="w-full h-full flex items-center justify-center">
                      <div className="text-center">
                        <CheckCircle className="w-16 h-16 text-green-400 mx-auto mb-4" />
                        <p className="text-white font-semibold">Model Generated!</p>
                        <p className="text-gray-400 text-sm mt-2">URN: {testUrn.substring(0, 30)}...</p>
                        <p className="text-gray-500 text-xs mt-4">
                          View the model in OSS Buckets viewer
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center">
                    <Eye className="w-16 h-16 text-gray-600 mx-auto mb-4" />
                    <p className="text-gray-500">Configure parameters and run a test</p>
                    <p className="text-gray-600 text-sm mt-2">The 3D preview will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
