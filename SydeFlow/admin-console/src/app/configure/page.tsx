'use client';

import { useState, useEffect, useRef, useCallback, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  ChevronRight, ChevronDown, Loader2,
  DollarSign, FileText, Send, RotateCcw,
  Minus, Plus, AlertCircle, CheckCircle,
  Box, X, SlidersHorizontal, Image as ImageIcon,
  PanelRightOpen, PanelRightClose,
  Ruler, Package, RefreshCw, Receipt, Download,
  Info, Database, LayoutGrid
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

// ============================================================================
// TYPES
// ============================================================================

interface Parameter {
  name: string;
  displayName: string;
  type: 'number' | 'text' | 'boolean';
  defaultValue: number | string | boolean;
  unit?: string;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

interface ControlConfig {
  controlType: 'slider' | 'slider-input' | 'toggle' | 'color' | 'dropdown' | 'input' | 'text';
  width: 'full' | 'half' | 'third';
  showLabel: boolean;
  showUnit: boolean;
  showDescription: boolean;
  showMinMax: boolean;
  customLabel?: string;
  customDescription?: string;
  customMin?: number;
  customMax?: number;
  customStep?: number;
  prefix?: string;
  suffix?: string;
  placeholder?: string;
}

interface PricingConfig {
  basePrice: number;
  currency: string;
  showPrice: boolean;
  parameterRules?: Record<string, PricingRule>;
  setupFee?: number;
}

interface PricingRule {
  type: 'none' | 'per-unit' | 'fixed' | 'multiplier' | 'option-based';
  value?: number;
  optionPrices?: Record<string, number>;
}

interface LayoutElement {
  id: string;
  type: string;
  order: number;
  style?: Record<string, any>;
  parameterName?: string;
  label?: string;
  description?: string;
  collapsible?: boolean;
  defaultExpanded?: boolean;
  children?: LayoutElement[];
  tabs?: { id: string; label: string; children: LayoutElement[] }[];
  text?: string;
  variant?: string;
  align?: string;
  lineStyle?: string;
  margin?: number;
  orientation?: string;
  height?: number;
  url?: string;
  alt?: string;
  width?: string | number;
  objectFit?: string;
  gap?: number;
}

interface ConfiguratorLayout {
  version: number;
  children?: LayoutElement[];
  sections?: any[];
  controls?: Record<string, ControlConfig>;
  styling: {
    theme: string;
    accentColor: string;
    sectionStyle: string;
    [key: string]: any;
  };
  actions: {
    primaryButton: { label: string; action: string; style: string };
    secondaryButton?: { label: string; action: string; style: string };
    showResetButton: boolean;
  };
}

interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  parameters: Parameter[];
  pricing?: PricingConfig;
  lastOutputUrn?: string;
  configuratorLayout?: ConfiguratorLayout;
  thumbnail?: string;
  productImage?: string;
  sourceFile?: {
    bucketKey: string;
    objectKey: string;
    fileName?: string;
  };
  drawingFile?: {
    bucketKey: string;
    objectKey: string;
    fileName?: string;
  };
  automation?: {
    activityId?: string;
    dwgActivityId?: string;
    enableDwgExport?: boolean;
  };
}

interface PriceBreakdown {
  label: string;
  amount: number;
}

type ViewerTab = '3d' | '2d' | 'bom' | 'summary';
type ConfigPanelTab = 'details' | 'parameters' | 'builder' | 'pricing';


// ============================================================================
// MAIN PAGE (with Suspense wrapper)
// ============================================================================
export default function ConfigurePage() {
  return (
    <Suspense fallback={
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
      </div>
    }>
      <ConfigurePageInner />
    </Suspense>
  );
}

function ConfigurePageInner() {
  const searchParams = useSearchParams();
  const productId = searchParams.get('id');
  const isEmbedMode = searchParams.get('embed') === 'true';

  // ── Core State ──
  const [product, setProduct] = useState<Product | null>(null);
  const [layout, setLayout] = useState<ConfiguratorLayout | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, any>>({});
  const [displayValues, setDisplayValues] = useState<Record<string, any>>({});
  const sliderTimerRef = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const [quantity, setQuantity] = useState(1);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());
  const [activeTabIds, setActiveTabIds] = useState<Record<string, string>>({});

  // ── UI State ──
  const [viewerTab, setViewerTab] = useState<ViewerTab>('3d');
  const [configPanelTab, setConfigPanelTab] = useState<ConfigPanelTab>('parameters');
  const [showConfigPanel, setShowConfigPanel] = useState(true);

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

  // ── Quote State ──
  const [quoteSubmitting, setQuoteSubmitting] = useState(false);
  const [quoteSubmitted, setQuoteSubmitted] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);
  const [submittedQuoteId, setSubmittedQuoteId] = useState<string | null>(null);
  const [linkCopied, setLinkCopied] = useState(false);
  const [customerForm, setCustomerForm] = useState({
    name: '',
    email: '',
    phone: '',
    company: '',
    notes: '',
  });

  // ── 3D Viewer ──
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<any>(null);
  const [viewerLoading, setViewerLoading] = useState(true);
  const [viewerError, setViewerError] = useState(false);
  const [viewerErrorMsg, setViewerErrorMsg] = useState<string | null>(null);

  // ── 2D DWG Viewer ──
  const viewer2dRef = useRef<HTMLDivElement>(null);
  const viewer2dInstance = useRef<any>(null);
  const [viewer2dLoading, setViewer2dLoading] = useState(false);
  const [dwgUrn, setDwgUrn] = useState<string | null>(null);
  const [dwgDownloadUrl, setDwgDownloadUrl] = useState<string | null>(null);

  // ── Change detection ──
  const [hasChanges, setHasChanges] = useState(false);
  const lastRegenValues = useRef<Record<string, any>>({});
  const toast = useToast();

  // ── Regeneration State (dual: 3D IPT + 2D DWG) ──
  const [regenerating, setRegenerating] = useState(false);
  const [regenProgress, setRegenProgress] = useState<string>('');
  const [regenWorkItemId, setRegenWorkItemId] = useState<string | null>(null);
  const [regenError, setRegenError] = useState<string | null>(null);
  // Separate tracking for parallel DWG work item
  const [dwgRegenerating, setDwgRegenerating] = useState(false);
  const [dwgRegenProgress, setDwgRegenProgress] = useState<string>('');
  const [dwgRegenWorkItemId, setDwgRegenWorkItemId] = useState<string | null>(null);

  // ── Download State ──
  const [downloading, setDownloading] = useState(false);

  // ============================================================================
  // POSTMESSAGE API — lets Shopify/Webflow/custom parent pages listen to events
  // Usage in parent: window.addEventListener('message', e => console.log(e.data))
  // ============================================================================
  const postToParent = useCallback((type: string, payload: Record<string, any> = {}) => {
    if (typeof window === 'undefined') return;
    const message = { source: 'sydeflow-configurator', type, productId, ...payload };
    window.parent.postMessage(message, '*');
  }, [productId]);

  // ============================================================================
  // DATA LOADING
  // ============================================================================
  useEffect(() => {
    if (!productId) {
      setError('No product ID specified. Please use ?id=<productId> in the URL.');
      setLoading(false);
      return;
    }

    const loadProduct = async () => {
      try {
        setLoading(true);
        const [prodRes, layoutRes] = await Promise.all([
          fetch(`/api/products/${productId}`),
          fetch(`/api/products/${productId}/layout`),
        ]);

        if (!prodRes.ok) throw new Error('Product not found');

        const prodData = await prodRes.json();
        const layoutData = await layoutRes.json();

        if (!prodData.success) throw new Error(prodData.error || 'Failed to load product');

        const prod = prodData.product;
        setProduct(prod);

        // Initialize 2D DWG viewer URN from product's drawingFile if available
        if (prod.drawingFile?.urn) {
          setDwgUrn(prod.drawingFile.urn);
        }

        if (layoutData.success && layoutData.layout) {
          setLayout(layoutData.layout);
          const expanded = new Set<string>();
          const initSections = (elements: LayoutElement[]) => {
            elements.forEach(el => {
              if ((el.type === 'section' || el.type === 'group') && el.defaultExpanded !== false) {
                expanded.add(el.id);
              }
              if (el.children) initSections(el.children);
              if (el.tabs) el.tabs.forEach(t => initSections(t.children));
            });
          };
          if (layoutData.layout.children) initSections(layoutData.layout.children);
          setExpandedSections(expanded);
        }

        const defaults: Record<string, any> = {};
        (prod.parameters || []).forEach((p: Parameter) => {
          defaults[p.name] = p.defaultValue;
        });
        setValues(defaults);
        setDisplayValues(defaults);
        lastRegenValues.current = { ...defaults };
        setLoading(false);
      } catch (err: any) {
        setError(err.message || 'Failed to load product');
        setLoading(false);
      }
    };

    loadProduct();
  }, [productId]);

  // ============================================================================
  // 3D VIEWER INIT
  // ============================================================================
  useEffect(() => {
    // Need either lastOutputUrn or a sourceFile to build a URN from
    if (!product?.lastOutputUrn && !product?.sourceFile) {
      setViewerLoading(false);
      setViewerError(true);
      return;
    }

    // Reset error/loading state when a valid URN is available
    setViewerError(false);
    setViewerErrorMsg(null);
    setViewerLoading(true);

    // Helper: compute base64 URN from sourceFile bucket/object  
    const getSourceFileUrn = (): string | null => {
      if (!product?.sourceFile?.bucketKey || !product?.sourceFile?.objectKey) return null;
      const objectId = `urn:adsk.objects:os.object:${product.sourceFile.bucketKey}/${product.sourceFile.objectKey}`;
      return btoa(objectId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
    };

    const loadViewer = async () => {
      try {
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

        const tokenRes = await fetch('/api/auth/token');
        if (!tokenRes.ok) throw new Error('Failed to get viewer token');
        const tokenData = await tokenRes.json();

        if (!tokenData.access_token) {
          console.error('Viewer token error:', tokenData.diagnostic || 'No token returned');
          setViewerLoading(false);
          setViewerError(true);
          return;
        }

        // Poll translation status before loading — with source file fallback
        let activeUrn = product.lastOutputUrn || getSourceFileUrn() || '';
        let translationTriggered = false;
        let fellBackToSource = false;

        const triggerTranslation = async (urn: string, force = false) => {
          try {
            console.log('Configure: Triggering SVF translation for URN (force=' + force + '):', urn.substring(0, 50));
            await fetch('/api/workflow/translate', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ urn, force }),
            });
            translationTriggered = true;
          } catch (err) {
            console.error('Configure: Failed to trigger translation:', err);
          }
        };

        const pollTranslationStatus = (urn: string): Promise<boolean> => {
          return new Promise((resolve) => {
            let retries = 0;
            const maxRetries = 60;
            const checkStatus = async () => {
              if (retries++ >= maxRetries) {
                console.error('Configure: Translation polling timed out');
                resolve(false);
                return;
              }
              try {
                const manifestRes = await fetch(`/api/translation/${urn}`);
                if (manifestRes.ok) {
                  const manifest = await manifestRes.json();
                  console.log('Configure: Translation status:', manifest.status, manifest.progress);
                  if (manifest.status === 'success') {
                    resolve(true);
                  } else if (manifest.status === 'failed') {
                    // Re-trigger translation (server uses xAdsForce:true)
                    if (!translationTriggered) {
                      console.log('Configure: Translation failed, re-triggering...');
                      await triggerTranslation(urn);
                      setTimeout(checkStatus, 5000);
                    } else if (retries < 5) {
                      // Give it a few more retries after re-trigger
                      setTimeout(checkStatus, 5000);
                    } else if (!fellBackToSource) {
                      // Output file may be expired/deleted — fall back to source file
                      const sourceUrn = getSourceFileUrn();
                      if (sourceUrn && urn !== sourceUrn) {
                        console.log('Configure: Translation permanently failed, falling back to source file URN');
                        fellBackToSource = true;
                        translationTriggered = false;
                        activeUrn = sourceUrn;
                        retries = 0;
                        const srcRes = await fetch(`/api/translation/${sourceUrn}`);
                        if (srcRes.ok) {
                          const srcManifest = await srcRes.json();
                          if (srcManifest.status === 'success') { resolve(true); return; }
                        }
                        await triggerTranslation(sourceUrn);
                        const pollSource = async () => {
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
                        resolve(false);
                      }
                    } else {
                      resolve(false);
                    }
                  } else {
                    setTimeout(checkStatus, 3000);
                  }
                } else if (manifestRes.status === 403) {
                  // Model belongs to a different APS account — can't access, stop polling
                  console.error('Configure: Model access forbidden (403) — credentials mismatch');
                  setViewerErrorMsg('This 3D model was generated with different APS credentials and cannot be accessed. Re-run the automation in the admin panel to regenerate it.');
                  resolve(false);
                } else if (manifestRes.status === 404 && !translationTriggered) {
                  await triggerTranslation(urn);
                  setTimeout(checkStatus, 5000);
                } else if (manifestRes.status === 404 && translationTriggered && retries > 8 && !fellBackToSource) {
                  // Expired output — fall back to source file
                  const sourceUrn = getSourceFileUrn();
                  if (sourceUrn && urn !== sourceUrn) {
                    console.log('Configure: Falling back to source file URN');
                    fellBackToSource = true;
                    translationTriggered = false;
                    activeUrn = sourceUrn;
                    retries = 0;
                    // Check source file translation
                    const srcRes = await fetch(`/api/translation/${sourceUrn}`);
                    if (srcRes.ok) {
                      const srcManifest = await srcRes.json();
                      if (srcManifest.status === 'success') { resolve(true); return; }
                    }
                    await triggerTranslation(sourceUrn);
                    // Continue polling with new URN
                    const pollSource = async () => {
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
                console.warn('Configure: Translation check error, retrying...', err);
                setTimeout(checkStatus, 3000);
              }
            };
            checkStatus();
          });
        };

        const translationReady = await pollTranslationStatus(activeUrn);
        if (!translationReady) {
          console.error('Configure: Model translation not ready');
          setViewerLoading(false);
          setViewerError(true);
          return;
        }

        if (viewerRef.current && (window as any).Autodesk) {
          const Autodesk = (window as any).Autodesk;

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

          Autodesk.Viewing.Initializer(options, () => {
            if (!viewerRef.current) return;

            const viewer = new Autodesk.Viewing.GuiViewer3D(viewerRef.current, {
              extensions: ['Autodesk.ViewCubeUi'],
            });
            viewer.start();
            viewerInstance.current = viewer;

            const urn = activeUrn.startsWith('urn:')
              ? `${activeUrn}`
              : `urn:${activeUrn}`;

            console.log('Configure page: Loading viewer document:', urn);

            Autodesk.Viewing.Document.load(
              urn,
              (doc: any) => {
                const viewable = doc.getRoot().getDefaultGeometry();
                if (viewable) {
                  viewer.loadDocumentNode(doc, viewable).then(() => {
                    viewer.addEventListener(Autodesk.Viewing.GEOMETRY_LOADED_EVENT, () => {
                      viewer.fitToView();
                    });
                  });
                }
                setViewerLoading(false);
              },
              (errorCode: any, errorMsg: any) => {
                console.error('Viewer document load failed:', errorCode, errorMsg);
                setViewerLoading(false);
                setViewerError(true);
                // Error code 3 = access denied (403) from the viewer SDK
                if (errorCode === 3 || String(errorMsg).includes('403') || String(errorMsg).toLowerCase().includes('forbidden')) {
                  setViewerErrorMsg('Model access denied (403). This model was generated with different APS credentials. Re-run the automation in the admin panel to regenerate it.');
                }
              }
            );
          });
        }
      } catch {
        setViewerLoading(false);
        setViewerError(true);
      }
    };

    loadViewer();

    return () => {
      if (viewerInstance.current) {
        viewerInstance.current.finish();
        viewerInstance.current = null;
      }
    };
  }, [product?.lastOutputUrn, product?.sourceFile]);

  // ============================================================================
  // 2D DWG VIEWER INIT
  // ============================================================================
  useEffect(() => {
    if (!dwgUrn || viewerTab !== '2d') return;

    const load2dViewer = async () => {
      try {
        setViewer2dLoading(true);
        const Autodesk = (window as any).Autodesk;
        if (!Autodesk) return;

        // Reuse same token endpoint
        const tokenRes = await fetch('/api/auth/token');
        if (!tokenRes.ok) throw new Error('Failed to get viewer token');
        const tokenData = await tokenRes.json();

        if (viewer2dRef.current) {
          // Clean up existing 2D viewer
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
                .catch(() => {
                  onTokenReady(cachedToken, cachedExpiry);
                });
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
                // Try to find a 2D viewable, fall back to default
                const root = doc.getRoot();
                const viewables2d = root.search({ type: 'geometry', role: '2d' });
                const viewable = viewables2d.length > 0
                  ? viewables2d[0]
                  : root.getDefaultGeometry();

                if (viewable) {
                  viewer.loadDocumentNode(doc, viewable);
                }
                setViewer2dLoading(false);
              },
              () => {
                setViewer2dLoading(false);
              }
            );
          });
        }
      } catch {
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
  // MODEL REGENERATION HANDLER
  // ============================================================================
  const handleRegenerate = useCallback(async () => {
    if (!product?.sourceFile || regenerating) return;

    setRegenError(null);
    setRegenerating(true);
    setRegenProgress('Submitting work item...');
    lastRegenValues.current = { ...values };
    setHasChanges(false);
    postToParent('GENERATION_STARTED', { parameters: values });

    // Also track DWG separately if applicable
    const hasDwg = !!(product.drawingFile && product.automation?.dwgActivityId);
    if (hasDwg) {
      setDwgRegenerating(true);
      setDwgRegenProgress('Submitting DWG work item...');
    }

    try {
      const body: any = {
        bucketKey: product.sourceFile.bucketKey,
        objectKey: product.sourceFile.objectKey,
        parameters: values,
      };

      if (hasDwg && product.drawingFile) {
        body.drawingFile = {
          bucketKey: product.drawingFile.bucketKey,
          objectKey: product.drawingFile.objectKey,
        };
      }

      const res = await fetch('/api/workflow/regenerate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to start regeneration');
      }

      const data = await res.json();

      // ─── Cache hit: skip work item + translation entirely ───
      if (data.cached && !data.pending && data.urn) {
        console.log('Configure: Cache HIT — loading cached model');
        setRegenProgress('Loading cached model...');

        setProduct(prev => prev ? { ...prev, lastOutputUrn: data.urn } : prev);
        postToParent('GENERATION_COMPLETE', { urn: data.urn, outputLocation: data.outputLocation, parameters: values, cached: true });

        if (productId) {
          fetch(`/api/products/${productId}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lastOutputUrn: data.urn }),
          }).catch(err => console.error('Failed to persist lastOutputUrn:', err));
        }

        setRegenProgress('');
        setRegenerating(false);
        setDwgRegenerating(false);
        setDwgRegenProgress('');
        toast.success('Model Loaded', 'Loaded from cache — identical parameters were generated before.');
        return;
      }

      // ─── Poll IPT work item (3D viewer) ───
      const iptWorkItemId = data.iptWorkItemId || data.workItemId;
      setRegenWorkItemId(iptWorkItemId);
      setRegenProgress('Processing 3D model...');

      const pollIpt = () => new Promise<void>((resolve) => {
        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/workflow/workitem/${iptWorkItemId}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'inprogress') {
              setRegenProgress('Regenerating 3D model...');
            } else if (statusData.status === 'success') {
              clearInterval(pollInterval);
              setRegenProgress('Translating 3D model for viewer...');

              const outputLocation = data.outputLocation;

              try {
                await fetch('/api/workflow/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bucketKey: outputLocation.bucketKey,
                    objectKey: outputLocation.objectKey,
                  }),
                });
              } catch {
                // Translation may already exist
              }

              const objectId = `urn:adsk.objects:os.object:${outputLocation.bucketKey}/${outputLocation.objectKey}`;
              const urn = btoa(objectId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');

              // Wait for translation to complete before updating the viewer
              const waitForTranslation = (): Promise<boolean> => {
                return new Promise((translationResolve) => {
                  let translationChecks = 0;
                  const maxChecks = 90; // ~4.5 min at 3s intervals
                  const checkTranslation = async () => {
                    if (translationChecks++ >= maxChecks) {
                      console.error('Configure: Translation timed out for output');
                      translationResolve(false);
                      return;
                    }
                    try {
                      const tRes = await fetch(`/api/translation/${urn}`);
                      if (tRes.ok) {
                        const tData = await tRes.json();
                        console.log('Configure: Output translation status:', tData.status, tData.progress);
                        if (tData.status === 'success') {
                          translationResolve(true);
                          return;
                        } else if (tData.status === 'failed') {
                          // Retry translation once
                          if (translationChecks < 10) {
                            try {
                              await fetch('/api/workflow/translate', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ bucketKey: outputLocation.bucketKey, objectKey: outputLocation.objectKey }),
                              });
                            } catch { /* ignore */ }
                          } else {
                            translationResolve(false);
                            return;
                          }
                        }
                      }
                      setTimeout(checkTranslation, 3000);
                    } catch {
                      setTimeout(checkTranslation, 3000);
                    }
                  };
                  // Small initial delay to let APS process the translate request
                  setTimeout(checkTranslation, 2000);
                });
              };

              const translationOk = await waitForTranslation();

              if (translationOk) {
                setProduct(prev => prev ? { ...prev, lastOutputUrn: urn } : prev);
                postToParent('GENERATION_COMPLETE', { urn, outputLocation, parameters: values });

                // Persist lastOutputUrn to the database
                if (productId) {
                  fetch(`/api/products/${productId}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ lastOutputUrn: urn }),
                  }).catch(err => console.error('Failed to persist lastOutputUrn:', err));
                }

                // Mark cache entry as completed so identical params return instantly next time
                if (data.cacheId) {
                  fetch('/api/workflow/cache-complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      cacheId: data.cacheId,
                      outputUrn: urn,
                      outputBucket: outputLocation.bucketKey,
                      outputObjectKey: outputLocation.objectKey,
                    }),
                  }).catch(err => console.error('Failed to complete cache entry:', err));
                }
              } else {
                console.error('Configure: Output translation failed, viewer will keep current model');
                setRegenError('Model updated but 3D preview translation failed. The model was regenerated successfully — try refreshing the page.');

                // Mark cache entry as failed so it will be retried next time
                if (data.cacheId) {
                  fetch('/api/workflow/cache-complete', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ cacheId: data.cacheId, failed: true, errorMessage: 'Translation failed' }),
                  }).catch(() => {});
                }
              }

              setRegenProgress('');
              setRegenerating(false);
              setRegenWorkItemId(null);
              resolve();
            } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
              clearInterval(pollInterval);
              setRegenProgress('');
              setRegenerating(false);
              setRegenWorkItemId(null);
              setRegenError('3D model update failed. Check your parameter values and try again.');
              console.error('IPT regeneration failed:', statusData);

              // Mark cache entry as failed
              if (data.cacheId) {
                fetch('/api/workflow/cache-complete', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ cacheId: data.cacheId, failed: true, errorMessage: 'Work item failed' }),
                }).catch(() => {});
              }
              resolve();
            }
          } catch (pollErr) {
            console.error('IPT poll error:', pollErr);
          }
        }, 3000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setRegenProgress('');
          setRegenerating(false);
          setRegenWorkItemId(null);
          resolve();
        }, 300000);
      });

      // ─── Poll DWG work item (2D viewer) ───
      const pollDwg = () => new Promise<void>((resolve) => {
        if (!data.dwgWorkItemId || !data.dwgOutputLocation) {
          setDwgRegenerating(false);
          setDwgRegenProgress('');
          resolve();
          return;
        }

        setDwgRegenWorkItemId(data.dwgWorkItemId);
        setDwgRegenProgress('Processing 2D drawing...');

        const pollInterval = setInterval(async () => {
          try {
            const statusRes = await fetch(`/api/workflow/workitem/${data.dwgWorkItemId}`);
            const statusData = await statusRes.json();

            if (statusData.status === 'inprogress') {
              setDwgRegenProgress('Updating 2D drawing...');
            } else if (statusData.status === 'success') {
              clearInterval(pollInterval);
              setDwgRegenProgress('Translating 2D drawing for viewer...');

              try {
                await fetch('/api/workflow/translate', {
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({
                    bucketKey: data.dwgOutputLocation.bucketKey,
                    objectKey: data.dwgOutputLocation.objectKey,
                  }),
                });
              } catch {
                // Translation may already exist
              }

              const dwgObjectId = `urn:adsk.objects:os.object:${data.dwgOutputLocation.bucketKey}/${data.dwgOutputLocation.objectKey}`;
              const dwgUrnVal = btoa(dwgObjectId).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
              setDwgUrn(dwgUrnVal);

              // Get download URL for DWG
              try {
                const dlRes = await fetch(
                  `/api/workflow/download/${data.dwgOutputLocation.bucketKey}/${data.dwgOutputLocation.objectKey}`
                );
                if (dlRes.ok) {
                  const dlData = await dlRes.json();
                  setDwgDownloadUrl(dlData.url);
                }
              } catch {
                // Non-critical
              }

              setDwgRegenProgress('');
              setDwgRegenerating(false);
              setDwgRegenWorkItemId(null);
              resolve();
            } else if (statusData.status === 'failed' || statusData.status === 'cancelled') {
              clearInterval(pollInterval);
              setDwgRegenProgress('2D drawing update failed');
              setTimeout(() => {
                setDwgRegenProgress('');
                setDwgRegenerating(false);
                setDwgRegenWorkItemId(null);
              }, 3000);
              console.error('DWG regeneration failed:', statusData);
              resolve();
            }
          } catch (pollErr) {
            console.error('DWG poll error:', pollErr);
          }
        }, 3000);

        // Timeout after 5 minutes
        setTimeout(() => {
          clearInterval(pollInterval);
          setDwgRegenProgress('');
          setDwgRegenerating(false);
          setDwgRegenWorkItemId(null);
          resolve();
        }, 300000);
      });

      // Fire both polling loops in parallel
      Promise.all([pollIpt(), pollDwg()]).then(() => {
        toast.success('Model Updated', '3D model and drawings regenerated successfully.');
      });

    } catch (err: any) {
      console.error('Regeneration error:', err);
      setRegenProgress('');
      setRegenerating(false);
      setDwgRegenProgress('');
      setDwgRegenerating(false);
    }
  }, [product, values, regenerating]);


  // ============================================================================
  // PRICING CALCULATION
  // ============================================================================
  const calculatePrice = useCallback((): { total: number; breakdown: PriceBreakdown[]; currency: string } => {
    if (!product?.pricing) return { total: 0, breakdown: [], currency: 'USD' };

    const pricing = product.pricing;
    const breakdown: PriceBreakdown[] = [];
    let total = pricing.basePrice || 0;
    breakdown.push({ label: 'Base price', amount: pricing.basePrice || 0 });

    const rules = pricing.parameterRules || {};
    for (const [paramName, rule] of Object.entries(rules)) {
      if (rule.type === 'none') continue;
      const val = values[paramName];
      const param = product.parameters.find(p => p.name === paramName);
      const label = param?.displayName || paramName;

      if (rule.type === 'per-unit' && typeof val === 'number' && rule.value) {
        const amt = val * rule.value;
        breakdown.push({ label: `${label} (${val} × $${rule.value})`, amount: amt });
        total += amt;
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

    return {
      total: Math.max(0, total),
      breakdown,
      currency: pricing.currency || 'USD',
    };
  }, [product, values]);

  const priceData = useMemo(() => calculatePrice(), [calculatePrice]);
  const currencySymbol = (c: string) => c === 'EUR' ? '€' : c === 'GBP' ? '£' : '$';
  const sym = currencySymbol(priceData.currency);

  // Notify parent whenever configuration or price changes (skip on initial load)
  const isInitialLoad = useRef(true);
  useEffect(() => {
    if (isInitialLoad.current) { isInitialLoad.current = false; return; }
    postToParent('CONFIG_CHANGED', { parameters: values, price: priceData, quantity });
    postToParent('PRICE_UPDATED', { total: priceData.total, currency: priceData.currency, breakdown: priceData.breakdown, quantity });
  }, [values, priceData, quantity, postToParent]);

  // ============================================================================
  // VALUE CHANGE / RESET
  // ============================================================================
  const handleValueChange = (name: string, value: any) => {
    setValues(prev => ({ ...prev, [name]: value }));
    setDisplayValues(prev => ({ ...prev, [name]: value }));

    // Detect change from last regenerated values
    if (lastRegenValues.current[name] !== undefined && lastRegenValues.current[name] !== value) {
      setHasChanges(true);
      const param = product?.parameters.find(p => p.name === name);
      const displayName = param?.displayName || name;
      const unit = param?.unit ? ` ${param.unit}` : '';
      toast.info('Parameter Updated', `${displayName} changed to ${value}${unit}. Click Update Model Dimension to apply.`);
    }
  };

  const resetValues = () => {
    if (!product) return;
    const defaults: Record<string, any> = {};
    product.parameters.forEach(p => { defaults[p.name] = p.defaultValue; });
    setValues(defaults);
    setDisplayValues(defaults);
  };

  // ============================================================================
  // OUTPUT DOWNLOAD
  // ============================================================================
  const handleDownload = async () => {
    if (!product?.lastOutputUrn || downloading) return;
    setDownloading(true);
    try {
      const res = await fetch(`/api/products/${product.id}/download`);
      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Download failed');
      // Trigger browser download via a temporary anchor
      const a = document.createElement('a');
      a.href = data.url;
      a.download = data.fileName || 'output.ipt';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    } catch (err: any) {
      alert('Download failed: ' + err.message);
    } finally {
      setDownloading(false);
    }
  };

  // ============================================================================
  // QUOTE SUBMISSION
  // ============================================================================
  const handleSubmitQuote = async () => {
    if (!product) return;
    if (!customerForm.email) {
      setQuoteError('Please enter your email address.');
      return;
    }

    setQuoteSubmitting(true);
    setQuoteError(null);

    try {
      const res = await fetch('/api/quotes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId: product.id,
          productName: product.name,
          configuration: values,
          pricing: {
            unitPrice: priceData.total,
            totalPrice: priceData.total * quantity,
            currency: priceData.currency,
            breakdown: priceData.breakdown,
            quantity,
          },
          quantity,
          customer: customerForm,
        }),
      });

      const data = await res.json();
      if (!data.success) throw new Error(data.error || 'Failed to submit quote');
      setQuoteSubmitted(true);
      setSubmittedQuoteId(data.quote?.id || null);
      postToParent('QUOTE_SUBMITTED', {
        quoteId: data.quote?.id,
        productName: product.name,
        configuration: values,
        pricing: { unitPrice: priceData.total, totalPrice: priceData.total * quantity, currency: priceData.currency, quantity },
        customer: { name: customerForm.name, email: customerForm.email, company: customerForm.company },
      });
    } catch (err: any) {
      setQuoteError(err.message || 'Failed to submit quote request');
    } finally {
      setQuoteSubmitting(false);
    }
  };

  // ============================================================================
  // SECTION TOGGLE
  // ============================================================================
  const toggleSection = (id: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // ============================================================================
  // CONTROL CONFIG HELPER
  // ============================================================================
  const getControlConfig = (paramName: string): ControlConfig => {
    const param = product?.parameters.find(p => p.name === paramName);
    // Auto-detect control type from parameter type
    let autoControlType: ControlConfig['controlType'] = 'input';
    if (param?.type === 'boolean') autoControlType = 'toggle';
    else if (param?.type === 'number' && param.min !== undefined && param.max !== undefined) autoControlType = 'slider';

    const defaults: ControlConfig = {
      controlType: autoControlType,
      width: 'full',
      showLabel: true,
      showUnit: true,
      showDescription: false,
      showMinMax: false,
    };
    if (!layout?.controls) return defaults;
    return { ...defaults, ...(layout.controls[paramName] || {}) };
  };

  // ============================================================================
  // ELEMENT STYLE HELPER
  // ============================================================================
  const elementStyleToCSS = (style?: Record<string, any>): React.CSSProperties => {
    if (!style) return {};
    const css: React.CSSProperties = {};
    if (style.backgroundColor) css.backgroundColor = style.backgroundColor;
    if (style.textColor) css.color = style.textColor;
    if (style.padding !== undefined) css.padding = `${style.padding}px`;
    if (style.margin !== undefined) css.margin = `${style.margin}px`;
    if (style.borderRadius !== undefined) css.borderRadius = `${style.borderRadius}px`;
    if (style.borderColor) css.borderColor = style.borderColor;
    if (style.borderWidth !== undefined) { css.borderWidth = `${style.borderWidth}px`; css.borderStyle = 'solid'; }
    if (style.opacity !== undefined) css.opacity = style.opacity;
    if (style.fontFamily) css.fontFamily = style.fontFamily;
    if (style.fontSize !== undefined) css.fontSize = `${style.fontSize}px`;
    if (style.fontWeight !== undefined) css.fontWeight = style.fontWeight;
    return css;
  };

  // ============================================================================
  // CONTROL RENDERER
  // ============================================================================
  const renderControl = (param: Parameter, config: ControlConfig) => {
    const value = values[param.name] ?? param.defaultValue;
    const displayValue = displayValues[param.name] ?? value;
    const label = config.customLabel || param.displayName;
    const effMin = config.customMin ?? param.min;
    const effMax = config.customMax ?? param.max;
    const effStep = config.customStep ?? param.step;
    const unitStr = config.showUnit && param.unit ? param.unit : '';

    return (
      <div key={param.name} className="w-full px-3 py-0.5">
        {/* Slider types: label on top, slider below */}
        {(config.controlType === 'slider' || config.controlType === 'slider-input') && param.type === 'number' ? (
          <div className="space-y-1.5">
            {config.showLabel && (
              <div className="flex items-center justify-between">
                <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>
                  {config.prefix && <span className="mr-1" style={{ color: 'var(--text-muted)' }}>{config.prefix}</span>}
                  {label}
                  {config.suffix && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{config.suffix}</span>}
                </span>
                <span className="text-[13px] font-medium" style={{ color: 'var(--text-primary)' }}>
                  {displayValue}{unitStr && <span className="ml-1 text-xs" style={{ color: 'var(--text-muted)' }}>{unitStr}</span>}
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                type="range"
                min={effMin ?? 0}
                max={effMax ?? 100}
                step={effStep ?? 1}
                value={displayValue as number}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDisplayValues(prev => ({ ...prev, [param.name]: val }));
                  clearTimeout(sliderTimerRef.current[param.name]);
                  sliderTimerRef.current[param.name] = setTimeout(() => {
                    handleValueChange(param.name, val);
                  }, 250);
                }}
                onPointerUp={(e) => {
                  clearTimeout(sliderTimerRef.current[param.name]);
                  handleValueChange(param.name, parseFloat((e.target as HTMLInputElement).value));
                }}
                className="flex-1 h-1.5 rounded-lg appearance-none cursor-pointer"
                style={{ accentColor: 'var(--accent)', backgroundColor: 'var(--border)' } as React.CSSProperties}
                aria-label={label}
              />
              {config.controlType === 'slider-input' && (
                <input
                  type="number"
                  min={effMin}
                  max={effMax}
                  step={effStep}
                  value={value as number}
                  onChange={(e) => handleValueChange(param.name, parseFloat(e.target.value) || 0)}
                  className="w-16 text-xs px-2 py-1 rounded border text-right outline-none"
                  style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                  aria-label={`${label} value`}
                />
              )}
            </div>
            {config.showMinMax && config.controlType === 'slider' && (
              <div className="flex justify-between text-[10px]" style={{ color: 'var(--text-muted)' }}>
                <span>{effMin ?? 0}</span>
                <span>{effMax ?? 100}</span>
              </div>
            )}
          </div>
        ) : config.controlType === 'toggle' ? (
          /* Toggle: horizontal label + toggle on right */
          <div className="flex items-center justify-between py-1">
            {config.showLabel && (
              <span className="text-[13px]" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            )}
            <button
              onClick={() => handleValueChange(param.name, !value)}
              className="relative w-11 h-6 rounded-full transition-colors flex-shrink-0"
              style={{ backgroundColor: value ? 'var(--accent)' : 'var(--border)' }}
              title={label}
              aria-label={`Toggle ${label}`}
            >
              <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${
                value ? 'left-[22px]' : 'left-0.5'
              }`} />
            </button>
          </div>
        ) : config.controlType === 'color' ? (
          /* Color picker: horizontal label + color swatch + hex */
          <div className="py-1">
            {config.showLabel && (
              <span className="block text-[13px] mb-1.5" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            )}
            <div className="flex items-center gap-2">
              <input
                type="color"
                value={value as string}
                onChange={(e) => handleValueChange(param.name, e.target.value)}
                className="w-8 h-8 rounded cursor-pointer bg-transparent border-0"
                title={`${label} color picker`}
                aria-label={`${label} color picker`}
              />
              <input
                type="text"
                value={value as string}
                onChange={(e) => handleValueChange(param.name, e.target.value)}
                className="flex-1 px-2 py-1 rounded border text-xs uppercase"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                aria-label={`${label} hex value`}
              />
            </div>
          </div>
        ) : config.controlType === 'dropdown' ? (
          /* Dropdown: horizontal label + select on right */
          <div className="flex items-center justify-between py-1 gap-3">
            {config.showLabel && (
              <span className="text-[13px] flex-shrink-0" style={{ color: 'var(--text-secondary)' }}>{label}</span>
            )}
            <select
              value={value as string}
              onChange={(e) => handleValueChange(param.name, e.target.value)}
              title={label}
              className="px-2 py-1 rounded border text-[13px] min-w-[100px] max-w-[160px]"
              style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
            >
              {(param.options || []).map(opt => (
                <option key={opt} value={opt}>{opt}</option>
              ))}
            </select>
          </div>
        ) : (
          /* Number/Text input: horizontal label + input with unit on right */
          <div className="flex items-center justify-between py-1 gap-3">
            {config.showLabel && (
              <span className="text-[13px] flex-shrink-0 overflow-hidden text-ellipsis whitespace-nowrap max-w-[50%]" style={{ color: 'var(--text-secondary)' }}>
                {config.prefix && <span className="mr-1" style={{ color: 'var(--text-muted)' }}>{config.prefix}</span>}
                {label}
                {config.suffix && <span className="ml-1" style={{ color: 'var(--text-muted)' }}>{config.suffix}</span>}
              </span>
            )}
            <div className="flex items-center gap-1">
              <input
                type={param.type === 'number' ? 'number' : 'text'}
                min={effMin}
                max={effMax}
                step={effStep}
                value={value as any}
                onChange={(e) => {
                  const v = param.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value;
                  handleValueChange(param.name, v);
                }}
                placeholder={config.placeholder}
                className="w-20 px-2 py-1 rounded border text-[13px] text-right outline-none"
                style={{ backgroundColor: 'var(--bg-input)', color: 'var(--text-primary)', borderColor: 'var(--border)' }}
                aria-label={label}
              />
              {unitStr && (
                <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-muted)' }}>{unitStr}</span>
              )}
            </div>
          </div>
        )}

        {config.showDescription && config.customDescription && (
          <p className="text-[11px] mt-0.5 px-0" style={{ color: 'var(--text-muted)' }}>{config.customDescription}</p>
        )}
      </div>
    );
  };

  // ============================================================================
  // LAYOUT ELEMENT RENDERER
  // ============================================================================
  const getElementWidthClass = (element: LayoutElement): string => {
    if (element.type === 'parameter' && element.parameterName) {
      const config = getControlConfig(element.parameterName);
      return config.width === 'half' ? 'w-1/2' : config.width === 'third' ? 'w-1/3' : 'w-full';
    }
    return 'w-full';
  };

  const renderElement = (element: LayoutElement): React.ReactNode => {
    const elStyle = elementStyleToCSS(element.style);

    switch (element.type) {
      case 'parameter': {
        const param = product?.parameters.find(p => p.name === element.parameterName);
        if (!param) return null;
        return renderControl(param, getControlConfig(element.parameterName!));
      }

      case 'section': {
        const isOpen = expandedSections.has(element.id);
        return (
          <div key={element.id} className="overflow-hidden" style={elStyle}>
            {element.collapsible ? (
              <button
                onClick={() => toggleSection(element.id)}
                className="w-full flex items-center justify-between px-4 py-3 text-left hover:opacity-80 transition-colors"
              >
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{element.label}</span>
                <ChevronDown className={`w-4 h-4 transition-transform ${isOpen ? '' : '-rotate-90'}`} style={{ color: 'var(--accent)' }} />
              </button>
            ) : (
              <div className="px-4 py-3">
                <span className="text-sm font-semibold" style={{ color: 'var(--accent)' }}>{element.label}</span>
                {element.description && <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{element.description}</p>}
              </div>
            )}
            <div
              className="overflow-hidden transition-all duration-200 ease-in-out"
              style={{ maxHeight: (!element.collapsible || isOpen) ? '2000px' : '0px', opacity: (!element.collapsible || isOpen) ? 1 : 0 }}
            >
              <div className="px-2 py-1">
                <div className="flex flex-wrap">
                  {(element.children || []).map(child => (
                    <div key={child.id} className={getElementWidthClass(child)}>
                      {renderElement(child)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'group': {
        const isOpen = expandedSections.has(element.id);
        return (
          <div key={element.id} className="w-full px-2 py-2" style={elStyle}>
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              {element.collapsible ? (
                <button
                  onClick={() => toggleSection(element.id)}
                  className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:opacity-80 transition-colors"
                >
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{element.label}</span>
                  {isOpen ? <ChevronDown className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} /> : <ChevronRight className="w-3.5 h-3.5" style={{ color: 'var(--text-muted)' }} />}
                </button>
              ) : (
                <div className="px-4 py-2.5" style={{ borderBottom: '1px solid var(--border)' }}>
                  <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>{element.label}</span>
                </div>
              )}
              <div
                className="overflow-hidden transition-all duration-200 ease-in-out"
                style={{ maxHeight: (!element.collapsible || isOpen) ? '2000px' : '0px', opacity: (!element.collapsible || isOpen) ? 1 : 0 }}
              >
                <div className="p-2 flex flex-wrap">
                  {(element.children || []).map(child => (
                    <div key={child.id} className={getElementWidthClass(child)}>
                      {renderElement(child)}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        );
      }

      case 'row': {
        return (
          <div key={element.id} className="w-full px-2 py-2" style={elStyle}>
            <div className="flex" style={{ gap: `${element.gap ?? 8}px` }}>
              {(element.children || []).map(child => (
                <div key={child.id} className="flex-1">
                  {renderElement(child)}
                </div>
              ))}
            </div>
          </div>
        );
      }

      case 'tab-group': {
        const activeTab = activeTabIds[element.id] || element.tabs?.[0]?.id || '';
        const activeTabChildren = element.tabs?.find(t => t.id === activeTab)?.children || [];
        const tabCount = (element.tabs || []).length || 1;
        return (
          <div key={element.id} className="w-full px-2 py-2" style={elStyle}>
            <div className="rounded-lg overflow-hidden" style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border)' }}>
              <div className="flex w-full" style={{ borderBottom: '1px solid var(--border)' }}>
                {(element.tabs || []).map((tab, idx) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTabIds(prev => ({ ...prev, [element.id]: tab.id }))}
                    className="text-sm font-medium transition-colors py-2.5 text-center"
                    style={{
                      width: `${100 / tabCount}%`,
                      color: activeTab === tab.id ? 'var(--accent)' : 'var(--text-muted)',
                      borderRight: idx < tabCount - 1 ? '1px solid var(--border)' : 'none',
                      borderBottom: activeTab === tab.id ? '2px solid var(--accent)' : '2px solid transparent',
                    }}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="p-2 flex flex-wrap">
                {activeTabChildren.map(child => (
                  <div key={child.id} className={getElementWidthClass(child)}>
                    {renderElement(child)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      }

      case 'label': {
        const variantStyles: Record<string, { className: string; colorVar: string }> = {
          heading: { className: 'text-base font-semibold', colorVar: 'var(--text-primary)' },
          subheading: { className: 'text-sm font-medium', colorVar: 'var(--text-secondary)' },
          body: { className: 'text-sm', colorVar: 'var(--text-secondary)' },
          caption: { className: 'text-xs', colorVar: 'var(--text-muted)' },
        };
        const vs = variantStyles[element.variant || 'body'] || variantStyles.body;
        return (
          <div key={element.id} className="w-full px-3 py-1" style={elStyle}>
            <p className={vs.className}
               style={{ textAlign: (element.align || 'left') as any, color: vs.colorVar }}>
              {element.text}
            </p>
          </div>
        );
      }

      case 'empty-space':
        return <div key={element.id} style={{ height: `${element.height || 24}px`, ...elStyle }} />;

      case 'splitter': {
        const marginPx = element.margin ?? 8;
        if (element.orientation === 'vertical') {
          return (
            <div key={element.id} className="self-stretch flex items-center" style={{ paddingLeft: `${marginPx}px`, paddingRight: `${marginPx}px`, ...elStyle }}>
              <div className="h-full min-h-[24px] w-px" style={{ backgroundColor: 'var(--border)', borderStyle: element.lineStyle || 'solid' }} />
            </div>
          );
        }
        return (
          <div key={element.id} className="w-full px-3" style={{ paddingTop: `${marginPx}px`, paddingBottom: `${marginPx}px`, ...elStyle }}>
            <hr style={{ borderColor: 'var(--border)', borderStyle: element.lineStyle || 'solid' }} />
          </div>
        );
      }

      case 'picture':
        return (
          <div key={element.id} className="w-full px-3 py-2" style={elStyle}>
            {element.url && (
              <img
                src={element.url}
                alt={element.alt || 'Image'}
                className="w-full rounded-lg"
                style={{ width: element.width || '100%', height: 'auto', objectFit: (element.objectFit as any) || 'contain' }}
              />
            )}
          </div>
        );

      default:
        return null;
    }
  };

  // ============================================================================
  // RENDER CONFIG CONTROLS
  // ============================================================================
  const renderConfigControls = () => {
    if (!product) return null;
    
    if (layout?.children && layout.children.length > 0) {
      const sStyle = layout.styling?.sectionStyle || 'card';
      const hasSections = layout.children.some(c => c.type === 'section');

      const childrenContent = (
        <div className="space-y-2">
          {layout.children.map(child => (
            <div key={child.id} className={getElementWidthClass(child)}>
              {renderElement(child)}
            </div>
          ))}
        </div>
      );

      if (!hasSections && sStyle !== 'flat') {
        return (
          <div className="rounded-xl border border-slate-700/50 bg-slate-800/50 p-3 overflow-hidden">
            {childrenContent}
          </div>
        );
      }
      return childrenContent;
    }

    // V1 fallback: render from flat parameters
    if (product.parameters.length > 0) {
      return (
        <div className="space-y-2">
          {product.parameters.map(param =>
            renderControl(param, getControlConfig(param.name))
          )}
        </div>
      );
    }

    return null;
  };

  // ============================================================================
  // LOADING / ERROR STATES
  // ============================================================================
  if (loading) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-10 h-10 animate-spin text-orange-500 mx-auto mb-4" />
          <p className="text-gray-400">Loading configurator...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="h-screen bg-slate-950 flex items-center justify-center">
        <div className="text-center max-w-md">
          <AlertCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">Product Not Found</h2>
          <p className="text-gray-400">{error || 'The requested product could not be loaded.'}</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER — 3DTHD DESIGNER INTERFACE
  // ============================================================================
  const _isDark = (layout?.styling?.theme || 'dark') === 'dark';
  const _accent = layout?.styling?.accentColor || '#f97316';

  return (
    <div className={`h-screen flex flex-col overflow-hidden configurator-3dthd ${_isDark ? 'bg-slate-950' : 'bg-gray-50'}`}>

      {/* ═══════════ QUOTE SUCCESS OVERLAY ═══════════ */}
      {quoteSubmitted && (
        <div className="absolute inset-0 z-[100] bg-slate-950/80 flex items-center justify-center" style={{ backdropFilter: 'blur(8px)' }}>
          <div className="bg-slate-800/95 border border-slate-700 rounded-2xl shadow-2xl max-w-md w-full mx-4 p-8 text-center">
            <div className="w-16 h-16 bg-green-500/15 rounded-full flex items-center justify-center mx-auto mb-6">
              <CheckCircle className="w-8 h-8 text-green-400" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-3">Quote Request Submitted!</h2>
            {submittedQuoteId && (
              <p className="text-xs text-slate-500 mb-3 font-mono">Ref: {submittedQuoteId}</p>
            )}
            <p className="text-gray-400 mb-2">
              Thank you for your interest in <span className="font-medium text-gray-200">{product.name}</span>.
              We&apos;ll review your configuration and get back to you shortly.
            </p>
            <p className="text-gray-500 text-sm mb-2">Our team will respond within 1 business day.</p>
            {customerForm.email && (
              <p className="text-gray-500 text-sm mb-6">A confirmation will be sent to <span className="text-gray-300">{customerForm.email}</span>.</p>
            )}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(window.location.href);
                setLinkCopied(true);
                setTimeout(() => setLinkCopied(false), 2000);
              }}
              className="mb-4 w-full flex items-center justify-center gap-2 px-4 py-2 rounded-xl border border-slate-600 text-sm text-gray-300 hover:bg-slate-700 transition-colors"
            >
              {linkCopied ? <CheckCircle className="w-4 h-4 text-green-400" /> : <RefreshCw className="w-4 h-4" />}
              {linkCopied ? 'Link Copied!' : 'Copy Configuration Link'}
            </button>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                type="button"
                onClick={() => {
                  setQuoteSubmitted(false);
                  setConfigPanelTab('parameters');
                  setCustomerForm({ name: '', email: '', phone: '', company: '', notes: '' });
                  resetValues();
                }}
                style={{
                  backgroundColor: layout?.styling?.accentColor || '#f97316',
                  color: '#fff',
                  borderRadius: '0.75rem',
                  fontWeight: 500,
                  padding: '0.75rem 1.5rem',
                  transition: 'background 0.2s',
                }}
                className="transition-colors"
              >
                Start New Configuration
              </button>
              <button
                type="button"
                onClick={() => setQuoteSubmitted(false)}
                className="px-6 py-3 rounded-xl border border-slate-600 text-gray-300 hover:bg-slate-700 transition-colors text-sm font-medium"
              >
                Back to Configurator
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ TOP BAR ═══════════ */}
      {!isEmbedMode && (
      <header className="h-14 border-b border-slate-800 bg-slate-900 flex items-center px-4 justify-between shrink-0 z-40">
        {/* Left: Logo + Product Name */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 overflow-hidden bg-slate-800 border border-slate-700">
            {(product.productImage || product.thumbnail) ? (
              <img src={product.productImage || product.thumbnail} alt={product.name} className="w-full h-full object-cover" />
            ) : (
              <ImageIcon className="w-4 h-4 text-gray-500" />
            )}
          </div>
          <div className="min-w-0">
            <h1 className="text-white font-medium text-sm truncate">{product.name}</h1>
            {product.description && (
              <p className="text-[10px] text-gray-500 truncate hidden sm:block">{product.description}</p>
            )}
          </div>
        </div>

        {/* Right: Actions */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={resetValues}
            className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title="Reset all parameters"
          >
            <RotateCcw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setShowConfigPanel(true); setConfigPanelTab('builder'); }}
            className="flex items-center gap-2 px-4 py-2 text-white text-sm font-medium rounded-lg transition-colors hover:opacity-90"
            style={{ backgroundColor: layout?.styling?.accentColor || '#f97316' }}
          >
            <Send className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Request Quote</span>
          </button>
          {/* Panel toggle */}
          <button
            onClick={() => setShowConfigPanel(!showConfigPanel)}
            className="p-2 text-gray-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors"
            title={showConfigPanel ? 'Hide panel' : 'Show panel'}
          >
            {showConfigPanel ? <PanelRightClose className="w-4 h-4" /> : <PanelRightOpen className="w-4 h-4" />}
          </button>
        </div>
      </header>
      )}

      {/* ═══════════ CONTENT — Full viewport with floating overlays ═══════════ */}
      <div className="flex-1 flex overflow-hidden relative">
        <main className="flex-1 overflow-hidden relative">

          {/* ── Viewer Area — Full width/height background ── */}
          <div className="absolute inset-0 flex flex-col bg-slate-900">
            <div className="flex-1 relative">

              {/* Floating Viewer Tabs — Pill toggles top center */}
              <div className="absolute top-3 left-1/2 -translate-x-1/2 z-20 flex items-center bg-slate-800/90 border border-slate-700/50 rounded-full shadow-lg p-1" style={{ backdropFilter: 'blur(8px)' }}>
                {([
                  { tab: '3d' as ViewerTab, label: '3D' },
                  { tab: '2d' as ViewerTab, label: '2D' },
                  { tab: 'bom' as ViewerTab, label: 'BOM' },
                  { tab: 'summary' as ViewerTab, label: 'Summary' },
                ]).map(({ tab, label }) => (
                  <button
                    key={tab}
                    onClick={() => setViewerTab(tab)}
                    className={`px-4 py-1.5 text-sm font-medium rounded-full transition-all ${
                      viewerTab === tab
                        ? 'text-white shadow-sm'
                        : 'text-gray-400 hover:text-white'
                    }`}
                    style={viewerTab === tab ? { backgroundColor: layout?.styling?.accentColor || '#f97316' } : {}}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {/* 3D Viewer — always mounted to preserve state */}
              <div
                ref={viewerRef}
                className={`w-full h-full absolute inset-0 ${viewerTab !== '3d' ? 'invisible pointer-events-none' : ''}`}
              />

              {/* Viewer Loading State */}
              {viewerTab === '3d' && viewerLoading && (
                <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center z-10">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                    <span className="text-gray-400">Loading 3D model...</span>
                  </div>
                </div>
              )}

              {/* No Model Available */}
              {viewerTab === '3d' && viewerError && !viewerLoading && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="text-center p-8 max-w-sm">
                    <div className={`w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center ${viewerErrorMsg ? 'bg-red-500/10' : 'bg-slate-800'}`}>
                      <Box className={`w-8 h-8 ${viewerErrorMsg ? 'text-red-400' : 'text-gray-500'}`} />
                    </div>
                    <h3 className="text-lg font-medium text-gray-300 mb-2">
                      {viewerErrorMsg ? 'Model Access Denied' : 'No 3D Model Available'}
                    </h3>
                    <p className="text-gray-500 text-sm">
                      {viewerErrorMsg || 'The 3D preview is not yet available for this product. Use the configuration panel to customize parameters.'}
                    </p>
                  </div>
                </div>
              )}

              {/* BOM Tab */}
              {viewerTab === 'bom' && (
                <div className="absolute inset-0 overflow-auto p-6 pt-14 z-10">
                  <div className="mb-4 flex items-center justify-between">
                    <div>
                      <h3 className="text-lg font-medium text-white">Bill of Materials</h3>
                      <p className="text-xs text-gray-500 mt-0.5">Extracted via APS Design Automation</p>
                    </div>
                    <span className="text-xs px-2.5 py-1 rounded-full border" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)', color: 'var(--accent)' }}>
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

              {/* Drawing Tab — 2D DWG Viewer or placeholder */}
              {viewerTab === '2d' && (
                <div className="absolute inset-0 z-10">
                  {dwgUrn ? (
                    <>
                      {/* 2D Viewer container */}
                      <div ref={viewer2dRef} className="w-full h-full" />

                      {/* Loading overlay */}
                      {viewer2dLoading && (
                        <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center">
                          <div className="flex flex-col items-center gap-3">
                            <Loader2 className="w-8 h-8 animate-spin text-orange-500" />
                            <span className="text-gray-400">Loading 2D drawing...</span>
                          </div>
                        </div>
                      )}

                      {/* DWG Download button — floating bottom right */}
                      {dwgDownloadUrl && (
                        <a
                          href={dwgDownloadUrl}
                          download
                          className="absolute bottom-4 right-4 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white shadow-lg transition-colors"
                          style={{ backgroundColor: 'var(--accent, #f97316)' }}
                        >
                          <FileText className="w-4 h-4" />
                          Download DWG
                        </a>
                      )}
                    </>
                  ) : (
                    <div className="absolute inset-0 flex items-center justify-center">
                      <div className="text-center p-8">
                        <div className="w-16 h-16 mx-auto mb-4 bg-slate-800 rounded-2xl flex items-center justify-center">
                          <FileText className="w-8 h-8 text-gray-500" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-300 mb-2">Technical Drawing</h3>
                        <p className="text-gray-500 text-sm max-w-xs">
                          {product?.drawingFile
                            ? 'The 2D drawing is being prepared. If this persists, the drawing file may need to be translated first.'
                            : '2D drawings are not configured for this product.'}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* ── Summary Overlay (replaces Review step) ── */}
              {viewerTab === 'summary' && (
                <div className="absolute inset-0 bg-slate-900 flex items-start justify-center overflow-y-auto py-8 z-10">
                  <div className="max-w-2xl w-full mx-4 space-y-6">
                    {/* Configuration Summary */}
                    <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                      <div className="px-5 py-4 border-b border-slate-700/50">
                        <h2 className="text-base font-bold text-white">Your Configuration</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Review your selected parameters</p>
                      </div>
                      <div className="divide-y divide-slate-700/50">
                        {product.parameters.map(param => {
                          const val = values[param.name] ?? param.defaultValue;
                          const config = getControlConfig(param.name);
                          const lbl = config.customLabel || param.displayName;
                          const unitStr = param.unit || '';
                          return (
                            <div key={param.name} className="flex items-center justify-between px-5 py-3">
                              <span className="text-sm text-gray-300">{lbl}</span>
                              <span className="text-sm font-semibold text-white">
                                {typeof val === 'boolean' ? (val ? 'Yes' : 'No') : `${val}`}
                                {unitStr && typeof val !== 'boolean' && <span className="text-xs text-gray-400 ml-1">{unitStr}</span>}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Pricing Breakdown */}
                    {product.pricing?.showPrice && (
                      <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
                        <div className="px-5 py-4 border-b border-slate-700/50">
                          <h2 className="text-base font-bold text-white">Pricing Breakdown</h2>
                        </div>
                        <div className="px-5 py-4">
                          <div className="space-y-2 mb-4">
                            {priceData.breakdown.map((item, i) => (
                              <div key={i} className="flex items-center justify-between text-sm">
                                <span className="text-gray-400">{item.label}</span>
                                <span className={`font-medium ${item.amount >= 0 ? 'text-white' : 'text-green-400'}`}>
                                  {item.amount >= 0 ? '' : '-'}{sym}{Math.abs(item.amount).toFixed(2)}
                                </span>
                              </div>
                            ))}
                          </div>
                          <hr className="border-slate-700 mb-4" />
                          <div className="flex items-center justify-between mb-4">
                            <span className="text-sm font-medium text-gray-300">Unit Price</span>
                            <span className="text-lg font-bold text-white">{sym}{priceData.total.toFixed(2)}</span>
                          </div>
                          {quantity > 1 && (
                            <div className="flex items-center justify-between p-3 rounded-xl border" style={{ backgroundColor: `${layout?.styling?.accentColor || '#f97316'}1a`, borderColor: `${layout?.styling?.accentColor || '#f97316'}33` }}>
                              <span className="text-sm font-medium text-gray-300">Total ({quantity} units)</span>
                              <span className="text-xl font-bold" style={{ color: layout?.styling?.accentColor || '#f97316' }}>{sym}{(priceData.total * quantity).toFixed(2)}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}

                    {/* Quick Quote CTA */}
                    <div className="text-center">
                      <button
                        onClick={() => { setViewerTab('3d'); setShowConfigPanel(true); setConfigPanelTab('builder'); }}
                        className="inline-flex items-center gap-2 px-8 py-3 text-white font-semibold rounded-xl hover:opacity-90 transition-colors shadow-lg"
                        style={{ backgroundColor: layout?.styling?.accentColor || '#f97316' }}
                      >
                        <Send className="w-4 h-4" />
                        Request a Quote
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ═══════════ FLOATING PRICE PILL — Dynamic position ═══════════ */}
          {product.pricing?.showPrice && (() => {
            const panelPos = layout?.styling?.panelPosition || 'right';
            let pillClass = 'absolute z-40 flex items-center gap-2 bg-white hover:bg-gray-50 text-slate-900 pl-3 pr-4 py-2 rounded-full shadow-lg border border-gray-200 transition-all hover:shadow-xl hover:scale-105 cursor-pointer';
            // Opposite side of panel
            if (panelPos === 'right') pillClass += ' top-3 left-4';
            else if (panelPos === 'left') pillClass += ' top-3 right-4';
            else if (panelPos === 'top') pillClass += ' bottom-4 left-4';
            else if (panelPos === 'bottom') pillClass += ' top-3 left-4';
            else pillClass += ' top-3 left-4';
            return (
              <button
                onClick={() => { setShowConfigPanel(true); setConfigPanelTab('pricing'); }}
                className={pillClass}
                title="View pricing breakdown"
              >
                <Receipt className="w-4 h-4 text-slate-500" />
                <span className="text-sm font-bold">
                  {sym}<span className="text-lg">{Math.floor(priceData.total * quantity)}</span>
                  <span className="text-xs text-slate-500">.{((priceData.total * quantity) % 1).toFixed(2).slice(2)}</span>
                </span>
              </button>
            );
          })()}

          {/* ═══════════ FLOATING CONFIG PANEL — Position driven by layout template ═══════════ */}
          {showConfigPanel && (() => {
            const accent = layout?.styling?.accentColor || '#f97316';
            const isDark = (layout?.styling?.theme || 'dark') === 'dark';
            const panelPos = layout?.styling?.panelPosition || 'right';
            const posClasses: Record<string, string> = {
              right: 'bottom-0 left-0 right-0 max-h-[58vh] sm:top-3 sm:bottom-10 sm:left-auto sm:right-3 sm:w-[360px] sm:max-h-none rounded-t-xl rounded-b-none sm:rounded-xl',
              left:  'bottom-0 left-0 right-0 max-h-[58vh] sm:top-3 sm:bottom-10 sm:right-auto sm:left-3 sm:w-[360px] sm:max-h-none rounded-t-xl rounded-b-none sm:rounded-xl',
              top:    'top-3 left-3 right-3 h-[320px]',
              bottom: 'bottom-10 left-3 right-3 h-[320px]',
            };
            return (
            <div className={`absolute z-30 ${posClasses[panelPos] || posClasses.right} flex flex-col border shadow-2xl overflow-hidden transition-all duration-300 touch-pan-y`}
              style={{
                '--accent': accent,
                '--accent-hover': accent + 'dd',
                '--bg-primary': isDark ? '#0f172a' : '#ffffff',
                '--bg-secondary': isDark ? '#1e293b' : '#f8fafc',
                '--bg-card': isDark ? '#1e293b' : '#f1f5f9',
                '--bg-input': isDark ? '#1e293b' : '#ffffff',
                '--border': isDark ? '#334155' : '#e2e8f0',
                '--border-focus': accent,
                '--text-primary': isDark ? '#f1f5f9' : '#0f172a',
                '--text-secondary': isDark ? '#cbd5e1' : '#475569',
                '--text-muted': isDark ? '#94a3b8' : '#94a3b8',
                backgroundColor: isDark ? 'rgba(15, 23, 42, 0.95)' : 'rgba(255, 255, 255, 0.97)',
                borderColor: isDark ? 'rgba(51, 65, 85, 0.5)' : 'rgba(226, 232, 240, 0.8)',
                color: isDark ? '#f1f5f9' : '#0f172a',
              } as React.CSSProperties}
            >
              {/* Panel Tab Icons */}
              <div className="flex items-center justify-center gap-1 px-3 py-2 shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-primary)' }}>
                {([
                  { tab: 'details' as ConfigPanelTab, icon: Info, label: 'Details' },
                  { tab: 'parameters' as ConfigPanelTab, icon: Database, label: 'Configure' },
                  { tab: 'builder' as ConfigPanelTab, icon: LayoutGrid, label: 'Quote' },
                  { tab: 'pricing' as ConfigPanelTab, icon: DollarSign, label: 'Pricing' },
                ]).map(({ tab, icon: Icon, label }) => (
                  <button
                    key={tab}
                    onClick={() => setConfigPanelTab(tab)}
                    className={`w-8 h-8 flex items-center justify-center rounded-full transition-all ${
                      configPanelTab === tab
                        ? 'text-white shadow-sm'
                        : 'hover:opacity-80'
                    }`}
                    style={configPanelTab === tab ? { backgroundColor: 'var(--accent)' } : { color: 'var(--text-muted)' }}
                    title={label}
                  >
                    <Icon className="w-[16px] h-[16px]" />
                  </button>
                ))}
                <button
                  onClick={() => setShowConfigPanel(false)}
                  className="ml-auto p-1 rounded-md transition-colors hover:opacity-80"
                  style={{ color: 'var(--text-muted)' }}
                  title="Close panel"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {/* Panel Header */}
              <div className="px-4 py-3 shrink-0" style={{ borderBottom: '1px solid var(--border)', backgroundColor: 'var(--bg-secondary)' }}>
                <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
                  {configPanelTab === 'parameters' ? product.name :
                   configPanelTab === 'pricing' ? 'Pricing' :
                   configPanelTab === 'builder' ? 'Request Quote' :
                   'Details'}
                </h2>
                {configPanelTab === 'parameters' && (
                  <p className="text-sm" style={{ color: 'var(--text-muted)' }}>Configure your product</p>
                )}
              </div>

              {/* Panel Content */}
              <div className="flex-1 overflow-y-auto">

                {/* ── Details Tab ── */}
                <div className={configPanelTab === 'details' ? 'block p-4 space-y-4' : 'hidden'}>
                  {(product.thumbnail || product.productImage) && (
                    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
                      <img
                        src={product.thumbnail || product.productImage}
                        alt={product.name}
                        className="w-full object-cover max-h-48"
                      />
                    </div>
                  )}
                  <div>
                    <h3 className="text-base font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{product.name}</h3>
                    {product.description && (
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{product.description}</p>
                    )}
                  </div>
                  {product.category && (
                    <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                      <Package className="w-4 h-4 shrink-0" />
                      <span>{product.category}</span>
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-sm" style={{ color: 'var(--text-muted)' }}>
                    <Database className="w-4 h-4 shrink-0" />
                    <span>{product.parameters.length} configurable parameter{product.parameters.length !== 1 ? 's' : ''}</span>
                  </div>
                </div>

                {/* ── Parameters (Configure) Tab ── */}
                <div className={configPanelTab === 'parameters' ? 'block p-2' : 'hidden'}>
                  {renderConfigControls()}

                  {product.parameters.length === 0 && (
                    <div className="p-6 text-center text-gray-400">
                      <SlidersHorizontal className="w-8 h-8 mx-auto mb-2 opacity-50" />
                      <p className="text-sm">No parameters configured</p>
                    </div>
                  )}
                </div>

                {/* ── Pricing Tab ── */}
                <div className={configPanelTab === 'pricing' ? 'block p-4 space-y-4' : 'hidden'}>
                    {product.pricing?.showPrice ? (
                      <>
                        {/* Breakdown items */}
                        <div className="space-y-2">
                          {priceData.breakdown.map((item, i) => (
                            <div key={i} className="flex items-center justify-between text-sm">
                              <span className="text-gray-400">{item.label}</span>
                              <span className={`font-medium ${item.amount >= 0 ? 'text-white' : 'text-green-400'}`}>
                                {item.amount >= 0 ? '' : '-'}{sym}{Math.abs(item.amount).toFixed(2)}
                              </span>
                            </div>
                          ))}
                        </div>

                        <hr className="border-slate-700" />

                        {/* Unit price */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-300">Unit Price</span>
                          <span className="text-lg font-bold text-white">{sym}{priceData.total.toFixed(2)}</span>
                        </div>

                        {/* Quantity */}
                        <div className="flex items-center justify-between">
                          <span className="text-sm font-medium text-gray-300">Quantity</span>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => setQuantity(Math.max(1, quantity - 1))}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors"
                              title="Decrease quantity"
                              aria-label="Decrease quantity"
                            >
                              <Minus className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                            <input
                              type="number"
                              min={1}
                              value={quantity}
                              onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                              className="w-14 text-center py-1 border border-slate-600 rounded-lg text-sm font-medium text-white bg-slate-800/60 outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                              aria-label="Quantity"
                              title="Quantity"
                            />
                            <button
                              onClick={() => setQuantity(quantity + 1)}
                              className="w-8 h-8 flex items-center justify-center rounded-lg border border-slate-600 hover:bg-slate-700 transition-colors"
                              title="Increase quantity"
                              aria-label="Increase quantity"
                            >
                              <Plus className="w-3.5 h-3.5 text-gray-400" />
                            </button>
                          </div>
                        </div>

                        <hr className="border-slate-700" />

                        {/* Total */}
                        <div className="flex items-center justify-between p-4 rounded-xl border" style={{ backgroundColor: 'color-mix(in srgb, var(--accent) 10%, transparent)', borderColor: 'color-mix(in srgb, var(--accent) 20%, transparent)' }}>
                          <span className="text-base font-semibold text-white">Total</span>
                          <span className="text-2xl font-bold" style={{ color: 'var(--accent)' }}>{sym}{(priceData.total * quantity).toFixed(2)}</span>
                        </div>

                        {/* Quick CTA */}
                        <button
                          onClick={() => setConfigPanelTab('builder')}
                          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium rounded-xl hover:opacity-90 transition-colors text-sm"
                          style={{ backgroundColor: 'var(--accent)' }}
                        >
                          <FileText className="w-4 h-4" />
                          Request Quote
                        </button>
                      </>
                    ) : (
                      <div className="p-6 text-center text-gray-400">
                        <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
                        <p className="text-sm">Pricing not configured</p>
                        <p className="text-xs mt-1">Contact us for a custom quote</p>
                      </div>
                    )}
                </div>

                {/* ── Builder (Quote) Tab ── */}
                <div className={configPanelTab === 'builder' ? 'block p-4 space-y-4' : 'hidden'}>
                    {/* Order summary mini */}
                    <div className="p-3 bg-slate-800/60 rounded-xl border border-slate-700">
                      <div className="flex items-center justify-between">
                        <div className="min-w-0">
                          <span className="text-sm font-medium text-gray-200 truncate block">{product.name}</span>
                          <span className="text-xs text-gray-400">Qty: {quantity}</span>
                        </div>
                        {product.pricing?.showPrice && (
                          <span className="text-base font-bold shrink-0" style={{ color: 'var(--accent)' }}>{sym}{(priceData.total * quantity).toFixed(2)}</span>
                        )}
                      </div>
                    </div>

                    {/* Form fields */}
                    <div className="space-y-3">
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Full Name</label>
                        <input
                          type="text"
                          value={customerForm.name}
                          onChange={(e) => setCustomerForm(f => ({ ...f, name: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/60 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                          placeholder="John Smith"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">
                          Email Address <span className="text-red-500">*</span>
                        </label>
                        <input
                          type="email"
                          value={customerForm.email}
                          onChange={(e) => setCustomerForm(f => ({ ...f, email: e.target.value }))}
                          className="w-full px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/60 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                          placeholder="john@company.com"
                          required
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Phone</label>
                          <input
                            type="tel"
                            value={customerForm.phone}
                            onChange={(e) => setCustomerForm(f => ({ ...f, phone: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/60 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                            placeholder="+1 (555) 000"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-400 mb-1">Company</label>
                          <input
                            type="text"
                            value={customerForm.company}
                            onChange={(e) => setCustomerForm(f => ({ ...f, company: e.target.value }))}
                            className="w-full px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/60 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none"
                            placeholder="Company, Inc."
                          />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-400 mb-1">Notes</label>
                        <textarea
                          value={customerForm.notes}
                          onChange={(e) => setCustomerForm(f => ({ ...f, notes: e.target.value }))}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/60 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                          placeholder="Any special requirements..."
                        />
                      </div>
                    </div>

                    {quoteError && (
                      <div className="flex items-center gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                        <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
                        {quoteError}
                      </div>
                    )}

                    {/* Submit button */}
                    <button
                      onClick={handleSubmitQuote}
                      disabled={quoteSubmitting || !customerForm.email}
                      className="w-full flex items-center justify-center gap-2 px-4 py-3 text-white font-semibold rounded-xl hover:opacity-90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
                      style={{ backgroundColor: 'var(--accent)' }}
                    >
                      {quoteSubmitting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Send className="w-4 h-4" />
                      )}
                      {quoteSubmitting ? 'Submitting...' : 'Submit Quote Request'}
                    </button>
                </div>
              </div>

              {/* Update Model Dimension — fixed at panel bottom, parameters tab only */}
              {configPanelTab === 'parameters' && (
                <div className="px-3 py-3 border-t shrink-0" style={{ borderColor: 'var(--border)', backgroundColor: 'var(--bg-primary)' }}>
                  <div className="flex gap-2">
                  <button
                    className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 text-white font-medium rounded-xl hover:opacity-90 transition-colors text-sm shadow-sm disabled:opacity-50 relative"
                    style={{ backgroundColor: 'var(--accent)' }}
                    onClick={handleRegenerate}
                    disabled={(regenerating || dwgRegenerating) || !product?.sourceFile}
                  >
                    {hasChanges && !(regenerating || dwgRegenerating) && (
                      <span className="absolute -top-1 -right-1 flex h-3 w-3">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                        <span className="relative inline-flex rounded-full h-3 w-3 bg-orange-500" />
                      </span>
                    )}
                    {(regenerating || dwgRegenerating) ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <RefreshCw className="w-4 h-4" />
                    )}
                    {(regenerating || dwgRegenerating) ? 'Updating...' : 'Update Model Dimension'}
                  </button>
                  {/* Download button — only shown when output is available */}
                  {product?.lastOutputUrn && (
                    <button
                      type="button"
                      onClick={handleDownload}
                      disabled={downloading || regenerating}
                      title="Download configured output file"
                      className="flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl border text-sm font-medium transition-colors disabled:opacity-50 hover:bg-slate-700"
                      style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', backgroundColor: 'var(--bg-secondary)' }}
                    >
                      {downloading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                    </button>
                  )}
                  </div>
                  {/* Step progress indicator */}
                  {(regenerating || dwgRegenerating) && (() => {
                    const prog = regenProgress || dwgRegenProgress || '';
                    const step = prog.includes('Translat') ? 2 : prog.includes('Process') || prog.includes('Updating') ? 1 : 0;
                    const steps = ['Submitting', 'Processing', 'Translating'];
                    return (
                      <div className="mt-2">
                        <div className="flex items-center gap-1 mb-1.5">
                          {steps.map((s, i) => (
                            <div key={s} className="flex items-center gap-1 flex-1">
                              <div className={`w-2 h-2 rounded-full flex-shrink-0 transition-colors ${i <= step ? 'bg-orange-400' : 'bg-slate-600'}`} />
                              <span className={`text-[10px] truncate ${i === step ? 'text-orange-300' : i < step ? 'text-slate-500' : 'text-slate-600'}`}>{s}</span>
                              {i < steps.length - 1 && <div className={`flex-1 h-px ${i < step ? 'bg-orange-400/40' : 'bg-slate-700'}`} />}
                            </div>
                          ))}
                        </div>
                        <p className="text-slate-500 text-[10px]">Typically takes 30–90 seconds.</p>
                      </div>
                    );
                  })()}
                  {/* Regen error banner with retry */}
                  {regenError && (
                    <div className="mt-2 flex items-start gap-2 px-3 py-2 bg-red-500/10 border border-red-500/20 rounded-lg text-xs text-red-400">
                      <AlertCircle className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <p>{regenError}</p>
                        <button
                          type="button"
                          onClick={() => handleRegenerate()}
                          className="mt-1 text-red-300 underline hover:text-red-200 transition-colors"
                        >
                          Try again
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            );
          })()}
        </main>
      </div>

      {/* ═══════════ BOTTOM STATUS BAR ═══════════ */}
      {!isEmbedMode && (
      <div className="h-7 flex items-center px-4 text-[0.6875rem] text-gray-400 justify-between shrink-0 border-t z-40 bg-[#1e293b] border-slate-800">
        {/* Left: Product info */}
        <div className="flex items-center gap-3">
          {product.category && (
            <div className="flex items-center gap-1.5">
              <Package className="w-3 h-3" />
              <span>{product.category}</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <Ruler className="w-3 h-3" />
            <span>Metric</span>
          </div>
          <span className="text-slate-600">•</span>
          <span>Powered by SydeFlow</span>
        </div>
        {/* Right: Live price */}
        <div className="flex items-center gap-3">
          {product.pricing?.showPrice && (
            <span className="font-medium" style={{ color: layout?.styling?.accentColor || '#f97316' }}>
              {sym}{priceData.total.toFixed(2)}
              {quantity > 1 && <span className="text-gray-500 ml-1">× {quantity}</span>}
            </span>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
