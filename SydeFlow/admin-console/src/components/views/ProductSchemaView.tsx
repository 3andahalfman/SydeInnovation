'use client';

import { useState, useEffect } from 'react';
import {
  Package, Trash2, Copy, Settings, Play,
  Ruler, Layers, Palette, DollarSign,
  ChevronRight, ChevronDown, AlertCircle, CheckCircle,
  Loader2, FileJson, Code, Box, Grid3x3, X,
  Cog, Download, Zap, FileCode, Anchor, DoorOpen
} from 'lucide-react';

// Types
interface ParameterOption {
  value: string;
  label: string;
  hex?: string;
  priceMultiplier?: number;
  priceAdd?: number;
  default?: boolean;
}

interface Parameter {
  id: string;
  label: string;
  inventorParam?: string;
  type: 'slider' | 'select' | 'radio' | 'checkbox' | 'color' | 'number' | 'text';
  min?: number;
  max?: number;
  step?: number;
  default?: string | number | string[];
  unit?: string;
  options?: ParameterOption[];
  group?: string;
  description?: string;
}

interface ParameterGroup {
  id: string;
  label: string;
  order: number;
  icon?: string;
}

interface ProductSchema {
  schemaVersion: string;
  productId: string;
  name: string;
  description: string;
  category: string;
  thumbnail?: string;
  cadModel?: {
    inputFile: string;
    activityId: string;
    engineVersion?: string;
    description?: string;
  };
  parameters: Parameter[];
  parameterGroups: ParameterGroup[];
  rules: any[];
  pricing: any;
  outputs?: any;
  metadata: any;
}

interface SchemaListItem {
  id: string;
  name: string;
  description: string;
  category: string;
  status: string;
  parameterCount: number;
  hasRules: boolean;
  hasPricing: boolean;
  cadModel?: any;
}

interface Toast {
  id: number;
  type: 'success' | 'error' | 'info';
  message: string;
}

