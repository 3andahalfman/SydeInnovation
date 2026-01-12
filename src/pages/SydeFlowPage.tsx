import { Link, useSearchParams } from 'react-router-dom';
import { 
  X, Package, ChevronRight, Box, Grid3x3, DoorOpen, Grip, 
  Layers, Cable, Table2, Palette, Armchair, Mountain, Lightbulb,
  ArrowLeft, List, Home, Loader2, RefreshCw, Plus, Minus,
  Save, Download, Eye
} from 'lucide-react';
import { useState, useEffect, useRef, useCallback } from 'react';
import io, { Socket } from 'socket.io-client';

// Autodesk Viewer Component
function AutodeskViewer({ urn }: { urn?: string }) {
  const viewerContainer = useRef<HTMLDivElement>(null);
  const viewerInstance = useRef<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modelLoaded, setModelLoaded] = useState(false);

  const loadModel = useCallback((viewer: any, modelUrn: string) => {
    setLoading(true);
    setModelLoaded(false);
    setError(null);

    const documentId = modelUrn.startsWith('urn:') ? modelUrn : `urn:${modelUrn}`;
    console.log('Loading model with URN:', documentId);

    (window as any).Autodesk.Viewing.Document.load(
      documentId,
      (doc: any) => {
        const defaultModel = doc.getRoot().getDefaultGeometry();
        if (!defaultModel) {
          setError('Model has no viewable geometry');
          setLoading(false);
          return;
        }

        viewer.loadDocumentNode(doc, defaultModel).then(() => {
          console.log('Model loaded successfully');
          setModelLoaded(true);
          setLoading(false);
        }).catch((err: any) => {
          console.error('Failed to load model node:', err);
          setError('Failed to load 3D model');
          setLoading(false);
        });
      },
      (errorCode: number) => {
        console.error('Failed to load document:', errorCode);
        setError(`Failed to load model (Error: ${errorCode})`);
        setLoading(false);
      }
    );
  }, []);

  useEffect(() => {
    const loadViewerScripts = () => {
      return new Promise<void>((resolve, reject) => {
        if ((window as any).Autodesk?.Viewing) {
          resolve();
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
        script.onerror = () => reject(new Error('Failed to load Autodesk Viewer'));
        document.head.appendChild(script);
      });
    };

    const initializeViewer = async () => {
      try {
        setLoading(true);
        setError(null);

        await loadViewerScripts();

        if (!viewerContainer.current || viewerInstance.current) return;

        const options = {
          env: 'AutodeskProduction',
          api: 'derivativeV2',
          getAccessToken: async (callback: (token: string, expire: number) => void) => {
            try {
              const response = await fetch('/api/forge/oauth/token');
              if (!response.ok) throw new Error('Failed to fetch token');
              const data = await response.json();
              callback(data.access_token, data.expires_in);
            } catch (error) {
              console.error('Failed to get access token:', error);
              setError('Failed to authenticate with Autodesk');
            }
          }
        };

        (window as any).Autodesk.Viewing.Initializer(options, () => {
          const viewer = new (window as any).Autodesk.Viewing.GuiViewer3D(viewerContainer.current);
          viewerInstance.current = viewer;

          const startedCode = viewer.start();
          if (startedCode > 0) {
            setError('WebGL is not supported');
            setLoading(false);
            return;
          }

          setLoading(false);
          if (urn) loadModel(viewer, urn);
        });
      } catch (error) {
        setError('Failed to initialize viewer');
        setLoading(false);
      }
    };

    initializeViewer();

    return () => {
      if (viewerInstance.current) {
        viewerInstance.current.finish();
        viewerInstance.current = null;
      }
    };
  }, [loadModel]);

  useEffect(() => {
    if (viewerInstance.current && urn) {
      loadModel(viewerInstance.current, urn);
    }
  }, [urn, loadModel]);

  return (
    <div className="relative w-full h-full">
      <div ref={viewerContainer} className="w-full h-full" />
      {loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/75 z-10">
          <div className="text-center">
            <Loader2 className="w-12 h-12 text-orange-500 animate-spin mx-auto mb-4" />
            <p className="text-white text-sm">{modelLoaded ? 'Loading model...' : 'Initializing viewer...'}</p>
          </div>
        </div>
      )}
      {error && !loading && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900/90 z-10">
          <div className="text-center max-w-md px-6">
            <p className="text-white text-lg font-semibold mb-2">Viewer Error</p>
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        </div>
      )}
      {!loading && !error && !urn && (
        <div className="absolute inset-0 flex items-center justify-center bg-neutral-900 z-10">
          <div className="text-center">
            <p className="text-gray-500 text-sm">No 3D model selected</p>
            <p className="text-gray-600 text-xs mt-2">Configure your design to generate a preview</p>
          </div>
        </div>
      )}
    </div>
  );
}

