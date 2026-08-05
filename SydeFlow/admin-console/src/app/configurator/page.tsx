'use client';

import { useState, useEffect, useRef, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ArrowLeft, Save, Play, Eye, Loader2, Sliders, 
  Box, Boxes, Zap, RefreshCw, Settings, CheckCircle,
  TestTube, Rocket, LayoutGrid, Palette, MonitorPlay,
  ChevronDown, X, Home, FileText, List, Download, Info,
  Layers, MapPin, Plus, RotateCcw, FolderOpen, Columns,
  Image as ImageIcon, Square, Type, Minus, Trash2,
  HelpCircle, Upload, Database, Check, PlusCircle, DollarSign
} from 'lucide-react';
import { io, Socket } from 'socket.io-client';
import LayoutBuilder from '@/components/configurator/LayoutBuilder';
import CustomerPreview from '@/components/configurator/CustomerPreview';
import TemplatePickerDialog from '@/components/configurator/TemplatePickerDialog';
import type { ConfiguratorLayout, LayoutElement, ControlConfig, TabGroupElement, SectionElement, ParameterElement, GroupElement, RowElement, LabelElement, PictureElement, SplitterElement, EmptySpaceElement, LayoutStyling, ElementStyle, PricingConfig, PricingRule } from '@/types/product';
import { migrateLayoutV1toV2, elementStyleToCSS, CONFIGURATOR_TEMPLATES } from '@/types/product';

// ============================================================================
// TYPES
// ============================================================================

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
  status: 'draft' | 'testing' | 'live';
  thumbnail?: string;
  sourceFile?: {
    bucketKey: string;
    objectKey: string;
    fileName: string;
  };
  activityId?: string;
  parameters: Parameter[];
  lastOutputUrn?: string;
  drawingFile?: {
    bucketKey: string;
    objectKey: string;
    fileName?: string;
    urn?: string;
  };
  createdAt: string;
  updatedAt: string;
  // Extended detail fields
  categories?: string[];
  subcategories?: string[];
  functions?: string[];
  sku?: string;
  quantityPerSku?: number;
  productImage?: string;
  pricing?: PricingConfig;
}

// Default layout - V2 flat canvas
const createDefaultLayout = (parameters: Parameter[]): ConfiguratorLayout => ({
  version: 2,
  children: parameters.map((p, i) => ({
    id: `param-${p.name}`,
    type: 'parameter' as const,
    order: i,
    parameterName: p.name
  })),
  sections: [],
  controls: Object.fromEntries(
    parameters.map(p => [
      p.name,
      {
        controlType: p.type === 'boolean' ? 'toggle' : p.type === 'select' ? 'dropdown' : 'slider-input',
        showLabel: true,
        showUnit: true,
        showDescription: false,
        showMinMax: true,
        width: 'full'
      }
    ])
  ),
  styling: {
    theme: 'dark',
    accentColor: '#f97316',
    panelPosition: 'right',
    panelWidth: 'medium',
    sectionStyle: 'card',
    controlSize: 'normal'
  },
  actions: {
    primaryButton: { label: 'Get Quote', action: 'quote', style: 'primary' },
    showResetButton: true
  },
  unassignedParameters: []
});

// ============================================================================
// TAG INPUT COMPONENT (multi-value input with comma/enter to add)
// ============================================================================