export default function ProductSchemaView() {
  const [loading, setLoading] = useState(true);
  const [schemas, setSchemas] = useState<SchemaListItem[]>([]);
  const [selectedSchema, setSelectedSchema] = useState<ProductSchema | null>(null);
  const [activeTab, setActiveTab] = useState<'list' | 'configurator' | 'inventor' | 'json'>('list');
  const [testConfig, setTestConfig] = useState<Record<string, any>>({});
  const [priceResult, setPriceResult] = useState<any>(null);
  const [validationResult, setValidationResult] = useState<any>(null);
  const [inventorParams, setInventorParams] = useState<any>(null);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(['dimensions']));
  const [toasts, setToasts] = useState<Toast[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [generating, setGenerating] = useState(false);

  const addToast = (type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  };

  useEffect(() => {
    fetchSchemas();
  }, []);

  const fetchSchemas = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/schemas');
      if (res.ok) {
        const data = await res.json();
        setSchemas(data);
      } else {
        addToast('error', 'Failed to load schemas');
      }
    } catch (error) {
      console.error('Error fetching schemas:', error);
      addToast('error', 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  };

  const loadSchema = async (id: string) => {
    try {
      const res = await fetch(`/api/schemas/${id}`);
      if (res.ok) {
        const schema = await res.json();
        setSelectedSchema(schema);
        initializeConfig(schema);
        setActiveTab('configurator');
        // Expand all groups by default
        const groups = new Set<string>(schema.parameterGroups?.map((g: ParameterGroup) => g.id) || ['dimensions']);
        setExpandedGroups(groups);
      }
    } catch (error) {
      console.error('Error loading schema:', error);
      addToast('error', 'Failed to load schema');
    }
  };

  const initializeConfig = (schema: ProductSchema) => {
    const config: Record<string, any> = {};
    for (const param of schema.parameters) {
      if (param.type === 'checkbox') {
        const defaults = param.options?.filter(o => o.default).map(o => o.value) || [];
        config[param.id] = defaults;
      } else if (param.default !== undefined) {
        config[param.id] = param.default;
      } else if (param.options) {
        const defaultOpt = param.options.find(o => o.default);
        config[param.id] = defaultOpt?.value || param.options[0]?.value;
      } else if (param.min !== undefined) {
        config[param.id] = param.min;
      }
    }
    setTestConfig(config);
    setPriceResult(null);
    setValidationResult(null);
    setInventorParams(null);
  };

  // Recalculate when config changes
  useEffect(() => {
    if (selectedSchema && Object.keys(testConfig).length > 0) {
      calculatePrice();
      validateConfig();
      getInventorParams();
    }
  }, [testConfig, selectedSchema, quantity]);

  const calculatePrice = async () => {
    if (!selectedSchema) return;
    try {
      const res = await fetch(`/api/schemas/${selectedSchema.productId}/calculate-price`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configuration: testConfig, quantity })
      });
      if (res.ok) {
        const result = await res.json();
        setPriceResult(result);
      }
    } catch (error) {
      console.error('Error calculating price:', error);
    }
  };

  const validateConfig = async () => {
    if (!selectedSchema) return;
    try {
      const res = await fetch(`/api/schemas/${selectedSchema.productId}/validate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configuration: testConfig })
      });
      if (res.ok) {
        const result = await res.json();
        setValidationResult(result);
      }
    } catch (error) {
      console.error('Error validating config:', error);
    }
  };

  const getInventorParams = async () => {
    if (!selectedSchema) return;
    try {
      const res = await fetch(`/api/schemas/${selectedSchema.productId}/inventor-params`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ configuration: testConfig })
      });
      if (res.ok) {
        const result = await res.json();
        setInventorParams(result);
      }
    } catch (error) {
      console.error('Error getting Inventor params:', error);
    }
  };

  const generateModel = async () => {
    if (!selectedSchema) return;
    setGenerating(true);
    try {
      const res = await fetch(`/api/schemas/${selectedSchema.productId}/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          configuration: testConfig,
          outputFormat: 'ipt'
        })
      });
      if (res.ok) {
        const result = await res.json();
        addToast('success', `Configuration saved! ID: ${result.configurationId}`);
        console.log('Generation result:', result);
      } else {
        const error = await res.json();
        addToast('error', error.error || 'Failed to generate');
      }
    } catch (error) {
      console.error('Error generating model:', error);
      addToast('error', 'Failed to generate model');
    } finally {
      setGenerating(false);
    }
  };

  const updateConfigValue = (paramId: string, value: any) => {
    setTestConfig(prev => ({ ...prev, [paramId]: value }));
  };

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const getParamsByGroup = (groupId: string) => {
    return selectedSchema?.parameters.filter(p => p.group === groupId) || [];
  };

  const getGroupIcon = (iconName?: string) => {
    const icons: Record<string, React.ReactNode> = {
      'Ruler': <Ruler className="w-4 h-4" />,
      'Layers': <Layers className="w-4 h-4" />,
      'Palette': <Palette className="w-4 h-4" />,
      'Settings': <Settings className="w-4 h-4" />,
      'Box': <Box className="w-4 h-4" />,
      'Grid3x3': <Grid3x3 className="w-4 h-4" />,
      'DoorOpen': <DoorOpen className="w-4 h-4" />,
      'Anchor': <Anchor className="w-4 h-4" />,
      'Cog': <Cog className="w-4 h-4" />,
    };
    return icons[iconName || ''] || <Settings className="w-4 h-4" />;
  };

  const isParamHidden = (paramId: string) => {
    return validationResult?.adjustedLimits?.[paramId]?.hidden;
  };

  const getDisabledOptions = (paramId: string) => {
    return validationResult?.adjustedLimits?.[paramId]?.disabled || [];
  };

  const renderParameterInput = (param: Parameter) => {
    if (isParamHidden(param.id)) return null;
    
    const value = testConfig[param.id];
    const isDisabled = getDisabledOptions(param.id);
    const limits = validationResult?.adjustedLimits?.[param.id] || {};

    switch (param.type) {
      case 'slider':
        const min = limits.min ?? param.min ?? 0;
        const max = limits.max ?? param.max ?? 100;
        return (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">{min}{param.unit}</span>
              <span className="text-orange-400 font-medium">{value}{param.unit}</span>
              <span className="text-gray-400">{max}{param.unit}</span>
            </div>
            <input
              type="range"
              min={min}
              max={max}
              step={param.step || 1}
              value={value ?? param.default}
              onChange={(e) => updateConfigValue(param.id, parseFloat(e.target.value))}
              className="w-full accent-orange-500"
            />
          </div>
        );

      case 'select':
        return (
          <select
            value={value ?? ''}
            onChange={(e) => updateConfigValue(param.id, e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
          >
            {param.options?.map(opt => (
              <option key={opt.value} value={opt.value} disabled={isDisabled.includes(opt.value)}>
                {opt.label}
                {opt.priceMultiplier && opt.priceMultiplier !== 1 ? ` (${opt.priceMultiplier}x)` : ''}
                {opt.priceAdd ? ` (+$${opt.priceAdd})` : ''}
              </option>
            ))}
          </select>
        );

      case 'radio':
        return (
          <div className="space-y-2">
            {param.options?.map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  value === opt.value ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-700/50 border border-transparent hover:bg-slate-700'
                } ${isDisabled.includes(opt.value) ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <input
                  type="radio"
                  name={param.id}
                  value={opt.value}
                  checked={value === opt.value}
                  onChange={(e) => updateConfigValue(param.id, e.target.value)}
                  disabled={isDisabled.includes(opt.value)}
                  className="accent-orange-500"
                />
                <span className="text-white flex-1">{opt.label}</span>
                {opt.priceAdd ? <span className="text-gray-400 text-sm">+${opt.priceAdd}</span> : null}
                {opt.priceMultiplier && opt.priceMultiplier !== 1 ? <span className="text-gray-400 text-sm">{opt.priceMultiplier}x</span> : null}
              </label>
            ))}
          </div>
        );

      case 'checkbox':
        const selectedValues = Array.isArray(value) ? value : [];
        return (
          <div className="space-y-2">
            {param.options?.map(opt => (
              <label
                key={opt.value}
                className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${
                  selectedValues.includes(opt.value) ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-700/50 border border-transparent hover:bg-slate-700'
                }`}
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(opt.value)}
                  onChange={(e) => {
                    const newValues = e.target.checked
                      ? [...selectedValues, opt.value]
                      : selectedValues.filter(v => v !== opt.value);
                    updateConfigValue(param.id, newValues);
                  }}
                  className="accent-orange-500 w-4 h-4"
                />
                <span className="text-white flex-1">{opt.label}</span>
                {opt.priceAdd ? <span className="text-gray-400 text-sm">+${opt.priceAdd}</span> : null}
              </label>
            ))}
          </div>
        );

      case 'color':
        return (
          <div className="flex flex-wrap gap-2">
            {param.options?.map(opt => (
              <button
                key={opt.value}
                onClick={() => updateConfigValue(param.id, opt.value)}
                className={`relative w-10 h-10 rounded-lg border-2 transition-all ${
                  value === opt.value ? 'border-orange-500 ring-2 ring-orange-500/50' : 'border-slate-600 hover:border-slate-500'
                }`}
                style={{ backgroundColor: opt.hex }}
                title={opt.label}
              >
                {value === opt.value && (
                  <CheckCircle className="absolute -top-1 -right-1 w-4 h-4 text-orange-500 bg-slate-800 rounded-full" />
                )}
              </button>
            ))}
          </div>
        );

      default:
        return (
          <input
            type="text"
            value={value ?? ''}
            onChange={(e) => updateConfigValue(param.id, e.target.value)}
            className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white focus:border-orange-500 focus:outline-none"
          />
        );
    }
  };

  const deleteSchema = async (id: string) => {
    if (!confirm('Are you sure you want to delete this schema?')) return;
    try {
      const res = await fetch(`/api/schemas/${id}`, { method: 'DELETE' });
      if (res.ok) {
        addToast('success', 'Schema deleted');
        fetchSchemas();
        if (selectedSchema?.productId === id) {
          setSelectedSchema(null);
          setActiveTab('list');
        }
      }
    } catch (error) {
      addToast('error', 'Failed to delete schema');
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-white flex items-center gap-3">
            <FileJson className="w-7 h-7 text-orange-500" />
            Product Configuration Schemas
          </h2>
          <p className="text-gray-400 mt-1">Define configurable Inventor products with parameters, rules, and pricing</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => { setActiveTab('list'); setSelectedSchema(null); }}
            className={`px-4 py-2 rounded-lg transition-colors ${
              activeTab === 'list' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
            }`}
          >
            All Schemas
          </button>
          {selectedSchema && (
            <>
              <button
                onClick={() => setActiveTab('configurator')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'configurator' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                Configurator
              </button>
              <button
                onClick={() => setActiveTab('inventor')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'inventor' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                Inventor Params
              </button>
              <button
                onClick={() => setActiveTab('json')}
                className={`px-4 py-2 rounded-lg transition-colors ${
                  activeTab === 'json' ? 'bg-orange-500 text-white' : 'bg-slate-700 text-gray-300 hover:bg-slate-600'
                }`}
              >
                JSON
              </button>
            </>
          )}
        </div>
      </div>

      {/* Schema List */}
      {activeTab === 'list' && (
        <div className="grid gap-4">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
            </div>
          ) : schemas.length === 0 ? (
            <div className="bg-slate-800 rounded-xl p-12 text-center">
              <Package className="w-16 h-16 text-gray-600 mx-auto mb-4" />
              <h3 className="text-xl font-semibold text-white mb-2">No Product Schemas</h3>
              <p className="text-gray-400">Add JSON schema files to server/data/product-schemas/</p>
            </div>
          ) : (
            <div className="grid md:grid-cols-2 gap-4">
              {schemas.map(schema => (
                <div
                  key={schema.id}
                  className="bg-slate-800 rounded-xl p-5 border border-slate-700 hover:border-orange-500/50 transition-colors"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <h3 className="text-lg font-semibold text-white">{schema.name}</h3>
                      <p className="text-sm text-gray-400">{schema.category}</p>
                    </div>
                    <span className={`px-2 py-1 rounded text-xs font-medium ${
                      schema.status === 'active' ? 'bg-green-500/20 text-green-400' :
                      schema.status === 'draft' ? 'bg-yellow-500/20 text-yellow-400' :
                      'bg-gray-500/20 text-gray-400'
                    }`}>
                      {schema.status}
                    </span>
                  </div>
                  <p className="text-sm text-gray-400 mb-4 line-clamp-2">{schema.description}</p>
                  
                  {/* CAD Model Info */}
                  {schema.cadModel && (
                    <div className="mb-4 p-2 bg-slate-700/50 rounded-lg">
                      <div className="flex items-center gap-2 text-xs text-cyan-400">
                        <FileCode className="w-3 h-3" />
                        <span>{schema.cadModel.inputFile}</span>
                      </div>
                    </div>
                  )}
                  
                  <div className="flex items-center gap-4 text-sm text-gray-400 mb-4">
                    <span className="flex items-center gap-1">
                      <Settings className="w-4 h-4" />
                      {schema.parameterCount} params
                    </span>
                    {schema.hasRules && (
                      <span className="flex items-center gap-1">
                        <Code className="w-4 h-4" />
                        Rules
                      </span>
                    )}
                    {schema.hasPricing && (
                      <span className="flex items-center gap-1">
                        <DollarSign className="w-4 h-4" />
                        Pricing
                      </span>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => loadSchema(schema.id)}
                      className="flex-1 px-3 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                    >
                      Open Configurator
                    </button>
                    <button
                      onClick={() => deleteSchema(schema.id)}
                      className="px-3 py-2 bg-slate-700 hover:bg-red-500/20 text-gray-400 hover:text-red-400 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Configurator View */}
      {activeTab === 'configurator' && selectedSchema && (
        <div className="grid lg:grid-cols-3 gap-6">
          {/* Parameter Configuration */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-white">{selectedSchema.name}</h3>
                {selectedSchema.cadModel && (
                  <div className="flex items-center gap-2 px-3 py-1 bg-cyan-500/20 rounded-full">
                    <FileCode className="w-4 h-4 text-cyan-400" />
                    <span className="text-sm text-cyan-400">{selectedSchema.cadModel.inputFile}</span>
                  </div>
                )}
              </div>
              <p className="text-gray-400 text-sm mb-6">{selectedSchema.description}</p>

              {/* Parameter Groups */}
              {selectedSchema.parameterGroups?.sort((a, b) => a.order - b.order).map(group => {
                const params = getParamsByGroup(group.id).filter(p => !isParamHidden(p.id));
                if (params.length === 0) return null;
                
                return (
                  <div key={group.id} className="mb-4">
                    <button
                      onClick={() => toggleGroup(group.id)}
                      className="w-full flex items-center justify-between p-3 bg-slate-700/50 rounded-lg hover:bg-slate-700 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        {getGroupIcon(group.icon)}
                        <span className="font-medium text-white">{group.label}</span>
                        <span className="text-xs text-gray-500">({params.length})</span>
                      </div>
                      {expandedGroups.has(group.id) ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </button>

                    {expandedGroups.has(group.id) && (
                      <div className="mt-3 space-y-4 pl-4 border-l-2 border-slate-700">
                        {params.map(param => (
                          <div key={param.id} className="space-y-2">
                            <label className="flex items-center justify-between">
                              <span className="text-sm font-medium text-white">{param.label}</span>
                              {param.inventorParam && (
                                <span className="text-xs text-cyan-500 font-mono bg-cyan-500/10 px-2 py-0.5 rounded">
                                  {param.inventorParam}
                                </span>
                              )}
                            </label>
                            {param.description && (
                              <p className="text-xs text-gray-500">{param.description}</p>
                            )}
                            {renderParameterInput(param)}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Price & Actions Panel */}
          <div className="space-y-4">
            {/* Quantity */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Quantity</h4>
              <input
                type="number"
                min="1"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                className="w-full bg-slate-700 border border-slate-600 rounded-lg px-3 py-2 text-white text-center text-xl font-bold focus:border-orange-500 focus:outline-none"
              />
            </div>

            {/* Price Display */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Pricing</h4>
              {priceResult ? (
                <div className="space-y-3">
                  <div className="text-3xl font-bold text-orange-500">
                    ${priceResult.totalPrice?.toFixed(2)}
                    <span className="text-lg text-gray-400 font-normal ml-2">{priceResult.currency}</span>
                  </div>
                  {quantity > 1 && (
                    <div className="text-sm text-gray-400">
                      ${priceResult.unitPrice?.toFixed(2)} per unit × {quantity}
                    </div>
                  )}
                  <div className="space-y-1 text-sm pt-2 border-t border-slate-700">
                    <div className="flex justify-between text-gray-400">
                      <span>Base Price</span>
                      <span>${priceResult.breakdown?.basePrice?.toFixed(2)}</span>
                    </div>
                    {priceResult.breakdown?.volumePrice > 0 && (
                      <div className="flex justify-between text-gray-400">
                        <span>Volume</span>
                        <span>${priceResult.breakdown.volumePrice.toFixed(2)}</span>
                      </div>
                    )}
                    {priceResult.breakdown?.surfacePrice > 0 && (
                      <div className="flex justify-between text-gray-400">
                        <span>Surface</span>
                        <span>${priceResult.breakdown.surfacePrice.toFixed(2)}</span>
                      </div>
                    )}
                    {priceResult.breakdown?.materialMultiplier !== 1 && (
                      <div className="flex justify-between text-gray-400">
                        <span>Material</span>
                        <span>{priceResult.breakdown.materialMultiplier}x</span>
                      </div>
                    )}
                    {priceResult.breakdown?.optionPrices > 0 && (
                      <div className="flex justify-between text-gray-400">
                        <span>Options</span>
                        <span>+${priceResult.breakdown.optionPrices.toFixed(2)}</span>
                      </div>
                    )}
                    {priceResult.breakdown?.discountPercent > 0 && (
                      <div className="flex justify-between text-green-400">
                        <span>Discount ({priceResult.breakdown.discountPercent}%)</span>
                        <span>-${priceResult.breakdown.discount.toFixed(2)}</span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="text-gray-500">Calculating...</div>
              )}
            </div>

            {/* Validation */}
            <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Validation</h4>
              {validationResult ? (
                <div className="space-y-3">
                  <div className={`flex items-center gap-2 ${validationResult.valid ? 'text-green-400' : 'text-red-400'}`}>
                    {validationResult.valid ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
                    <span className="font-medium">{validationResult.valid ? 'Valid Configuration' : 'Has Issues'}</span>
                  </div>
                  
                  {validationResult.warnings?.length > 0 && (
                    <div className="space-y-1">
                      {validationResult.warnings.map((warn: any, i: number) => (
                        <div key={i} className="text-sm text-yellow-400 flex items-start gap-2">
                          <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                          {warn.message}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-gray-500">Validating...</div>
              )}
            </div>

            {/* Generate Button */}
            <button
              onClick={generateModel}
              disabled={generating || !validationResult?.valid}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-gradient-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 disabled:from-gray-600 disabled:to-gray-700 text-white rounded-xl font-semibold transition-all"
            >
              {generating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Zap className="w-5 h-5" />
                  Generate Model
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Inventor Parameters View */}
      {activeTab === 'inventor' && selectedSchema && inventorParams && (
        <div className="grid lg:grid-cols-2 gap-6">
          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <FileCode className="w-5 h-5 text-cyan-400" />
                Inventor Parameters
              </h3>
              <button
                onClick={() => {
                  navigator.clipboard.writeText(JSON.stringify(inventorParams.parameters, null, 2));
                  addToast('success', 'Parameters copied to clipboard');
                }}
                className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-gray-300"
              >
                <Copy className="w-4 h-4" />
                Copy
              </button>
            </div>
            <p className="text-gray-400 text-sm mb-4">
              These parameters will be sent to Autodesk Inventor via Design Automation
            </p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-sm">
              {Object.entries(inventorParams.parameters || {}).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 border-b border-slate-800 last:border-0">
                  <span className="text-cyan-400">{key}</span>
                  <span className="text-orange-400">{String(value)}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
            <h3 className="text-lg font-semibold text-white mb-4">CAD Model Info</h3>
            <div className="space-y-3">
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-gray-400">Input File</span>
                <span className="text-white font-mono">{selectedSchema.cadModel?.inputFile}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-gray-400">Activity ID</span>
                <span className="text-white font-mono">{selectedSchema.cadModel?.activityId}</span>
              </div>
              <div className="flex justify-between py-2 border-b border-slate-700">
                <span className="text-gray-400">Engine Version</span>
                <span className="text-white">{selectedSchema.cadModel?.engineVersion || '2025'}</span>
              </div>
            </div>

            <div className="mt-6">
              <h4 className="text-sm font-medium text-gray-400 mb-3">Available Outputs</h4>
              <div className="flex flex-wrap gap-2">
                {selectedSchema.outputs?.['3dModel']?.formats?.map((fmt: string) => (
                  <span key={fmt} className="px-2 py-1 bg-cyan-500/20 text-cyan-400 rounded text-xs font-mono">
                    .{fmt}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* JSON Preview */}
      {activeTab === 'json' && selectedSchema && (
        <div className="bg-slate-800 rounded-xl p-5 border border-slate-700">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-white">Schema JSON</h3>
            <button
              onClick={() => {
                navigator.clipboard.writeText(JSON.stringify(selectedSchema, null, 2));
                addToast('success', 'Schema copied to clipboard');
              }}
              className="flex items-center gap-2 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 rounded-lg text-sm text-gray-300"
            >
              <Copy className="w-4 h-4" />
              Copy
            </button>
          </div>
          <pre className="bg-slate-900 rounded-lg p-4 overflow-auto max-h-[600px] text-sm text-gray-300">
            {JSON.stringify(selectedSchema, null, 2)}
          </pre>
        </div>
      )}

      {/* Toast Notifications */}
      <div className="fixed bottom-4 right-4 z-50 space-y-2">
        {toasts.map(toast => (
          <div
            key={toast.id}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg shadow-lg ${
              toast.type === 'success' ? 'bg-green-500/90 text-white' :
              toast.type === 'error' ? 'bg-red-500/90 text-white' :
              'bg-blue-500/90 text-white'
            }`}
          >
            {toast.type === 'success' ? <CheckCircle className="w-5 h-5" /> :
             toast.type === 'error' ? <AlertCircle className="w-5 h-5" /> :
             <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{toast.message}</span>
            <button onClick={() => setToasts(prev => prev.filter(t => t.id !== toast.id))} className="ml-2 hover:opacity-70">
              <X className="w-4 h-4" />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
