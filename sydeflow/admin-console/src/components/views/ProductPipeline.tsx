'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  Package, FileCode, Settings, DollarSign, Eye, Save,
  ChevronRight, ChevronLeft, Check, Upload, RefreshCw,
  Loader2, Plus, Trash2, GripVertical, AlertCircle,
  Box, Sliders, X, Edit, Play, Clock, TestTube, Rocket,
  Sparkles, Download, Search, Filter
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import type {
  ConfigurableProduct,
  ParameterConfig,
  ExtractedParameter,
  PipelineStep,
} from '../../types/product';

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  ossBucket?: string;
  ossObjectKey?: string;
  activityId: string;
  status: 'draft' | 'testing' | 'published';
  parameters: ParameterConfig[];
  pricing?: {
    basePrice: number;
    currency: string;
    setupFee?: number;
  };
  automation?: {
    activityId: string;
    outputFormat: string;
    additionalOutputs?: string[];
  };
  sourceFile?: {
    bucketKey: string;
    objectKey: string;
    fileName: string;
    fileSize: number;
  };
  createdAt?: string;
  updatedAt?: string;
}

// ============================================================================
// PIPELINE STEPS CONFIGURATION
// ============================================================================

const PIPELINE_STEPS: { id: PipelineStep; label: string; icon: React.ReactNode }[] = [
  { id: 'product-details', label: 'Product Details', icon: <Package className="w-4 h-4" /> },
  { id: 'file-upload', label: 'Source File', icon: <Upload className="w-4 h-4" /> },
  { id: 'parameter-config', label: 'Parameters', icon: <Sliders className="w-4 h-4" /> },
  { id: 'automation-setup', label: 'Automation', icon: <Settings className="w-4 h-4" /> },
  { id: 'pricing', label: 'Pricing', icon: <DollarSign className="w-4 h-4" /> },
  { id: 'preview', label: 'Preview', icon: <Eye className="w-4 h-4" /> },
];

const statusColors: Record<string, string> = {
  draft: 'bg-gray-500/20 text-gray-400 border-gray-500/30',
  testing: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30',
  published: 'bg-green-500/20 text-green-400 border-green-500/30',
  live: 'bg-green-500/20 text-green-400 border-green-500/30'
};

const statusLabels: Record<string, string> = {
  draft: 'Draft',
  testing: 'Testing',
  published: 'Live',
  live: 'Live'
};

