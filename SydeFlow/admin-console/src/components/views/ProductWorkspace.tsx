"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
  Package,
  Box,
  Plus,
  Edit,
  Trash2,
  Play,
  Settings,
  Upload,
  FileCode,
  Folder,
  ChevronRight,
  ChevronDown,
  Save,
  X,
  AlertCircle,
  CheckCircle,
  Clock,
  Loader2,
  RefreshCw,
  Eye,
  Download,
  Zap,
  Database,
  ArrowRight,
  TestTube,
  Rocket,
  HardDrive,
  File,
  MoreVertical,
  Search,
  Filter,
  Grid3X3,
  List,
  ExternalLink,
  Sliders,
  PenTool,
  ChevronLeft,
  ChevronsLeft,
  ChevronsRight,
  ArrowUpDown,
  Link2,
  Tag,
  Layers,
  Share2,
  Maximize2,
  Minimize2,
  GripVertical,
  Info,
  HelpCircle,
} from "lucide-react";
import { io, Socket } from "socket.io-client";
import { useToast } from "@/contexts/ToastContext";
import { useNotifications } from "@/contexts/NotificationContext";
import type { ViewType } from "@/app/page";
import FormDesigner from "./FormDesigner";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { BASE_PATH, appPath } from '@/lib/config';

// ============================================================================
// TYPES
// ============================================================================

interface Parameter {
  name: string;
  displayName: string;
  type: "number" | "text" | "boolean" | "select";
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
  status: "draft" | "testing" | "live";
  thumbnail?: string;
  sourceFile?: {
    bucketKey: string;
    objectKey: string;
    fileName: string;
  };
  drawingFile?: {
    bucketKey: string;
    objectKey: string;
    fileName: string;
    urn?: string;
  };
  source?: string; // e.g., 'onshape', 'inventor', 'fusion'
  owner?: string;
  activityId?: string;
  parameters: Parameter[];
  properties?: Record<string, any>;
  connectors?: number;
  configurations?: number;
  lastRun?: string;
  lastOutputUrn?: string; // Persisted URN for 3D viewer
  createdAt: string;
  updatedAt: string;
}

interface OSSBucket {
  bucketKey: string;
  createdDate: string;
  policyKey: string;
}

interface OSSObject {
  objectKey: string;
  objectId: string;
  size: number;
}

interface Activity {
  id: string;
  description?: string;
}

interface Category {
  id: string;
  name: string;
  description: string;
}

// ============================================================================
// PRODUCT WORKSPACE VIEW
// ============================================================================

interface ProductWorkspaceProps {
  onNavigate?: (view: ViewType) => void;
}