// Main SydeFlow Page
export default function SydeFlowPage() {
  const [searchParams] = useSearchParams();
  const categoryFromUrl = searchParams.get('category');
  
  // UI State
  const [selectedCategory, setSelectedCategory] = useState<string | null>(categoryFromUrl);
  const [previousCategory, setPreviousCategory] = useState<string | null>(null);
  const [isChangingCategory, setIsChangingCategory] = useState(false);
  const [isConfigOpen, setIsConfigOpen] = useState(true);
  const [activeConfigSection, setActiveConfigSection] = useState<string | null>(null);
  const [isSummaryOpen, setIsSummaryOpen] = useState(false);

  // Model State
  const [modelUrn, setModelUrn] = useState<string | undefined>(undefined);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generationStatus, setGenerationStatus] = useState('');
  const [parametersChanged, setParametersChanged] = useState(false);
  const socketRef = useRef<Socket | null>(null);

  // Design Parameters
  const [dimensions, setDimensions] = useState({ width: 2000, height: 2400, depth: 600 });
  const [parameters, setParameters] = useState({ width: 36, height: 12, length: 24, thickness: 0.5 });
  const [material, setMaterial] = useState('Oak');
  const [finish, setFinish] = useState('Natural');
  const [components, setComponents] = useState<Record<string, number>>({ shelves: 4, drawers: 2, hangingRods: 1, doors: 2 });

  const categories = ['Wardrobes', 'TV Consoles', 'Tables', 'Chairs', 'Parametric Walls'];
  const materials = ['Oak', 'Walnut', 'Pine', 'Birch', 'MDF', 'Plywood'];
  const finishes = ['Natural', 'White', 'Black', 'Gray', 'Stained', 'Lacquered'];



  // Initialize category defaults from URL param
  useEffect(() => {
    if (categoryFromUrl && categories.includes(categoryFromUrl)) {
      switch (categoryFromUrl) {
        case 'Wardrobes':
          setDimensions({ width: 2000, height: 2400, depth: 600 });
          setComponents({ shelves: 4, drawers: 2, hangingRods: 1, doors: 2 });
          break;
        case 'TV Consoles':
          setDimensions({ width: 1800, height: 600, depth: 450 });
          setComponents({ shelves: 3, compartments: 2, drawers: 1, cableHoles: 2 });
          break;
        case 'Tables':
          setDimensions({ width: 1600, height: 750, depth: 900 });
          setComponents({ legs: 4, leaves: 0, supports: 1 });
          break;
        case 'Chairs':
          setDimensions({ width: 450, height: 850, depth: 500 });
          setComponents({ legs: 4, armrests: 2, cushions: 1 });
          break;
        case 'Parametric Walls':
          setDimensions({ width: 2400, height: 2700, depth: 100 });
          setComponents({ panels: 12, mountingPoints: 8, ledStrips: 2 });
          break;
      }
    }
  }, []);

  // Dynamic configuration sections based on category
  const getConfigSections = () => {
    switch (selectedCategory) {
      case 'Wardrobes':
        return [
          { id: 'frames', label: 'Frames', icon: Box },
          { id: 'doors', label: 'Doors', icon: DoorOpen },
          { id: 'handles', label: 'Handles', icon: Grip },
          { id: 'organisers', label: 'Organisers', icon: Grid3x3 }
        ];
      case 'TV Consoles':
        return [
          { id: 'frames', label: 'Frames', icon: Box },
          { id: 'shelves', label: 'Shelves & Compartments', icon: Layers },
          { id: 'doors', label: 'Doors & Drawers', icon: DoorOpen },
          { id: 'cable-management', label: 'Cable Management', icon: Cable }
        ];
      case 'Tables':
        return [
          { id: 'frames', label: 'Table Top', icon: Table2 },
          { id: 'legs', label: 'Legs & Base', icon: Grip },
          { id: 'finish', label: 'Finish & Details', icon: Palette },
          { id: 'extensions', label: 'Extensions & Leaves', icon: Layers }
        ];
      case 'Chairs':
        return [
          { id: 'frames', label: 'Seat & Cushion', icon: Armchair },
          { id: 'backrest', label: 'Backrest', icon: Box },
          { id: 'legs', label: 'Legs & Base', icon: Grip },
          { id: 'upholstery', label: 'Upholstery', icon: Palette }
        ];
      case 'Parametric Walls':
        return [
          { id: 'frames', label: 'Wall Pattern', icon: Grid3x3 },
          { id: 'texture', label: 'Texture & Depth', icon: Mountain },
          { id: 'lighting', label: 'Lighting Effects', icon: Lightbulb },
          { id: 'mounting', label: 'Mounting System', icon: Box }
        ];
      default:
        return [];
    }
  };

  const configSections = getConfigSections();

  // Calculate price
  const calculatePrice = () => {
    const basePrice = 1;
    const sizeAdjustment = Math.floor((dimensions.width + dimensions.height + dimensions.depth - 4000) / 100);
    const materialCost = materials.indexOf(material);
    let componentCost = 0;
    Object.values(components).forEach(value => { componentCost += value; });
    return Math.max(1, basePrice + Math.max(0, sizeAdjustment) + materialCost + componentCost);
  };

  // Parameter handlers
  const handleParameterChange = (param: string, value: number) => {
    if (param === 'thickness') {
      setParameters(prev => ({ ...prev, [param]: Math.max(0.1, Math.min(10, value)) }));
    } else {
      setParameters(prev => ({ ...prev, [param]: Math.max(10, Math.min(100, value)) }));
    }
    setParametersChanged(true);
  };

  const handleComponentChange = (comp: string, value: number) => {
    setComponents(prev => ({ ...prev, [comp]: Math.max(0, Math.min(20, value)) }));
  };

  // Socket.IO connection
  useEffect(() => {
    socketRef.current = io('http://localhost:8080');

    socketRef.current.on('connect', () => {
      console.log('Socket.IO connected:', socketRef.current?.id);
    });

    socketRef.current.on('onComplete', (message: any) => {
      if (typeof message === 'string') {
        setGenerationStatus(message);
      } else if (message.status) {
        setGenerationStatus(`Workitem: ${message.status} ${message.progress || ''}`);
      }
    });

    socketRef.current.on('workitemComplete', (data: { urn: string }) => {
      console.log('Workitem complete, received URN:', data.urn);
      setGenerationStatus('Model generated! Translating for viewer...');
      pollTranslationStatus(data.urn);
    });

    socketRef.current.on('onError', (error: string) => {
      setGenerationStatus('Error: ' + error);
      setIsGenerating(false);
    });

    return () => {
      socketRef.current?.disconnect();
    };
  }, []);

  // Poll translation status
  const pollTranslationStatus = async (urn: string) => {
    let attempts = 0;
    const maxAttempts = 60;

    const checkStatus = async (): Promise<void> => {
      try {
        const response = await fetch(`/api/translation/${encodeURIComponent(urn)}`);
        const data = await response.json();

        if (data.status === 'success' || data.status === 'complete') {
          setGenerationStatus('Complete!');
          setModelUrn(urn);
          setIsGenerating(false);
          setTimeout(() => setGenerationStatus(''), 2000);
        } else if (data.status === 'failed') {
          throw new Error('Translation failed');
        } else {
          attempts++;
          if (attempts < maxAttempts) {
            setGenerationStatus(`Translating... ${data.progress || ''}`);
            setTimeout(checkStatus, 2000);
          } else {
            throw new Error('Translation timeout');
          }
        }
      } catch (error) {
        setGenerationStatus('Error loading model');
        setIsGenerating(false);
      }
    };

    checkStatus();
  };

  // Generate model
  const generateModel = async () => {
    if (isGenerating) return;

    if (!socketRef.current?.connected) {
      setGenerationStatus('Connecting to server...');
      await new Promise<void>((resolve) => {
        const checkConnection = setInterval(() => {
          if (socketRef.current?.connected) {
            clearInterval(checkConnection);
            resolve();
          }
        }, 100);
        setTimeout(() => { clearInterval(checkConnection); resolve(); }, 5000);
      });
    }

    const connectionId = socketRef.current?.id || '';
    if (!connectionId) {
      setGenerationStatus('Error: Could not connect to server');
      return;
    }

    setIsGenerating(true);
    setParametersChanged(false);
    setGenerationStatus('Preparing workitem...');

    try {
      const formData = new FormData();
      formData.append('inputFile', new Blob([]), 'dummy.ipt');
      formData.append('data', JSON.stringify({
        width: parameters.width,
        height: parameters.height,
        length: parameters.length,
        thickness: parameters.thickness,
        activityName: 'UpdateIPTParamActivity',
        browserConnectionId: connectionId,
        ossBucket: 'planique-dev-templates',
        ossObject: 'inventor_sample_file.ipt'
      }));

      setGenerationStatus('Starting Design Automation...');

      const result = await fetch('/api/aps/designautomation/workitems', {
        method: 'POST',
        body: formData
      });

      if (!result.ok) throw new Error('Failed to start workitem');
      setGenerationStatus('Workitem submitted, processing...');
    } catch (error) {
      console.error('Generation error:', error);
      setGenerationStatus('Error generating model');
      setIsGenerating(false);
    }
  };

  // Category selection
  const handleCategorySelect = (category: string) => {
    setSelectedCategory(category);
    setIsChangingCategory(false);

    switch (category) {
      case 'Wardrobes':
        setDimensions({ width: 2000, height: 2400, depth: 600 });
        setComponents({ shelves: 4, drawers: 2, hangingRods: 1, doors: 2 });
        break;
      case 'TV Consoles':
        setDimensions({ width: 1800, height: 600, depth: 450 });
        setComponents({ shelves: 3, compartments: 2, drawers: 1, cableHoles: 2 });
        break;
      case 'Tables':
        setDimensions({ width: 1600, height: 750, depth: 900 });
        setComponents({ legs: 4, leaves: 0, supports: 1 });
        break;
      case 'Chairs':
        setDimensions({ width: 450, height: 850, depth: 500 });
        setComponents({ legs: 4, armrests: 2, cushions: 1 });
        break;
      case 'Parametric Walls':
        setDimensions({ width: 2400, height: 2700, depth: 100 });
        setComponents({ panels: 12, mountingPoints: 8, ledStrips: 2 });
        break;
    }
  };

  const handleChangeCategory = () => {
    setPreviousCategory(selectedCategory);
    setIsChangingCategory(true);
    setSelectedCategory(null);
  };

  const handleCloseModal = () => {
    if (isChangingCategory) {
      setSelectedCategory(previousCategory);
      setIsChangingCategory(false);
    } else {
      window.history.back();
    }
  };



  return (
    <div className="h-screen bg-gradient-to-br from-slate-950 via-blue-950 to-slate-900 flex flex-col">
      {/* Parameter Change Notification */}
      {parametersChanged && !isGenerating && (
        <div className="fixed top-20 right-6 z-50 bg-orange-500 text-white px-5 py-3 rounded-lg shadow-lg flex items-center gap-3">
          <span className="text-xl">⚠️</span>
          <span className="font-medium">Parameters changed - Click "Generate Model" to update</span>
        </div>
      )}

      {/* Header */}
      <div className="px-8 py-4 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link to="/sydeflow" className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors" title="Back to Categories">
            <Home className="w-6 h-6 text-gray-400" />
          </Link>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
              <span className="text-white font-bold text-sm">SF</span>
            </div>
            <h1 className="text-2xl font-bold text-white">
              SydeFlow{selectedCategory && ` - ${selectedCategory}`}
            </h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {selectedCategory && (
            <>
              <button
                onClick={handleChangeCategory}
                className="px-4 py-2 bg-slate-700/50 hover:bg-slate-600/50 text-gray-300 rounded-lg font-medium transition-colors flex items-center gap-2 text-sm border border-slate-600/50"
              >
                <Package className="w-4 h-4" />
                Change Category
              </button>

              <div className="flex items-center gap-3 px-4 py-2 bg-slate-800/50 rounded-lg border border-slate-600/50 backdrop-blur-sm">
                <div className="flex items-center gap-2">
                  <List className="w-5 h-5 text-gray-400" />
                  <span className="text-2xl font-bold text-white">${calculatePrice()}</span>
                </div>
                <button
                  onClick={() => setIsSummaryOpen(true)}
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  Summary
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </>
          )}
          <Link to="/sydeflow" className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors" title="Back to Categories">
            <X className="w-5 h-5 text-gray-400" />
          </Link>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 px-8 py-4 overflow-hidden">
        <div className="flex gap-4 h-full">
          {/* 3D Viewer - 70% */}
          <div className="flex-[7] bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-700/50 p-6 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-2xl font-bold text-white">3D Viewer SDK</h3>
              <button className="p-2 bg-orange-500/20 hover:bg-orange-500/30 rounded-lg transition-colors">
                <Eye className="w-5 h-5 text-orange-400" />
              </button>
            </div>
            <div className="flex-1 bg-neutral-900 rounded-lg overflow-hidden relative">
              <AutodeskViewer urn={modelUrn} />
              {isGenerating && (
                <div className="absolute inset-0 bg-black/70 flex items-center justify-center z-50">
                  <div className="bg-slate-800 rounded-lg p-6 shadow-2xl max-w-sm border border-slate-700">
                    <div className="flex items-center gap-3 mb-3">
                      <Loader2 className="w-6 h-6 text-orange-500 animate-spin" />
                      <h4 className="text-lg font-bold text-white">Generating Model</h4>
                    </div>
                    <p className="text-sm text-gray-400">{generationStatus}</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Configuration Panel - 30% */}
          {isConfigOpen && (
            <div className="flex-[3] bg-slate-800/50 backdrop-blur-lg rounded-2xl shadow-xl border border-slate-700/50 overflow-hidden flex flex-col">
              <div className="sticky top-0 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 p-4 flex items-center justify-between z-10">
                <h3 className="text-xl font-bold text-white">Configuration</h3>
                <button onClick={() => setIsConfigOpen(false)} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto">
                {!activeConfigSection ? (
                  <>
                    <div className="p-4">
                      <h4 className="text-lg font-bold text-white mb-4">Design your {selectedCategory}</h4>
                    </div>

                    <div className="border-t border-slate-700/50">
                      {configSections.map((section) => {
                        const Icon = section.icon;
                        return (
                          <button
                            key={section.id}
                            onClick={() => setActiveConfigSection(section.id)}
                            className="w-full px-6 py-4 flex items-center justify-between hover:bg-slate-700/30 transition-colors border-b border-slate-700/50"
                          >
                            <div className="flex items-center gap-3">
                              <Icon className="w-5 h-5 text-gray-400" />
                              <span className="font-medium text-white">{section.label}</span>
                            </div>
                            <ChevronRight className="w-5 h-5 text-gray-500" />
                          </button>
                        );
                      })}
                    </div>

                    <div className="p-6 space-y-2 bg-slate-900/50 border-t border-slate-700/50 mt-4">
                      <button className="w-full bg-slate-700/50 hover:bg-slate-600/50 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 border border-slate-600/50 text-sm">
                        <Save className="w-4 h-4" />
                        Save Design
                      </button>
                      <button className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 text-sm">
                        <Download className="w-4 h-4" />
                        Download CAD Files
                      </button>
                    </div>
                  </>
                ) : (
                  <div className="h-full flex flex-col">
                    <div className="sticky top-0 bg-slate-900/80 backdrop-blur-lg border-b border-slate-700/50 p-4 flex items-center gap-3 z-10">
                      <button onClick={() => setActiveConfigSection(null)} className="p-2 hover:bg-slate-700/50 rounded-lg transition-colors">
                        <ArrowLeft className="w-5 h-5 text-gray-400" />
                      </button>
                      <h4 className="text-lg font-bold text-white">
                        {configSections.find(s => s.id === activeConfigSection)?.label}
                      </h4>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      {activeConfigSection === 'frames' && (
                        <>
                          {/* Design Automation Parameters */}
                          <div>
                            <h5 className="text-sm font-bold text-white mb-3">Parameters (inches)</h5>
                            <div className="space-y-4">
                              {Object.entries(parameters).map(([key, value]) => (
                                <div key={key}>
                                  <div className="flex items-center justify-between mb-2">
                                    <label className="text-xs font-medium text-gray-400 capitalize">{key}</label>
                                    <input
                                      type="number"
                                      min={key === 'thickness' ? '0.1' : '10'}
                                      max={key === 'thickness' ? '10' : '100'}
                                      step={key === 'thickness' ? '0.1' : '1'}
                                      value={value}
                                      onChange={(e) => handleParameterChange(key, parseFloat(e.target.value) || (key === 'thickness' ? 0.1 : 10))}
                                      className="w-20 px-2 py-1 border border-slate-600 rounded text-center focus:outline-none focus:ring-2 focus:ring-orange-500 text-xs font-semibold text-white bg-slate-700"
                                    />
                                  </div>
                                  <input
                                    type="range"
                                    min={key === 'thickness' ? '0.1' : '10'}
                                    max={key === 'thickness' ? '10' : '100'}
                                    step={key === 'thickness' ? '0.1' : '1'}
                                    value={value}
                                    onChange={(e) => handleParameterChange(key, parseFloat(e.target.value))}
                                    className="w-full h-2 bg-slate-600 rounded-lg appearance-none cursor-pointer accent-orange-500"
                                  />
                                </div>
                              ))}
                            </div>
                          </div>

                          {/* Generate Model Button */}
                          <div>
                            <button
                              onClick={generateModel}
                              disabled={isGenerating}
                              className="w-full px-4 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-lg font-medium transition-colors flex items-center justify-center gap-2"
                            >
                              {isGenerating ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Generating...
                                </>
                              ) : (
                                <>
                                  <RefreshCw className="w-4 h-4" />
                                  Generate Model
                                </>
                              )}
                            </button>
                          </div>

                          {/* Materials & Finish */}
                          <div>
                            <h5 className="text-sm font-bold text-white mb-3">Materials & Finish</h5>
                            <div className="space-y-4">
                              <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">Material</label>
                                <p className="text-xs text-gray-500 mb-3">{material}</p>
                                <div className="flex flex-wrap gap-3">
                                  {materials.map(m => {
                                    const materialColors: Record<string, string> = {
                                      'Oak': '#D4A574', 'Walnut': '#6B4423', 'Pine': '#E8C8A0',
                                      'Birch': '#F5E6D3', 'MDF': '#C9B8A8', 'Plywood': '#DDB892'
                                    };
                                    return (
                                      <button
                                        key={m}
                                        onClick={() => setMaterial(m)}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                                          material === m ? 'border-orange-500 ring-2 ring-offset-2 ring-offset-slate-800 ring-orange-500' : 'border-slate-600 hover:border-slate-500'
                                        }`}
                                        style={{ backgroundColor: materialColors[m] }}
                                        title={m}
                                      />
                                    );
                                  })}
                                </div>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-gray-400 mb-2">Finish</label>
                                <p className="text-xs text-gray-500 mb-3">{finish}</p>
                                <div className="flex flex-wrap gap-3">
                                  {finishes.map(f => {
                                    const finishColors: Record<string, string> = {
                                      'Natural': '#F5E6D3', 'White': '#FFFFFF', 'Black': '#1A1A1A',
                                      'Gray': '#6B7280', 'Stained': '#8B4513', 'Lacquered': '#E5E7EB'
                                    };
                                    return (
                                      <button
                                        key={f}
                                        onClick={() => setFinish(f)}
                                        className={`w-10 h-10 rounded-full border-2 transition-all ${
                                          finish === f ? 'border-orange-500 ring-2 ring-offset-2 ring-offset-slate-800 ring-orange-500' : 'border-slate-600 hover:border-slate-500'
                                        }`}
                                        style={{ backgroundColor: finishColors[f] }}
                                        title={f}
                                      />
                                    );
                                  })}
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Components */}
                          <div>
                            <h5 className="text-sm font-bold text-white mb-3">Components</h5>
                            <div className="space-y-3">
                              {Object.entries(components).map(([key, value]) => (
                                <div key={key}>
                                  <label className="block text-xs font-medium text-gray-400 mb-1.5 capitalize">
                                    {key.replace(/([A-Z])/g, ' $1').trim()}
                                  </label>
                                  <div className="flex items-center gap-2">
                                    <button
                                      onClick={() => handleComponentChange(key, value - 1)}
                                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors border border-slate-600"
                                    >
                                      <Minus className="w-3 h-3 text-gray-300" />
                                    </button>
                                    <input
                                      type="number"
                                      min="0"
                                      max="20"
                                      value={value}
                                      onChange={(e) => handleComponentChange(key, parseInt(e.target.value) || 0)}
                                      className="flex-1 px-3 py-1.5 border border-slate-600 rounded-lg text-center focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm bg-slate-700 text-white"
                                    />
                                    <button
                                      onClick={() => handleComponentChange(key, value + 1)}
                                      className="p-1.5 bg-slate-700 hover:bg-slate-600 rounded transition-colors border border-slate-600"
                                    >
                                      <Plus className="w-3 h-3 text-gray-300" />
                                    </button>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </>
                      )}

                      {activeConfigSection !== 'frames' && (
                        <div className="text-center py-12">
                          <p className="text-gray-500">Coming soon...</p>
                        </div>
                      )}
                    </div>

                    <div className="sticky bottom-0 bg-slate-900/80 backdrop-blur-lg border-t border-slate-700/50 p-4">
                      <button
                        onClick={() => setActiveConfigSection(null)}
                        className="w-full bg-orange-500 hover:bg-orange-600 text-white py-2.5 rounded-lg font-medium transition-colors text-sm"
                      >
                        Done
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Toggle Button when panel is closed */}
          {!isConfigOpen && (
            <button
              onClick={() => setIsConfigOpen(true)}
              className="fixed right-4 top-1/2 -translate-y-1/2 bg-orange-500 hover:bg-orange-600 text-white p-3 rounded-lg shadow-lg transition-colors z-20"
            >
              <Package className="w-6 h-6" />
            </button>
          )}
        </div>
      </div>

      {/* Category Selection Modal */}
      {!selectedCategory && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto relative border border-slate-700">
            <button
              onClick={handleCloseModal}
              className="absolute top-4 right-4 p-2 hover:bg-slate-700/50 rounded-full transition-colors z-10"
            >
              <X className="w-6 h-6 text-gray-400" />
            </button>
            <div className="p-8">
              <div className="text-center mb-8">
                <h2 className="text-4xl font-bold text-white mb-3">Choose Your Category</h2>
                <p className="text-gray-400 text-lg">Select a product category to start designing</p>
              </div>

              <div className="grid grid-cols-2 gap-6">
                {categories.map((category) => {
                  const prices: Record<string, string> = {
                    'Wardrobes': '$1', 'TV Consoles': '$1', 'Tables': '$1', 'Chairs': '$1', 'Parametric Walls': '$1'
                  };
                  const descriptions: Record<string, string> = {
                    'Wardrobes': 'Design custom wardrobes with adjustable shelves, drawers, and hanging space',
                    'TV Consoles': 'Create entertainment units with customizable storage and cable management',
                    'Tables': 'Configure dining and office tables to your exact specifications',
                    'Chairs': 'Design comfortable seating with custom dimensions and upholstery',
                    'Parametric Walls': 'Design architectural wall features with 3D patterns and textures'
                  };
                  const images: Record<string, string> = {
                    'Wardrobes': 'https://images.pexels.com/photos/1350789/pexels-photo-1350789.jpeg?auto=compress&cs=tinysrgb&w=600',
                    'TV Consoles': 'https://images.pexels.com/photos/1866149/pexels-photo-1866149.jpeg?auto=compress&cs=tinysrgb&w=600',
                    'Tables': 'https://images.pexels.com/photos/1884584/pexels-photo-1884584.jpeg?auto=compress&cs=tinysrgb&w=600',
                    'Chairs': 'https://images.pexels.com/photos/116910/pexels-photo-116910.jpeg?auto=compress&cs=tinysrgb&w=600',
                    'Parametric Walls': 'https://images.pexels.com/photos/271816/pexels-photo-271816.jpeg?auto=compress&cs=tinysrgb&w=600'
                  };

                  return (
                    <button
                      key={category}
                      onClick={() => handleCategorySelect(category)}
                      className="group text-left bg-slate-800/50 rounded-xl overflow-hidden border-2 border-slate-700/50 hover:border-orange-500 transition-all duration-300 transform hover:-translate-y-1 hover:shadow-xl hover:shadow-orange-500/10"
                    >
                      <div className="aspect-[4/3] overflow-hidden relative">
                        <img
                          src={images[category]}
                          alt={category}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/20 to-transparent" />
                        <div className="absolute top-3 right-3 bg-orange-500 text-white font-bold px-3 py-1 rounded-full text-sm">
                          From {prices[category]}
                        </div>
                      </div>
                      <div className="p-6">
                        <h3 className="text-2xl font-bold text-white mb-2">{category}</h3>
                        <p className="text-gray-400 text-sm leading-relaxed">{descriptions[category]}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Summary Panel */}
      {isSummaryOpen && (
        <>
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50" onClick={() => setIsSummaryOpen(false)} />
          <div className="fixed right-0 top-0 h-full w-full max-w-md bg-slate-900 shadow-2xl z-50 border-l border-slate-700">
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">Order Summary</h3>
                  <button onClick={() => setIsSummaryOpen(false)} className="p-2 hover:bg-slate-700/50 rounded-full transition-colors">
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6">
                <div className="space-y-6">
                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Product</h4>
                    <p className="text-lg font-medium text-white">{selectedCategory}</p>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Dimensions</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                        <span className="text-gray-400">Width</span>
                        <span className="font-medium text-white">{dimensions.width} mm</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                        <span className="text-gray-400">Height</span>
                        <span className="font-medium text-white">{dimensions.height} mm</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                        <span className="text-gray-400">Depth</span>
                        <span className="font-medium text-white">{dimensions.depth} mm</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Materials & Finish</h4>
                    <div className="space-y-2">
                      <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                        <span className="text-gray-400">Material</span>
                        <span className="font-medium text-white">{material}</span>
                      </div>
                      <div className="flex justify-between items-center py-2 border-b border-slate-700/50">
                        <span className="text-gray-400">Finish</span>
                        <span className="font-medium text-white">{finish}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h4 className="text-sm font-semibold text-gray-500 uppercase mb-2">Components</h4>
                    <div className="space-y-2">
                      {Object.entries(components).map(([key, value]) => (
                        <div key={key} className="flex justify-between items-center py-2 border-b border-slate-700/50">
                          <span className="text-gray-400 capitalize">{key.replace(/([A-Z])/g, ' $1').trim()}</span>
                          <span className="font-medium text-white">{value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-orange-500/10 rounded-lg p-4 border border-orange-500/20">
                    <h4 className="text-sm font-semibold text-orange-400 uppercase mb-3">Price Details</h4>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between items-center">
                        <span className="text-orange-300/70">Base Price</span>
                        <span className="font-medium text-orange-300">$1</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-orange-300/70">Size Adjustments</span>
                        <span className="font-medium text-orange-300">+${Math.max(0, Math.floor((dimensions.width + dimensions.height + dimensions.depth - 4000) / 100))}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-orange-300/70">Material Cost</span>
                        <span className="font-medium text-orange-300">+${materials.indexOf(material)}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-orange-300/70">Components</span>
                        <span className="font-medium text-orange-300">+${Object.values(components).reduce((sum, val) => sum + val, 0)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              <div className="p-6 border-t border-slate-700 bg-slate-800/50">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-lg font-semibold text-white">Total Price:</span>
                  <span className="text-3xl font-bold text-orange-500">${calculatePrice()}</span>
                </div>
                <div className="space-y-2">
                  <button
                    onClick={handleAddToCart}
                    className="w-full bg-orange-500 text-white py-3 rounded-lg font-medium hover:bg-orange-600 transition-colors flex items-center justify-center gap-2"
                  >
                    <ShoppingCart className="w-5 h-5" />
                    Add to Cart
                  </button>
                  <button
                    onClick={() => setIsSummaryOpen(false)}
                    className="w-full bg-slate-700/50 text-white py-3 rounded-lg font-medium hover:bg-slate-600/50 transition-colors border border-slate-600/50"
                  >
                    Continue Configuring
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
