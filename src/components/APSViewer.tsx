import { useEffect, useRef, useState, useCallback } from 'react';

// Type declarations for Autodesk Viewer
declare global {
  interface Window {
    Autodesk: typeof Autodesk;
  }
  const Autodesk: {
    Viewing: {
      Initializer: (options: InitializerOptions, callback: () => void) => void;
      GuiViewer3D: new (container: HTMLElement, config?: ViewerConfig) => Viewer3D;
      Document: {
        load: (
          urn: string,
          onSuccess: (doc: Document) => void,
          onError: (errorCode: number) => void
        ) => void;
      };
    };
  };
}

interface InitializerOptions {
  env: string;
  api?: string;
  getAccessToken: (callback: (token: string, expires: number) => void) => void;
}

interface ViewerConfig {
  extensions?: string[];
}

interface Viewer3D {
  start: () => void;
  finish: () => void;
  loadDocumentNode: (doc: Document, viewables: any) => Promise<any>;
  loadModel: (url: string, options: any, onSuccess: () => void, onError: (err: any) => void) => void;
  clearAll: () => void;
  setTheme: (theme: string) => void;
  setBackgroundColor: (r: number, g: number, b: number, r2: number, g2: number, b2: number) => void;
  resize: () => void;
}

interface Document {
  getRoot: () => { getDefaultGeometry: () => any };
}

interface APSViewerProps {
  urn?: string;
  onViewerReady?: (viewer: Viewer3D) => void;
  onModelLoaded?: () => void;
  onError?: (error: string) => void;
  className?: string;
  apiEndpoint?: string;
}

const APS_VIEWER_VERSION = '7.*';

export default function APSViewer({
  urn,
  onViewerReady,
  onModelLoaded,
  onError,
  className = '',
  apiEndpoint = 'http://localhost:8080/api'
}: APSViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<Viewer3D | null>(null);
  const [isInitialized, setIsInitialized] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch access token from backend
  const getAccessToken = useCallback(async (callback: (token: string, expires: number) => void) => {
    try {
      const response = await fetch(`${apiEndpoint}/auth/token`);
      if (!response.ok) throw new Error('Failed to get token');
      const data = await response.json();
      callback(data.access_token, data.expires_in);
    } catch (err) {
      console.error('Token fetch error:', err);
      setError('Failed to authenticate with APS');
      onError?.('Failed to authenticate with APS');
    }
  }, [apiEndpoint, onError]);

  // Load Autodesk Viewer scripts
  useEffect(() => {
    const loadViewerScripts = async () => {
      // Check if already loaded
      if (window.Autodesk?.Viewing) {
        setIsInitialized(true);
        return;
      }

      // Load CSS
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${APS_VIEWER_VERSION}/style.min.css`;
      document.head.appendChild(link);

      // Load JS
      const script = document.createElement('script');
      script.src = `https://developer.api.autodesk.com/modelderivative/v2/viewers/${APS_VIEWER_VERSION}/viewer3D.min.js`;
      script.async = true;
      script.onload = () => {
        setIsInitialized(true);
      };
      script.onerror = () => {
        setError('Failed to load Autodesk Viewer');
        onError?.('Failed to load Autodesk Viewer');
      };
      document.body.appendChild(script);
    };

    loadViewerScripts();
  }, [onError]);

  // Initialize viewer when scripts are loaded
  useEffect(() => {
    if (!isInitialized || !containerRef.current) return;

    const initViewer = () => {
      window.Autodesk.Viewing.Initializer(
        {
          env: 'AutodeskProduction2',
          api: 'streamingV2',
          getAccessToken: getAccessToken
        },
        () => {
          if (!containerRef.current) return;

          const viewer = new window.Autodesk.Viewing.GuiViewer3D(containerRef.current, {
            extensions: ['Autodesk.DocumentBrowser']
          });
          viewer.start();
          viewer.setTheme('dark-theme');
          viewer.setBackgroundColor(15, 23, 42, 15, 23, 42); // slate-900 color
          
          viewerRef.current = viewer;
          onViewerReady?.(viewer);
        }
      );
    };

    initViewer();

    return () => {
      if (viewerRef.current) {
        viewerRef.current.finish();
        viewerRef.current = null;
      }
    };
  }, [isInitialized, getAccessToken, onViewerReady]);

  // Load model when URN changes
  useEffect(() => {
    if (!urn || !viewerRef.current) return;

    setIsLoading(true);
    setError(null);

    window.Autodesk.Viewing.Document.load(
      `urn:${urn}`,
      (doc) => {
        const viewables = doc.getRoot().getDefaultGeometry();
        viewerRef.current?.loadDocumentNode(doc, viewables)
          .then(() => {
            setIsLoading(false);
            onModelLoaded?.();
          })
          .catch((err) => {
            setIsLoading(false);
            setError('Failed to load model');
            onError?.('Failed to load model');
            console.error('Model load error:', err);
          });
      },
      (errorCode) => {
        setIsLoading(false);
        setError(`Failed to load document: Error ${errorCode}`);
        onError?.(`Failed to load document: Error ${errorCode}`);
      }
    );
  }, [urn, onModelLoaded, onError]);

  // Handle resize
  useEffect(() => {
    const handleResize = () => {
      viewerRef.current?.resize();
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className={`relative ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full min-h-[400px] rounded-xl overflow-hidden"
      />
      
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-white">Loading 3D Model...</p>
          </div>
        </div>
      )}

      {/* Error overlay */}
      {error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 backdrop-blur-sm rounded-xl">
          <div className="text-center p-6">
            <div className="w-12 h-12 bg-red-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <p className="text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Placeholder when no model */}
      {!urn && !isLoading && !error && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/50 backdrop-blur-sm rounded-xl">
          <div className="text-center p-6">
            <div className="w-16 h-16 bg-orange-500/20 rounded-full flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
              </svg>
            </div>
            <p className="text-gray-400">Upload a CAD file to view</p>
          </div>
        </div>
      )}
    </div>
  );
}