const statusIcons: Record<string, any> = {
  draft: Clock,
  testing: TestTube,
  published: Rocket,
  live: Rocket
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export default function ProductPipeline() {
  // List view state
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  
  // Modal state
  const [showPipelineModal, setShowPipelineModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  
  // Pipeline state
  const [currentStep, setCurrentStep] = useState<PipelineStep>('product-details');
  const [saving, setSaving] = useState(false);
  
  // Product form data
  const [product, setProduct] = useState<Partial<Product>>({
    name: '',
    category: '',
    description: '',
    status: 'draft',
    parameters: [],
    pricing: {
      basePrice: 0,
      currency: 'USD',
    },
    automation: {
      activityId: '',
      outputFormat: 'ipt',
    },
  });

  // Extracted parameters (from Inventor file)
  const [extractedParams, setExtractedParams] = useState<ExtractedParameter[]>([]);
  const [extracting, setExtracting] = useState(false);
  const [extractionStatus, setExtractionStatus] = useState('');
  
  // Extraction setup state (APS Design Automation bundle/activity)
  const [extractionSetupReady, setExtractionSetupReady] = useState<boolean | null>(null);
  const [settingUpExtraction, setSettingUpExtraction] = useState(false);

  // Available options
  const [activities, setActivities] = useState<string[]>([]);
  const [loadingActivities, setLoadingActivities] = useState(false);

  // OSS file selection
  const [buckets, setBuckets] = useState<{ bucketKey: string }[]>([]);
  const [objects, setObjects] = useState<{ objectKey: string; size: number }[]>([]);
  const [selectedBucket, setSelectedBucket] = useState('');
  const [loadingBuckets, setLoadingBuckets] = useState(false);
  const [loadingObjects, setLoadingObjects] = useState(false);

  // Socket ref for parameter extraction
  const socketRef = useRef<Socket | null>(null);

  // Load products on mount
  useEffect(() => {
    fetchProducts();
  }, []);

  // Socket.IO setup for parameter extraction
  useEffect(() => {
    socketRef.current = io('http://localhost:8080');

    socketRef.current.on('connect', () => {
      console.log('Socket connected:', socketRef.current?.id);
    });

    socketRef.current.on('extractionProgress', (data: { status: string; progress?: string }) => {
      setExtractionStatus(`Extracting: ${data.status} ${data.progress || ''}`);
    });

    socketRef.current.on('extractionComplete', (data: { success: boolean; parameters?: any[]; error?: string }) => {
      setExtracting(false);
      if (data.success && data.parameters) {
        setExtractionStatus(`Found ${data.parameters.length} parameters!`);
        // Convert to ParameterConfig format
        const paramConfigs: ParameterConfig[] = data.parameters.map((p: any) => ({
          inventorName: p.name,
          inventorType: p.type || 'number',
          displayName: formatParamName(p.name),
          controlType: inferControlType(p),
          defaultValue: p.value ?? p.defaultValue ?? 0,
          unit: p.unit,
          validation: {
            required: false,
            min: typeof p.value === 'number' ? 0 : undefined,
            max: typeof p.value === 'number' ? (p.value || 100) * 10 : undefined,
          },
          exposed: p.isKey ?? true,
        }));
        setProduct(prev => ({ ...prev, parameters: paramConfigs }));
      } else {
        setExtractionStatus(`Extraction failed: ${data.error || 'Unknown error'}`);
      }
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Fetch products from API
  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || data || []);
      }
    } catch (err) {
      console.error('Failed to load products:', err);
    }
    setLoading(false);
  };

  const loadActivities = async () => {
    setLoadingActivities(true);
    try {
      const res = await fetch('/api/aps/designautomation/activities');
      if (res.ok) {
        const data = await res.json();
        setActivities(data || []);
      }
    } catch (err) {
      console.error('Failed to load activities:', err);
    }
    setLoadingActivities(false);
  };

  const loadBuckets = async () => {
    setLoadingBuckets(true);
    try {
      const res = await fetch('/api/oss/buckets');
      if (res.ok) {
        const data = await res.json();
        console.log('Buckets response:', data);
        setBuckets(data || []);
      } else {
        console.error('Failed to load buckets:', res.status, await res.text());
      }
    } catch (err) {
      console.error('Failed to load buckets:', err);
    }
    setLoadingBuckets(false);
  };

  const loadObjects = async (bucketKey: string) => {
    setLoadingObjects(true);
    try {
      const res = await fetch(`/api/oss/buckets/${bucketKey}/objects`);
      if (res.ok) {
        const data = await res.json();
        const allObjects = data.items || data || [];
        // Filter for Inventor files
        const inventorFiles = allObjects.filter((obj: any) => 
          obj.objectKey?.endsWith('.ipt') || obj.objectKey?.endsWith('.iam')
        );
        setObjects(inventorFiles);
      }
    } catch (err) {
      console.error('Failed to load objects:', err);
    }
    setLoadingObjects(false);
  };

  // Check if extraction bundle/activity are set up in APS
  const checkExtractionSetup = async () => {
    try {
      const res = await fetch('/api/extract-parameters/status');
      if (res.ok) {
        const data = await res.json();
        setExtractionSetupReady(data.ready === true);
      } else {
        setExtractionSetupReady(false);
      }
    } catch (err) {
      console.error('Failed to check extraction setup:', err);
      setExtractionSetupReady(false);
    }
  };

  // Auto-setup extraction bundle and activity in APS Design Automation
  const setupExtractionAutomation = async () => {
    setSettingUpExtraction(true);
    setExtractionStatus('Setting up extraction automation...');
    try {
      const res = await fetch('/api/extract-parameters/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      const data = await res.json();
      
      if (res.ok && data.success) {
        setExtractionSetupReady(true);
        setExtractionStatus('✓ Extraction automation ready!');
      } else {
        setExtractionStatus(`Setup failed: ${data.error || 'Unknown error'}`);
      }
    } catch (err) {
      console.error('Failed to setup extraction:', err);
      setExtractionStatus('Failed to setup extraction automation');
    }
    setSettingUpExtraction(false);
  };

  // Open pipeline modal for new product
  const openCreatePipeline = () => {
    setEditingProduct(null);
    setProduct({
      name: '',
      category: '',
      description: '',
      status: 'draft',
      parameters: [],
      pricing: { basePrice: 0, currency: 'USD' },
      automation: { activityId: '', outputFormat: 'ipt' },
    });
    setCurrentStep('product-details');
    setSelectedBucket('');
    setObjects([]);
    setExtractionStatus('');
    setExtractionSetupReady(null);
    setShowPipelineModal(true);
    loadActivities();
    loadBuckets();
    checkExtractionSetup(); // Check if extraction automation is ready
  };

  // Open pipeline modal for editing existing product
  const openEditPipeline = (prod: Product) => {
    setEditingProduct(prod);
    setProduct({
      ...prod,
      pricing: prod.pricing || { basePrice: 0, currency: 'USD' },
      automation: prod.automation || { activityId: prod.activityId || '', outputFormat: 'ipt' },
    });
    setCurrentStep('product-details');
    setSelectedBucket(prod.sourceFile?.bucketKey || prod.ossBucket || '');
    setExtractionStatus('');
    setShowPipelineModal(true);
    loadActivities();
    loadBuckets();
    if (prod.sourceFile?.bucketKey || prod.ossBucket) {
      loadObjects(prod.sourceFile?.bucketKey || prod.ossBucket || '');
    }
  };

  // Close pipeline modal
  const closePipeline = () => {
    setShowPipelineModal(false);
    setEditingProduct(null);
  };

  // Extract parameters from selected Inventor file
  const extractParameters = async () => {
    const bucketKey = product.sourceFile?.bucketKey || selectedBucket;
    const objectKey = product.sourceFile?.objectKey;
    
    if (!bucketKey || !objectKey) {
      return;
    }

    setExtracting(true);
    setExtractionStatus('Starting parameter extraction...');
    
    try {
      // Try simple extraction first (doesn't require Design Automation activity)
      const res = await fetch('/api/extract-parameters-simple', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ossBucket: bucketKey,
          ossObjectKey: objectKey,
          browserConnectionId: socketRef.current?.id,
        }),
      });

      const data = await res.json();
      
      if (res.ok && data.success) {
        // Simple extraction worked - update parameters directly
        setExtractionStatus(`Found ${data.parameters?.length || 0} parameters from ${data.source || 'file'}`);
        setProduct(prev => ({
          ...prev,
          parameters: data.parameters || [],
        }));
        setExtracting(false);
      } else if (res.ok) {
        // Extraction started via Design Automation, wait for socket events
        setExtractionStatus(data.message || 'Extraction started, waiting for results...');
      } else {
        setExtractionStatus(`Failed: ${data.diagnostic || data.message || 'Unknown error'}`);
        setExtracting(false);
      }
    } catch (err) {
      console.error('Failed to extract parameters:', err);
      setExtractionStatus('Failed to start extraction');
      setExtracting(false);
    }
  };

  // Helper: Format parameter name for display
  const formatParamName = (name: string): string => {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .trim()
      .replace(/\s+/g, ' ')
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ');
  };

  // Helper: Infer control type from parameter
  const inferControlType = (param: any): ParameterConfig['controlType'] => {
    if (typeof param.value === 'boolean') return 'checkbox';
    if (typeof param.value === 'number') return 'slider';
    return 'text';
  };

  // Update parameter config
  const updateParameter = (index: number, updates: Partial<ParameterConfig>) => {
    setProduct(prev => {
      const params = [...(prev.parameters || [])];
      params[index] = { ...params[index], ...updates };
      return { ...prev, parameters: params };
    });
  };

  // Navigation
  const currentStepIndex = PIPELINE_STEPS.findIndex(s => s.id === currentStep);
  const canGoNext = currentStepIndex < PIPELINE_STEPS.length - 1;
  const canGoPrev = currentStepIndex > 0;

  const goNext = () => {
    if (canGoNext) {
      setCurrentStep(PIPELINE_STEPS[currentStepIndex + 1].id);
    }
  };

  const goPrev = () => {
    if (canGoPrev) {
      setCurrentStep(PIPELINE_STEPS[currentStepIndex - 1].id);
    }
  };

  // Save product
  const saveProduct = async (status?: 'draft' | 'testing' | 'published') => {
    setSaving(true);
    try {
      const productData = {
        ...product,
        status: status || product.status || 'draft',
        activityId: product.automation?.activityId,
        ossBucket: product.sourceFile?.bucketKey || selectedBucket,
        ossObjectKey: product.sourceFile?.objectKey,
      };

      const endpoint = editingProduct 
        ? `/api/products/${editingProduct.id}` 
        : '/api/products';
      
      const res = await fetch(endpoint, {
        method: editingProduct ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(productData),
      });

      if (res.ok) {
        await fetchProducts();
        closePipeline();
      }
    } catch (err) {
      console.error('Failed to save product:', err);
    }
    setSaving(false);
  };

  // Delete product
  const deleteProduct = async (id: string) => {
    const confirmed = window.confirm('Are you sure you want to delete this product? This action cannot be undone.');
    if (!confirmed) return;
    
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) {
        await fetchProducts();
      } else {
        const error = await res.json();
        alert('Failed to delete: ' + (error.diagnostic || 'Unknown error'));
      }
    } catch (err) {
      console.error('Failed to delete product:', err);
      alert('Failed to delete product');
    }
  };

  // Update product status directly
  const updateProductStatus = async (id: string, newStatus: 'draft' | 'testing' | 'published') => {
    try {
      const res = await fetch(`/api/products/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        await fetchProducts();
      }
    } catch (err) {
      console.error('Failed to update product status:', err);
    }
  };

  // Filter products
  const filteredProducts = products.filter(p => {
    const matchesSearch = !searchQuery || 
      p.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  // ============================================================================
  // RENDER STEP CONTENT
  // ============================================================================

  const renderStepContent = () => {
    switch (currentStep) {
      case 'product-details':
        return renderProductDetails();
      case 'file-upload':
        return renderFileUpload();
      case 'parameter-config':
        return renderParameterConfig();
      case 'automation-setup':
        return renderAutomationSetup();
      case 'pricing':
        return renderPricing();
      case 'preview':
        return renderPreview();
      default:
        return null;
    }
  };

  // Step 1: Product Details
  const renderProductDetails = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Product Information</h3>
        <p className="text-sm text-gray-400 mb-6">
          Enter basic information about your configurable product.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Product Name *
          </label>
          <input
            type="text"
            value={product.name || ''}
            onChange={(e) => setProduct(prev => ({ ...prev, name: e.target.value }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            placeholder="e.g., Custom Steel Bracket"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Category *
          </label>
          <select
            value={product.category || ''}
            onChange={(e) => setProduct(prev => ({ ...prev, category: e.target.value }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            title="Product Category"
          >
            <option value="">Select category...</option>
            <option value="brackets">Brackets & Mounts</option>
            <option value="enclosures">Enclosures</option>
            <option value="frames">Frames & Structures</option>
            <option value="custom">Custom Parts</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Description
        </label>
        <textarea
          value={product.description || ''}
          onChange={(e) => setProduct(prev => ({ ...prev, description: e.target.value }))}
          rows={4}
          className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          placeholder="Describe the product and its configurable features..."
        />
      </div>
    </div>
  );

  // Step 2: File Upload/Selection
  const renderFileUpload = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Source CAD File</h3>
        <p className="text-sm text-gray-400 mb-6">
          Select the Inventor file (.ipt or .iam) that will be used as the base for this configurable product.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            OSS Bucket
          </label>
          <select
            value={selectedBucket}
            onChange={(e) => {
              setSelectedBucket(e.target.value);
              setProduct(prev => ({
                ...prev,
                sourceFile: { ...prev.sourceFile, bucketKey: e.target.value } as any,
              }));
              if (e.target.value) {
                loadObjects(e.target.value);
              }
            }}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={loadingBuckets}
            title="OSS Bucket"
          >
            <option value="">Select bucket...</option>
            {buckets.map(b => (
              <option key={b.bucketKey} value={b.bucketKey}>{b.bucketKey}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Inventor File
          </label>
          <select
            value={product.sourceFile?.objectKey || ''}
            onChange={(e) => {
              const obj = objects.find(o => o.objectKey === e.target.value);
              setProduct(prev => ({
                ...prev,
                sourceFile: {
                  bucketKey: selectedBucket,
                  objectKey: e.target.value,
                  fileName: e.target.value,
                  fileSize: obj?.size || 0,
                },
              }));
            }}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={loadingObjects || !selectedBucket}
            title="Inventor File"
          >
            <option value="">Select file...</option>
            {objects.map(o => (
              <option key={o.objectKey} value={o.objectKey}>
                {o.objectKey} ({(o.size / 1024).toFixed(1)} KB)
              </option>
            ))}
          </select>
        </div>
      </div>

      {product.sourceFile?.objectKey && (
        <div className="p-4 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-3">
            <Box className="w-8 h-8 text-green-400" />
            <div>
              <p className="font-medium text-green-300">{product.sourceFile.fileName}</p>
              <p className="text-sm text-green-400/70">
                Ready to extract parameters
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );

  // Step 3: Parameter Configuration
  const renderParameterConfig = () => (
    <div className="space-y-6">
      {/* Extraction Setup Status Banner */}
      {extractionSetupReady === false && (
        <div className="p-4 bg-yellow-500/10 border border-yellow-500/30 rounded-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-yellow-400" />
              <div>
                <p className="font-medium text-yellow-300">Extraction Setup Required</p>
                <p className="text-sm text-yellow-400/70">
                  The parameter extraction automation needs to be configured in APS Design Automation.
                </p>
              </div>
            </div>
            <button
              onClick={setupExtractionAutomation}
              disabled={settingUpExtraction}
              className="flex items-center gap-2 px-4 py-2 bg-yellow-500 text-black rounded-lg hover:bg-yellow-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
            >
              {settingUpExtraction ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Settings className="w-4 h-4" />
              )}
              {settingUpExtraction ? 'Setting Up...' : 'Auto Setup'}
            </button>
          </div>
        </div>
      )}

      {extractionSetupReady === true && (
        <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
          <div className="flex items-center gap-2 text-green-400 text-sm">
            <Check className="w-4 h-4" />
            <span>Extraction automation ready</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white mb-1">Parameter Configuration</h3>
          <p className="text-sm text-gray-400">
            Extract and configure which parameters customers can modify.
          </p>
        </div>
        <button
          onClick={extractParameters}
          disabled={extracting || !product.sourceFile?.objectKey}
          className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {extracting ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Sparkles className="w-4 h-4" />
          )}
          Extract Parameters
        </button>
      </div>

      {extractionStatus && (
        <div className={`p-3 rounded-lg text-sm ${
          extractionStatus.includes('Failed') || extractionStatus.includes('failed')
            ? 'bg-red-500/10 border border-red-500/30 text-red-400'
            : extractionStatus.includes('Found') || extractionStatus.includes('✓')
              ? 'bg-green-500/10 border border-green-500/30 text-green-400'
              : 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
        }`}>
          {extractionStatus}
        </div>
      )}

      {(product.parameters?.length || 0) === 0 ? (
        <div className="text-center py-12 bg-slate-800/50 rounded-lg border-2 border-dashed border-slate-600">
          <Sliders className="w-12 h-12 text-gray-500 mx-auto mb-4" />
          <p className="text-gray-400 mb-2">No parameters configured</p>
          <p className="text-sm text-gray-500">
            Click "Extract Parameters" to read parameters from the Inventor file
          </p>
        </div>
      ) : (
        <div className="space-y-3 max-h-[400px] overflow-y-auto">
          {product.parameters?.map((param, index) => (
            <div
              key={index}
              className={`p-4 border rounded-lg ${
                param.exposed 
                  ? 'border-orange-500/30 bg-orange-500/5' 
                  : 'border-slate-600 bg-slate-800/50'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex items-center gap-2 text-gray-500">
                  <GripVertical className="w-4 h-4 cursor-move" />
                </div>

                {/* Expose toggle */}
                <button
                  onClick={() => updateParameter(index, { exposed: !param.exposed })}
                  className={`p-2 rounded ${
                    param.exposed 
                      ? 'bg-orange-500 text-white' 
                      : 'bg-slate-700 text-gray-400'
                  }`}
                  title={param.exposed ? 'Exposed to customers' : 'Hidden from customers'}
                >
                  <Eye className="w-4 h-4" />
                </button>

                {/* Parameter details */}
                <div className="flex-1 grid grid-cols-4 gap-4">
                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Display Name</label>
                    <input
                      type="text"
                      value={param.displayName}
                      onChange={(e) => updateParameter(index, { displayName: e.target.value })}
                      className="w-full px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                      placeholder="Display Name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Inventor Param</label>
                    <input
                      type="text"
                      value={param.inventorName}
                      disabled
                      className="w-full px-3 py-1.5 text-sm bg-slate-800 border border-slate-700 rounded text-gray-400"
                      placeholder="Parameter Name"
                    />
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Control Type</label>
                    <select
                      value={param.controlType}
                      onChange={(e) => updateParameter(index, { controlType: e.target.value as any })}
                      className="w-full px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                      title="Control Type"
                    >
                      <option value="number">Number Input</option>
                      <option value="slider">Slider</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="text">Text Input</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs text-gray-500 mb-1">Default Value</label>
                    <input
                      type={param.controlType === 'checkbox' ? 'checkbox' : 'text'}
                      value={String(param.defaultValue)}
                      onChange={(e) => updateParameter(index, { 
                        defaultValue: param.controlType === 'checkbox' 
                          ? e.target.checked 
                          : param.controlType === 'number' || param.controlType === 'slider'
                            ? parseFloat(e.target.value) || 0
                            : e.target.value
                      })}
                      className="w-full px-3 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                      placeholder="Default"
                    />
                  </div>
                </div>

                {/* Validation */}
                {(param.controlType === 'slider' || param.controlType === 'number') && (
                  <div className="flex gap-2">
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Min</label>
                      <input
                        type="number"
                        value={param.validation?.min ?? ''}
                        onChange={(e) => updateParameter(index, { 
                          validation: { ...param.validation, min: parseFloat(e.target.value) || undefined }
                        })}
                        className="w-20 px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <label className="block text-xs text-gray-500 mb-1">Max</label>
                      <input
                        type="number"
                        value={param.validation?.max ?? ''}
                        onChange={(e) => updateParameter(index, { 
                          validation: { ...param.validation, max: parseFloat(e.target.value) || undefined }
                        })}
                        className="w-20 px-2 py-1.5 text-sm bg-slate-700 border border-slate-600 rounded text-white"
                        placeholder="100"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );

  // Step 4: Automation Setup
  const renderAutomationSetup = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Design Automation</h3>
        <p className="text-sm text-gray-400 mb-6">
          Configure how the product will be processed when customers place orders.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Activity *
          </label>
          <select
            value={product.automation?.activityId || ''}
            onChange={(e) => setProduct(prev => ({
              ...prev,
              automation: { ...prev.automation!, activityId: e.target.value },
            }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            disabled={loadingActivities}
            title="Design Automation Activity"
          >
            <option value="">Select activity...</option>
            {activities.map(a => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <p className="mt-1 text-xs text-gray-500">
            The Design Automation activity that will process this product
          </p>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Output Format
          </label>
          <select
            value={product.automation?.outputFormat || 'ipt'}
            onChange={(e) => setProduct(prev => ({
              ...prev,
              automation: { ...prev.automation!, outputFormat: e.target.value },
            }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            title="Output Format"
          >
            <option value="ipt">Inventor Part (.ipt)</option>
            <option value="iam">Inventor Assembly (.iam)</option>
            <option value="step">STEP (.step)</option>
            <option value="pdf">PDF Drawing (.pdf)</option>
          </select>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-300 mb-2">
          Additional Outputs
        </label>
        <div className="flex flex-wrap gap-2">
          {['step', 'pdf', 'dwg', 'iges'].map(format => (
            <label key={format} className="flex items-center gap-2 px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg cursor-pointer hover:bg-slate-600">
              <input
                type="checkbox"
                checked={product.automation?.additionalOutputs?.includes(format)}
                onChange={(e) => {
                  const current = product.automation?.additionalOutputs || [];
                  const updated = e.target.checked
                    ? [...current, format]
                    : current.filter(f => f !== format);
                  setProduct(prev => ({
                    ...prev,
                    automation: { ...prev.automation!, additionalOutputs: updated },
                  }));
                }}
                className="rounded bg-slate-600 border-slate-500"
              />
              <span className="text-sm text-gray-300">.{format}</span>
            </label>
          ))}
        </div>
      </div>
    </div>
  );

  // Step 5: Pricing
  const renderPricing = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Pricing Configuration</h3>
        <p className="text-sm text-gray-400 mb-6">
          Set base pricing and optional parameter-based price modifiers.
        </p>
      </div>

      <div className="grid grid-cols-3 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Base Price *
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-gray-400">
              $
            </span>
            <input
              type="number"
              value={product.pricing?.basePrice || ''}
              onChange={(e) => setProduct(prev => ({
                ...prev,
                pricing: { ...prev.pricing!, basePrice: parseFloat(e.target.value) || 0 },
              }))}
              className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-r-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Currency
          </label>
          <select
            value={product.pricing?.currency || 'USD'}
            onChange={(e) => setProduct(prev => ({
              ...prev,
              pricing: { ...prev.pricing!, currency: e.target.value },
            }))}
            className="w-full px-4 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
            title="Currency"
          >
            <option value="USD">USD - US Dollar</option>
            <option value="EUR">EUR - Euro</option>
            <option value="GBP">GBP - British Pound</option>
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-300 mb-2">
            Setup Fee
          </label>
          <div className="flex">
            <span className="inline-flex items-center px-3 bg-slate-700 border border-r-0 border-slate-600 rounded-l-lg text-gray-400">
              $
            </span>
            <input
              type="number"
              value={product.pricing?.setupFee || ''}
              onChange={(e) => setProduct(prev => ({
                ...prev,
                pricing: { ...prev.pricing!, setupFee: parseFloat(e.target.value) || 0 },
              }))}
              className="flex-1 px-4 py-2 bg-slate-700 border border-slate-600 rounded-r-lg text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
              placeholder="0.00"
            />
          </div>
        </div>
      </div>

      {/* Parameter-based pricing */}
      {(product.parameters?.filter(p => p.exposed).length || 0) > 0 && (
        <div className="border-t border-slate-700 pt-6">
          <h4 className="font-medium text-white mb-4">Parameter Price Modifiers</h4>
          <div className="space-y-2">
            {product.parameters?.filter(p => p.exposed).map((param, index) => (
              <div key={index} className="flex items-center gap-4 p-3 bg-slate-800/50 rounded-lg">
                <span className="font-medium text-gray-300 w-32">{param.displayName}</span>
                <select
                  value={param.priceModifier?.type || 'none'}
                  onChange={(e) => {
                    const paramIndex = product.parameters?.findIndex(p => p.inventorName === param.inventorName);
                    if (paramIndex !== undefined && paramIndex >= 0) {
                      updateParameter(paramIndex, { 
                        priceModifier: { type: e.target.value as any, value: 0 }
                      });
                    }
                  }}
                  className="px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                  title="Price Modifier Type"
                >
                  <option value="none">No price impact</option>
                  <option value="per-unit">Price per unit</option>
                  <option value="multiplier">Multiplier</option>
                  <option value="fixed">Fixed addition</option>
                </select>
                {param.priceModifier?.type && param.priceModifier.type !== 'none' && (
                  <input
                    type="number"
                    value={param.priceModifier.value || ''}
                    onChange={(e) => {
                      const paramIndex = product.parameters?.findIndex(p => p.inventorName === param.inventorName);
                      if (paramIndex !== undefined && paramIndex >= 0) {
                        updateParameter(paramIndex, { 
                          priceModifier: { ...param.priceModifier!, value: parseFloat(e.target.value) || 0 }
                        });
                      }
                    }}
                    className="w-24 px-3 py-1.5 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                    placeholder="Value"
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  // Step 6: Preview
  const renderPreview = () => (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-semibold text-white mb-4">Preview & Publish</h3>
        <p className="text-sm text-gray-400 mb-6">
          Review your product configuration before publishing.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-6">
        {/* Product Summary */}
        <div className="space-y-4">
          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="font-medium text-white mb-3">Product Details</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Name:</dt>
                <dd className="font-medium text-white">{product.name || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Category:</dt>
                <dd className="font-medium text-white">{product.category || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Source File:</dt>
                <dd className="font-medium text-white">{product.sourceFile?.fileName || '-'}</dd>
              </div>
              <div className="flex justify-between">
                <dt className="text-gray-500">Activity:</dt>
                <dd className="font-medium text-white">{product.automation?.activityId || '-'}</dd>
              </div>
            </dl>
          </div>

          <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
            <h4 className="font-medium text-white mb-3">Pricing</h4>
            <dl className="space-y-2 text-sm">
              <div className="flex justify-between">
                <dt className="text-gray-500">Base Price:</dt>
                <dd className="font-medium text-green-400">${product.pricing?.basePrice?.toFixed(2) || '0.00'}</dd>
              </div>
              {product.pricing?.setupFee && (
                <div className="flex justify-between">
                  <dt className="text-gray-500">Setup Fee:</dt>
                  <dd className="font-medium text-white">${product.pricing.setupFee.toFixed(2)}</dd>
                </div>
              )}
            </dl>
          </div>
        </div>

        {/* Exposed Parameters */}
        <div className="p-4 bg-slate-800/50 rounded-lg border border-slate-700">
          <h4 className="font-medium text-white mb-3">
            Customer Parameters ({product.parameters?.filter(p => p.exposed).length || 0})
          </h4>
          <div className="space-y-2 max-h-[200px] overflow-y-auto">
            {product.parameters?.filter(p => p.exposed).map((param, index) => (
              <div key={index} className="flex items-center justify-between p-2 bg-slate-700/50 rounded border border-slate-600">
                <span className="text-sm font-medium text-white">{param.displayName}</span>
                <span className="text-xs text-gray-400">
                  {param.controlType} | {param.unit || 'no unit'}
                </span>
              </div>
            ))}
            {(product.parameters?.filter(p => p.exposed).length || 0) === 0 && (
              <p className="text-sm text-gray-500 text-center py-4">No parameters exposed</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white">Product Automation Pipeline</h2>
          <p className="text-gray-400">Create and manage configurable products with automated workflows</p>
        </div>
        <button
          onClick={openCreatePipeline}
          className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-xl hover:from-orange-600 hover:to-orange-700 transition-all shadow-lg shadow-orange-500/20"
        >
          <Plus className="w-5 h-5" />
          Create Product
        </button>
      </div>

      {/* Search and Filter */}
      <div className="flex items-center gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products..."
            className="w-full pl-10 pr-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          />
        </div>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-4 py-2 bg-slate-800/50 border border-slate-700 rounded-xl text-white focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
          title="Filter by Status"
        >
          <option value="all">All Status</option>
          <option value="draft">Draft</option>
          <option value="testing">Testing</option>
          <option value="published">Published</option>
        </select>
      </div>

      {/* Products Grid */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-orange-500 animate-spin" />
        </div>
      ) : filteredProducts.length === 0 ? (
        <div className="text-center py-12 bg-slate-800/30 rounded-2xl border border-slate-700/50">
          <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-white mb-2">No products found</h3>
          <p className="text-gray-400 mb-6">
            {searchQuery || statusFilter !== 'all' 
              ? 'Try adjusting your search or filters'
              : 'Get started by creating your first configurable product'}
          </p>
          {!searchQuery && statusFilter === 'all' && (
            <button
              onClick={openCreatePipeline}
              className="inline-flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600"
            >
              <Plus className="w-4 h-4" />
              Create Product
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredProducts.map((prod) => {
            const StatusIcon = statusIcons[prod.status] || Clock;
            return (
              <div
                key={prod.id}
                className="bg-slate-800/50 rounded-2xl border border-slate-700/50 overflow-hidden hover:border-orange-500/30 transition-all group"
              >
                {/* Card Header */}
                <div className="p-4 border-b border-slate-700/50">
                  <div className="flex items-start justify-between mb-2">
                    <h3 className="font-semibold text-white group-hover:text-orange-400 transition-colors">
                      {prod.name}
                    </h3>
                    <span className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${statusColors[prod.status] || statusColors.draft}`}>
                      <StatusIcon className="w-3 h-3" />
                      {statusLabels[prod.status] || prod.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 line-clamp-2">{prod.description || 'No description'}</p>
                </div>

                {/* Card Body */}
                <div className="p-4 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Parameters:</span>
                    <span className="text-white font-medium">{prod.parameters?.length || 0}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Category:</span>
                    <span className="text-white font-medium">{prod.category || '-'}</span>
                  </div>
                  {prod.pricing && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-gray-500">Base Price:</span>
                      <span className="text-green-400 font-medium">${prod.pricing.basePrice?.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Created:</span>
                    <span className="text-gray-400 font-medium">
                      {prod.createdAt 
                        ? new Date(prod.createdAt).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })
                        : '-'}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-500">Last Edited:</span>
                    <span className="text-gray-400 font-medium">
                      {prod.updatedAt 
                        ? new Date(prod.updatedAt).toLocaleString('en-US', { 
                            month: 'short', 
                            day: 'numeric', 
                            year: 'numeric',
                            hour: 'numeric',
                            minute: '2-digit',
                            hour12: true
                          })
                        : '-'}
                    </span>
                  </div>
                </div>

                {/* Card Actions */}
                <div className="p-4 border-t border-slate-700/50 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => deleteProduct(prod.id)}
                      className="p-2 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    <select
                      value={prod.status}
                      onChange={(e) => updateProductStatus(prod.id, e.target.value as 'draft' | 'testing' | 'published')}
                      className="px-2 py-1.5 text-xs bg-slate-700 border border-slate-600 rounded-lg text-gray-300 cursor-pointer hover:bg-slate-600 focus:ring-2 focus:ring-orange-500 focus:border-orange-500"
                      title="Change Status"
                    >
                      <option value="draft">Draft</option>
                      <option value="testing">Testing</option>
                      <option value="published">Live</option>
                    </select>
                  </div>
                  <button
                    onClick={() => openEditPipeline(prod)}
                    className="flex items-center gap-1 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                  >
                    <Settings className="w-4 h-4" />
                    Configure
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pipeline Modal */}
      {showPipelineModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-5xl max-h-[90vh] bg-slate-900 rounded-2xl border border-slate-700 shadow-2xl flex flex-col">
            {/* Modal Header */}
            <div className="flex items-center justify-between p-4 border-b border-slate-700">
              <div>
                <h2 className="text-xl font-bold text-white">
                  {editingProduct ? 'Edit Product' : 'Create New Product'}
                </h2>
                <p className="text-sm text-gray-400">
                  Step {currentStepIndex + 1} of {PIPELINE_STEPS.length}: {PIPELINE_STEPS[currentStepIndex].label}
                </p>
              </div>
              <button
                onClick={closePipeline}
                className="p-2 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex flex-1 overflow-hidden">
              {/* Step Navigation */}
              <div className="w-56 bg-slate-800/50 border-r border-slate-700 p-4">
                <nav className="space-y-1">
                  {PIPELINE_STEPS.map((step, index) => {
                    const isActive = step.id === currentStep;
                    const isPast = index < currentStepIndex;
                    
                    return (
                      <button
                        key={step.id}
                        onClick={() => setCurrentStep(step.id)}
                        className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                          isActive 
                            ? 'bg-orange-500/20 text-orange-400 border border-orange-500/30' 
                            : isPast
                              ? 'text-green-400 hover:bg-slate-700/50'
                              : 'text-gray-400 hover:bg-slate-700/50'
                        }`}
                      >
                        <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-medium ${
                          isActive
                            ? 'bg-orange-500 text-white'
                            : isPast
                              ? 'bg-green-500 text-white'
                              : 'bg-slate-600 text-gray-400'
                        }`}>
                          {isPast ? <Check className="w-3 h-3" /> : index + 1}
                        </div>
                        <span className="text-sm font-medium">{step.label}</span>
                      </button>
                    );
                  })}
                </nav>
              </div>

              {/* Step Content */}
              <div className="flex-1 p-6 overflow-y-auto">
                {renderStepContent()}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-between p-4 border-t border-slate-700">
              <button
                onClick={goPrev}
                disabled={!canGoPrev}
                className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-gray-300 rounded-lg hover:bg-slate-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
                Previous
              </button>

              <div className="flex items-center gap-3">
                <button
                  onClick={() => saveProduct('draft')}
                  disabled={saving}
                  className="flex items-center gap-2 px-4 py-2 border border-slate-600 text-gray-300 rounded-lg hover:bg-slate-700 disabled:opacity-50"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  Save Draft
                </button>

                {currentStep === 'preview' ? (
                  <>
                    <button
                      onClick={() => saveProduct('testing')}
                      disabled={saving}
                      className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 border border-yellow-500/30 text-yellow-400 rounded-lg hover:bg-yellow-500/30 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <TestTube className="w-4 h-4" />}
                      Save as Test
                    </button>
                    <button
                      onClick={() => saveProduct('published')}
                      disabled={saving}
                      className="flex items-center gap-2 px-6 py-2 bg-gradient-to-r from-orange-500 to-orange-600 text-white rounded-lg hover:from-orange-600 hover:to-orange-700 disabled:opacity-50"
                    >
                      {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                      Go Live
                    </button>
                  </>
                ) : (
                  <button
                    onClick={goNext}
                    disabled={!canGoNext}
                    className="flex items-center gap-2 px-4 py-2 bg-orange-500 text-white rounded-lg hover:bg-orange-600 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Next
                    <ChevronRight className="w-4 h-4" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