export default function ProductWorkspace({
  onNavigate,
}: ProductWorkspaceProps) {
  const { addNotification } = useNotifications();
  const toast = useToast();
  const socketRef = useRef<Socket | null>(null);

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const [displayMode, setDisplayMode] = useState<"grid" | "list">("list");
  const [pageMode, setPageMode] = useState<"browse" | "detail" | "create">(
    "browse",
  );
  const [searchQuery, setSearchQuery] = useState("");

  // Table selection and pagination state
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(10);

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showFileSelector, setShowFileSelector] = useState(false);
  const [showDrawingFileSelector, setShowDrawingFileSelector] = useState(false);
  const [showActivitySelector, setShowActivitySelector] = useState(false);
  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [editCategoryProductId, setEditCategoryProductId] = useState<
    string | null
  >(null);
  const [editCategoryValue, setEditCategoryValue] = useState<string>("");
  const [statusDropdownProductId, setStatusDropdownProductId] = useState<
    string | null
  >(null);
  const [previewProduct, setPreviewProduct] = useState<Product | null>(null);

  // Delete confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    productId: string;
    productName: string;
    bulk?: boolean;
    ids?: Set<string>;
  }>({ open: false, productId: "", productName: "" });

  const [catDeleteConfirm, setCatDeleteConfirm] = useState<{ open: boolean; catId: string; catName: string }>(
    { open: false, catId: '', catName: '' }
  );

  // Preview modal viewer refs
  const previewViewerRef = useRef<HTMLDivElement>(null);
  const previewViewerInstanceRef = useRef<any>(null);
  const [previewViewerLoading, setPreviewViewerLoading] = useState(false);

  // Categories
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryForm, setCategoryForm] = useState({
    name: "",
    description: "",
  });
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);

  // OSS data for file selection
  const [buckets, setBuckets] = useState<OSSBucket[]>([]);
  const [selectedBucket, setSelectedBucket] = useState<string>("");
  const [bucketObjects, setBucketObjects] = useState<OSSObject[]>([]);
  const [loadingObjects, setLoadingObjects] = useState(false);

  // Activities
  const [activities, setActivities] = useState<string[]>([]);

  // Form state for new/edit product
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    category: "",
  });

  // Test run state
  const [testRunning, setTestRunning] = useState(false);
  const [testProgress, setTestProgress] = useState("");

  // Parameter upload state
  const parameterFileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingParameters, setUploadingParameters] = useState(false);

  // Form layout state (saved form controls)
  const [formLayout, setFormLayout] = useState<any[]>([]);

  // 3D Viewer state
  const viewerRef = useRef<HTMLDivElement>(null);
  const viewerInstanceRef = useRef<any>(null);
  const [viewerUrn, setViewerUrn] = useState<string>("");
  const [viewerLoaded, setViewerLoaded] = useState(false);
  const [viewerLoading, setViewerLoading] = useState(false);

  // Ref to track current selected product ID for socket handlers
  const selectedProductIdRef = useRef<string | null>(null);

  // Status dropdown state
  const [showStatusDropdown, setShowStatusDropdown] = useState(false);

  // Inline edit state for product name/description
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editDirty, setEditDirty] = useState(false);
  const [configuratorLinkCopied, setConfiguratorLinkCopied] = useState(false);
  // ============================================================================
  // DATA FETCHING
  // ============================================================================

  const apiFetch = async (url: string, options: RequestInit = {}) => {
    const token =
      typeof window !== "undefined" ? localStorage.getItem("token") : null;
    const headers: Record<string, string> = {
      ...((options.headers as Record<string, string>) || {}),
    };
    if (token) {
      headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(url, { ...options, headers });
  };

  const fetchProducts = useCallback(async () => {
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await apiFetch("/api/products", { headers });
      if (res.ok) {
        const data = await res.json();
        setProducts(data.products || []);
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBuckets = useCallback(async () => {
    try {
      const res = await apiFetch("/api/oss/buckets");
      if (res.ok) {
        const data = await res.json();
        setBuckets(data || []);
      }
    } catch (error) {
      console.error("Failed to fetch buckets:", error);
    }
  }, []);

  const fetchBucketObjects = useCallback(async (bucketKey: string) => {
    setLoadingObjects(true);
    try {
      const res = await apiFetch(`/api/oss/buckets/${bucketKey}/objects`);
      if (res.ok) {
        const data = await res.json();
        // Server returns array directly, not wrapped in { items: [] }
        setBucketObjects(Array.isArray(data) ? data : data.items || []);
      }
    } catch (error) {
      console.error("Failed to fetch objects:", error);
    } finally {
      setLoadingObjects(false);
    }
  }, []);

  const fetchActivities = useCallback(async () => {
    try {
      const res = await apiFetch("/api/aps/activities");
      if (res.ok) {
        const data = await res.json();
        // Filter out extract param activities
        const filtered = (data || []).filter(
          (a: string) => !a.toLowerCase().includes("extractparam"),
        );
        setActivities(filtered);
      }
    } catch (error) {
      console.error("Failed to fetch activities:", error);
    }
  }, []);

  const fetchCategories = useCallback(async () => {
    try {
      const res = await apiFetch("/api/categories");
      if (res.ok) {
        const data = await res.json();
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error("Failed to fetch categories:", error);
    }
  }, []);

  // Automation progress tracking
  const [automationProgress, setAutomationProgress] = useState(0);
  const [automationStage, setAutomationStage] = useState("");

  // Keep the ref updated with current selected product ID
  useEffect(() => {
    selectedProductIdRef.current = selectedProduct?.id || null;
  }, [selectedProduct?.id]);

  useEffect(() => {
    fetchProducts();
    fetchBuckets();
    fetchActivities();
    fetchCategories();

    // Socket.IO for real-time updates - connect explicitly like AutomationDashboard
    socketRef.current = io(window.location.origin, {
      transports: ["websocket", "polling"],
    });

    socketRef.current.on("connect", () => {
      console.log("Socket connected:", socketRef.current?.id);
    });

    socketRef.current.on("disconnect", () => {
      console.log("Socket disconnected");
    });

    // WorkItem status updates from onComplete
    socketRef.current.on("onComplete", (data: any) => {
      if (typeof data === "object" && data.status) {
        if (data.status === "inprogress") {
          setAutomationStage("Processing...");
          setAutomationProgress(50);
        } else if (data.status === "pending") {
          setAutomationStage("Queued...");
          setAutomationProgress(20);
        }
      }
    });

    // Handle workitem completion with output URN for viewer
    socketRef.current.on("workitemComplete", async (data: any) => {
      console.log("workitemComplete received:", data);
      toast.success("Model Ready", "Your updated model is ready for viewing");
      setTestRunning(false);
      setTestProgress("");
      setAutomationProgress(100);
      setAutomationStage("Complete!");
      if (data.urn) {
        setViewerUrn(data.urn);

        // Persist the URN to the product so it loads on refresh
        const productId = selectedProductIdRef.current;
        if (productId) {
          try {
            const lastRun = new Date().toISOString();
            await apiFetch(`/api/products/${productId}`, {
              method: "PUT",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ lastOutputUrn: data.urn, lastRun }),
            });
            // Update local product state
            setSelectedProduct((prev) =>
              prev ? { ...prev, lastOutputUrn: data.urn, lastRun } : null,
            );
            setProducts((prev) =>
              prev.map((p) =>
                p.id === productId
                  ? { ...p, lastOutputUrn: data.urn, lastRun }
                  : p,
              ),
            );
          } catch (err) {
            console.error("Failed to persist output URN:", err);
          }
        }

        // Brief delay to show 100% before resetting
        setTimeout(() => {
          setAutomationProgress(0);
          setAutomationStage("");
        }, 500);
      }
    });

    // Handle download result
    socketRef.current.on("downloadResult", (url: string) => {
      console.log("Download available:", url);
    });

    // Handle errors
    socketRef.current.on("onError", (error: any) => {
      console.error("WorkItem error:", error);
      toast.error(
        "Work Item Failed",
        error.message || "The automation job encountered an error",
      );
      setTestRunning(false);
      setTestProgress("");
      setAutomationProgress(0);
      setAutomationStage("");
    });

    socketRef.current?.on("propExtractionComplete", (data: any) => {
      if (data.success && data.properties) {
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selectedProduct?.id ? { ...p, properties: data.properties } : p
          )
        );
        setSelectedProduct((prev) => prev ? { ...prev, properties: data.properties } : prev);
        toast.success("Properties Extracted", "Model properties have been extracted successfully");
      } else {
        toast.error("Extraction Failed", data.error || "Property extraction failed");
      }
    });

        return () => {
      socketRef.current?.disconnect();
    };
  }, [fetchProducts, fetchBuckets, fetchActivities, toast]);

  // ============================================================================
  // AUTODESK VIEWER
  // ============================================================================

  // Load Autodesk Viewer script once
  useEffect(() => {
    if (typeof window !== "undefined" && !(window as any).Autodesk) {
      // Load viewer CSS
      const link = document.createElement("link");
      link.rel = "stylesheet";
      link.href =
        "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/style.min.css";
      document.head.appendChild(link);

      // Load viewer script
      const script = document.createElement("script");
      script.src =
        "https://developer.api.autodesk.com/modelderivative/v2/viewers/7.*/viewer3D.min.js";
      script.async = true;
      script.onload = () => {
        setViewerLoaded(true);
        console.log("Autodesk Viewer loaded");
      };
      script.onerror = () => {
        console.error("Failed to load Autodesk Viewer");
      };
      document.head.appendChild(script);
    } else if ((window as any).Autodesk) {
      setViewerLoaded(true);
    }
  }, []);

  // Load persisted viewer URN when selecting a product
  useEffect(() => {
    if (selectedProduct?.lastOutputUrn) {
      setViewerUrn(selectedProduct.lastOutputUrn);
    } else {
      setViewerUrn("");
    }
  }, [selectedProduct?.id, selectedProduct?.lastOutputUrn]);

  // Initialize preview viewer when modal opens
  useEffect(() => {
    if (
      previewProduct?.lastOutputUrn &&
      previewViewerRef.current &&
      viewerLoaded
    ) {
      initializePreviewViewer(previewProduct.lastOutputUrn);
    }

    return () => {
      if (previewViewerInstanceRef.current) {
        previewViewerInstanceRef.current.finish();
        previewViewerInstanceRef.current = null;
      }
    };
  }, [previewProduct?.id, previewProduct?.lastOutputUrn, viewerLoaded]);

  // Initialize viewer when URN changes (for preview modal only)
  useEffect(() => {
    // Viewer initialization moved to ConfiguratorView
    // This effect is kept for cleanup purposes
    return () => {
      if (viewerInstanceRef.current) {
        viewerInstanceRef.current.finish();
        viewerInstanceRef.current = null;
      }
    };
  }, [viewerUrn, viewerLoaded]);

  // Extract model properties via APS Model Derivative API (Quick Props)
  // or APS Design Automation (DA Props)
  const extractProperties = async (useSimple: boolean = false) => {
    if (!selectedProduct?.sourceFile) {
      toast.error("No Source File", "Please link a source file to this product first.");
      return;
    }
    const { bucketKey, objectKey } = selectedProduct.sourceFile;
    setTestRunning(true);
    setTestProgress("Starting property extraction...");
    try {
      const endpoint = useSimple ? "/api/extract-properties-simple" : "/api/extract-properties";
      const response = await apiFetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ossBucket: bucketKey,
          ossObjectKey: objectKey,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setTestProgress(`Error: ${data.diagnostic || data.message || "Failed"}`);
        toast.error("Extraction Failed", data.diagnostic || data.message || "Failed to extract properties");
      } else if (data.success && data.properties) {
        setTestProgress("Properties extracted! Saving...");
        // Update local state immediately
        const updatedProduct = { ...selectedProduct, properties: data.properties };
        setSelectedProduct(updatedProduct as any);
        setProducts((prev) =>
          prev.map((p) => p.id === selectedProduct.id ? { ...p, properties: data.properties } : p)
        );
        // Persist to server
        try {
          const saveRes = await apiFetch(`/api/products/${selectedProduct.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ properties: data.properties }),
          });
          if (saveRes.ok) {
            setTestProgress("Properties extracted and saved!");
            toast.success("Properties Extracted", `Extracted from ${data.source || "model"}`);
          } else {
            setTestProgress("Extracted but failed to save to server.");
          }
        } catch (saveErr) {
          setTestProgress("Extracted but failed to save.");
        }
      } else if (data.success === false) {
        setTestProgress(data.message || (data.hint ? `${data.message}\n${data.hint}` : "No properties found"));
        toast.error("No Properties Found", data.message || "Could not extract properties");
      } else {
        setTestProgress(data.message || "Extraction started via Design Automation...");
      }
    } catch (ex: any) {
      setTestProgress(`Error: ${ex.message}`);
      toast.error("Extraction Error", ex.message);
    } finally {
      setTestRunning(false);
    }
  };

    const initializeViewer = async (urn: string) => {
    if (!(window as any).Autodesk) {
      toast.error("Viewer Error", "Viewer not loaded yet");
      return;
    }

    // Cleanup previous viewer instance
    if (viewerInstanceRef.current) {
      viewerInstanceRef.current.finish();
      viewerInstanceRef.current = null;
    }

    setViewerLoading(true);

    try {
      // Get token first
      const tokenRes = await apiFetch("/api/auth/token");
      const tokenData = await tokenRes.json();

      // Poll translation status before loading
      const pollTranslationStatus = (): Promise<boolean> => {
        return new Promise((resolve) => {
          const checkStatus = async () => {
            try {
              const manifestRes = await apiFetch(`/api/translation/${urn}`);
              if (manifestRes.ok) {
                const manifest = await manifestRes.json();

                if (manifest.status === "success") {
                  resolve(true);
                } else if (manifest.status === "failed") {
                  toast.error("Translation Failed", "Model translation failed");
                  resolve(false);
                } else if (
                  manifest.status === "inprogress" ||
                  manifest.status === "pending"
                ) {
                  const progress = manifest.progress || "starting...";
                  setTestProgress(`Translating (${progress})...`);
                  setTimeout(checkStatus, 3000);
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

      const translationReady = await pollTranslationStatus();
      if (!translationReady) {
        setViewerLoading(false);
        return;
      }

      setTestProgress("");

      const options = {
        env: "AutodeskProduction",
        api: "derivativeV2",
        getAccessToken: (
          callback: (token: string, expires: number) => void,
        ) => {
          callback(tokenData.access_token, tokenData.expires_in);
        },
      };

      const Autodesk = (window as any).Autodesk;

      Autodesk.Viewing.Initializer(options, () => {
        const viewer = new Autodesk.Viewing.GuiViewer3D(viewerRef.current, {
          extensions: ["Autodesk.ViewCubeUi"],
        });
        viewer.start();
        viewerInstanceRef.current = viewer;

        const documentId = `urn:${urn}`;
        Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            if (viewables) {
              viewer.loadDocumentNode(doc, viewables).then(() => {
                viewer.addEventListener(
                  Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
                  () => {
                    viewer.fitToView();
                    const nav = viewer.navigation;
                    if (nav) {
                      nav.setRequestHomeView(true);
                    }
                  },
                );
                setViewerLoading(false);
              });
            } else {
              toast.warning("No Viewables", "No viewable geometry found");
              setViewerLoading(false);
            }
          },
          (errorCode: number, errorMessage: string) => {
            toast.error("Viewer Error", errorMessage || `Error ${errorCode}`);
            setViewerLoading(false);
          },
        );
      });
    } catch (err) {
      toast.error("Viewer Error", `Viewer init failed: ${err}`);
      setViewerLoading(false);
    }
  };

  // Initialize preview modal viewer
  const initializePreviewViewer = async (urn: string) => {
    if (!(window as any).Autodesk) {
      toast.error("Viewer Error", "Viewer not loaded yet");
      return;
    }

    // Cleanup previous viewer instance
    if (previewViewerInstanceRef.current) {
      previewViewerInstanceRef.current.finish();
      previewViewerInstanceRef.current = null;
    }

    setPreviewViewerLoading(true);

    try {
      const tokenRes = await apiFetch("/api/auth/token");
      const tokenData = await tokenRes.json();

      const options = {
        env: "AutodeskProduction",
        api: "derivativeV2",
        getAccessToken: (
          callback: (token: string, expires: number) => void,
        ) => {
          callback(tokenData.access_token, tokenData.expires_in);
        },
      };

      const Autodesk = (window as any).Autodesk;

      Autodesk.Viewing.Initializer(options, () => {
        const viewer = new Autodesk.Viewing.GuiViewer3D(
          previewViewerRef.current,
          {
            extensions: ["Autodesk.ViewCubeUi"],
          },
        );
        viewer.start();
        previewViewerInstanceRef.current = viewer;

        const documentId = `urn:${urn}`;
        Autodesk.Viewing.Document.load(
          documentId,
          (doc: any) => {
            const viewables = doc.getRoot().getDefaultGeometry();
            if (viewables) {
              viewer.loadDocumentNode(doc, viewables).then(() => {
                viewer.addEventListener(
                  Autodesk.Viewing.GEOMETRY_LOADED_EVENT,
                  () => {
                    viewer.fitToView();
                  },
                );
                setPreviewViewerLoading(false);
              });
            } else {
              toast.warning("No Viewables", "No viewable geometry found");
              setPreviewViewerLoading(false);
            }
          },
          (errorCode: number, errorMessage: string) => {
            toast.error("Viewer Error", errorMessage || `Error ${errorCode}`);
            setPreviewViewerLoading(false);
          },
        );
      });
    } catch (err) {
      toast.error("Viewer Error", `Preview viewer init failed: ${err}`);
      setPreviewViewerLoading(false);
    }
  };

  // ============================================================================
  // PRODUCT ACTIONS
  // ============================================================================

  const handleCreateProduct = async () => {
    if (!formData.name.trim()) {
      toast.error("Validation Error", "Product name is required");
      return;
    }

    const toastId = toast.loading("Creating product...");

    try {
      const res = await apiFetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...formData,
          status: "draft",
          parameters: [],
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.updateToast(toastId, {
          type: "success",
          title: "Product created successfully!",
        });
        setProducts((prev) => [...prev, data.product]);
        setFormData({ name: "", description: "", category: "" });
        openProductDetail(data.product);
        addNotification("workspace");
      } else {
        throw new Error("Failed to create product");
      }
    } catch (error) {
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to create product",
      });
    }
  };

  const confirmDeleteProduct = (productId: string, productName: string) => {
    setDeleteConfirm({ open: true, productId, productName });
  };

  const confirmBulkDelete = (ids: Set<string>) => {
    setDeleteConfirm({
      open: true,
      productId: "",
      productName: "",
      bulk: true,
      ids,
    });
  };

  const handleDeleteProduct = async (productId: string) => {
    const toastId = toast.loading("Deleting product...");

    try {
      const res = await apiFetch(`/api/products/${productId}`, {
        method: "DELETE",
      });

      if (res.ok) {
        toast.updateToast(toastId, {
          type: "success",
          title: "Product deleted",
        });
        setProducts((prev) => prev.filter((p) => p.id !== productId));
        if (selectedProduct?.id === productId) {
          setSelectedProduct(null);
        }
      } else {
        throw new Error("Failed to delete");
      }
    } catch (error) {
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to delete product",
      });
    }
  };

  const handleSaveProductInfo = async () => {
    if (!selectedProduct || !editDirty) return;
    const toastId = toast.loading("Saving product info...");
    try {
      const res = await apiFetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editName,
          description: editDescription,
          category: editCategory,
        }),
      });
      if (!res.ok) throw new Error("Failed to save");
      const data = await res.json();
      toast.updateToast(toastId, { type: "success", title: "Product updated" });
      setSelectedProduct(data.product);
      setProducts((prev) =>
        prev.map((p) => (p.id === data.product.id ? data.product : p)),
      );
      setEditDirty(false);
    } catch {
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to update product",
      });
    }
  };

  const handleUpdateProductCategory = async (
    productId: string,
    newCategory: string,
  ) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    const toastId = toast.loading("Updating category...");

    try {
      const res = await apiFetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, category: newCategory }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.updateToast(toastId, {
          type: "success",
          title: "Category updated!",
        });
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? data.product : p)),
        );
        if (selectedProduct?.id === productId) {
          setSelectedProduct(data.product);
        }
        setEditCategoryProductId(null);
        setEditCategoryValue("");
      } else {
        throw new Error("Failed to update category");
      }
    } catch (error) {
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to update category",
      });
    }
  };

  const handleLinkFile = async (
    bucketKey: string,
    objectKey: string,
    fileName: string,
  ) => {
    if (!selectedProduct) return;

    const toastId = toast.loading("Linking file to product...");

    try {
      const res = await apiFetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedProduct,
          sourceFile: { bucketKey, objectKey, fileName },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.updateToast(toastId, {
          type: "success",
          title: "File linked successfully!",
        });
        setSelectedProduct(data.product);
        setProducts((prev) =>
          prev.map((p) => (p.id === data.product.id ? data.product : p)),
        );
        setShowFileSelector(false);
      } else {
        throw new Error("Failed to link file");
      }
    } catch (error) {
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to link file",
      });
    }
  };

  const handleLinkDrawingFile = async (
    bucketKey: string,
    objectKey: string,
    fileName: string,
  ) => {
    if (!selectedProduct) return;

    const toastId = toast.loading("Linking drawing file & translating...");

    try {
      // Build URN for the drawing file
      const objectId = `urn:adsk.objects:os.object:${bucketKey}/${objectKey}`;
      const urn = btoa(objectId)
        .replace(/\+/g, "-")
        .replace(/\//g, "_")
        .replace(/=/g, "");

      // Trigger SVF translation so APS Viewer can display it
      try {
        await apiFetch("/api/workflow/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ bucketKey, objectKey }),
        });
      } catch {
        // Translation may already exist
      }

      // Save drawingFile with URN to product
      const res = await apiFetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedProduct,
          drawingFile: { bucketKey, objectKey, fileName, urn },
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.updateToast(toastId, {
          type: "success",
          title: "Drawing file linked & translation started!",
        });
        setSelectedProduct(data.product);
        setProducts((prev) =>
          prev.map((p) => (p.id === data.product.id ? data.product : p)),
        );
        setShowDrawingFileSelector(false);
      } else {
        throw new Error("Failed to link drawing file");
      }
    } catch (error: any) {
      toast.updateToast(toastId, {
        type: "error",
        title: error.message || "Failed to link drawing file",
      });
    }
  };

  const handleLinkActivity = async (activityId: string) => {
    if (!selectedProduct) return;

    const toastId = toast.loading("Linking activity...");

    try {
      const res = await apiFetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedProduct,
          activityId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        toast.updateToast(toastId, {
          type: "success",
          title: "Activity linked!",
        });
        setSelectedProduct(data.product);
        setProducts((prev) =>
          prev.map((p) => (p.id === data.product.id ? data.product : p)),
        );
        setShowActivitySelector(false);
      } else {
        throw new Error("Failed to link activity");
      }
    } catch (error) {
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to link activity",
      });
    }
  };

  const handleRunTest = async () => {
    if (!selectedProduct?.sourceFile || !selectedProduct?.activityId) {
      toast.warning(
        "Missing Configuration",
        "Please link a file and activity first",
      );
      return;
    }

    setTestRunning(true);
    setTestProgress("Initializing...");
    setAutomationProgress(10);
    setAutomationStage("Starting...");

    const toastId = toast.loading("Starting automation job...");

    try {
      console.log("Submitting workitem with socketId:", socketRef.current?.id);

      const res = await apiFetch(
        "/api/aps/designautomation/workitems/from-oss",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            activityId: selectedProduct.activityId,
            inputFile: {
              bucket: selectedProduct.sourceFile.bucketKey,
              object: selectedProduct.sourceFile.objectKey,
            },
            parameters: {},
            socketId: socketRef.current?.id,
          }),
        },
      );

      if (res.ok) {
        toast.updateToast(toastId, {
          type: "info",
          title: "Work item submitted",
          message: "Waiting for results...",
        });
        setAutomationProgress(30);
        setAutomationStage("Submitted to Design Automation");
      } else {
        throw new Error("Failed to start work item");
      }
    } catch (error) {
      toast.updateToast(toastId, {
        type: "error",
        title: "Failed to start automation",
      });
      setTestRunning(false);
      setTestProgress("");
      setAutomationProgress(0);
      setAutomationStage("");
    }
  };

  const handleStatusChange = async (
    productId: string,
    newStatus: Product["status"],
  ) => {
    const product = products.find((p) => p.id === productId);
    if (!product) return;

    try {
      const res = await apiFetch(`/api/products/${productId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...product, status: newStatus }),
      });

      if (res.ok) {
        const data = await res.json();
        setProducts((prev) =>
          prev.map((p) => (p.id === productId ? data.product : p)),
        );
        if (selectedProduct?.id === productId) {
          setSelectedProduct(data.product);
        }
        toast.success("Status updated", `Product is now ${newStatus}`);
      }
    } catch (error) {
      toast.error("Failed to update status");
    }
  };

  const handleUploadParametersClick = () => {
    parameterFileInputRef.current?.click();
  };

  const handleParameterFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
  ) => {
    const file = e.target.files?.[0];
    if (!file || !selectedProduct) return;

    setUploadingParameters(true);
    const toastId = toast.loading("Processing parameters...");

    try {
      const text = await file.text();
      const isXml =
        file.name.toLowerCase().endsWith(".xml") || text.trim().startsWith("<");

      let parameters: Parameter[];

      if (isXml) {
        // Parse XML
        parameters = transformXmlToParameters(text);
      } else {
        // Parse JSON
        const json = JSON.parse(text);
        parameters = transformJsonToParameters(json);
      }

      if (parameters.length === 0) {
        toast.removeToast(toastId);
        toast.error(
          "No Parameters Found",
          `Could not find any valid parameters in the ${isXml ? "XML" : "JSON"} file`,
        );
        return;
      }

      // Save parameters to product
      const res = await apiFetch(`/api/products/${selectedProduct.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...selectedProduct,
          parameters,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSelectedProduct({ ...data.product, parameters });
        setProducts((prev) =>
          prev.map((p) =>
            p.id === selectedProduct.id ? { ...data.product, parameters } : p,
          ),
        );
        toast.removeToast(toastId);
        toast.success(
          "Parameters Uploaded",
          `Imported ${parameters.length} parameters from ${isXml ? "XML" : "JSON"}`,
        );
      } else {
        throw new Error("Failed to save parameters");
      }
    } catch (error: any) {
      toast.removeToast(toastId);
      if (error instanceof SyntaxError) {
        toast.error(
          "Invalid File",
          "The file does not contain valid JSON or XML",
        );
      } else {
        toast.error(
          "Upload Failed",
          error.message || "Failed to process parameters",
        );
      }
    } finally {
      setUploadingParameters(false);
      // Reset file input
      if (parameterFileInputRef.current) {
        parameterFileInputRef.current.value = "";
      }
    }
  };

  // Transform XML to Parameter[]
  const transformXmlToParameters = (xmlText: string): Parameter[] => {
    const parameters: Parameter[] = [];

    try {
      const parser = new DOMParser();
      const xmlDoc = parser.parseFromString(xmlText, "text/xml");

      // Check for parse errors
      const parseError = xmlDoc.querySelector("parsererror");
      if (parseError) {
        console.error("XML parse error:", parseError.textContent);
        return parameters;
      }

      console.log("XML document parsed successfully");
      console.log("Root element:", xmlDoc.documentElement?.tagName);

      // Handle Inventor XML format: <ParamWithValueList> â†’ <parameters> â†’ <ParamWithValue>
      const inventorParams = xmlDoc.querySelectorAll("ParamWithValue");
      if (inventorParams.length > 0) {
        console.log(
          "Detected Inventor XML format, found",
          inventorParams.length,
          "parameters",
        );
        inventorParams.forEach((el) => {
          const param = parseInventorXmlParameter(el);
          if (param) {
            console.log(
              "Parsed Inventor parameter:",
              param.name,
              param.type,
              param.defaultValue,
            );
            parameters.push(param);
          }
        });
        return parameters;
      }

      // Fallback: Find parameter elements - support various XML structures
      const paramElements = xmlDoc.querySelectorAll(
        "parameter, Parameter, param, Param, UserParameter",
      );

      console.log("Found parameter elements:", paramElements.length);

      paramElements.forEach((el, index) => {
        console.log(
          `Processing element ${index}:`,
          el.tagName,
          "children:",
          Array.from(el.children).map((c) => c.tagName),
        );
        const param = parseXmlParameterElement(el);
        if (param) {
          console.log(
            "Parsed parameter:",
            param.name,
            param.type,
            param.defaultValue,
          );
          parameters.push(param);
        } else {
          console.log("Failed to parse element", index);
        }
      });

      // If no parameter elements found, try to parse child elements of root as parameters
      if (parameters.length === 0) {
        console.log("No parameters found, trying root children...");
        const root = xmlDoc.documentElement;
        if (root) {
          Array.from(root.children).forEach((el) => {
            // Skip non-parameter elements
            const tagName = el.tagName.toLowerCase();
            if (
              [
                "version",
                "schema_version",
                "metadata",
                "info",
                "parameters",
                "parametertypes",
              ].includes(tagName)
            )
              return;

            const param = parseXmlParameterElement(el);
            if (param) parameters.push(param);
          });
        }
      }

      console.log("Final parameters count:", parameters.length);
    } catch (error) {
      console.error("Failed to parse XML:", error);
    }

    return parameters;
  };

  // Parse Inventor XML format: <ParamWithValue> with <name>, <typeCode>, <value>
  const parseInventorXmlParameter = (el: Element): Parameter | null => {
    const name = getXmlChildText(el, "name");
    if (!name) return null;

    // Skip model/dimension parameters (d0, d1, d2, etc.) - these are auto-generated by Inventor
    // User parameters have meaningful names like "length", "width", "Color"
    if (/^d\d+$/i.test(name)) {
      console.log("Skipping model parameter:", name);
      return null;
    }

    const typeCode = getXmlChildText(el, "typeCode") || "";
    const valueStr = getXmlChildText(el, "value") || "";

    // Determine parameter type based on typeCode
    // typeCode can be: "in", "mm", "deg" (numeric with units), "String", "Boolean"
    let type: Parameter["type"] = "number";
    let defaultValue: string | number | boolean = 0;
    let unit: string | undefined;

    const typeCodeLower = typeCode.toLowerCase();

    if (typeCodeLower === "string") {
      type = "text";
      defaultValue = valueStr;
    } else if (typeCodeLower === "boolean") {
      type = "boolean";
      defaultValue = valueStr.toLowerCase() === "true";
    } else {
      // Numeric type - typeCode is the unit (in, mm, deg, etc.)
      type = "number";
      unit = typeCode || undefined;

      // Parse numeric value from string like "24 in" or "0.5 deg"
      // The value might be a reference to another parameter (like "length" or "thickness")
      const numMatch = valueStr.match(/^([+-]?\d*\.?\d+)/);
      if (numMatch) {
        defaultValue = parseFloat(numMatch[1]);
      } else {
        // Value is a formula or reference - store as 0 but keep the expression
        defaultValue = 0;
      }
    }

    return {
      name,
      displayName: name,
      type,
      defaultValue,
      unit,
    };
  };

  const parseXmlParameterElement = (el: Element): Parameter | null => {
    // Get name from attribute first, then child elements
    const nameFromAttr =
      el.getAttribute("name") ||
      el.getAttribute("key") ||
      el.getAttribute("id");
    const nameFromChild =
      getXmlChildText(el, "name") || getXmlChildText(el, "key");
    const name = nameFromAttr || nameFromChild;

    // Skip if no name found (don't use tagName as fallback - causes issues)
    if (!name) {
      console.log("Skipping element, no name found:", el.tagName);
      return null;
    }

    console.log("Parsing parameter:", name);

    // Get data type
    const dataTypeRaw =
      el.getAttribute("data_type") ||
      el.getAttribute("dataType") ||
      el.getAttribute("type") ||
      getXmlChildText(el, "data_type") ||
      getXmlChildText(el, "dataType") ||
      getXmlChildText(el, "type") ||
      "";
    const dataType = dataTypeRaw.toLowerCase();

    // Get unit
    const unit =
      el.getAttribute("unit") ||
      el.getAttribute("units") ||
      getXmlChildText(el, "unit") ||
      getXmlChildText(el, "units") ||
      undefined;

    // Get default value - prefer default_value, then value, then default_expression
    const defaultValueStr =
      el.getAttribute("default_value") ||
      el.getAttribute("defaultValue") ||
      el.getAttribute("value") ||
      getXmlChildText(el, "default_value") ||
      getXmlChildText(el, "defaultValue") ||
      getXmlChildText(el, "value");
    const defaultExprStr =
      el.getAttribute("default_expression") ||
      el.getAttribute("defaultExpression") ||
      el.getAttribute("expression") ||
      getXmlChildText(el, "default_expression") ||
      getXmlChildText(el, "defaultExpression") ||
      getXmlChildText(el, "expression");

    // Determine type and value
    let type: Parameter["type"] = "text";
    let defaultValue: string | number | boolean = "";

    if (dataType === "boolean" || dataType === "bool") {
      type = "boolean";
      const valStr = (defaultValueStr || defaultExprStr || "").toLowerCase();
      defaultValue = valStr === "true" || valStr === "1";
    } else if (
      dataType === "number" ||
      dataType === "numeric" ||
      dataType === "float" ||
      dataType === "integer"
    ) {
      type = "number";
      // Try to parse number from value or expression
      if (defaultValueStr) {
        defaultValue = parseFloat(defaultValueStr) || 0;
      } else if (defaultExprStr) {
        const match = defaultExprStr.match(/^([+-]?\d*\.?\d+)/);
        defaultValue = match ? parseFloat(match[1]) : 0;
      }
    } else if (dataType === "text" || dataType === "string") {
      type = "text";
      // Strip surrounding quotes from text values (e.g., "Blue" -> Blue)
      let textVal = defaultValueStr || defaultExprStr || "";
      if (
        (textVal.startsWith('"') && textVal.endsWith('"')) ||
        (textVal.startsWith("'") && textVal.endsWith("'"))
      ) {
        textVal = textVal.slice(1, -1);
      }
      defaultValue = textVal;
    } else {
      // Auto-detect type from value
      const testVal = defaultValueStr || defaultExprStr || "";
      if (
        testVal.toLowerCase() === "true" ||
        testVal.toLowerCase() === "false"
      ) {
        type = "boolean";
        defaultValue = testVal.toLowerCase() === "true";
      } else if (!isNaN(parseFloat(testVal))) {
        type = "number";
        const match = testVal.match(/^([+-]?\d*\.?\d+)/);
        defaultValue = match ? parseFloat(match[1]) : 0;
      } else {
        type = "text";
        defaultValue = testVal;
      }
    }

    // Get optional fields
    const displayName =
      el.getAttribute("displayName") ||
      el.getAttribute("display_name") ||
      el.getAttribute("label") ||
      getXmlChildText(el, "displayName") ||
      getXmlChildText(el, "display_name") ||
      getXmlChildText(el, "label") ||
      name;
    const minStr = el.getAttribute("min") || getXmlChildText(el, "min");
    const maxStr = el.getAttribute("max") || getXmlChildText(el, "max");
    const stepStr = el.getAttribute("step") || getXmlChildText(el, "step");
    const group =
      el.getAttribute("group") ||
      el.getAttribute("category") ||
      getXmlChildText(el, "group") ||
      getXmlChildText(el, "category");

    return {
      name,
      displayName,
      type,
      defaultValue,
      unit: unit || undefined,
      min: minStr ? parseFloat(minStr) : undefined,
      max: maxStr ? parseFloat(maxStr) : undefined,
      step: stepStr ? parseFloat(stepStr) : undefined,
      group: group || undefined,
    };
  };

  const getXmlChildText = (el: Element, tagName: string): string | null => {
    // Only look at direct children - iterate and match by tag name
    const children = Array.from(el.children);

    // Try exact match first
    let child = children.find((c) => c.tagName === tagName);
    if (child) {
      return child.textContent?.trim() || null;
    }

    // Try case-insensitive match
    child = children.find(
      (c) => c.tagName.toLowerCase() === tagName.toLowerCase(),
    );
    if (child) {
      return child.textContent?.trim() || null;
    }

    return null;
  };

  // Transform various JSON formats to Parameter[]
  const transformJsonToParameters = (json: any): Parameter[] => {
    const parameters: Parameter[] = [];

    // Handle array of parameters directly
    if (Array.isArray(json)) {
      for (const item of json) {
        const param = parseParameterObject(item);
        if (param) parameters.push(param);
      }
      return parameters;
    }

    // Handle object with parameters array
    if (json.parameters && Array.isArray(json.parameters)) {
      for (const item of json.parameters) {
        const param = parseParameterObject(item);
        if (param) parameters.push(param);
      }
      return parameters;
    }

    // Handle Inventor-style parameter export (object with parameter names as keys)
    if (typeof json === "object") {
      for (const [name, value] of Object.entries(json)) {
        // Skip metadata fields
        if (
          [
            "_version",
            "_source",
            "_timestamp",
            "metadata",
            "schema_version",
            "version",
          ].includes(name)
        )
          continue;

        const param = parseParameterFromKeyValue(name, value);
        if (param) parameters.push(param);
      }
    }

    return parameters;
  };

  const parseParameterObject = (obj: any): Parameter | null => {
    if (!obj || typeof obj !== "object") return null;

    // Must have a name - support multiple field names
    const name = obj.name || obj.key || obj.parameterName || obj.id;
    if (!name) return null;

    // Determine type - support multiple type field names and formats
    let type: Parameter["type"] = "text";
    let defaultValue: any = "";

    // For Inventor exports: prefer default_expression (e.g., "24 in") over default_value (internal units)
    // default_expression is user-friendly, default_value is in base units (e.g., cm)
    const rawExpression = obj.default_expression || obj.expression;
    const rawValue =
      obj.value ?? obj.defaultValue ?? obj.default_value ?? obj.default ?? "";
    const rawType = (obj.type || obj.data_type || "")?.toLowerCase();

    if (
      rawType === "boolean" ||
      rawType === "bool" ||
      typeof rawValue === "boolean"
    ) {
      type = "boolean";
      defaultValue = Boolean(rawValue);
    } else if (
      rawType === "number" ||
      rawType === "numeric" ||
      rawType === "float" ||
      rawType === "integer" ||
      typeof rawValue === "number"
    ) {
      type = "number";
      // Use expression if available (e.g., "24 in" -> extract the number 24)
      if (rawExpression) {
        // Parse number from expression like "24 in" or "0.5 in"
        const match = String(rawExpression).match(/^([+-]?\d*\.?\d+)/);
        defaultValue = match
          ? parseFloat(match[1])
          : typeof rawValue === "number"
            ? rawValue
            : parseFloat(rawValue) || 0;
      } else {
        defaultValue =
          typeof rawValue === "number" ? rawValue : parseFloat(rawValue) || 0;
      }
    } else if (rawType === "select" || obj.options) {
      type = "select";
      defaultValue = rawExpression || String(rawValue);
    } else {
      type = "text";
      defaultValue = rawExpression || String(rawValue);
    }

    // Extract unit from expression if not explicitly provided (e.g., "24 in" -> "in")
    let unit = obj.unit || obj.units;
    if (!unit && rawExpression && type === "number") {
      const unitMatch = String(rawExpression).match(/[\d.]+\s*(.+)$/);
      if (unitMatch) {
        unit = unitMatch[1].trim();
      }
    }

    return {
      name: String(name),
      displayName:
        obj.displayName ||
        obj.display_name ||
        obj.label ||
        obj.display ||
        String(name),
      type,
      defaultValue,
      unit: unit || undefined,
      min: obj.min !== undefined ? Number(obj.min) : undefined,
      max: obj.max !== undefined ? Number(obj.max) : undefined,
      step: obj.step !== undefined ? Number(obj.step) : undefined,
      options: obj.options,
      group: obj.group || obj.category || undefined,
    };
  };

  const parseParameterFromKeyValue = (
    name: string,
    value: any,
  ): Parameter | null => {
    // Handle simple key-value pairs
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      // Value is an object with more details
      return parseParameterObject({ name, ...value });
    }

    // Simple value
    let type: Parameter["type"] = "text";
    let defaultValue: any = "";

    if (typeof value === "boolean") {
      type = "boolean";
      defaultValue = value;
    } else if (typeof value === "number") {
      type = "number";
      defaultValue = value;
    } else {
      type = "text";
      defaultValue = String(value ?? "");
    }

    return {
      name,
      displayName: name,
      type,
      defaultValue,
    };
  };

  // ============================================================================
  // HELPERS
  // ============================================================================

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  };

  const filteredProducts = products.filter(
    (p) =>
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.description?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const statusColors: Record<string, string> = {
    draft: "bg-gray-500/20 text-gray-400 border-gray-500/30",
    testing: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    live: "bg-green-500/20 text-green-400 border-green-500/30",
    published: "bg-green-500/20 text-green-400 border-green-500/30",
  };

  const statusIcons: Record<string, React.ElementType> = {
    draft: Clock,
    testing: TestTube,
    live: Rocket,
    published: Rocket,
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
      </div>
    );
  }

  // Helper function to open product detail
  const openProductDetail = (product: Product) => {
    setSelectedProduct(product);
    setEditName(product.name);
    setEditDescription(product.description || "");
    setEditCategory(product.category || "");
    setEditDirty(false);
    setPageMode("detail");
  };

  // Helper function to go back to browse
  const backToBrowse = () => {
    setPageMode("browse");
    setSelectedProduct(null);
  };

  // ============================================================================
  // BROWSE VIEW - Table view of all products
  // ============================================================================

  // Sort and paginate products
  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aVal: any, bVal: any;
    switch (sortColumn) {
      case "name":
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case "category":
        aVal = a.category?.toLowerCase() || "";
        bVal = b.category?.toLowerCase() || "";
        break;
      case "owner":
        aVal = a.owner?.toLowerCase() || "";
        bVal = b.owner?.toLowerCase() || "";
        break;
      case "updatedAt":
        aVal = new Date(a.updatedAt).getTime();
        bVal = new Date(b.updatedAt).getTime();
        break;
      case "source":
        aVal = a.source || "";
        bVal = b.source || "";
        break;
      case "parameters":
        aVal = a.parameters?.length || 0;
        bVal = b.parameters?.length || 0;
        break;
      case "connectors":
        aVal = a.connectors || 0;
        bVal = b.connectors || 0;
        break;
      default:
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
    }
    if (sortDirection === "asc") return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const paginatedProducts = sortedProducts.slice(
    startIndex,
    startIndex + itemsPerPage,
  );

  // Selection helpers
  const allSelected =
    paginatedProducts.length > 0 &&
    paginatedProducts.every((p) => selectedIds.has(p.id));
  const someSelected = paginatedProducts.some((p) => selectedIds.has(p.id));

  const toggleSelectAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedProducts.map((p) => p.id)));
    }
  };

  const toggleSelect = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelectedIds(newSet);
  };

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get source badge styling based on sync/upload type
  const getSourceBadge = (product: Product) => {
    // Determine source type: OSS (uploaded), onshape (synced), etc.
    const sourceType =
      product.source || (product.sourceFile?.bucketKey ? "oss" : "unknown");
    const styles: Record<string, string> = {
      oss: "bg-cyan-500/20 text-cyan-400 border-cyan-500/50",
      onshape: "bg-blue-500/20 text-blue-400 border-blue-500/50",
      fusion: "bg-purple-500/20 text-purple-400 border-purple-500/50",
      local: "bg-green-500/20 text-green-400 border-green-500/50",
      unknown: "bg-gray-500/20 text-gray-400 border-gray-500/50",
    };
    return {
      label: `.${sourceType}`,
      style: styles[sourceType] || styles.unknown,
    };
  };

  if (pageMode === "create") {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center gap-4 mb-8 pb-4 border-b border-slate-700/50">
          <button
            onClick={backToBrowse}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors text-sm"
          >
            <ChevronRight className="w-4 h-4 rotate-180" />
            Back to Products
          </button>
          <div className="h-5 w-px bg-slate-700" />
          <div className="flex items-center gap-2">
            <Plus className="w-4 h-4 text-orange-400" />
            <span className="text-white font-semibold text-lg">
              New Product
            </span>
          </div>
        </div>

        {/* Create Product Form â€” centered */}
        <div className="flex-1 overflow-y-auto flex justify-center">
          <div className="w-full max-w-xl">
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-2xl border border-slate-700/50 p-8">
              <div className="space-y-6">
                {/* Product Name */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    Product Name
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) =>
                      setFormData((prev) => ({ ...prev, name: e.target.value }))
                    }
                    placeholder="e.g., Configurable Bracket"
                    className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                  />
                </div>

                {/* Description */}
                <div>
                  <label className="block text-sm font-bold text-white mb-2">
                    Description
                  </label>
                  <textarea
                    value={formData.description}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        description: e.target.value,
                      }))
                    }
                    placeholder="Brief description of the product..."
                    rows={4}
                    className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm placeholder-gray-500 focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors resize-none"
                  />
                </div>

                {/* Category */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-sm font-bold text-white">
                      Category
                    </label>
                    <button
                      onClick={() => setShowCategoryModal(true)}
                      className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                      type="button"
                    >
                      <Tag className="w-3 h-3" />
                      Manage Categories
                    </button>
                  </div>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData((prev) => ({
                        ...prev,
                        category: e.target.value,
                      }))
                    }
                    className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-3 text-white text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                    title="Select product category"
                  >
                    <option value="">Select category...</option>
                    {categories.map((cat) => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                  {formData.category &&
                    categories.find((c) => c.id === formData.category)
                      ?.description && (
                      <p className="text-xs text-gray-400 mt-2">
                        {
                          categories.find((c) => c.id === formData.category)
                            ?.description
                        }
                      </p>
                    )}
                </div>
              </div>

              {/* Actions â€” separated with border */}
              <div className="flex items-center justify-end gap-4 pt-6 mt-8 border-t border-slate-700/40">
                <button
                  onClick={backToBrowse}
                  className="px-5 py-2.5 text-gray-400 hover:text-white transition-colors text-sm font-medium"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateProduct}
                  className="flex items-center gap-2 px-6 py-2.5 bg-orange-500 hover:bg-orange-400 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-orange-500/20"
                >
                  <Plus className="w-4 h-4" />
                  Create Product
                </button>
              </div>
            </div>
          </div>
        </div>

        {renderModals()}
      </div>
    );
  }

  if (pageMode === "browse") {
    return (
      <div className="flex flex-col h-[calc(100vh-8rem)]">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            {/* Selection info */}
            <span className="text-sm text-gray-400">
              {selectedIds.size} Items Selected
            </span>

            {/* Selection actions */}
            {selectedIds.size > 0 && (
              <div className="flex items-center gap-2 border-l border-slate-700 pl-4">
                <button
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Tag"
                >
                  <Package className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Settings"
                >
                  <Settings className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                  title="Delete"
                  onClick={() => confirmBulkDelete(new Set(selectedIds))}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Open"
                >
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="Refresh"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
                <button
                  className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded transition-colors"
                  title="More"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Search */}
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-56 pl-8 pr-2.5 py-1.5 bg-slate-800/50 border border-slate-700 rounded-lg text-xs text-white placeholder-gray-400"
              />
            </div>

            {/* Create Button */}
            <button
              onClick={() => {
                setFormData({ name: "", description: "", category: "" });
                setPageMode("create");
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              New Product
            </button>
          </div>
        </div>

        {/* Products Table */}
        <div className="flex-1 overflow-hidden flex flex-col bg-slate-800/30 backdrop-blur-lg rounded-lg border border-slate-700/50">
          {filteredProducts.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full">
              <Package className="w-12 h-12 text-gray-600 mb-3" />
              <h3 className="text-base font-semibold text-white mb-1">
                No products yet
              </h3>
              <p className="text-gray-400 text-xs mb-3">
                Create your first configurable product
              </p>
              <button
                onClick={() => {
                  setFormData({ name: "", description: "", category: "" });
                  setPageMode("create");
                }}
                className="px-3 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-xs font-medium transition-colors"
              >
                Create Product
              </button>
            </div>
          ) : (
            <>
              {/* Table */}
              <div className="flex-1 overflow-auto">
                <table className="w-full min-w-[800px] text-xs">
                  <thead className="bg-slate-800/50 sticky top-0">
                    <tr className="border-b border-slate-700/50">
                      {/* Checkbox */}
                      <th className="w-10 px-3 py-2">
                        <input
                          type="checkbox"
                          checked={allSelected}
                          ref={(el) => {
                            if (el)
                              el.indeterminate = someSelected && !allSelected;
                          }}
                          onChange={toggleSelectAll}
                          className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                          aria-label="Select all products"
                        />
                      </th>

                      {/* Name */}
                      <th className="text-left px-3 py-2">
                        <button
                          onClick={() => handleSort("name")}
                          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Name
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>

                      {/* Status */}
                      <th className="text-left px-3 py-2">
                        <button
                          onClick={() => handleSort("status")}
                          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Status
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>

                      {/* Category */}
                      <th className="text-left px-3 py-2">
                        <button
                          onClick={() => handleSort("category")}
                          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Category
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>

                      {/* Owner */}
                      <th className="text-left px-3 py-2">
                        <button
                          onClick={() => handleSort("owner")}
                          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Owner
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>

                      {/* Last Edited */}
                      <th className="text-left px-3 py-2">
                        <button
                          onClick={() => handleSort("updatedAt")}
                          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Last Edited
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>

                      {/* Source */}
                      <th className="text-left px-3 py-2">
                        <button
                          onClick={() => handleSort("source")}
                          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Source
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>

                      {/* Parameters */}
                      <th className="text-left px-3 py-2">
                        <button
                          onClick={() => handleSort("parameters")}
                          className="flex items-center gap-1 text-xs font-medium text-gray-400 hover:text-white"
                        >
                          Parameters
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                      </th>

                      {/* Actions */}
                      <th className="w-24 px-3 py-2"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedProducts.map((product) => {
                      const sourceBadge = getSourceBadge(product);
                      const isSelected = selectedIds.has(product.id);
                      const ownerName = product.owner || "Admin";

                      return (
                        <tr
                          key={product.id}
                          onClick={() => openProductDetail(product)}
                          className={`border-b border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors ${isSelected ? "bg-orange-500/10" : ""}`}
                        >
                          {/* Checkbox */}
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={(e) =>
                                toggleSelect(product.id, e as any)
                              }
                              onClick={(e) => e.stopPropagation()}
                              className="w-3.5 h-3.5 rounded border-slate-600 bg-slate-700 text-orange-500 focus:ring-orange-500"
                              aria-label={`Select ${product.name}`}
                            />
                          </td>

                          {/* Name */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs text-white font-medium">
                                {product.name}
                              </span>
                              {product.lastOutputUrn && (
                                <span
                                  className="flex items-center gap-1 px-1 py-0.5 bg-green-500/20 text-green-400 rounded text-[10px]"
                                  title="Automation run - 3D preview available"
                                >
                                  <Zap className="w-2.5 h-2.5" />
                                </span>
                              )}
                            </div>
                          </td>

                          {/* Status */}
                          <td
                            className="px-3 py-2"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <div className="relative">
                              <button
                                onClick={() =>
                                  setStatusDropdownProductId(
                                    statusDropdownProductId === product.id
                                      ? null
                                      : product.id,
                                  )
                                }
                                className="cursor-pointer"
                              >
                                {product.status === "draft" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-600/50 text-slate-300 rounded text-xs font-medium hover:bg-slate-500/50 transition-colors">
                                    <Edit className="w-3 h-3" />
                                    Draft
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                  </span>
                                )}
                                {product.status === "testing" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium hover:bg-yellow-500/30 transition-colors">
                                    <TestTube className="w-3 h-3" />
                                    Testing
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                  </span>
                                )}
                                {product.status === "live" && (
                                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium hover:bg-green-500/30 transition-colors">
                                    <Rocket className="w-3 h-3" />
                                    Live
                                    <ChevronDown className="w-3 h-3 ml-0.5" />
                                  </span>
                                )}
                              </button>

                              {/* Status Dropdown */}
                              {statusDropdownProductId === product.id && (
                                <div className="absolute left-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-[120px] overflow-hidden">
                                  <button
                                    onClick={() => {
                                      handleStatusChange(product.id, "draft");
                                      setStatusDropdownProductId(null);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-700/50 transition-colors ${product.status === "draft" ? "bg-slate-700/50" : ""}`}
                                  >
                                    <Edit className="w-3 h-3 text-slate-400" />
                                    <span className="text-slate-300">
                                      Draft
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleStatusChange(product.id, "testing");
                                      setStatusDropdownProductId(null);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-700/50 transition-colors ${product.status === "testing" ? "bg-slate-700/50" : ""}`}
                                  >
                                    <TestTube className="w-3 h-3 text-yellow-400" />
                                    <span className="text-yellow-400">
                                      Testing
                                    </span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      handleStatusChange(product.id, "live");
                                      setStatusDropdownProductId(null);
                                    }}
                                    className={`w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-slate-700/50 transition-colors ${product.status === "live" ? "bg-slate-700/50" : ""}`}
                                  >
                                    <Rocket className="w-3 h-3 text-green-400" />
                                    <span className="text-green-400">Live</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          </td>

                          {/* Category */}
                          <td className="px-3 py-2">
                            <span className="text-xs text-gray-400">
                              {categories.find((c) => c.id === product.category)
                                ?.name ||
                                product.category ||
                                "-"}
                            </span>
                          </td>

                          {/* Owner */}
                          <td className="px-3 py-2">
                            <div className="flex items-center gap-1.5">
                              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-orange-500 to-amber-600 flex items-center justify-center text-white text-[10px] font-medium">
                                {ownerName[0].toUpperCase()}
                              </div>
                              <span className="text-xs text-gray-300 truncate max-w-[120px]">
                                {ownerName}
                              </span>
                            </div>
                          </td>

                          {/* Last Edited */}
                          <td className="px-3 py-2">
                            <span className="text-xs text-gray-400">
                              {product.updatedAt &&
                              !isNaN(new Date(product.updatedAt).getTime())
                                ? new Date(
                                    product.updatedAt,
                                  ).toLocaleDateString("en-US", {
                                    month: "2-digit",
                                    day: "2-digit",
                                    year: "2-digit",
                                  })
                                : "-"}
                            </span>
                          </td>

                          {/* Source */}
                          <td className="px-3 py-2">
                            {product.sourceFile || product.source ? (
                              <span
                                className={`inline-flex px-1.5 py-0.5 rounded text-[10px] font-medium border ${sourceBadge.style}`}
                              >
                                {sourceBadge.label}
                              </span>
                            ) : (
                              <span className="text-xs text-gray-500">-</span>
                            )}
                          </td>

                          {/* Parameters */}
                          <td className="px-3 py-2 text-center">
                            <span className="text-xs text-gray-400">
                              {product.parameters?.length || 0}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-3 py-2">
                            <div
                              className="flex items-center justify-end gap-0.5"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                onClick={() => {
                                  setEditCategoryProductId(product.id);
                                  setEditCategoryValue(product.category || "");
                                }}
                                className="p-1 text-gray-400 hover:text-orange-400 hover:bg-orange-500/20 rounded transition-colors"
                                title="Change Category"
                              >
                                <Tag className="w-3.5 h-3.5" />
                              </button>
                              {product.lastOutputUrn && (
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setPreviewProduct(product);
                                  }}
                                  className="p-1 text-gray-400 hover:text-cyan-400 hover:bg-cyan-500/20 rounded transition-colors"
                                  title="Preview 3D Model"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <a
                                href={appPath(`/configure?id=${product.id}`)}
                                target="_blank"
                                rel="noopener noreferrer"
                                onClick={(e) => e.stopPropagation()}
                                className="p-1 text-gray-400 hover:text-green-400 hover:bg-green-500/20 rounded transition-colors"
                                title="Preview Customer Configurator"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                              </a>
                              <button
                                onClick={() => openProductDetail(product)}
                                className="p-1 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                                title="Edit"
                              >
                                <Edit className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() =>
                                  confirmDeleteProduct(product.id, product.name)
                                }
                                className="p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Pagination Footer */}
              <div className="flex items-center justify-between px-3 py-2 border-t border-slate-700/50 bg-slate-800/30">
                <span className="text-xs text-gray-400">
                  Showing {startIndex + 1} to{" "}
                  {Math.min(startIndex + itemsPerPage, sortedProducts.length)}{" "}
                  of {sortedProducts.length} entries
                </span>

                <div className="flex items-center gap-2">
                  {/* First page */}
                  <button
                    onClick={() => setCurrentPage(1)}
                    disabled={currentPage === 1}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="First page"
                  >
                    <ChevronsLeft className="w-4 h-4" />
                  </button>

                  {/* Previous page */}
                  <button
                    onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                    disabled={currentPage === 1}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Previous page"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </button>

                  {/* Page indicator */}
                  <span className="px-3 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white min-w-[40px] text-center">
                    {currentPage}
                  </span>

                  {/* Next page */}
                  <button
                    onClick={() =>
                      setCurrentPage((p) => Math.min(totalPages, p + 1))
                    }
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Next page"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </button>

                  {/* Last page */}
                  <button
                    onClick={() => setCurrentPage(totalPages)}
                    disabled={currentPage === totalPages || totalPages === 0}
                    className="p-1.5 text-gray-400 hover:text-white hover:bg-slate-700 rounded disabled:opacity-50 disabled:cursor-not-allowed"
                    title="Last page"
                  >
                    <ChevronsRight className="w-4 h-4" />
                  </button>

                  {/* Items per page */}
                  <select
                    value={itemsPerPage}
                    onChange={(e) => {
                      setItemsPerPage(Number(e.target.value));
                      setCurrentPage(1);
                    }}
                    className="ml-2 px-2 py-1 bg-slate-700 border border-slate-600 rounded text-sm text-white"
                    aria-label="Items per page"
                  >
                    <option value={10}>10</option>
                    <option value={25}>25</option>
                    <option value={50}>50</option>
                    <option value={100}>100</option>
                  </select>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modals */}
        {renderModals()}
      </div>
    );
  }

  // ============================================================================
  // DETAIL VIEW - Full page product editor
  // ============================================================================
  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header with back button */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <button
            onClick={backToBrowse}
            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
          >
            <ChevronRight className="w-5 h-5 rotate-180" />
            Back to Products
          </button>

          {/* Product Name */}
          {selectedProduct && (
            <div className="flex items-center gap-2 ml-4">
              <FileCode className="w-4 h-4 text-orange-400" />
              <span className="bg-slate-800/50 border border-slate-700/50 rounded-lg px-3 py-1 text-white font-medium text-sm truncate max-w-[200px]">
                {selectedProduct.name}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          {selectedProduct && (
            <a
              href={appPath(`/configure?id=${selectedProduct.id}`)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1.5 px-3 py-1.5 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 hover:text-green-300 text-sm rounded-lg transition-colors"
              title="Preview Customer Configurator"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              Preview
            </a>
          )}
          <div className="relative">
            <button
              onClick={() => setShowStatusDropdown(!showStatusDropdown)}
              className="flex items-center gap-2 bg-slate-700/50 border border-slate-600 rounded-lg px-3 py-1.5 text-sm text-white hover:bg-slate-600/50 transition-colors"
              title="Change product status"
            >
              {selectedProduct?.status === "draft" && (
                <Edit className="w-4 h-4 text-gray-400" />
              )}
              {selectedProduct?.status === "testing" && (
                <TestTube className="w-4 h-4 text-yellow-400" />
              )}
              {selectedProduct?.status === "live" && (
                <Rocket className="w-4 h-4 text-green-400" />
              )}
              <span className="capitalize">
                {selectedProduct?.status || "draft"}
              </span>
              <ChevronDown className="w-4 h-4 text-gray-400" />
            </button>
            {showStatusDropdown && (
              <div className="absolute right-0 top-full mt-1 bg-slate-800 border border-slate-700 rounded-lg shadow-xl z-50 min-w-[140px] overflow-hidden">
                <button
                  onClick={() => {
                    selectedProduct &&
                      handleStatusChange(selectedProduct.id, "draft");
                    setShowStatusDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700/50 transition-colors ${selectedProduct?.status === "draft" ? "bg-slate-700/50" : ""}`}
                >
                  <Edit className="w-4 h-4 text-gray-400" />
                  Draft
                </button>
                <button
                  onClick={() => {
                    selectedProduct &&
                      handleStatusChange(selectedProduct.id, "testing");
                    setShowStatusDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700/50 transition-colors ${selectedProduct?.status === "testing" ? "bg-slate-700/50" : ""}`}
                >
                  <TestTube className="w-4 h-4 text-yellow-400" />
                  Testing
                </button>
                <button
                  onClick={() => {
                    selectedProduct &&
                      handleStatusChange(selectedProduct.id, "live");
                    setShowStatusDropdown(false);
                  }}
                  className={`w-full flex items-center gap-2 px-3 py-2 text-sm text-left hover:bg-slate-700/50 transition-colors ${selectedProduct?.status === "live" ? "bg-slate-700/50" : ""}`}
                >
                  <Rocket className="w-4 h-4 text-green-400" />
                  Live
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Product Detail Content */}
      {selectedProduct && (
        <div className="flex-1 overflow-y-auto">
          {/* Sticky unsaved changes banner */}
          {editDirty && (
            <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-2 bg-orange-500/10 border-b border-orange-500/30 backdrop-blur-sm">
              <span className="text-sm text-orange-300 font-medium">You have unsaved changes</span>
              <button
                onClick={handleSaveProductInfo}
                className="flex items-center gap-1.5 px-3 py-1 bg-orange-500 hover:bg-orange-400 text-white text-sm font-medium rounded-lg transition-colors"
              >
                <Save className="w-3.5 h-3.5" />
                Save
              </button>
            </div>
          )}
          {/* Product Info Card */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6 mb-6">
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Product Name
                </label>
                <input
                  value={editName}
                  onChange={(e) => {
                    setEditName(e.target.value);
                    setEditDirty(true);
                  }}
                  className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder-gray-500"
                  placeholder="e.g., Configurable Bracket"
                />
              </div>
              <div>
                <label className="block text-sm font-bold text-white mb-2">
                  Description
                </label>
                <textarea
                  value={editDescription}
                  onChange={(e) => {
                    setEditDescription(e.target.value);
                    setEditDirty(true);
                  }}
                  rows={3}
                  className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors placeholder-gray-500 resize-none"
                  placeholder="Brief description of the product..."
                />
              </div>
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-bold text-white">
                    Category
                  </label>
                  <button
                    onClick={() => setShowCategoryModal(true)}
                    className="text-xs text-orange-400 hover:text-orange-300 flex items-center gap-1"
                    type="button"
                  >
                    <Tag className="w-3 h-3" />
                    Manage Categories
                  </button>
                </div>
                <select
                  value={editCategory}
                  onChange={(e) => {
                    setEditCategory(e.target.value);
                    setEditDirty(true);
                  }}
                  className="w-full bg-slate-900/60 border border-slate-600 rounded-lg px-4 py-2.5 text-white text-sm focus:border-orange-500 focus:outline-none focus:ring-1 focus:ring-orange-500/30 transition-colors"
                  title="Select product category"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
                {editCategory &&
                  categories.find((c) => c.id === editCategory)
                    ?.description && (
                    <p className="text-xs text-gray-400 mt-1.5">
                      {
                        categories.find((c) => c.id === editCategory)
                          ?.description
                      }
                    </p>
                  )}
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleSaveProductInfo}
                  disabled={!editDirty}
                  className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                    editDirty
                      ? "bg-orange-500 hover:bg-orange-400 text-white"
                      : "bg-slate-700 text-gray-500 cursor-not-allowed"
                  }`}
                >
                  <Save className="w-4 h-4" />
                  Save Changes
                </button>
              </div>
            </div>
          </div>

          {/* Configuration Cards */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            {/* Source File Card */}
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <HardDrive className="w-5 h-5 text-cyan-400" />
                  Source File
                </h3>
                <button
                  onClick={() => {
                    setShowFileSelector(true);
                    if (selectedBucket) fetchBucketObjects(selectedBucket);
                  }}
                  className="text-sm text-orange-400 hover:text-orange-300"
                >
                  {selectedProduct.sourceFile ? "Change" : "Link File"}
                </button>
              </div>

              {selectedProduct.sourceFile ? (
                <div className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg">
                  <File className="w-10 h-10 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {selectedProduct.sourceFile.fileName ||
                        selectedProduct.sourceFile.objectKey}
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedProduct.sourceFile.bucketKey}
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-slate-600 rounded-lg">
                  <Upload className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">No file linked</p>
                  <button
                    onClick={() => setShowFileSelector(true)}
                    className="mt-2 text-sm text-orange-400 hover:text-orange-300"
                  >
                    Browse OSS
                  </button>
                </div>
              )}
            </div>

            {/* Drawing File Card */}
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <FileCode className="w-5 h-5 text-blue-400" />
                  Drawing File (2D)
                </h3>
                <button
                  onClick={() => {
                    setShowDrawingFileSelector(true);
                    if (selectedBucket) fetchBucketObjects(selectedBucket);
                  }}
                  className="text-sm text-orange-400 hover:text-orange-300"
                >
                  {selectedProduct.drawingFile ? "Change" : "Link Drawing"}
                </button>
              </div>

              {selectedProduct.drawingFile ? (
                <div className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg">
                  <FileCode className="w-10 h-10 text-blue-400" />
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {selectedProduct.drawingFile.fileName ||
                        selectedProduct.drawingFile.objectKey}
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedProduct.drawingFile.bucketKey}
                    </p>
                    {selectedProduct.drawingFile.urn && (
                      <p className="text-xs text-green-400 mt-0.5">
                        Translated for 2D viewer
                      </p>
                    )}
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-slate-600 rounded-lg">
                  <FileCode className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">No drawing file linked</p>
                  <button
                    onClick={() => setShowDrawingFileSelector(true)}
                    className="mt-2 text-sm text-orange-400 hover:text-orange-300"
                  >
                    Browse OSS
                  </button>
                </div>
              )}
            </div>

            {/* Activity Card */}
            <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-white flex items-center gap-2">
                  <Zap className="w-5 h-5 text-yellow-400" />
                  Automation Activity
                </h3>
                <button
                  onClick={() => setShowActivitySelector(true)}
                  className="text-sm text-orange-400 hover:text-orange-300"
                >
                  {selectedProduct.activityId ? "Change" : "Link Activity"}
                </button>
              </div>

              {selectedProduct.activityId ? (
                <div className="flex items-center gap-3 p-4 bg-slate-700/30 rounded-lg">
                  <div className="w-10 h-10 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                    <Zap className="w-5 h-5 text-yellow-400" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-white truncate">
                      {selectedProduct.activityId}
                    </p>
                    <p className="text-xs text-gray-400">
                      Design Automation Activity
                    </p>
                  </div>
                  <CheckCircle className="w-5 h-5 text-green-400" />
                </div>
              ) : (
                <div className="text-center py-8 border-2 border-dashed border-slate-600 rounded-lg">
                  <Zap className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                  <p className="text-gray-400">No activity linked</p>
                  <button
                    onClick={() => setShowActivitySelector(true)}
                    className="mt-2 text-sm text-orange-400 hover:text-orange-300"
                  >
                    Select Activity
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Parameters Section */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-white flex items-center gap-2">
                <Settings className="w-5 h-5 text-purple-400" />
                Parameters ({selectedProduct.parameters?.length || 0})
              </h3>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  ref={parameterFileInputRef}
                  accept=".json,.xml"
                  onChange={handleParameterFileUpload}
                  className="hidden"
                  title="Upload parameter file"
                />
                <button
                  onClick={handleUploadParametersClick}
                  disabled={uploadingParameters}
                  className="flex items-center gap-2 text-sm text-orange-400 hover:text-orange-300 disabled:opacity-50"
                >
                  {uploadingParameters ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  Upload File
                </button>
                {/* Extract Properties Buttons */}
                <button
                  onClick={() => extractProperties && extractProperties(true)}
                  className="flex items-center gap-2 text-sm text-cyan-400 hover:text-cyan-300"
                  title="Quick property extraction"
                >
                  <Zap className="w-4 h-4" />
                  Quick Props
                </button>
                <button
                  onClick={() => extractProperties && extractProperties(false)}
                  className="flex items-center gap-2 text-sm text-teal-400 hover:text-teal-300"
                  title="Extract via Design Automation"
                >
                  <Database className="w-4 h-4" />
                  DA Props
                </button>
              </div>
            </div>

            {selectedProduct.parameters &&
            selectedProduct.parameters.length > 0 ? (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {selectedProduct.parameters.map((param, index) => (
                  <div key={index} className="bg-slate-700/30 rounded-lg p-4">
                    <p className="font-medium text-white">
                      {param.displayName || param.name}
                    </p>
                    <p className="text-xs text-gray-400 mb-2">
                      {param.type}
                      {param.unit ? ` (${param.unit})` : ""}
                    </p>
                    <p
                      className={`text-sm ${
                        param.type === "number"
                          ? "text-cyan-400"
                          : param.type === "boolean"
                            ? "text-yellow-400"
                            : "text-green-400"
                      }`}
                    >
                      {param.type === "boolean"
                        ? param.defaultValue
                          ? "true"
                          : "false"
                        : param.type === "text"
                          ? `"${param.defaultValue}"`
                          : param.defaultValue}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 border-2 border-dashed border-slate-600 rounded-lg">
                <Settings className="w-12 h-12 text-gray-500 mx-auto mb-3" />
                <p className="text-gray-400 mb-2">No parameters defined</p>
                <p className="text-sm text-gray-500 mb-4">
                  Upload a JSON or XML file with parameter definitions
                </p>
                <button
                  onClick={handleUploadParametersClick}
                  className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors"
                >
                  Upload Parameters File
                </button>
              </div>
            )}

            {/* Extracted Properties Display */}
            {(selectedProduct as any).properties &&
              Object.keys((selectedProduct as any).properties).length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-700/50">
                  <h4 className="text-sm font-semibold text-teal-400 mb-3 flex items-center gap-2">
                    <Database className="w-4 h-4" />
                    Model Properties
                  </h4>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {(selectedProduct as any).properties.physicalProperties && (
                      <>
                        {(selectedProduct as any).properties.physicalProperties.mass && (
                          <div className="bg-slate-700/30 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Mass</p>
                            <p className="text-sm text-cyan-400 font-mono">
                              {(selectedProduct as any).properties.physicalProperties.mass.value?.toFixed(3)}{" "}
                              <span className="text-xs text-gray-400">{(selectedProduct as any).properties.physicalProperties.mass.unit}</span>
                            </p>
                          </div>
                        )}
                        {(selectedProduct as any).properties.physicalProperties.volume && (
                          <div className="bg-slate-700/30 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Volume</p>
                            <p className="text-sm text-cyan-400 font-mono">
                              {(selectedProduct as any).properties.physicalProperties.volume.value?.toFixed(3)}{" "}
                              <span className="text-xs text-gray-400">{(selectedProduct as any).properties.physicalProperties.volume.unit}</span>
                            </p>
                          </div>
                        )}
                        {(selectedProduct as any).properties.physicalProperties.area && (
                          <div className="bg-slate-700/30 rounded-lg p-3">
                            <p className="text-xs text-gray-500 mb-1">Area</p>
                            <p className="text-sm text-cyan-400 font-mono">
                              {(selectedProduct as any).properties.physicalProperties.area.value?.toFixed(3)}{" "}
                              <span className="text-xs text-gray-400">{(selectedProduct as any).properties.physicalProperties.area.unit}</span>
                            </p>
                          </div>
                        )}
                      </>
                    )}
                    {(selectedProduct as any).properties.iProperties &&
                      Object.entries((selectedProduct as any).properties.iProperties).map(([key, val]) => (
                        <div key={key} className="bg-slate-700/30 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-1">{key}</p>
                          <p className="text-sm text-gray-200">{String(val)}</p>
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>

          {/* Automation Status & Run Button */}
          <div className="space-y-3">
            {/* Status indicator â€” shown when automation has been run before */}
            {!testRunning && selectedProduct.lastOutputUrn && (
              <div className="bg-green-500/10 border border-green-500/30 rounded-xl p-4 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 bg-green-500/20 rounded-lg flex items-center justify-center">
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-green-400">
                      Automation Completed
                    </p>
                    <p className="text-xs text-gray-400">
                      {selectedProduct.lastRun
                        ? `Last run: ${new Date(selectedProduct.lastRun).toLocaleString()}`
                        : "Output model available"}
                    </p>
                  </div>
                </div>
                <span
                  className="text-xs text-gray-500 font-mono truncate max-w-[200px]"
                  title={selectedProduct.lastOutputUrn}
                >
                  {selectedProduct.lastOutputUrn.slice(0, 20)}â€¦
                </span>
              </div>
            )}

            {/* Progress bar â€” shown while running */}
            {testRunning && (
              <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-white">
                    {automationStage || "Processing..."}
                  </span>
                  <span className="text-sm text-orange-400">
                    {automationProgress}%
                  </span>
                </div>
                <div className="w-full bg-slate-700 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-gradient-to-r from-orange-500 to-orange-400 h-2.5 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${automationProgress}%` }}
                  />
                </div>
              </div>
            )}

            <div className="flex justify-end">
              <button
                onClick={handleRunTest}
                disabled={
                  testRunning ||
                  !selectedProduct.sourceFile ||
                  !selectedProduct.activityId
                }
                className="flex items-center gap-2 px-6 py-3 bg-orange-500 hover:bg-orange-600 disabled:bg-slate-600 disabled:cursor-not-allowed text-white rounded-xl font-medium transition-colors"
              >
                {testRunning ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {testProgress || "Running..."}
                  </>
                ) : selectedProduct.lastOutputUrn ? (
                  <>
                    <RefreshCw className="w-5 h-5" />
                    Rerun Automation
                  </>
                ) : (
                  <>
                    <Play className="w-5 h-5" />
                    Run Automation
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Share & Embed Card */}
          <div className="bg-slate-800/50 backdrop-blur-lg rounded-xl border border-slate-700/50 p-6 mb-6">
            <h3 className="font-semibold text-white flex items-center gap-2 mb-4">
              <Share2 className="w-5 h-5 text-green-400" />
              Share & Embed
            </h3>
            <p className="text-sm text-gray-400 mb-3">
              Use this URL to embed the configurator in Shopify, Webflow, or any other site.
            </p>
            <div className="flex items-center gap-2">
              <code className="flex-1 bg-slate-900/60 border border-slate-700 rounded-lg px-3 py-2 text-sm text-green-300 font-mono truncate select-all">
                {typeof window !== "undefined"
                  ? `${window.location.origin}${BASE_PATH}/configure?id=${selectedProduct.id}`
                  : appPath(`/configure?id=${selectedProduct.id}`)}
              </code>
              <button
                onClick={() => {
                  const url = typeof window !== "undefined"
                    ? `${window.location.origin}${BASE_PATH}/configure?id=${selectedProduct.id}`
                    : appPath(`/configure?id=${selectedProduct.id}`);
                  navigator.clipboard.writeText(url).then(() => {
                    setConfiguratorLinkCopied(true);
                    setTimeout(() => setConfiguratorLinkCopied(false), 2000);
                  });
                }}
                className="flex items-center gap-1.5 px-3 py-2 bg-slate-700 hover:bg-slate-600 text-sm text-white rounded-lg transition-colors flex-shrink-0"
                title="Copy configurator URL"
              >
                {configuratorLinkCopied ? (
                  <>
                    <CheckCircle className="w-4 h-4 text-green-400" />
                    Copied!
                  </>
                ) : (
                  <>
                    <Share2 className="w-4 h-4 text-gray-400" />
                    Copy
                  </>
                )}
              </button>
              <a
                href={appPath(`/configure?id=${selectedProduct.id}`)}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 px-3 py-2 bg-green-600/20 hover:bg-green-600/30 border border-green-500/30 text-green-400 hover:text-green-300 text-sm rounded-lg transition-colors flex-shrink-0"
                title="Open configurator in new tab"
              >
                <ExternalLink className="w-4 h-4" />
                Open
              </a>
            </div>
          </div>
        </div>
      )}

      {/* Modals */}
      {renderModals()}
    </div>
  );

  // ============================================================================
  // MODALS RENDER FUNCTION
  // ============================================================================
  function renderModals() {
    return (
      <>
        {/* Preview 3D Model Modal */}
        {previewProduct && previewProduct.lastOutputUrn && (
          <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-4xl h-[80vh] border border-slate-700 flex flex-col">
              <div className="p-4 border-b border-slate-700 flex items-center justify-between flex-shrink-0">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-cyan-500/20 rounded-lg flex items-center justify-center">
                    <Eye className="w-5 h-5 text-cyan-400" />
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">
                      {previewProduct.name}
                    </h3>
                    <p className="text-sm text-gray-400">3D Model Preview</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    // Cleanup viewer when closing
                    if (previewViewerInstanceRef.current) {
                      previewViewerInstanceRef.current.finish();
                      previewViewerInstanceRef.current = null;
                    }
                    setPreviewProduct(null);
                  }}
                  className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                  title="Close preview"
                >
                  <X className="w-5 h-5 text-gray-400" />
                </button>
              </div>

              <div className="flex-1 relative bg-slate-900">
                {previewViewerLoading && (
                  <div className="absolute inset-0 flex items-center justify-center bg-slate-900/80 z-10">
                    <div className="flex flex-col items-center gap-3">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                      <span className="text-gray-400">Loading 3D Model...</span>
                    </div>
                  </div>
                )}
                <div ref={previewViewerRef} className="w-full h-full" />
              </div>
            </div>
          </div>
        )}

        {/* File Selector Modal */}
        {showFileSelector && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">
                    Select Source File
                  </h3>
                  <button
                    onClick={() => setShowFileSelector(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Close modal"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    OSS Bucket
                  </label>
                  <select
                    value={selectedBucket}
                    onChange={(e) => {
                      setSelectedBucket(e.target.value);
                      if (e.target.value) fetchBucketObjects(e.target.value);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    title="Select a bucket"
                  >
                    <option value="">Select a bucket...</option>
                    {buckets.map((b) => (
                      <option key={b.bucketKey} value={b.bucketKey}>
                        {b.bucketKey}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBucket && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-300">Files</p>
                    {loadingObjects ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 text-orange-400 animate-spin mx-auto" />
                      </div>
                    ) : bucketObjects.length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        No files in this bucket
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {bucketObjects
                          .filter(
                            (o) =>
                              o.objectKey.endsWith(".ipt") ||
                              o.objectKey.endsWith(".iam") ||
                              o.objectKey.endsWith(".dwg") ||
                              o.objectKey.endsWith(".rvt"),
                          )
                          .map((obj) => (
                            <button
                              key={obj.objectKey}
                              onClick={() =>
                                handleLinkFile(
                                  selectedBucket,
                                  obj.objectKey,
                                  obj.objectKey,
                                )
                              }
                              className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                            >
                              <File className="w-8 h-8 text-blue-400" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">
                                  {obj.objectKey}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatFileSize(obj.size)}
                                </p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Drawing File Selector Modal */}
        {showDrawingFileSelector && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-2xl border border-slate-700 max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">
                    Select Drawing File (DWG)
                  </h3>
                  <button
                    onClick={() => setShowDrawingFileSelector(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Close modal"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
                <p className="text-sm text-gray-400 mt-1">
                  Select a .dwg file to display in the 2D viewer tab
                </p>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-300 mb-2">
                    OSS Bucket
                  </label>
                  <select
                    value={selectedBucket}
                    onChange={(e) => {
                      setSelectedBucket(e.target.value);
                      if (e.target.value) fetchBucketObjects(e.target.value);
                    }}
                    className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white"
                    title="Select a bucket"
                  >
                    <option value="">Select a bucket...</option>
                    {buckets.map((b) => (
                      <option key={b.bucketKey} value={b.bucketKey}>
                        {b.bucketKey}
                      </option>
                    ))}
                  </select>
                </div>

                {selectedBucket && (
                  <div className="space-y-2">
                    <p className="text-sm font-medium text-gray-300">
                      Drawing Files
                    </p>
                    {loadingObjects ? (
                      <div className="text-center py-8">
                        <Loader2 className="w-6 h-6 text-orange-400 animate-spin mx-auto" />
                      </div>
                    ) : bucketObjects.filter((o) =>
                        o.objectKey.endsWith(".dwg"),
                      ).length === 0 ? (
                      <div className="text-center py-8 text-gray-400">
                        No .dwg files in this bucket
                      </div>
                    ) : (
                      <div className="max-h-64 overflow-y-auto space-y-2">
                        {bucketObjects
                          .filter((o) => o.objectKey.endsWith(".dwg"))
                          .map((obj) => (
                            <button
                              key={obj.objectKey}
                              onClick={() =>
                                handleLinkDrawingFile(
                                  selectedBucket,
                                  obj.objectKey,
                                  obj.objectKey,
                                )
                              }
                              className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                            >
                              <FileCode className="w-8 h-8 text-blue-400" />
                              <div className="flex-1 min-w-0">
                                <p className="font-medium text-white truncate">
                                  {obj.objectKey}
                                </p>
                                <p className="text-xs text-gray-400">
                                  {formatFileSize(obj.size)}
                                </p>
                              </div>
                              <ChevronRight className="w-5 h-5 text-gray-400" />
                            </button>
                          ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Activity Selector Modal */}
        {showActivitySelector && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-md border border-slate-700">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white">
                    Select Activity
                  </h3>
                  <button
                    onClick={() => setShowActivitySelector(false)}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Close modal"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6">
                {activities.length === 0 ? (
                  <div className="text-center py-8">
                    <AlertCircle className="w-10 h-10 text-gray-500 mx-auto mb-2" />
                    <p className="text-gray-400">No activities found</p>
                    <p className="text-xs text-gray-500 mt-1">
                      Create an activity in Design Automation first
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {activities.map((activity) => (
                      <button
                        key={activity}
                        onClick={() => handleLinkActivity(activity)}
                        className="w-full flex items-center gap-3 p-3 bg-slate-700/50 hover:bg-slate-700 rounded-lg transition-colors text-left"
                      >
                        <div className="w-8 h-8 bg-yellow-500/20 rounded-lg flex items-center justify-center">
                          <Zap className="w-5 h-5 text-yellow-400" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-white">{activity}</p>
                        </div>
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Quick Edit Category Modal */}
        {editCategoryProductId && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-xl w-full max-w-sm border border-slate-700 shadow-xl">
              <div className="p-4 border-b border-slate-700">
                <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                  <Tag className="w-5 h-5 text-orange-400" />
                  Change Category
                </h3>
                <p className="text-sm text-gray-400 mt-1">
                  {products.find((p) => p.id === editCategoryProductId)?.name}
                </p>
              </div>
              <div className="p-4">
                <select
                  value={editCategoryValue}
                  onChange={(e) => setEditCategoryValue(e.target.value)}
                  className="w-full px-3 py-2.5 bg-slate-900 border border-slate-600 rounded-lg text-white focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none"
                  title="Select Category"
                >
                  <option value="">No Category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="p-4 border-t border-slate-700 flex gap-3 justify-end">
                <button
                  onClick={() => {
                    setEditCategoryProductId(null);
                    setEditCategoryValue("");
                  }}
                  className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() =>
                    handleUpdateProductCategory(
                      editCategoryProductId,
                      editCategoryValue,
                    )
                  }
                  className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors"
                >
                  Save
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Category Management Modal */}
        {showCategoryModal && (
          <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-slate-800 rounded-2xl w-full max-w-lg border border-slate-700 max-h-[80vh] flex flex-col">
              <div className="p-6 border-b border-slate-700">
                <div className="flex items-center justify-between">
                  <h3 className="text-xl font-bold text-white flex items-center gap-2">
                    <Tag className="w-5 h-5 text-orange-400" />
                    Manage Categories
                  </h3>
                  <button
                    onClick={() => {
                      setShowCategoryModal(false);
                      setEditingCategory(null);
                      setCategoryForm({ name: "", description: "" });
                    }}
                    className="p-2 hover:bg-slate-700 rounded-lg transition-colors"
                    title="Close modal"
                  >
                    <X className="w-5 h-5 text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-6 flex-1 overflow-y-auto">
                {/* Add/Edit Category Form */}
                <div className="bg-slate-700/50 rounded-lg p-4 mb-4">
                  <h4 className="text-sm font-medium text-gray-300 mb-3">
                    {editingCategory ? "Edit Category" : "Add New Category"}
                  </h4>
                  <div className="space-y-3">
                    <input
                      type="text"
                      value={categoryForm.name}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          name: e.target.value,
                        }))
                      }
                      placeholder="Category name"
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 text-sm"
                    />
                    <textarea
                      value={categoryForm.description}
                      onChange={(e) =>
                        setCategoryForm((prev) => ({
                          ...prev,
                          description: e.target.value,
                        }))
                      }
                      placeholder="Description (optional)"
                      rows={2}
                      className="w-full bg-slate-700 border border-slate-600 rounded-lg px-4 py-2 text-white placeholder-gray-400 text-sm resize-none"
                    />
                    <div className="flex gap-2">
                      {editingCategory && (
                        <button
                          onClick={() => {
                            setEditingCategory(null);
                            setCategoryForm({ name: "", description: "" });
                          }}
                          className="px-3 py-1.5 text-gray-400 hover:text-white text-sm"
                        >
                          Cancel
                        </button>
                      )}
                      <button
                        onClick={async () => {
                          if (!categoryForm.name.trim()) {
                            toast.error("Category name is required");
                            return;
                          }
                          try {
                            const url = editingCategory
                              ? `/api/categories/${editingCategory.id}`
                              : "/api/categories";
                            const res = await apiFetch(url, {
                              method: editingCategory ? "PUT" : "POST",
                              headers: { "Content-Type": "application/json" },
                              body: JSON.stringify(categoryForm),
                            });
                            const data = await res.json();
                            if (data.success) {
                              toast.success(
                                editingCategory
                                  ? "Category updated"
                                  : "Category created",
                              );
                              fetchCategories();
                              setCategoryForm({ name: "", description: "" });
                              setEditingCategory(null);
                            } else {
                              toast.error(
                                data.error || "Failed to save category",
                              );
                            }
                          } catch (error) {
                            toast.error("Failed to save category");
                          }
                        }}
                        className="px-4 py-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded-lg text-sm font-medium transition-colors"
                      >
                        {editingCategory ? "Update" : "Add Category"}
                      </button>
                    </div>
                  </div>
                </div>

                {/* Categories List */}
                <div className="space-y-2">
                  <h4 className="text-sm font-medium text-gray-300 mb-2">
                    Existing Categories
                  </h4>
                  {categories.length === 0 ? (
                    <p className="text-gray-500 text-sm text-center py-4">
                      No categories yet
                    </p>
                  ) : (
                    categories.map((cat) => (
                      <div
                        key={cat.id}
                        className="flex items-center gap-3 p-3 bg-slate-700/30 rounded-lg group"
                      >
                        <div className="w-8 h-8 bg-orange-500/20 rounded-lg flex items-center justify-center flex-shrink-0">
                          <Tag className="w-4 h-4 text-orange-400" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-white text-sm">
                            {cat.name}
                          </p>
                          {cat.description && (
                            <p className="text-xs text-gray-400 truncate">
                              {cat.description}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => {
                              setEditingCategory(cat);
                              setCategoryForm({
                                name: cat.name,
                                description: cat.description,
                              });
                            }}
                            className="p-1.5 text-gray-400 hover:text-blue-400 hover:bg-blue-500/20 rounded transition-colors"
                            title="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => setCatDeleteConfirm({ open: true, catId: cat.id, catName: cat.name })}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Delete Confirmation Dialog */}
        <ConfirmDialog
          open={deleteConfirm.open}
          title={
            deleteConfirm.bulk
              ? `Delete ${deleteConfirm.ids?.size || 0} product(s)?`
              : `Delete "${deleteConfirm.productName}"?`
          }
          message={
            deleteConfirm.bulk
              ? "This will permanently delete the selected products. This action cannot be undone."
              : "This will permanently delete this product and all its associated data. This action cannot be undone."
          }
          confirmLabel="Delete"
          onConfirm={() => {
            if (deleteConfirm.bulk && deleteConfirm.ids) {
              deleteConfirm.ids.forEach((id) => handleDeleteProduct(id));
              setSelectedIds(new Set());
            } else if (deleteConfirm.productId) {
              handleDeleteProduct(deleteConfirm.productId);
            }
            setDeleteConfirm({ open: false, productId: "", productName: "" });
          }}
          onCancel={() =>
            setDeleteConfirm({ open: false, productId: "", productName: "" })
          }
        />

        {/* Category Delete Confirmation */}
        <ConfirmDialog
          open={catDeleteConfirm.open}
          title={`Delete "${catDeleteConfirm.catName}"?`}
          message="This will permanently delete this category. Products using it will not be affected."
          confirmLabel="Delete"
          onConfirm={async () => {
            try {
              const res = await apiFetch(`/api/categories/${catDeleteConfirm.catId}`, { method: "DELETE" });
              const data = await res.json();
              if (data.success) { toast.success("Category deleted"); fetchCategories(); }
              else toast.error(data.error || "Failed to delete");
            } catch { toast.error("Failed to delete category"); }
            setCatDeleteConfirm({ open: false, catId: '', catName: '' });
          }}
          onCancel={() => setCatDeleteConfirm({ open: false, catId: '', catName: '' })}
        />
      </>
    );
  }
}