function TagInput({ tags, onChange, placeholder }: {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}) {
  const [inputValue, setInputValue] = useState('');

  const addTag = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !tags.includes(trimmed)) {
      onChange([...tags, trimmed]);
    }
    setInputValue('');
  };

  const removeTag = (index: number) => {
    onChange(tags.filter((_, i) => i !== index));
  };

  return (
    <div className="w-full border border-slate-600 rounded-lg bg-slate-800/60 focus-within:border-orange-500 focus-within:ring-1 focus-within:ring-orange-500">
      <div className="flex flex-wrap gap-1.5 p-2">
        {tags.map((tag, i) => (
          <span key={i} className="inline-flex items-center gap-1 px-2 py-0.5 bg-orange-500/15 text-orange-400 border border-orange-500/30 rounded-md text-xs font-medium">
            {tag}
            <button
              onClick={() => removeTag(i)}
              className="hover:text-orange-300 transition-colors"
              title={`Remove ${tag}`}
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          onKeyDown={(e) => {
            if ((e.key === 'Enter' || e.key === ',') && inputValue.trim()) {
              e.preventDefault();
              addTag(inputValue);
            } else if (e.key === 'Backspace' && !inputValue && tags.length > 0) {
              removeTag(tags.length - 1);
            }
          }}
          onBlur={() => { if (inputValue.trim()) addTag(inputValue); }}
          placeholder={tags.length === 0 ? placeholder : ''}
          title={placeholder || 'Add tag'}
          className="flex-1 min-w-[100px] px-1 py-0.5 text-sm text-white bg-transparent outline-none placeholder:text-gray-500"
        />
      </div>
    </div>
  );
}

// ============================================================================
// CONFIGURATOR PAGE CONTENT
// ============================================================================

function ConfiguratorPageContent() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');
  const templateParam = searchParams.get('template');
  const socketRef = useRef<Socket | null>(null);
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);
  
  // State
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Config toolbar tab
  const [configTab, setConfigTab] = useState<'details' | 'parameters' | 'builder' | 'pricing' | 'settings'>('builder');

  // Pricing state
  const [pricing, setPricing] = useState<PricingConfig>({
    basePrice: 0,
    currency: 'USD',
    showPrice: false,
    parameterRules: {},
    setupFee: 0,
    rushFee: 0,
  });
  const [pricingSaving, setPricingSaving] = useState(false);
  const [pricingDirty, setPricingDirty] = useState(false);
  
  // Builder mode: edit (LayoutBuilder) or preview (CustomerPreview)
  const [builderMode, setBuilderMode] = useState<'edit' | 'preview'>('edit');
  
  // Layout Builder state
  const [configuratorLayout, setConfiguratorLayout] = useState<ConfiguratorLayout | null>(null);
  const [layoutSaving, setLayoutSaving] = useState(false);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showToolbox, setShowToolbox] = useState(true);
  const [showConfigPanel, setShowConfigPanel] = useState(true);
  
  // Parameter values for preview
  const [configValues, setConfigValues] = useState<Record<string, string | number | boolean>>({});
  
  // Test run state
  const [testRunning, setTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState('');
  
  // Viewer state
  const [viewerLoading, setViewerLoading] = useState(false);
  const [viewerUrn, setViewerUrn] = useState<string>('');
  
  // Viewer tab state
  const [viewerTab, setViewerTab] = useState<'visualization' | 'drawing' | 'bom' | 'summary'>('visualization');
  
  // 2D Drawing viewer state
  const [dwgUrn, setDwgUrn] = useState<string>('');
  const viewer2dRef = useRef<HTMLDivElement>(null);
  const viewer2dInstance = useRef<any>(null);
  const [viewer2dLoading, setViewer2dLoading] = useState(false);

  // BOM data (mock for demo, will be populated by APS DA extraction)
  const [bomData] = useState([
    { partNumber: 'BRK-001', name: 'Base Plate', quantity: 1, material: 'Steel A36', weight: '2.4 kg' },
    { partNumber: 'BRK-002', name: 'Side Bracket L', quantity: 2, material: 'Steel A36', weight: '0.8 kg' },
    { partNumber: 'BRK-003', name: 'Side Bracket R', quantity: 2, material: 'Steel A36', weight: '0.8 kg' },
    { partNumber: 'BRK-004', name: 'Top Mount Assembly', quantity: 1, material: 'Aluminum 6061', weight: '1.2 kg' },
    { partNumber: 'BRK-005', name: 'Reinforcement Rib', quantity: 4, material: 'Steel A36', weight: '0.3 kg' },
    { partNumber: 'HDW-010', name: 'M8\u00d725 Hex Bolt', quantity: 8, material: 'Grade 8.8', weight: '0.02 kg' },
    { partNumber: 'HDW-011', name: 'M8 Lock Nut', quantity: 8, material: 'Grade 8', weight: '0.01 kg' },
    { partNumber: 'HDW-012', name: 'M8 Flat Washer', quantity: 16, material: 'Zinc Plated', weight: '0.005 kg' },
    { partNumber: 'BRK-006', name: 'Gusset Plate', quantity: 2, material: 'Steel A36', weight: '0.5 kg' },
    { partNumber: 'BRK-007', name: 'Mounting Flange', quantity: 1, material: 'Aluminum 6061', weight: '0.9 kg' },
  ]);

  // Properties panel state (right side)
  const [selectedElement, setSelectedElement] = useState<LayoutElement | null>(null);
  const [selectedParam, setSelectedParam] = useState<string | null>(null);

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [isTemplateReset, setIsTemplateReset] = useState(false);

  // ============================================================================
  // LOAD PRODUCT
  // ============================================================================

  const fetchProduct = useCallback(async () => {
    if (!productId) {
      setError('No product ID provided');
      setLoading(false);
      return;
    }
    
    try {
      setLoading(true);
      const res = await fetch(`/api/products/${productId}`);
      if (!res.ok) throw new Error('Product not found');
      
      const data = await res.json();
      // Handle both direct product and wrapped response
      const productData = data.product || data;
      setProduct(productData);
      
      // Initialize config values with defaults
      const defaults: Record<string, string | number | boolean> = {};
      productData.parameters?.forEach((p: Parameter) => {
        defaults[p.name] = p.defaultValue;
      });
      setConfigValues(defaults);
      
      // Load pricing config
      if (productData.pricing) {
        setPricing(productData.pricing);
      }
      
      // Load layout
      await fetchLayout(productId, productData);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load product');
    } finally {
      setLoading(false);
    }
  }, [productId]);

  const fetchLayout = async (id: string, productData?: Product) => {
    try {
      const res = await fetch(`/api/products/${id}/layout`);
      if (res.ok) {
        const data = await res.json();
        // Only use the layout if it was explicitly saved (not a server-generated default)
        if (data.layout && !data.isDefault) {
          // Migrate V1 layouts to V2 automatically
          const migrated = migrateLayoutV1toV2(data.layout);
          setConfiguratorLayout(migrated);
          return;
        }
      }
    } catch (err) {
      console.log('No saved layout, using default');
    }
    
    // No saved layout — check for template from URL param (set by ConfiguratorView picker)
    if (templateParam) {
      // Template was selected before opening this tab — apply it and auto-save
      applyTemplateById(templateParam, productData);
      // Auto-save so the template picker won't appear next time
      const template = CONFIGURATOR_TEMPLATES.find(t => t.id === templateParam);
      const prod = productData;
      if (template && prod?.parameters) {
        const paramNames = prod.parameters.map(p => p.name);
        const layout = template.createLayout(paramNames);
        layout.controls = Object.fromEntries(
          prod.parameters.map(p => [p.name, {
            controlType: p.type === 'boolean' ? 'toggle' : p.type === 'select' ? 'dropdown' : 'slider-input',
            showLabel: true, showUnit: true, showDescription: false, showMinMax: true, width: 'full' as const
          }])
        );
        // Save directly via fetch since product state may not be set yet
        fetch(`/api/products/${id}/layout`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ layout })
        }).catch(() => {});
      }
      return;
    }
    
    // No saved layout and no template param — show template picker
    setShowTemplatePicker(true);
    setIsTemplateReset(false);
  };

  // Apply a template by ID (used by both URL param and dialog)
  const applyTemplateById = (templateId: string, productData?: Product) => {
    const template = CONFIGURATOR_TEMPLATES.find(t => t.id === templateId);
    const prod = productData || product;
    if (!template || !prod?.parameters) return;
    const paramNames = prod.parameters.map(p => p.name);
    const layout = template.createLayout(paramNames);
    layout.controls = Object.fromEntries(
      prod.parameters.map(p => [
        p.name,
        {
          controlType: p.type === 'boolean' ? 'toggle' : p.type === 'select' ? 'dropdown' : 'slider-input',
          showLabel: true,
          showUnit: true,
          showDescription: false,
          showMinMax: true,
          width: 'full' as const
        }
      ])
    );
    setConfiguratorLayout(layout);
    setHasUnsavedChanges(true);
  };

  // Handle template selection from the picker dialog
  const handleTemplateSelect = (templateId: string) => {
    applyTemplateById(templateId);
    setShowTemplatePicker(false);
    setIsTemplateReset(false);
    // Auto-save the layout so the template picker won't show again next time
    setTimeout(() => {
      const template = CONFIGURATOR_TEMPLATES.find(t => t.id === templateId);
      const prod = product;
      if (template && prod?.parameters) {
        const paramNames = prod.parameters.map(p => p.name);
        const layout = template.createLayout(paramNames);
        layout.controls = Object.fromEntries(
          prod.parameters.map(p => [p.name, {
            controlType: p.type === 'boolean' ? 'toggle' : p.type === 'select' ? 'dropdown' : 'slider-input',
            showLabel: true, showUnit: true, showDescription: false, showMinMax: true, width: 'full' as const
          }])
        );
        saveLayout(layout);
      }
    }, 100);
  };

  useEffect(() => {
    fetchProduct();
  }, [fetchProduct]);

  // Update default layout when product loads
  useEffect(() => {
    if (product?.parameters && !configuratorLayout) {
      setConfiguratorLayout(createDefaultLayout(product.parameters));
    }
    // Set 2D drawing URN from product
    if (product?.drawingFile?.urn) {
      setDwgUrn(product.drawingFile.urn);
    }
  }, [product, configuratorLayout]);

  // ============================================================================
  // 3D VIEWER INIT (unified — matches configure page pattern)
  // ============================================================================
  useEffect(() => {
    // Need either lastOutputUrn or a sourceFile to build a URN from
    if (!product?.lastOutputUrn && !product?.sourceFile) {
      setViewerLoading(false);
      return;
    }

    setViewerLoading(true);

    // Helper: compute base64 URN from sourceFile bucket/object
    const getSourceFileUrn = (): string | null => {
      if (!product?.sourceFile?.bucketKey || !product?.sourceFile?.objectKey) return null;
      const objectId = `urn:adsk.objects:os.object:${product.sourceFile.bucketKey}/${product.sourceFile.objectKey}`;
      return btoa(objectId).replace(/=/g, '');
    };

    let cancelled = false;

    const loadViewer = async () => {
      try {
        // Load Autodesk Viewer script inline if needed
        if (!(window as any).Autodesk) {
          await new Promise<void>((resolve, reject) => {
            const existingScript = document.querySelector('script[src*="viewer3D.min.js"]');
            if (existingScript) {
              if ((window as any).Autodesk) return resolve();
              existingScript.addEventListener('load', () => resolve());
              return;
            }
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css';
            document.head.appendChild(link);
            const script = document.createElement('script');
            script.src = 'https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js';
            script.async = true;
            script.onload = () => resolve();
            script.onerror = () => reject(new Error('Failed to load viewer'));
            document.head.appendChild(script);
          });
        }

        if (cancelled) return;

        // Fetch token
        const tokenRes = await fetch('/api/auth/token');
        if (!tokenRes.ok) throw new Error('Failed to get viewer token');
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
          console.error('Viewer token error:', tokenData.diagnostic || 'No token returned');
          setViewerLoading(false);
          return;
        }

        console.log('Viewer token obtained, expires_in:', tokenData.expires_in);

        // Determine initial URN
        let activeUrn = product.lastOutputUrn || getSourceFileUrn() || '';
        if (!activeUrn) { setViewerLoading(false); return; }

        // Set viewerUrn for UI state
        setViewerUrn(activeUrn);

        let translationTriggered = false;
        let fellBackToSource = false;

        const triggerTranslation = async (targetUrn: string) => {
          try {
            console.log('Configurator: Triggering SVF translation for URN:', targetUrn);
            await fetch('/api/workflow/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urn: targetUrn }),
            });
            translationTriggered = true;
          } catch (err) {
            console.error('Configurator: Failed to trigger translation:', err);
          }
        };

        const pollTranslationStatus = (pollUrn: string): Promise<boolean> => {
          return new Promise((resolve) => {
            let retries = 0;
            const maxRetries = 60;
            const checkStatus = async () => {
              if (cancelled) { resolve(false); return; }
              if (retries++ >= maxRetries) {
                console.error('Configurator: Translation polling timed out');
                resolve(false);
                return;
              }
              try {
                const manifestRes = await fetch(`/api/translation/${pollUrn}`);
                if (manifestRes.ok) {
                  const manifest = await manifestRes.json();
                  if (manifest.status === 'success') {
                    resolve(true);
                  } else if (manifest.status === 'failed') {
                    resolve(false);
                  } else if (manifest.status === 'inprogress' || manifest.status === 'pending') {
                    const progress = manifest.progress || 'starting...';
                    setTestProgress(`Translating (${progress})...`);
                    setTimeout(checkStatus, 3000);
                  } else {
                    setTimeout(checkStatus, 3000);
                  }
                } else if (manifestRes.status === 404 && !translationTriggered) {
                  await triggerTranslation(pollUrn);
                  setTimeout(checkStatus, 5000);
                } else if (manifestRes.status === 404 && translationTriggered && retries > 8 && !fellBackToSource) {
                  // Expired output — fall back to source file
                  const sourceUrn = getSourceFileUrn();
                  if (sourceUrn && pollUrn !== sourceUrn) {
                    console.log('Configurator: Falling back to source file URN');
                    fellBackToSource = true;
                    translationTriggered = false;
                    activeUrn = sourceUrn;
                    setViewerUrn(sourceUrn);
                    retries = 0;
                    const srcRes = await fetch(`/api/translation/${sourceUrn}`);
                    if (srcRes.ok) {
                      const srcManifest = await srcRes.json();
                      if (srcManifest.status === 'success') { resolve(true); return; }
                    }
                    await triggerTranslation(sourceUrn);
                    const pollSource = async () => {
                      if (cancelled) { resolve(false); return; }
                      if (retries++ >= maxRetries) { resolve(false); return; }
                      try {
                        const r = await fetch(`/api/translation/${sourceUrn}`);
                        if (r.ok) {
                          const m = await r.json();
                          if (m.status === 'success') { resolve(true); }
                          else if (m.status === 'failed') { resolve(false); }
                          else { setTimeout(pollSource, 3000); }
                        } else { setTimeout(pollSource, 3000); }
                      } catch { setTimeout(pollSource, 3000); }
                    };
                    setTimeout(pollSource, 5000);
                  } else {
                    setTimeout(checkStatus, 3000);
                  }
                } else {
                  setTimeout(checkStatus, 3000);
                }
              } catch (err) {
                setTimeout(checkStatus, 3000);
              }
            };
            checkStatus();
          });
        };

        const translationReady = await pollTranslationStatus(activeUrn);
        if (!translationReady || cancelled) {
          setViewerLoading(false);
          return;
        }

        setTestProgress('');

        // Destroy previous viewer
        if (viewerInstanceRef.current) {
          viewerInstanceRef.current.finish();
          viewerInstanceRef.current = null;
        }

        // Keep mutable token ref for viewer's getAccessToken callback
        let cachedToken = tokenData.access_token;
        let cachedExpiry = tokenData.expires_in;

        const options = {
          env: 'AutodeskProduction',
          api: 'derivativeV2',
          getAccessToken: (onTokenReady: (token: string, expires: number) => void) => {
            fetch('/api/auth/token')
              .then(r => r.json())
              .then(data => {
                if (data.access_token) {
                  cachedToken = data.access_token;
                  cachedExpiry = data.expires_in;
                  onTokenReady(data.access_token, data.expires_in);
                } else {
                  onTokenReady(cachedToken, cachedExpiry);
                }
              })
              .catch(() => {
                onTokenReady(cachedToken, cachedExpiry);
              });
          }
        };

        if (cancelled) return;

        const Autodesk = (window as any).Autodesk;

        Autodesk.Viewing.Initializer(options, () => {
          if (!viewerRef.current || cancelled) return;

          const viewer = new Autodesk.Viewing.GuiViewer3D(viewerRef.current, {
            extensions: ['Autodesk.ViewCubeUi']
          });
          viewer.start();
          viewerInstanceRef.current = viewer;

          const documentId = activeUrn.startsWith('urn:') ? activeUrn : `urn:${activeUrn}`;
          console.log('Loading viewer document:', documentId);

          Autodesk.Viewing.Document.load(
            documentId,
            (doc: any) => {
              const viewables = doc.getRoot().getDefaultGeometry();
              if (viewables) {
                viewer.loadDocumentNode(doc, viewables).then(() => {
                  viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                    viewer.fitToView();
                  });
                  setViewerLoading(false);
                });
              } else {
                console.error('No viewables found in document');
                setViewerLoading(false);
              }
            },
            (errorCode: number, errorMessage: string) => {
              console.error('Viewer document load error:', errorCode, errorMessage);
              setViewerLoading(false);
            }
          );
        });
      } catch (err) {
        console.error('Viewer init failed:', err);
        setViewerLoading(false);
      }
    };

    loadViewer();

    return () => {
      cancelled = true;
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.finish();
        viewerInstanceRef.current = null;
      }
    };
  }, [product?.lastOutputUrn, product?.sourceFile]);

  // ============================================================================
  // 2D DWG VIEWER INIT
  // ============================================================================
  useEffect(() => {
    if (!dwgUrn || viewerTab !== 'drawing') return;

    const load2dViewer = async () => {
      try {
        setViewer2dLoading(true);
        const Autodesk = (window as any).Autodesk;
        if (!Autodesk) return;

        const tokenRes = await fetch('/api/auth/token');
        if (!tokenRes.ok) throw new Error('Failed to get viewer token');
        const tokenData = await tokenRes.json();

        if (viewer2dRef.current) {
          if (viewer2dInstance.current) {
            viewer2dInstance.current.finish();
            viewer2dInstance.current = null;
          }

          let cachedToken = tokenData.access_token;
          let cachedExpiry = tokenData.expires_in;

          const options = {
            env: 'AutodeskProduction',
            api: 'derivativeV2',
            getAccessToken: (onTokenReady: (token: string, expires: number) => void) => {
              fetch('/api/auth/token')
                .then(r => r.json())
                .then(data => {
                  if (data.access_token) {
                    cachedToken = data.access_token;
                    cachedExpiry = data.expires_in;
                    onTokenReady(data.access_token, data.expires_in);
                  } else {
                    onTokenReady(cachedToken, cachedExpiry);
                  }
                })
                .catch(() => onTokenReady(cachedToken, cachedExpiry));
            }
          };

          Autodesk.Viewing.Initializer(options, () => {
            if (!viewer2dRef.current) return;

            const viewer = new Autodesk.Viewing.GuiViewer3D(viewer2dRef.current, {
              extensions: ['Autodesk.DocumentBrowser'],
            });
            viewer.start();
            viewer2dInstance.current = viewer;

            const urn = dwgUrn.startsWith('urn:') ? dwgUrn : `urn:${dwgUrn}`;

            Autodesk.Viewing.Document.load(
              urn,
              (doc: any) => {
                const root = doc.getRoot();
                const viewables2d = root.search({ type: 'geometry', role: '2d' });
                const viewable = viewables2d.length > 0
                  ? viewables2d[0]
                  : root.getDefaultGeometry();
                if (viewable) {
                  viewer.loadDocumentNode(doc, viewable).then(() => {
                    viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                      viewer.fitToView();
                    });
                    setViewer2dLoading(false);
                  });
                } else {
                  setViewer2dLoading(false);
                }
              },
              (errorCode: number, errorMsg: string) => {
                console.error('2D Viewer load error:', errorCode, errorMsg);
                setViewer2dLoading(false);
              }
            );
          });
        }
      } catch (err) {
        console.error('2D viewer init failed:', err);
        setViewer2dLoading(false);
      }
    };

    load2dViewer();

    return () => {
      if (viewer2dInstance.current) {
        viewer2dInstance.current.finish();
        viewer2dInstance.current = null;
      }
    };
  }, [dwgUrn, viewerTab]);

  // ============================================================================
  // SOCKET CONNECTION
  // ============================================================================

  useEffect(() => {
    socketRef.current = io();
    
    socketRef.current.on('workitem-progress', (data: any) => {
      if (testRunning) {
        setTestProgress(data.message || 'Processing...');
      }
    });
    
    socketRef.current.on('workitem-complete', () => {
      setTestRunning(false);
      setTestProgress('');
    });
    
    return () => {
      socketRef.current?.disconnect();
    };
  }, [testRunning]);

  // ============================================================================
  // LAYOUT ACTIONS
  // ============================================================================

  const addSection = () => {
    if (!configuratorLayout) return;
    
    const newSection: SectionElement = {
      id: `section-${Date.now()}`,
      type: 'section',
      order: (configuratorLayout.children || []).length,
      label: 'New Section',
      collapsible: true,
      defaultExpanded: true,
      children: []
    };
    
    handleLayoutChange({
      ...configuratorLayout,
      children: [...(configuratorLayout.children || []), newSection]
    });
  };

  const resetLayout = () => {
    if (!product?.parameters) return;
    setConfiguratorLayout(createDefaultLayout(product.parameters));
    setHasUnsavedChanges(true);
  };

  // ============================================================================
  // PRICING
  // ============================================================================

  const savePricingData = async (pricingData: PricingConfig) => {
    if (!product) return;
    setPricingSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}/pricing`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pricing: pricingData }),
      });
      if (!res.ok) throw new Error('Failed to save pricing');
      setPricingDirty(false);
    } catch (err) {
      console.error('Failed to save pricing:', err);
    } finally {
      setPricingSaving(false);
    }
  };

  // Auto-save pricing ref for debounce
  const pricingSaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const updatePricing = (updates: Partial<PricingConfig>) => {
    setPricing(prev => {
      const next = { ...prev, ...updates };
      // Auto-save with debounce
      if (pricingSaveTimerRef.current) clearTimeout(pricingSaveTimerRef.current);
      pricingSaveTimerRef.current = setTimeout(() => savePricingData(next), 500);
      return next;
    });
    setPricingDirty(true);
  };

  const updatePricingRule = (paramName: string, rule: PricingRule) => {
    setPricing(prev => {
      const next = {
        ...prev,
        parameterRules: { ...(prev.parameterRules || {}), [paramName]: rule },
      };
      if (pricingSaveTimerRef.current) clearTimeout(pricingSaveTimerRef.current);
      pricingSaveTimerRef.current = setTimeout(() => savePricingData(next), 500);
      return next;
    });
    setPricingDirty(true);
  };

  // Keep savePricing for any explicit save calls
  const savePricing = async () => savePricingData(pricing);

  // Client-side price calculation
  const calculatePrice = (vals: Record<string, string | number | boolean>): { total: number; breakdown: { label: string; amount: number }[] } => {
    const breakdown: { label: string; amount: number }[] = [];
    let total = pricing.basePrice || 0;
    breakdown.push({ label: 'Base price', amount: pricing.basePrice || 0 });

    const rules = pricing.parameterRules || {};
    for (const [paramName, rule] of Object.entries(rules)) {
      if (rule.type === 'none') continue;
      const val = vals[paramName];
      const param = product?.parameters?.find(p => p.name === paramName);
      const label = param?.displayName || paramName;

      if (rule.type === 'per-unit' && typeof val === 'number' && rule.value) {
        const amount = val * rule.value;
        breakdown.push({ label: `${label} (${val} × $${rule.value})`, amount });
        total += amount;
      } else if (rule.type === 'fixed' && rule.value) {
        breakdown.push({ label, amount: rule.value });
        total += rule.value;
      } else if (rule.type === 'multiplier' && rule.value) {
        const mult = (rule.value - 1) * total;
        breakdown.push({ label: `${label} (×${rule.value})`, amount: mult });
        total *= rule.value;
      } else if (rule.type === 'option-based' && rule.optionPrices) {
        const optPrice = rule.optionPrices[String(val)] || 0;
        if (optPrice !== 0) {
          breakdown.push({ label: `${label}: ${val}`, amount: optPrice });
          total += optPrice;
        }
      }
    }

    if (pricing.setupFee && pricing.setupFee > 0) {
      breakdown.push({ label: 'Setup fee', amount: pricing.setupFee });
      total += pricing.setupFee;
    }

    return { total: Math.max(0, total), breakdown };
  };

  // ============================================================================
  // SAVE LAYOUT
  // ============================================================================

  const saveLayout = async (layoutOverride?: ConfiguratorLayout) => {
    const layoutToSave = layoutOverride || configuratorLayout;
    if (!product || !layoutToSave) return;
    
    setLayoutSaving(true);
    try {
      const res = await fetch(`/api/products/${product.id}/layout`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ layout: layoutToSave })
      });
      
      if (!res.ok) throw new Error('Failed to save layout');
      setHasUnsavedChanges(false);
    } catch (err) {
      console.error('Failed to save layout:', err);
    } finally {
      setLayoutSaving(false);
    }
  };

  // Track unsaved changes
  const handleLayoutChange = (newLayout: ConfiguratorLayout) => {
    setConfiguratorLayout(newLayout);
    setHasUnsavedChanges(true);
  };

  // Click-to-add: append a new toolbox element to the root of the layout
  const addToolboxItem = (type: string) => {
    if (!configuratorLayout) return;
    const id = `${type}-${Date.now()}`;
    const order = (configuratorLayout.children || []).length;
    let newElement: LayoutElement;
    switch (type) {
      case 'section':
        newElement = { id, type: 'section', label: 'New Section', collapsible: true, defaultExpanded: true, order, children: [] } as SectionElement;
        break;
      case 'tab-group':
        newElement = { id, type: 'tab-group', order, tabs: [{ id: `tab-${Date.now()}`, label: 'Tab 1', children: [] }] } as TabGroupElement;
        break;
      case 'label':
        newElement = { id, type: 'label', text: 'Label text', variant: 'body', align: 'left', order } as LabelElement;
        break;
      case 'splitter':
        newElement = { id, type: 'splitter', lineStyle: 'solid', margin: 8, order } as SplitterElement;
        break;
      case 'picture':
        newElement = { id, type: 'picture', url: '', alt: 'Image', order } as PictureElement;
        break;
      case 'empty-space':
        newElement = { id, type: 'empty-space', height: 24, order } as EmptySpaceElement;
        break;
      default:
        return;
    }
    handleLayoutChange({
      ...configuratorLayout,
      children: [...(configuratorLayout.children || []), newElement]
    });
  };

  // ============================================================================
  // PROPERTIES PANEL HELPERS
  // ============================================================================

  const showPropertiesPanel = !!(selectedElement || selectedParam);

  const getControlConfig = (paramName: string): ControlConfig => {
    if (!configuratorLayout) return { controlType: 'input', showLabel: true, showUnit: true, showDescription: false, showMinMax: true, width: 'full' };
    const existing = configuratorLayout.controls[paramName];
    if (existing) return existing;
    const param = product?.parameters?.find(p => p.name === paramName);
    let controlType: ControlConfig['controlType'] = 'input';
    if (param) {
      if (param.type === 'boolean') controlType = 'toggle';
      else if (param.type === 'select') controlType = 'dropdown';
      else if (param.type === 'number' && param.min !== undefined) controlType = 'slider-input';
      else if (param.type === 'text') controlType = 'text';
    }
    return { controlType, showLabel: true, showUnit: true, showDescription: false, showMinMax: true, width: 'full' };
  };

  const updateControlConfig = (paramName: string, updates: Partial<ControlConfig>) => {
    if (!configuratorLayout) return;
    const existing = getControlConfig(paramName);
    handleLayoutChange({
      ...configuratorLayout,
      controls: {
        ...configuratorLayout.controls,
        [paramName]: { ...existing, ...updates }
      }
    });
  };

  // Update an element anywhere in the children tree (recursive)
  const updateElement = (elementId: string, updates: Record<string, unknown>) => {
    if (!configuratorLayout) return;

    const updateInTree = (elements: LayoutElement[]): LayoutElement[] => {
      return elements.map(el => {
        if (el.id === elementId) {
          return { ...el, ...updates } as LayoutElement;
        }
        // Recurse into containers
        if (el.type === 'section' || el.type === 'group') {
          const container = el as SectionElement | GroupElement;
          return { ...container, children: updateInTree(container.children) } as LayoutElement;
        }
        if (el.type === 'row') {
          const row = el as RowElement;
          return { ...row, children: updateInTree(row.children) } as LayoutElement;
        }
        if (el.type === 'tab-group') {
          const tg = el as TabGroupElement;
          return {
            ...tg,
            tabs: tg.tabs.map(tab => ({
              ...tab,
              children: updateInTree(tab.children)
            }))
          } as LayoutElement;
        }
        return el;
      });
    };

    const newChildren = updateInTree(configuratorLayout.children || []);
    handleLayoutChange({ ...configuratorLayout, children: newChildren });

    if (selectedElement?.id === elementId) {
      setSelectedElement({ ...selectedElement, ...updates } as LayoutElement);
    }
  };

  // Find element by ID in the children tree
  const findElementById = (elementId: string): LayoutElement | null => {
    const search = (elements: LayoutElement[]): LayoutElement | null => {
      for (const el of elements) {
        if (el.id === elementId) return el;
        if (el.type === 'section' || el.type === 'group') {
          const found = search((el as SectionElement | GroupElement).children);
          if (found) return found;
        }
        if (el.type === 'row') {
          const found = search((el as RowElement).children);
          if (found) return found;
        }
        if (el.type === 'tab-group') {
          for (const tab of (el as TabGroupElement).tabs) {
            const found = search(tab.children);
            if (found) return found;
          }
        }
      }
      return null;
    };
    return search(configuratorLayout?.children || []);
  };

  const closePropertiesPanel = () => {
    setSelectedElement(null);
    setSelectedParam(null);
  };

  // ============================================================================
  // TEST RUN
  // ============================================================================

  const runTest = async () => {
    if (!product) return;
    
    setTestRunning(true);
    setTestProgress('Starting test...');
    
    try {
      const res = await fetch('/api/workflow/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          parameters: configValues
        })
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error || 'Test run failed');
      }

      if (data.cached && data.urn) {
        setTestProgress('Loaded cached result');
        if (data.urn) setViewerUrn(data.urn);
      } else {
        setTestProgress(
          data.iptWorkItemId || data.workItemId
            ? `Work item started: ${data.iptWorkItemId || data.workItemId}`
            : 'Test run started',
        );
      }
    } catch (err) {
      console.error('Test run failed:', err);
      setTestProgress(err instanceof Error ? err.message : 'Test run failed');
    } finally {
      setTestRunning(false);
    }
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading configurator...</span>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-lg mb-4">{error || 'Product not found'}</div>
          <button
            onClick={() => window.close()}
            className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
          >
            Close Tab
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-slate-950 flex flex-col overflow-hidden configurator-3dthd">
      {/* Template Picker Dialog */}
      {showTemplatePicker && (
        <TemplatePickerDialog
          onSelect={handleTemplateSelect}
          onClose={() => {
            setShowTemplatePicker(false);
            // If closing without selecting and no layout exists, apply blank canvas
            if (!configuratorLayout && product?.parameters) {
              handleTemplateSelect('blank-canvas');
            }
          }}
          isReset={isTemplateReset}
        />
      )}

      {/* Header - Merged toolbar with centered product name */}
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between shrink-0">
        {/* Left: Back + Product Name */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            onClick={() => window.close()}
            className="flex items-center text-gray-400 hover:text-white transition-colors shrink-0"
            title="Close and return to admin"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>
          
          <div className="flex items-center gap-2 min-w-0">
            <div className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 overflow-hidden bg-slate-800 border border-slate-700">
              {(product.productImage || product.thumbnail) ? (
                <img src={product.productImage || product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
              ) : (
                <ImageIcon className="w-3.5 h-3.5 text-gray-500" />
              )}
            </div>
            <h1 className="text-white font-medium text-sm truncate">{product.name}</h1>
          </div>
        </div>

        {/* Right: Save/Reset Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {((configTab === 'builder' && builderMode === 'edit') || configTab === 'settings') && (
            <>
              <button
                onClick={resetLayout}
                className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
                title="Reset layout"
              >
                <RotateCcw className="w-4 h-4" />
              </button>
              <button
                onClick={() => saveLayout()}
                disabled={layoutSaving || !hasUnsavedChanges}
                className={`p-2 rounded-lg transition-colors ${
                  hasUnsavedChanges
                    ? 'bg-orange-500 hover:bg-orange-600 text-white'
                    : 'bg-slate-700 text-gray-500 cursor-not-allowed'
                }`}
                title={layoutSaving ? 'Saving...' : 'Save'}
              >
                <Save className="w-4 h-4" />
              </button>
            </>
          )}
          {configTab === 'pricing' && pricingSaving && (
            <div className="p-2 text-gray-400" title="Auto-saving...">
              <Loader2 className="w-4 h-4 animate-spin" />
            </div>
          )}
          {configTab === 'pricing' && !pricingSaving && pricingDirty === false && (
            <div className="p-2 text-green-400" title="All changes saved">
              <CheckCircle className="w-4 h-4" />
            </div>
          )}
        </div>
      </header>

      {/* Content - Full viewport with floating overlays */}
      <div className="flex-1 flex overflow-hidden relative">

      {/* Main Content Area - Viewer fills entire space, config panel floats over it */}
      <main className="flex-1 overflow-hidden relative">
          {/* Floating Left Sidebar - Toolbox only (Builder edit mode) */}
          {configTab === 'builder' && builderMode === 'edit' && (
          <div className="absolute top-1/2 -translate-y-1/2 left-3 z-30 flex flex-col bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden">
              <div className="flex flex-col items-center py-1 gap-0.5 px-1 overflow-y-auto">
                {/* Section */}
                <div
                  onClick={() => addToolboxItem('section')}
                  className="group relative p-2 rounded-lg cursor-pointer transition-colors text-orange-400 hover:bg-orange-500/10"
                  title="Section"
                >
                  <FolderOpen className="w-[18px] h-[18px]" />
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Section
                    <div className="text-gray-400 text-[10px]">Collapsible section container</div>
                  </div>
                </div>
                {/* Tab Group */}
                <div
                  onClick={() => addToolboxItem('tab-group')}
                  className="group relative p-2 rounded-lg cursor-pointer transition-colors text-orange-400 hover:bg-orange-500/10"
                  title="Tab Group"
                >
                  <Layers className="w-[18px] h-[18px]" />
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Tab Group
                    <div className="text-gray-400 text-[10px]">Tabbed container</div>
                  </div>
                </div>
                {/* Picture */}
                <div
                  onClick={() => addToolboxItem('picture')}
                  className="group relative p-2 rounded-lg cursor-pointer transition-colors text-orange-400 hover:bg-orange-500/10"
                  title="Picture"
                >
                  <ImageIcon className="w-[18px] h-[18px]" />
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Picture
                    <div className="text-gray-400 text-[10px]">URL-based image</div>
                  </div>
                </div>
                {/* Empty Space */}
                <div
                  onClick={() => addToolboxItem('empty-space')}
                  className="group relative p-2 rounded-lg cursor-pointer transition-colors text-orange-400 hover:bg-orange-500/10"
                  title="Empty Space"
                >
                  <Square className="w-[18px] h-[18px]" />
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Empty Space
                    <div className="text-gray-400 text-[10px]">Spacer element</div>
                  </div>
                </div>
                {/* Label */}
                <div
                  onClick={() => addToolboxItem('label')}
                  className="group relative p-2 rounded-lg cursor-pointer transition-colors text-orange-400 hover:bg-orange-500/10"
                  title="Label"
                >
                  <Type className="w-[18px] h-[18px]" />
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Label
                    <div className="text-gray-400 text-[10px]">Static text</div>
                  </div>
                </div>
                {/* Splitter */}
                <div
                  onClick={() => addToolboxItem('splitter')}
                  className="group relative p-2 rounded-lg cursor-pointer transition-colors text-orange-400 hover:bg-orange-500/10"
                  title="Splitter"
                >
                  <Minus className="w-[18px] h-[18px]" />
                  <div className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 bg-slate-800 border border-slate-700 rounded text-xs text-white whitespace-nowrap opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 pointer-events-none">
                    Splitter
                    <div className="text-gray-400 text-[10px]">Horizontal divider</div>
                  </div>
                </div>
              </div>
        </div>
          )}

          {/* Viewer Area - Full width/height background */}
          <div className="absolute inset-0 flex flex-col bg-slate-900">
            <div className="flex-1 relative">

            {/* Viewer Tabs - Floating top-center, larger */}
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center bg-slate-800/90 border border-slate-700/50 rounded-full shadow-lg p-1" style={{ backdropFilter: 'blur(8px)' }}>
              {([
                { tab: 'visualization' as const, label: '3D' },
                { tab: 'drawing' as const, label: '2D' },
                { tab: 'bom' as const, label: 'BOM' },
                { tab: 'summary' as const, label: 'Summary' },
              ]).map(({ tab, label }) => (
                <button
                  key={tab}
                  onClick={() => setViewerTab(tab)}
                  className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                    viewerTab === tab
                      ? 'text-white shadow-sm'
                      : 'text-gray-400 hover:text-white'
                  }`}
                  style={viewerTab === tab ? { backgroundColor: configuratorLayout?.styling?.accentColor || '#f97316' } : {}}
                >
                  {label}
                </button>
              ))}
            </div>



            {/* 3D Viewer - always mounted to preserve viewer state across tab switches */}
            <div 
              ref={viewerRef} 
              className={`w-full h-full absolute inset-0 ${viewerTab !== 'visualization' ? 'invisible pointer-events-none' : ''}`}
            />
            
            {/* Viewer Loading State */}
            {viewerTab === 'visualization' && viewerLoading && (
              <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
                <div className="flex flex-col items-center gap-3">
                  <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                  <span className="text-gray-400">
                    {testProgress || 'Loading 3D model...'}
                  </span>
                </div>
              </div>
            )}
            
            {/* No Model Available */}
            {viewerTab === 'visualization' && !viewerUrn && !viewerLoading && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center p-8">
                  <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
                    <Boxes className="w-8 h-8 text-gray-500" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-300 mb-2">No 3D Model Available</h3>
                  <p className="text-gray-500 text-sm max-w-xs">
                    Run a test to generate the 3D model preview, or upload a source file in product settings.
                  </p>
                </div>
              </div>
            )}

            {/* BOM Tab */}
            {viewerTab === 'bom' && (
              <div className="absolute inset-0 overflow-auto p-6 pt-14">
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-medium text-white">Bill of Materials</h3>
                    <p className="text-xs text-gray-500 mt-0.5">Extracted via APS Design Automation</p>
                  </div>
                  <span className="text-xs px-2.5 py-1 rounded-full bg-orange-500/10 text-orange-400 border border-orange-500/20">
                    {bomData.length} items
                  </span>
                </div>
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-slate-700">
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Part #</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Name</th>
                      <th className="text-center py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Qty</th>
                      <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Material</th>
                      <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-400 uppercase tracking-wider">Weight</th>
                    </tr>
                  </thead>
                  <tbody>
                    {bomData.map((item, i) => (
                      <tr key={item.partNumber} className={`border-b border-slate-800 hover:bg-slate-800/50 transition-colors ${i % 2 === 0 ? 'bg-slate-800/20' : ''}`}>
                        <td className="py-2.5 px-3 text-blue-400 font-mono text-xs">{item.partNumber}</td>
                        <td className="py-2.5 px-3 text-gray-200">{item.name}</td>
                        <td className="py-2.5 px-3 text-center text-gray-300">{item.quantity}</td>
                        <td className="py-2.5 px-3 text-gray-400">{item.material}</td>
                        <td className="py-2.5 px-3 text-right text-gray-400">{item.weight}</td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot>
                    <tr className="border-t border-slate-600">
                      <td className="py-3 px-3 text-xs font-semibold text-gray-300" colSpan={2}>Total Components</td>
                      <td className="py-3 px-3 text-center text-white font-semibold">{bomData.reduce((sum, item) => sum + item.quantity, 0)}</td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}

            {/* Drawing Tab - 2D DWG Viewer */}
            {viewerTab === 'drawing' && (
              <div className="absolute inset-0">
                {dwgUrn ? (
                  <>
                    <div ref={viewer2dRef} className="w-full h-full" />
                    {viewer2dLoading && (
                      <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
                        <div className="flex flex-col items-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                          <span className="text-gray-400">Loading 2D drawing...</span>
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="flex items-center justify-center h-full">
                    <div className="text-center p-8">
                      <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
                        <FileText className="w-8 h-8 text-gray-500" />
                      </div>
                      <h3 className="text-lg font-medium text-gray-300 mb-2">No 2D Drawing Available</h3>
                      <p className="text-gray-500 text-sm max-w-xs">
                        Link a DWG drawing file to this product to view 2D drawings here.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Summary Tab */}
            {viewerTab === 'summary' && (
              <div className="absolute inset-0 overflow-auto p-6 pt-14">
                <div className="max-w-lg mx-auto space-y-6">
                  {/* Product Header */}
                  <div>
                    <h3 className="text-lg font-semibold text-white">{product.name}</h3>
                    <p className="text-sm text-gray-500 mt-1">{product.description || 'Product configuration summary'}</p>
                  </div>

                  {/* Configuration Values */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Configuration</h4>
                    <div className="bg-slate-800/60 rounded-xl border border-slate-700 divide-y divide-slate-700/50">
                      {(product.parameters || []).map((param) => (
                        <div key={param.name} className="flex items-center justify-between px-4 py-3">
                          <span className="text-sm text-gray-300">{param.displayName || param.name}</span>
                          <span className="text-sm font-medium text-white">
                            {configValues[param.name] !== undefined
                              ? String(configValues[param.name])
                              : String(param.defaultValue)}
                            {param.unit ? ` ${param.unit}` : ''}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pricing Summary */}
                  {pricing.showPrice && (() => {
                    const result = calculatePrice(configValues);
                    const sym = pricing.currency === 'EUR' ? '\u20ac' : pricing.currency === 'GBP' ? '\u00a3' : '$';
                    return (
                      <div>
                        <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pricing</h4>
                        <div className="bg-slate-800/60 rounded-xl border border-slate-700 divide-y divide-slate-700/50">
                          {result.breakdown.map((item, i) => (
                            <div key={i} className="flex items-center justify-between px-4 py-2.5">
                              <span className="text-sm text-gray-400">{item.label}</span>
                              <span className="text-sm text-gray-300">{sym}{item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="flex items-center justify-between px-4 py-3 bg-slate-700/30">
                            <span className="text-sm font-semibold text-white">Total</span>
                            <span className="text-lg font-bold text-orange-400">{sym}{result.total.toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })()}

                  {/* BOM Preview */}
                  <div>
                    <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Bill of Materials</h4>
                    <div className="bg-slate-800/60 rounded-xl border border-slate-700 p-4 flex items-center justify-between">
                      <p className="text-sm text-gray-400">{bomData.length} components · {bomData.reduce((sum, item) => sum + item.quantity, 0)} total parts</p>
                      <button
                        onClick={() => setViewerTab('bom')}
                        className="text-xs text-blue-400 hover:text-blue-300 transition-colors"
                      >
                        View BOM →
                      </button>
                    </div>
                  </div>

                  {/* Update Selection Button */}
                  <button
                    onClick={() => {
                      console.log('Configuration saved:', configValues);
                    }}
                    className="w-full flex items-center justify-center gap-2 px-4 py-3 bg-orange-500 hover:bg-orange-600 text-white font-medium rounded-xl transition-colors"
                  >
                    <CheckCircle className="w-5 h-5" />
                    Update Selection
                  </button>
                </div>
              </div>
            )}
            </div>
          </div>

          {/* Floating Config Panel - Position driven by layout template */}
          {showConfigPanel && (() => {
            const panelPos = configuratorLayout?.styling?.panelPosition || 'right';
            const posClasses: Record<string, string> = {
              right: 'top-14 bottom-14 right-3 w-[360px]',
              left: 'top-14 bottom-14 left-14 w-[360px]',
              top: 'top-14 left-3 right-3 h-[320px]',
              bottom: 'bottom-14 left-3 right-3 h-[320px]',
            };
            return (
            <div className={`absolute z-30 ${posClasses[panelPos] || posClasses.right} flex flex-col bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl overflow-hidden transition-all duration-300`}>
              {/* Config Tab Icons */}
              <div className="flex items-center justify-center gap-1 px-3 py-2 border-b border-slate-700/50 bg-slate-900 shrink-0">
                {([
                  { tab: 'details' as const, icon: Info, label: 'Details' },
                  { tab: 'parameters' as const, icon: Database, label: 'Parameters' },
                  { tab: 'builder' as const, icon: LayoutGrid, label: 'Builder' },
                  { tab: 'pricing' as const, icon: DollarSign, label: 'Pricing' },
                  { tab: 'settings' as const, icon: Settings, label: 'Settings' },
                ]).filter(({ tab }) => builderMode === 'preview' ? tab !== 'settings' : true).map(({ tab, icon: Icon, label }) => (
                  <button
                    key={tab}
                    onClick={() => setConfigTab(tab)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                      configTab === tab
                        ? 'text-white shadow-sm'
                        : 'text-gray-400 hover:opacity-80'
                    }`}
                    style={configTab === tab ? { backgroundColor: configuratorLayout?.styling?.accentColor || '#f97316' } : {}}
                    title={label}
                  >
                    <Icon className="w-[16px] h-[16px]" />
                  </button>
                ))}
                <button
                  onClick={() => setShowConfigPanel(false)}
                  className="ml-auto p-1 text-gray-400 hover:text-white hover:bg-slate-700 rounded-md transition-colors"
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              {/* Panel Header with title */}
              <div className="flex items-center px-4 py-2 border-b border-slate-700/50 bg-slate-900 shrink-0">
                <h2 className="text-sm font-semibold text-white">
                  {configTab === 'builder' ? product.name :
                   configTab === 'details' ? 'Details' :
                   configTab === 'parameters' ? 'Parameters' :
                   configTab === 'pricing' ? 'Pricing Rules' :
                   configTab === 'settings' ? 'Settings' : product.name}
                </h2>
              </div>
              {/* Panel Content */}
              <div className="flex-1 overflow-hidden">
            {configTab === 'builder' && builderMode === 'edit' && configuratorLayout && (
              <CustomerPreview
                productName={product.name}
                parameters={product.parameters || []}
                layout={configuratorLayout}
                values={configValues}
                onValueChange={(name, value) => setConfigValues(prev => ({ ...prev, [name]: value }))}
                builderMode={builderMode}
                onBuilderModeChange={setBuilderMode}
                editable={true}
                selectedElementId={selectedElement?.id || selectedParam || null}
                onSelectElement={setSelectedElement}
                onSelectParam={setSelectedParam}
                onLayoutChange={handleLayoutChange}
                pricing={pricing}
                configValues={configValues}
                onUpdateSelection={(vals) => {
                  console.log('Selection updated:', vals);
                  setViewerTab('summary');
                }}
              />
            )}
            
            {configTab === 'builder' && builderMode === 'preview' && configuratorLayout && (
              <CustomerPreview
                key={`preview-${(configuratorLayout.children || []).length}-${(configuratorLayout.children || []).map(c => c.id).join(',')}`}
                productName={product.name}
                parameters={product.parameters || []}
                layout={configuratorLayout}
                values={configValues}
                onValueChange={(name, value) => setConfigValues(prev => ({ ...prev, [name]: value }))}
                builderMode={builderMode}
                onBuilderModeChange={setBuilderMode}
                pricing={pricing}
                configValues={configValues}
                onUpdateSelection={(vals) => {
                  console.log('Selection updated:', vals);
                  setViewerTab('summary');
                }}
              />
            )}

            {configTab === 'details' && (
              <div className="p-4 space-y-5 overflow-y-auto h-full">
                <h2 className="text-lg font-semibold text-white">Details</h2>

                {/* Name */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Name
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <p className="text-[11px] text-orange-400/80 mb-1.5">*Must be unique</p>
                  <input
                    type="text"
                    value={product.name}
                    onChange={(e) => setProduct({ ...product, name: e.target.value })}
                    placeholder="Product name"
                    className="w-full px-3 py-2 bg-slate-800/60 text-white border border-slate-600 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder:text-gray-500"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Description
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <textarea
                    value={product.description || ''}
                    onChange={(e) => setProduct({ ...product, description: e.target.value })}
                    rows={4}
                    placeholder="Product description..."
                    className="w-full px-3 py-2 bg-slate-800/60 text-white border border-slate-600 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm resize-none placeholder:text-gray-500"
                  />
                </div>

                {/* Categories */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Categories
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <p className="text-[11px] text-orange-400/80 mb-1.5">*Use comma or enter to insert multiple</p>
                  <TagInput
                    tags={product.categories || []}
                    onChange={(tags) => setProduct({ ...product, categories: tags })}
                    placeholder="Add category..."
                  />
                </div>

                {/* Sub-Categories */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Sub-Categories
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <p className="text-[11px] text-orange-400/80 mb-1.5">*Use enter to confirm</p>
                  <TagInput
                    tags={product.subcategories || []}
                    onChange={(tags) => setProduct({ ...product, subcategories: tags })}
                    placeholder="Add sub-category..."
                  />
                </div>

                {/* Functions */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Functions
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <p className="text-[11px] text-orange-400/80 mb-1.5">*Use comma or enter to insert multiple</p>
                  <TagInput
                    tags={product.functions || []}
                    onChange={(tags) => setProduct({ ...product, functions: tags })}
                    placeholder="Add function..."
                  />
                </div>

                {/* Stock Keeping Unit */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Stock Keeping Unit
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <p className="text-[11px] text-orange-400/80 mb-1.5">*SKU value or values for this product</p>
                  <input
                    type="text"
                    value={product.sku || ''}
                    onChange={(e) => setProduct({ ...product, sku: e.target.value })}
                    placeholder="SKU"
                    className="w-full px-3 py-2 bg-slate-800/60 text-white border border-slate-600 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder:text-gray-500"
                  />
                </div>

                {/* Quantity per SKU */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Quantity per SKU
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <input
                    type="number"
                    value={product.quantityPerSku ?? 1}
                    onChange={(e) => setProduct({ ...product, quantityPerSku: parseInt(e.target.value) || 1 })}
                    min={1}
                    placeholder="1"
                    className="w-full px-3 py-2 bg-slate-800/60 text-white border border-slate-600 rounded-lg focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500 text-sm placeholder:text-gray-500"
                  />
                </div>

                {/* Product Image */}
                <div>
                  <label className="flex items-center gap-1.5 text-xs font-medium text-gray-400 mb-1">
                    Product Image
                    <HelpCircle className="w-3.5 h-3.5 text-gray-500" />
                  </label>
                  <div className="flex items-center gap-3 mt-2">
                    {/* Thumbnail preview */}
                    <div className="w-16 h-16 rounded-lg border border-slate-600 bg-slate-800/60 flex items-center justify-center overflow-hidden shrink-0">
                      {product.productImage ? (
                        <img src={product.productImage} alt="Product" className="w-full h-full object-cover" />
                      ) : product.thumbnail ? (
                        <img src={product.thumbnail} alt="Product" className="w-full h-full object-cover" />
                      ) : (
                        <ImageIcon className="w-6 h-6 text-gray-600" />
                      )}
                    </div>
                    {/* Upload button */}
                    <label title="Upload image" className="w-9 h-9 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700 flex items-center justify-center cursor-pointer transition-colors">
                      <Upload className="w-4 h-4 text-gray-400" />
                      <input
                        type="file"
                        accept="image/*"
                        title="Upload product image"
                        className="hidden"
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) {
                            const reader = new FileReader();
                            reader.onload = (ev) => {
                              setProduct({ ...product, productImage: ev.target?.result as string });
                            };
                            reader.readAsDataURL(file);
                          }
                        }}
                      />
                    </label>
                    {/* Delete button */}
                    {(product.productImage || product.thumbnail) && (
                      <button
                        onClick={() => setProduct({ ...product, productImage: '', thumbnail: '' })}
                        className="w-9 h-9 rounded-lg border border-red-500/30 bg-red-500/10 hover:bg-red-500/20 flex items-center justify-center transition-colors"
                        title="Remove image"
                        aria-label="Remove product image"
                      >
                        <Trash2 className="w-4 h-4 text-red-400" />
                      </button>
                    )}
                  </div>
                </div>

                {/* Save Details Button */}
                <button
                  onClick={async () => {
                    try {
                      const res = await fetch(`/api/products/${product.id}`, {
                        method: 'PUT',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          name: product.name,
                          description: product.description,
                          categories: product.categories,
                          subcategories: product.subcategories,
                          functions: product.functions,
                          sku: product.sku,
                          quantityPerSku: product.quantityPerSku,
                          productImage: product.productImage,
                        })
                      });
                      if (!res.ok) throw new Error('Save failed');
                    } catch (err) {
                      console.error('Failed to save details:', err);
                    }
                  }}
                  className="w-full py-2.5 bg-orange-500 hover:bg-orange-600 text-white text-sm font-medium rounded-lg transition-colors"
                >
                  Save Details
                </button>
              </div>
            )}

            {configTab === 'parameters' && (
              <div className="p-4 space-y-4 overflow-y-auto h-full">
                <div className="flex items-center justify-between">
                  <h2 className="text-lg font-semibold text-white">Parameters</h2>
                  <span className="text-xs text-gray-500">
                    {product?.parameters?.length || 0} total
                  </span>
                </div>

                {/* Parameter list */}
                {product?.parameters && product.parameters.length > 0 ? (
                  <div className="space-y-2">
                    {product.parameters.map(param => {
                      // Check if this param is already on the layout
                      const isOnLayout = (() => {
                        if (!configuratorLayout?.children) return false;
                        const search = (elements: LayoutElement[]): boolean => {
                          for (const el of elements) {
                            if (el.type === 'parameter' && (el as ParameterElement).parameterName === param.name) return true;
                            if (el.type === 'section' || el.type === 'group') {
                              if (search((el as SectionElement | GroupElement).children)) return true;
                            }
                            if (el.type === 'row') {
                              if (search((el as RowElement).children)) return true;
                            }
                            if (el.type === 'tab-group') {
                              for (const tab of (el as TabGroupElement).tabs) {
                                if (search(tab.children)) return true;
                              }
                            }
                          }
                          return false;
                        };
                        return search(configuratorLayout.children);
                      })();

                      return (
                        <div
                          key={param.name}
                          className="bg-slate-800/60 rounded-lg border border-slate-700 overflow-hidden"
                        >
                          {/* Parameter header */}
                          <div className="flex items-center justify-between px-3 py-2.5">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium text-white truncate">{param.displayName}</span>
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-700 text-gray-400 uppercase tracking-wider shrink-0">{param.type}</span>
                              </div>
                              <span className="text-xs text-gray-500 truncate block mt-0.5">{param.name}</span>
                            </div>
                            {isOnLayout ? (
                              <button
                                onClick={() => {
                                  // Select this param on the layout for editing
                                  setSelectedParam(param.name);
                                  setSelectedElement(null);
                                  setConfigTab('builder');
                                  setBuilderMode('edit');
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-lg hover:bg-green-500/20 transition-colors shrink-0"
                                title="On layout — click to edit"
                              >
                                <Check className="w-3.5 h-3.5" />
                                On Layout
                              </button>
                            ) : (
                              <button
                                onClick={() => {
                                  if (!configuratorLayout) return;
                                  const newParam: ParameterElement = {
                                    id: `param-${param.name}`,
                                    type: 'parameter',
                                    order: (configuratorLayout.children || []).length,
                                    parameterName: param.name
                                  };
                                  handleLayoutChange({
                                    ...configuratorLayout,
                                    children: [...(configuratorLayout.children || []), newParam],
                                    controls: {
                                      ...configuratorLayout.controls,
                                      [param.name]: {
                                        controlType: param.type === 'boolean' ? 'toggle' : param.type === 'select' ? 'dropdown' : param.type === 'number' ? 'slider-input' : 'text',
                                        showLabel: true,
                                        showUnit: true,
                                        showDescription: false,
                                        showMinMax: true,
                                        width: 'full'
                                      }
                                    }
                                  });
                                }}
                                className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-orange-400 bg-orange-500/10 border border-orange-500/20 rounded-lg hover:bg-orange-500/20 transition-colors shrink-0"
                                title="Add to layout"
                              >
                                <PlusCircle className="w-3.5 h-3.5" />
                                Add to Layout
                              </button>
                            )}
                          </div>

                          {/* Parameter properties */}
                          <div className="px-3 py-2 bg-slate-900/40 border-t border-slate-700/50">
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                              {param.unit && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-gray-500">Unit</span>
                                  <span className="text-[11px] text-gray-300">{param.unit}</span>
                                </div>
                              )}
                              <div className="flex items-center justify-between">
                                <span className="text-[11px] text-gray-500">Default</span>
                                <span className="text-[11px] text-gray-300">{String(param.defaultValue)}</span>
                              </div>
                              {param.min !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-gray-500">Min</span>
                                  <span className="text-[11px] text-gray-300">{param.min}</span>
                                </div>
                              )}
                              {param.max !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-gray-500">Max</span>
                                  <span className="text-[11px] text-gray-300">{param.max}</span>
                                </div>
                              )}
                              {param.step !== undefined && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-gray-500">Step</span>
                                  <span className="text-[11px] text-gray-300">{param.step}</span>
                                </div>
                              )}
                              {param.options && param.options.length > 0 && (
                                <div className="col-span-2 flex items-start justify-between">
                                  <span className="text-[11px] text-gray-500">Options</span>
                                  <span className="text-[11px] text-gray-300 text-right">{param.options.join(', ')}</span>
                                </div>
                              )}
                              {param.group && (
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-gray-500">Group</span>
                                  <span className="text-[11px] text-gray-300">{param.group}</span>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-12">
                    <Database className="w-10 h-10 mx-auto mb-3 text-gray-600" />
                    <p className="text-sm text-gray-400">No parameters found</p>
                    <p className="text-xs text-gray-500 mt-1">Extract parameters from your CAD model first</p>
                  </div>
                )}
              </div>
            )}

            {configTab === 'settings' && configuratorLayout && (
              <div className="p-4 space-y-6 overflow-y-auto h-full">
                <h2 className="text-lg font-semibold text-white">Configurator Settings</h2>

                {/* Change Template */}
                <button
                  onClick={() => { setShowTemplatePicker(true); setIsTemplateReset(true); }}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-slate-800/80 hover:bg-slate-700/80 border border-slate-600 hover:border-orange-500/50 rounded-xl transition-all group"
                >
                  <LayoutGrid className="w-5 h-5 text-gray-400 group-hover:text-orange-400 transition-colors" />
                  <div className="text-left flex-1">
                    <span className="text-sm font-medium text-white group-hover:text-orange-300 transition-colors">Change Template</span>
                    <p className="text-[11px] text-gray-500">Switch to a different layout template</p>
                  </div>
                  <ChevronDown className="w-4 h-4 text-gray-500 -rotate-90" />
                </button>
                
                {/* Theme */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Theme</label>
                  <div className="flex gap-1.5">
                    {(['dark', 'light', 'auto'] as const).map(t => (
                      <button
                        key={t}
                        onClick={() => handleLayoutChange({ ...configuratorLayout, styling: { ...configuratorLayout?.styling, theme: t } })}
                        className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                          configuratorLayout?.styling?.theme === t
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-700/80 text-gray-400 hover:text-white hover:bg-slate-600'
                        }`}
                      >
                        {t.charAt(0).toUpperCase() + t.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Accent Color */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Accent Color</label>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      value={configuratorLayout?.styling?.accentColor || '#f97316'}
                      onChange={(e) => handleLayoutChange({ ...configuratorLayout, styling: { ...configuratorLayout?.styling, accentColor: e.target.value } })}
                      className="w-10 h-10 rounded cursor-pointer bg-transparent border border-slate-600"
                      title="Accent color picker"
                      aria-label="Accent color picker"
                    />
                    <input
                      type="text"
                      value={configuratorLayout?.styling?.accentColor || '#f97316'}
                      onChange={(e) => handleLayoutChange({ ...configuratorLayout, styling: { ...configuratorLayout?.styling, accentColor: e.target.value } })}
                      className="flex-1 bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 uppercase"
                      title="Accent color hex"
                      aria-label="Accent color hex value"
                    />
                  </div>
                  {/* Quick presets */}
                  <div className="flex gap-1.5 mt-2">
                    {['#f97316', '#3b82f6', '#10b981', '#8b5cf6', '#ef4444', '#ec4899', '#06b6d4'].map(c => (
                      <button
                        key={c}
                        onClick={() => handleLayoutChange({ ...configuratorLayout, styling: { ...configuratorLayout?.styling, accentColor: c } })}
                        className={`w-7 h-7 rounded-lg border-2 transition-colors ${configuratorLayout?.styling?.accentColor === c ? 'border-white scale-110' : 'border-transparent'}`}
                        style={{ backgroundColor: c }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>

                {/* Section Style */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Section Style</label>
                  <div className="flex gap-1.5">
                    {(['card', 'flat', 'bordered'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => handleLayoutChange({ ...configuratorLayout, styling: { ...configuratorLayout?.styling, sectionStyle: s } })}
                        className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                          configuratorLayout?.styling?.sectionStyle === s
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-700/80 text-gray-400 hover:text-white hover:bg-slate-600'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Control Size */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Control Size</label>
                  <div className="flex gap-1.5">
                    {(['compact', 'normal', 'large'] as const).map(s => (
                      <button
                        key={s}
                        onClick={() => handleLayoutChange({ ...configuratorLayout, styling: { ...configuratorLayout?.styling, controlSize: s } })}
                        className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                          configuratorLayout?.styling?.controlSize === s
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-700/80 text-gray-400 hover:text-white hover:bg-slate-600'
                        }`}
                      >
                        {s.charAt(0).toUpperCase() + s.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Panel Width */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Panel Width</label>
                  <div className="flex gap-1.5">
                    {(['narrow', 'medium', 'wide'] as const).map(w => (
                      <button
                        key={w}
                        onClick={() => handleLayoutChange({ ...configuratorLayout, styling: { ...configuratorLayout?.styling, panelWidth: w } })}
                        className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                          configuratorLayout?.styling?.panelWidth === w
                            ? 'bg-orange-500 text-white'
                            : 'bg-slate-700/80 text-gray-400 hover:text-white hover:bg-slate-600'
                        }`}
                      >
                        {w.charAt(0).toUpperCase() + w.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Pricing Tab Content */}
            {configTab === 'pricing' && (
              <div className="p-4 space-y-6 overflow-y-auto h-full">
                <h2 className="text-lg font-semibold text-white flex items-center gap-2">
                  <DollarSign className="w-5 h-5 text-orange-400" />
                  Pricing Rules
                </h2>

                {/* Show Price Toggle */}
                <div className="flex items-center justify-between p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                  <div>
                    <span className="text-sm font-medium text-white">Show Price</span>
                    <p className="text-[11px] text-gray-500">Display price in configurator preview</p>
                  </div>
                  <button
                    onClick={() => updatePricing({ showPrice: !pricing.showPrice })}
                    className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                      pricing.showPrice ? 'bg-orange-500' : 'bg-slate-600'
                    }`}
                    title="Toggle price display"
                  >
                    <span className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform shadow-sm ${
                      pricing.showPrice ? 'left-6' : 'left-1'
                    }`} />
                  </button>
                </div>

                {/* Currency */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Currency</label>
                  <select
                    value={pricing.currency || 'USD'}
                    onChange={(e) => updatePricing({ currency: e.target.value })}
                    className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                    title="Currency"
                  >
                    <option value="USD">USD ($)</option>
                    <option value="EUR">EUR (€)</option>
                    <option value="GBP">GBP (£)</option>
                    <option value="CAD">CAD (C$)</option>
                    <option value="AUD">AUD (A$)</option>
                  </select>
                </div>

                {/* Base Price */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Base Price</label>
                  <input
                    type="number"
                    value={pricing.basePrice || 0}
                    onChange={(e) => updatePricing({ basePrice: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    title="Base price"
                  />
                </div>

                {/* Setup Fee */}
                <div>
                  <label className="text-xs font-medium text-gray-400 block mb-2">Setup Fee</label>
                  <input
                    type="number"
                    value={pricing.setupFee || 0}
                    onChange={(e) => updatePricing({ setupFee: parseFloat(e.target.value) || 0 })}
                    className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                    placeholder="0.00"
                    min={0}
                    step={0.01}
                    title="Setup fee"
                  />
                </div>

                {/* Divider */}
                <div className="border-t border-slate-700 pt-4">
                  <h3 className="text-sm font-semibold text-white mb-3">Parameter Pricing Rules</h3>
                  <p className="text-[11px] text-gray-500 mb-4">Set pricing rules for each parameter to calculate the total price dynamically.</p>
                </div>

                {/* Per-parameter rules */}
                {product?.parameters?.map((param) => {
                  const rule = pricing.parameterRules?.[param.name] || { type: 'none' as const };
                  return (
                    <div key={param.name} className="p-3 bg-slate-800/40 rounded-xl border border-slate-700 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-white">{param.displayName || param.name}</span>
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-slate-700 text-gray-400">{param.type}</span>
                      </div>

                      {/* Rule type selector */}
                      <select
                        value={rule.type}
                        onChange={(e) => updatePricingRule(param.name, { ...rule, type: e.target.value as PricingRule['type'] })}
                        className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                        title={`Pricing rule type for ${param.displayName || param.name}`}
                      >
                        <option value="none">No pricing impact</option>
                        <option value="per-unit">Per-unit (value × rate)</option>
                        <option value="fixed">Fixed add-on</option>
                        <option value="multiplier">Multiplier</option>
                        <option value="option-based">Option-based pricing</option>
                      </select>

                      {/* Rule value input */}
                      {rule.type === 'per-unit' && (
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Rate per unit</label>
                          <input
                            type="number"
                            value={rule.value || 0}
                            onChange={(e) => updatePricingRule(param.name, { ...rule, value: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                            placeholder="Price per unit"
                            step={0.01}
                            title="Rate per unit"
                          />
                        </div>
                      )}
                      {rule.type === 'fixed' && (
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Fixed amount to add</label>
                          <input
                            type="number"
                            value={rule.value || 0}
                            onChange={(e) => updatePricingRule(param.name, { ...rule, value: parseFloat(e.target.value) || 0 })}
                            className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                            placeholder="Fixed add-on price"
                            step={0.01}
                            title="Fixed amount"
                          />
                        </div>
                      )}
                      {rule.type === 'multiplier' && (
                        <div>
                          <label className="text-[11px] text-gray-500 block mb-1">Multiplier (e.g. 1.5 = +50%)</label>
                          <input
                            type="number"
                            value={rule.value || 1}
                            onChange={(e) => updatePricingRule(param.name, { ...rule, value: parseFloat(e.target.value) || 1 })}
                            className="w-full bg-slate-900 text-white text-xs px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                            placeholder="1.0"
                            step={0.1}
                            min={0}
                            title="Multiplier value"
                          />
                        </div>
                      )}
                      {rule.type === 'option-based' && (
                        <div className="space-y-2">
                          <label className="text-[11px] text-gray-500 block">Price per option</label>
                          {(param.options || []).map((opt) => (
                            <div key={opt} className="flex items-center gap-2">
                              <span className="text-xs text-gray-300 flex-1 truncate">{opt}</span>
                              <input
                                type="number"
                                value={rule.optionPrices?.[opt] || 0}
                                onChange={(e) => updatePricingRule(param.name, {
                                  ...rule,
                                  optionPrices: { ...(rule.optionPrices || {}), [opt]: parseFloat(e.target.value) || 0 }
                                })}
                                className="w-24 bg-slate-900 text-white text-xs px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                                placeholder="0.00"
                                step={0.01}
                                title={`Price for ${opt}`}
                              />
                            </div>
                          ))}
                          {(!param.options || param.options.length === 0) && (
                            <p className="text-[11px] text-gray-500 italic">No allowed values defined for this parameter. Add options in the Parameters tab first.</p>
                          )}
                        </div>
                      )}

                      {/* Description */}
                      {rule.type !== 'none' && (
                        <input
                          type="text"
                          value={rule.description || ''}
                          onChange={(e) => updatePricingRule(param.name, { ...rule, description: e.target.value })}
                          className="w-full bg-slate-900 text-gray-300 text-xs px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                          placeholder="Optional description (shown in price breakdown)"
                          title={`Description for ${param.displayName || param.name} pricing rule`}
                        />
                      )}
                    </div>
                  );
                })}

                {/* Live Preview */}
                {pricing.showPrice && (
                  <div className="p-4 bg-gradient-to-br from-orange-500/10 to-orange-600/5 rounded-xl border border-orange-500/20">
                    <h4 className="text-xs font-semibold text-orange-400 mb-2 uppercase tracking-wider">Live Price Preview</h4>
                    {(() => {
                      const result = calculatePrice(configValues);
                      const sym = pricing.currency === 'EUR' ? '€' : pricing.currency === 'GBP' ? '£' : '$';
                      return (
                        <div className="space-y-1.5">
                          {result.breakdown.map((item, i) => (
                            <div key={i} className="flex justify-between text-xs">
                              <span className="text-gray-400">{item.label}</span>
                              <span className="text-gray-300">{sym}{item.amount.toFixed(2)}</span>
                            </div>
                          ))}
                          <div className="border-t border-orange-500/20 pt-1.5 mt-1.5 flex justify-between">
                            <span className="text-sm font-semibold text-white">Total</span>
                            <span className="text-sm font-bold text-orange-400">{sym}{result.total.toFixed(2)}</span>
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
              </div>
            )}
              </div>
            </div>
          );
          })()}

          {/* Panel toggle button - shows when panel is hidden */}
          {!showConfigPanel && (
            <button
              onClick={() => setShowConfigPanel(true)}
              className="absolute top-3 right-3 z-30 p-2 bg-slate-800 border border-slate-700 rounded-lg shadow-lg hover:bg-slate-700 transition-colors"
              title="Show config panel"
            >
              <Sliders className="w-4 h-4 text-gray-400" />
            </button>
          )}

        {/* Properties Panel - Floating overlay, light theme */}
        {showPropertiesPanel && (
          <div 
            className="absolute top-14 bottom-14 right-[380px] z-40 w-[260px] bg-slate-900/95 border border-slate-700/50 rounded-xl shadow-2xl flex flex-col overflow-hidden animate-in slide-in-from-right duration-200"
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-slate-700/50 flex items-center justify-between bg-slate-800/50">
              <div>
                <h3 className="text-sm font-semibold text-white">
                  {selectedParam ? 'Control Settings' : 'Element Settings'}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {selectedParam
                    ? product?.parameters?.find(p => p.name === selectedParam)?.displayName || selectedParam
                    : selectedElement?.type ? selectedElement.type.charAt(0).toUpperCase() + selectedElement.type.slice(1).replace('-', ' ') : ''
                  }
                </p>
              </div>
              <button
                onClick={closePropertiesPanel}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                title="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Properties Content */}
            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {/* Parameter Control Settings */}
              {selectedParam && (
                <>
                  {/* Control Type */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-2">Control Type</label>
                    <select
                      value={getControlConfig(selectedParam).controlType}
                      onChange={(e) => updateControlConfig(selectedParam, { controlType: e.target.value as ControlConfig['controlType'] })}
                      title="Control type"
                      className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    >
                      <option value="slider">Slider</option>
                      <option value="slider-input">Slider + Input</option>
                      <option value="input">Input</option>
                      <option value="text">Text</option>
                      <option value="dropdown">Dropdown</option>
                      <option value="toggle">Toggle</option>
                      <option value="color">Color</option>
                    </select>
                  </div>

                  {/* Width */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-2">Width</label>
                    <div className="flex gap-1.5">
                      {(['full', 'half', 'third'] as const).map((w) => (
                        <button
                          key={w}
                          onClick={() => updateControlConfig(selectedParam, { width: w })}
                          className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                            getControlConfig(selectedParam).width === w
                              ? 'bg-orange-500 text-white'
                              : 'bg-slate-700/80 text-gray-400 hover:text-white hover:bg-slate-600'
                          }`}
                        >
                          {w.charAt(0).toUpperCase() + w.slice(1)}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Display Options */}
                  <div className="space-y-2.5">
                    <label className="text-xs font-medium text-gray-400 block">Display Options</label>
                    {[
                      { key: 'showLabel', label: 'Show Label' },
                      { key: 'showUnit', label: 'Show Unit' },
                      { key: 'showDescription', label: 'Show Description' },
                      { key: 'showMinMax', label: 'Show Min/Max' },
                    ].map(({ key, label }) => (
                      <label key={key} className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                        <input
                          type="checkbox"
                          checked={getControlConfig(selectedParam)[key as keyof ControlConfig] as boolean}
                          onChange={(e) => updateControlConfig(selectedParam, { [key]: e.target.checked })}
                          className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-orange-500 focus:ring-orange-500/30"
                        />
                        <span className="group-hover:text-white transition-colors">{label}</span>
                      </label>
                    ))}
                  </div>

                  {/* Label Override */}
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-gray-400 block">Label</label>
                    {/* Default / Custom toggle */}
                    <div className="flex bg-slate-800 rounded-lg p-0.5 border border-slate-700">
                      <button
                        onClick={() => updateControlConfig(selectedParam, { customLabel: undefined })}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                          !getControlConfig(selectedParam).customLabel
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        Default
                      </button>
                      <button
                        onClick={() => {
                          if (!getControlConfig(selectedParam).customLabel) {
                            const defaultName = product?.parameters?.find(p => p.name === selectedParam)?.displayName || selectedParam;
                            updateControlConfig(selectedParam, { customLabel: defaultName });
                          }
                        }}
                        className={`flex-1 text-xs font-medium py-1.5 rounded-md transition-all ${
                          getControlConfig(selectedParam).customLabel
                            ? 'bg-orange-500 text-white shadow-sm'
                            : 'text-gray-400 hover:text-gray-300'
                        }`}
                      >
                        Custom
                      </button>
                    </div>
                    {/* Show default name preview when Default is selected */}
                    {!getControlConfig(selectedParam).customLabel && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-slate-800/50 rounded-lg border border-slate-700/50">
                        <span className="text-xs text-gray-500">Using:</span>
                        <span className="text-sm text-gray-300">
                          {product?.parameters?.find(p => p.name === selectedParam)?.displayName || selectedParam}
                        </span>
                      </div>
                    )}
                    {/* Show editable input when Custom is selected */}
                    {getControlConfig(selectedParam).customLabel && (
                      <input
                        type="text"
                        value={getControlConfig(selectedParam).customLabel || ''}
                        onChange={(e) => updateControlConfig(selectedParam, { customLabel: e.target.value || undefined })}
                        placeholder="Enter custom label..."
                        className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                        autoFocus
                      />
                    )}
                  </div>

                  {/* Min / Max / Step - only for slider, input, slider-input, dropdown */}
                  {['slider', 'input', 'slider-input', 'dropdown'].includes(getControlConfig(selectedParam).controlType) && (
                    <div className="space-y-2">
                      <label className="text-xs font-medium text-gray-400 block">Constraints</label>
                      <div className="grid grid-cols-3 gap-2">
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 block mb-1">Min</label>
                          <input
                            type="number"
                            value={getControlConfig(selectedParam).customMin ?? ''}
                            onChange={(e) => updateControlConfig(selectedParam, { customMin: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                            placeholder={String(product?.parameters?.find(p => p.name === selectedParam)?.min ?? 'Min')}
                            className="w-full bg-slate-800 text-white text-sm px-2.5 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 block mb-1">Max</label>
                          <input
                            type="number"
                            value={getControlConfig(selectedParam).customMax ?? ''}
                            onChange={(e) => updateControlConfig(selectedParam, { customMax: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                            placeholder={String(product?.parameters?.find(p => p.name === selectedParam)?.max ?? 'Max')}
                            className="w-full bg-slate-800 text-white text-sm px-2.5 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-[10px] font-medium text-gray-500 block mb-1">Step</label>
                          <input
                            type="number"
                            value={getControlConfig(selectedParam).customStep ?? ''}
                            onChange={(e) => updateControlConfig(selectedParam, { customStep: e.target.value === '' ? undefined : parseFloat(e.target.value) })}
                            placeholder={String(product?.parameters?.find(p => p.name === selectedParam)?.step ?? 'Step')}
                            min={0}
                            className="w-full bg-slate-800 text-white text-sm px-2.5 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                      </div>
                      <p className="text-[10px] text-gray-600">Leave empty to use parameter defaults</p>
                    </div>
                  )}

                  {/* Placeholder */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-2">Placeholder</label>
                    <input
                      type="text"
                      value={getControlConfig(selectedParam).placeholder || ''}
                      onChange={(e) => updateControlConfig(selectedParam, { placeholder: e.target.value || undefined })}
                      placeholder="Enter value..."
                      className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </div>

                  {/* Custom Description */}
                  <div>
                    <label className="text-xs font-medium text-gray-400 block mb-2">Description</label>
                    <input
                      type="text"
                      value={getControlConfig(selectedParam).customDescription || ''}
                      onChange={(e) => updateControlConfig(selectedParam, { customDescription: e.target.value || undefined })}
                      placeholder="Help text shown below control..."
                      className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    />
                  </div>

                </>
              )}

              {/* Element Settings */}
              {selectedElement && !selectedParam && (() => {
                return (
                  <>
                    {/* Section Element */}
                    {selectedElement.type === 'section' && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Section Title</label>
                          <input
                            type="text"
                            value={(selectedElement as any).label || ''}
                            onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                            placeholder="Enter section title..."
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Description</label>
                          <input
                            type="text"
                            value={(selectedElement as SectionElement).description || ''}
                            onChange={(e) => updateElement(selectedElement.id, { description: e.target.value || undefined })}
                            placeholder="Optional description..."
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Icon</label>
                          <input
                            type="text"
                            value={(selectedElement as SectionElement).icon || ''}
                            onChange={(e) => updateElement(selectedElement.id, { icon: e.target.value || undefined })}
                            placeholder="e.g. Settings, Box"
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={(selectedElement as any).collapsible || false}
                              onChange={(e) => updateElement(selectedElement.id, { collapsible: e.target.checked })}
                              className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-orange-500 focus:ring-orange-500/30"
                            />
                            <span className="group-hover:text-white transition-colors">Collapsible</span>
                          </label>
                          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={(selectedElement as SectionElement).defaultExpanded ?? true}
                              onChange={(e) => updateElement(selectedElement.id, { defaultExpanded: e.target.checked })}
                              className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-orange-500 focus:ring-orange-500/30"
                            />
                            <span className="group-hover:text-white transition-colors">Default Expanded</span>
                          </label>
                        </div>
                      </>
                    )}

                    {/* Label Element */}
                    {selectedElement.type === 'label' && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Label Text</label>
                          <input
                            type="text"
                            value={(selectedElement as LabelElement).text || ''}
                            onChange={(e) => updateElement(selectedElement.id, { text: e.target.value })}
                            placeholder="Enter label text..."
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Variant</label>
                          <select
                            value={(selectedElement as LabelElement).variant || 'body'}
                            onChange={(e) => updateElement(selectedElement.id, { variant: e.target.value })}
                            title="Label variant"
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          >
                            <option value="heading">Heading</option>
                            <option value="subheading">Subheading</option>
                            <option value="body">Body</option>
                            <option value="caption">Caption</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Alignment</label>
                          <div className="flex gap-1.5">
                            {(['left', 'center', 'right'] as const).map(a => (
                              <button
                                key={a}
                                onClick={() => updateElement(selectedElement.id, { align: a })}
                                className={`flex-1 py-2 text-xs rounded-lg font-medium transition-colors ${
                                  ((selectedElement as LabelElement).align || 'left') === a
                                    ? 'bg-orange-500 text-white'
                                    : 'bg-slate-700/80 text-gray-400 hover:text-white hover:bg-slate-600'
                                }`}
                              >
                                {a.charAt(0).toUpperCase() + a.slice(1)}
                              </button>
                            ))}
                          </div>
                        </div>
                      </>
                    )}

                    {/* Group Element */}
                    {selectedElement.type === 'group' && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Group Title</label>
                          <input
                            type="text"
                            value={(selectedElement as any).label || ''}
                            onChange={(e) => updateElement(selectedElement.id, { label: e.target.value })}
                            placeholder="Enter group title..."
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div className="space-y-2.5">
                          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={(selectedElement as any).collapsible || false}
                              onChange={(e) => updateElement(selectedElement.id, { collapsible: e.target.checked })}
                              className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-orange-500 focus:ring-orange-500/30"
                            />
                            <span className="group-hover:text-white transition-colors">Collapsible</span>
                          </label>
                          <label className="flex items-center gap-3 text-sm text-gray-300 cursor-pointer group">
                            <input
                              type="checkbox"
                              checked={(selectedElement as GroupElement).defaultExpanded ?? true}
                              onChange={(e) => updateElement(selectedElement.id, { defaultExpanded: e.target.checked })}
                              className="w-4 h-4 rounded bg-slate-700 border-slate-600 text-orange-500 focus:ring-orange-500/30"
                            />
                            <span className="group-hover:text-white transition-colors">Default Expanded</span>
                          </label>
                        </div>
                      </>
                    )}

                    {/* Picture Element */}
                    {selectedElement.type === 'picture' && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Image URL</label>
                          <input
                            type="text"
                            value={(selectedElement as PictureElement).url || ''}
                            onChange={(e) => updateElement(selectedElement.id, { url: e.target.value })}
                            placeholder="https://..."
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Alt Text</label>
                          <input
                            type="text"
                            value={(selectedElement as PictureElement).alt || ''}
                            onChange={(e) => updateElement(selectedElement.id, { alt: e.target.value || undefined })}
                            placeholder="Image description..."
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="text-xs font-medium text-gray-400 block mb-2">Width</label>
                            <input
                              type="text"
                              value={(selectedElement as PictureElement).width || ''}
                              onChange={(e) => updateElement(selectedElement.id, { width: e.target.value || undefined })}
                              placeholder="100%, 200px"
                              className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                            />
                          </div>
                          <div>
                            <label className="text-xs font-medium text-gray-400 block mb-2">Height</label>
                            <input
                              type="text"
                              value={(selectedElement as PictureElement).height || ''}
                              onChange={(e) => updateElement(selectedElement.id, { height: e.target.value || undefined })}
                              placeholder="auto, 150px"
                              className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Object Fit</label>
                          <select
                            value={(selectedElement as PictureElement).objectFit || 'contain'}
                            onChange={(e) => updateElement(selectedElement.id, { objectFit: e.target.value })}
                            title="Object fit"
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          >
                            <option value="contain">Contain</option>
                            <option value="cover">Cover</option>
                            <option value="fill">Fill</option>
                          </select>
                        </div>
                      </>
                    )}

                    {/* Empty Space */}
                    {selectedElement.type === 'empty-space' && (
                      <div>
                        <label className="text-xs font-medium text-gray-400 block mb-2">Height (px)</label>
                        <input
                          type="number"
                          value={(selectedElement as EmptySpaceElement).height || 20}
                          onChange={(e) => updateElement(selectedElement.id, { height: parseInt(e.target.value) || 20 })}
                          min={4}
                          max={200}
                          title="Element height in pixels"
                          className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                        />
                      </div>
                    )}

                    {/* Splitter */}
                    {selectedElement.type === 'splitter' && (
                      <>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Orientation</label>
                          <select
                            value={(selectedElement as SplitterElement).orientation || 'horizontal'}
                            onChange={(e) => updateElement(selectedElement.id, { orientation: e.target.value })}
                            title="Splitter orientation"
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          >
                            <option value="horizontal">Horizontal</option>
                            <option value="vertical">Vertical</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Style</label>
                          <select
                            value={(selectedElement as SplitterElement).lineStyle || 'solid'}
                            onChange={(e) => updateElement(selectedElement.id, { lineStyle: e.target.value })}
                            title="Splitter style"
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          >
                            <option value="solid">Solid</option>
                            <option value="dashed">Dashed</option>
                            <option value="dotted">Dotted</option>
                          </select>
                        </div>
                        <div>
                          <label className="text-xs font-medium text-gray-400 block mb-2">Margin (px)</label>
                          <input
                            type="number"
                            value={(selectedElement as SplitterElement).margin ?? 8}
                            onChange={(e) => updateElement(selectedElement.id, { margin: parseInt(e.target.value) || 8 })}
                            min={0}
                            max={100}
                            title="Margin in pixels"
                            className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                          />
                        </div>
                      </>
                    )}

                    {/* Row */}
                    {selectedElement.type === 'row' && (
                      <div>
                        <label className="text-xs font-medium text-gray-400 block mb-2">Gap (px)</label>
                        <input
                          type="number"
                          value={(selectedElement as RowElement).gap ?? 8}
                          onChange={(e) => updateElement(selectedElement.id, { gap: parseInt(e.target.value) || 8 })}
                          min={0}
                          max={100}
                          title="Gap between children in pixels"
                          className="w-full bg-slate-800 text-white text-sm px-3 py-2.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                        />
                      </div>
                    )}

                    {/* Tab Group */}
                    {selectedElement.type === 'tab-group' && (() => {
                      const tg = selectedElement as TabGroupElement;
                      return (
                        <div className="space-y-3">
                          <label className="text-xs font-medium text-gray-400 block">Tabs</label>
                          <div className="space-y-2">
                            {tg.tabs.map((tab, idx) => (
                              <div key={tab.id} className="flex items-center gap-1.5">
                                <input
                                  type="text"
                                  value={tab.label}
                                  onChange={(e) => {
                                    const newTabs = tg.tabs.map(t =>
                                      t.id === tab.id ? { ...t, label: e.target.value } : t
                                    );
                                    updateElement(selectedElement.id, { tabs: newTabs });
                                  }}
                                  className="flex-1 bg-slate-800 text-white text-sm px-3 py-2 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500 focus:ring-1 focus:ring-orange-500/30 transition-colors"
                                  title={`Tab ${idx + 1} label`}
                                />
                                {tg.tabs.length > 1 && (
                                  <button
                                    onClick={() => {
                                      const newTabs = tg.tabs.filter(t => t.id !== tab.id);
                                      updateElement(selectedElement.id, { tabs: newTabs });
                                    }}
                                    className="p-1.5 text-gray-500 hover:text-red-400 transition-colors"
                                    title="Remove tab"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            ))}
                          </div>
                          <button
                            onClick={() => {
                              const newId = `tab-${Date.now()}`;
                              const newTabs = [...tg.tabs, { id: newId, label: `Tab Group ${tg.tabs.length + 1}`, children: [] }];
                              updateElement(selectedElement.id, { tabs: newTabs });
                            }}
                            className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-gray-400 hover:text-blue-400 border border-dashed border-slate-600 hover:border-blue-500/50 rounded-lg transition-colors"
                          >
                            <Plus className="w-3.5 h-3.5" />
                            Add Tab
                          </button>
                        </div>
                      );
                    })()}

                    {/* ============================================ */}
                    {/* ELEMENT STYLE EDITOR — applies to all types  */}
                    {/* ============================================ */}
                    <div className="pt-4 border-t border-slate-700/50">
                      <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Style Overrides</h4>
                      
                      {/* Background & Text Color */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Background</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={selectedElement.style?.backgroundColor || '#1e293b'}
                              onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, backgroundColor: e.target.value } })}
                              className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                              title="Background color"
                              aria-label="Background color"
                            />
                            <button
                              onClick={() => {
                                const s = { ...selectedElement.style };
                                delete s.backgroundColor;
                                updateElement(selectedElement.id, { style: Object.keys(s).length ? s : undefined });
                              }}
                              className="text-[10px] text-gray-500 hover:text-red-400"
                              title="Reset"
                            >✕</button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Text Color</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={selectedElement.style?.textColor || '#f8fafc'}
                              onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, textColor: e.target.value } })}
                              className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                              title="Text color"
                              aria-label="Text color"
                            />
                            <button
                              onClick={() => {
                                const s = { ...selectedElement.style };
                                delete s.textColor;
                                updateElement(selectedElement.id, { style: Object.keys(s).length ? s : undefined });
                              }}
                              className="text-[10px] text-gray-500 hover:text-red-400"
                              title="Reset"
                            >✕</button>
                          </div>
                        </div>
                      </div>

                      {/* Padding & Margin */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Padding (px)</label>
                          <input
                            type="number"
                            value={selectedElement.style?.padding ?? ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? undefined : parseInt(e.target.value);
                              updateElement(selectedElement.id, { style: { ...selectedElement.style, padding: v } });
                            }}
                            min={0} max={200} placeholder="—"
                            title="Padding"
                            className="w-full bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Margin (px)</label>
                          <input
                            type="number"
                            value={selectedElement.style?.margin ?? ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? undefined : parseInt(e.target.value);
                              updateElement(selectedElement.id, { style: { ...selectedElement.style, margin: v } });
                            }}
                            min={0} max={200} placeholder="—"
                            title="Margin"
                            className="w-full bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* Border Radius */}
                      <div className="mb-3">
                        <label className="text-xs text-gray-500 block mb-1">Border Radius (px)</label>
                        <input
                          type="number"
                          value={selectedElement.style?.borderRadius ?? ''}
                          onChange={(e) => {
                            const v = e.target.value === '' ? undefined : parseInt(e.target.value);
                            updateElement(selectedElement.id, { style: { ...selectedElement.style, borderRadius: v } });
                          }}
                          min={0} max={100} placeholder="—"
                          title="Border radius"
                          className="w-full bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                        />
                      </div>

                      {/* Border Color & Width */}
                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Border Color</label>
                          <div className="flex items-center gap-1.5">
                            <input
                              type="color"
                              value={selectedElement.style?.borderColor || '#334155'}
                              onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, borderColor: e.target.value } })}
                              className="w-8 h-8 rounded cursor-pointer bg-transparent border border-slate-600"
                              title="Border color"
                              aria-label="Border color"
                            />
                            <button
                              onClick={() => {
                                const s = { ...selectedElement.style };
                                delete s.borderColor;
                                updateElement(selectedElement.id, { style: Object.keys(s).length ? s : undefined });
                              }}
                              className="text-[10px] text-gray-500 hover:text-red-400"
                              title="Reset"
                            >✕</button>
                          </div>
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Border Width</label>
                          <input
                            type="number"
                            value={selectedElement.style?.borderWidth ?? ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? undefined : parseInt(e.target.value);
                              updateElement(selectedElement.id, { style: { ...selectedElement.style, borderWidth: v } });
                            }}
                            min={0} max={20} placeholder="—"
                            title="Border width"
                            className="w-full bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                      </div>

                      {/* Typography */}
                      <div className="mb-3">
                        <label className="text-xs text-gray-500 block mb-1">Font Family</label>
                        <select
                          value={selectedElement.style?.fontFamily || ''}
                          onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontFamily: e.target.value || undefined } })}
                          title="Font family"
                          className="w-full bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                        >
                          <option value="">Default</option>
                          <option value="Inter, sans-serif">Inter</option>
                          <option value="'Roboto', sans-serif">Roboto</option>
                          <option value="'Open Sans', sans-serif">Open Sans</option>
                          <option value="'Poppins', sans-serif">Poppins</option>
                          <option value="'Montserrat', sans-serif">Montserrat</option>
                          <option value="monospace">Monospace</option>
                          <option value="serif">Serif</option>
                        </select>
                      </div>

                      <div className="grid grid-cols-2 gap-2 mb-3">
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Font Size</label>
                          <input
                            type="number"
                            value={selectedElement.style?.fontSize ?? ''}
                            onChange={(e) => {
                              const v = e.target.value === '' ? undefined : parseInt(e.target.value);
                              updateElement(selectedElement.id, { style: { ...selectedElement.style, fontSize: v } });
                            }}
                            min={8} max={72} placeholder="—"
                            title="Font size"
                            className="w-full bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                          />
                        </div>
                        <div>
                          <label className="text-xs text-gray-500 block mb-1">Font Weight</label>
                          <select
                            value={selectedElement.style?.fontWeight ?? ''}
                            onChange={(e) => updateElement(selectedElement.id, { style: { ...selectedElement.style, fontWeight: e.target.value ? parseInt(e.target.value) : undefined } })}
                            title="Font weight"
                            className="w-full bg-slate-800 text-white text-sm px-2 py-1.5 rounded-lg border border-slate-600 focus:outline-none focus:border-orange-500"
                          >
                            <option value="">Default</option>
                            <option value="300">Light (300)</option>
                            <option value="400">Regular (400)</option>
                            <option value="500">Medium (500)</option>
                            <option value="600">Semibold (600)</option>
                            <option value="700">Bold (700)</option>
                          </select>
                        </div>
                      </div>

                      {/* Opacity */}
                      <div>
                        <label className="text-xs text-gray-500 block mb-1">Opacity</label>
                        <input
                          type="range"
                          min={0} max={1} step={0.05}
                          value={selectedElement.style?.opacity ?? 1}
                          onChange={(e) => {
                            const v = parseFloat(e.target.value);
                            updateElement(selectedElement.id, { style: { ...selectedElement.style, opacity: v === 1 ? undefined : v } });
                          }}
                          title="Opacity"
                          className="w-full h-2 bg-slate-700 rounded-lg appearance-none cursor-pointer accent-orange-500"
                        />
                        <div className="text-right text-[10px] text-gray-500">{Math.round((selectedElement.style?.opacity ?? 1) * 100)}%</div>
                      </div>
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}
      </main>

      </div>{/* end outer flex wrapper */}
    </div>
  );
}

// ============================================================================
// MAIN EXPORT WITH SUSPENSE
// ============================================================================

export default function ConfiguratorPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-gray-400">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span>Loading...</span>
        </div>
      </div>
    }>
      <ConfiguratorPageContent />
    </Suspense>
  );
}
