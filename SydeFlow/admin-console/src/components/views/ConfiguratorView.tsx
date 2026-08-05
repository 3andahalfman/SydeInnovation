"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Loader2,
  Sliders,
  Box,
  Zap,
  Search,
  RefreshCw,
  List,
  LayoutGrid,
  ExternalLink,
  Palette,
  ArrowUpDown,
  Trash2,
  Edit,
  Eye,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import TemplatePickerDialog from "@/components/configurator/TemplatePickerDialog";
import ConfirmDialog from "@/components/ui/ConfirmDialog";
import { CONFIGURATOR_TEMPLATES } from "@/types/product";
import { appPath } from "@/lib/config";

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
  activityId?: string;
  parameters: Parameter[];
  lastOutputUrn?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// CONFIGURATOR VIEW
// ============================================================================

export default function ConfiguratorView() {
  const toast = useToast();

  // State
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");

  // Sorting state
  const [sortColumn, setSortColumn] = useState<string>("name");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");

  // Template picker state
  const [showTemplatePicker, setShowTemplatePicker] = useState(false);
  const [pendingProductId, setPendingProductId] = useState<string | null>(null);
  const [checkingLayout, setCheckingLayout] = useState<string | null>(null);

  // Delete confirmation dialog
  const [deleteConfirm, setDeleteConfirm] = useState<{
    open: boolean;
    productId: string;
    productName: string;
  }>({ open: false, productId: "", productName: "" });

  // ============================================================================
  // DATA LOADING
  // ============================================================================

  const fetchProducts = useCallback(async () => {
    setLoading(true);
    try {
      const token = localStorage.getItem("token");
      const headers: Record<string, string> = {};
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch("/api/products", { headers });
      if (res.ok) {
        const data = await res.json();
        // Only show products that have been configured (have lastOutputUrn)
        const configuredProducts = (data.products || []).filter(
          (p: Product) => p.lastOutputUrn,
        );
        setProducts(configuredProducts);
      } else {
        console.error("Failed to fetch products:", res.status, res.statusText);
        toast.error("Failed to load products");
      }
    } catch (error) {
      console.error("Failed to fetch products:", error);
      toast.error("Failed to load products");
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  // ============================================================================
  // FILTERING & SORTING
  // ============================================================================

  const filteredProducts = products.filter(
    (product) =>
      product.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      product.category?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const sortedProducts = [...filteredProducts].sort((a, b) => {
    let aVal: string | number = "";
    let bVal: string | number = "";
    switch (sortColumn) {
      case "name":
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
        break;
      case "category":
        aVal = (a.category || "").toLowerCase();
        bVal = (b.category || "").toLowerCase();
        break;
      case "status":
        aVal = a.status || "";
        bVal = b.status || "";
        break;
      case "parameters":
        aVal = a.parameters?.length || 0;
        bVal = b.parameters?.length || 0;
        break;
      case "updatedAt":
        aVal = a.updatedAt || "";
        bVal = b.updatedAt || "";
        break;
      default:
        aVal = a.name.toLowerCase();
        bVal = b.name.toLowerCase();
    }
    if (sortDirection === "asc") return aVal > bVal ? 1 : -1;
    return aVal < bVal ? 1 : -1;
  });

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Open configurator - check for existing layout first
  const openConfigurator = async (productId: string) => {
    setCheckingLayout(productId);
    try {
      const res = await fetch(`/api/products/${productId}/layout`);
      if (res.ok) {
        const data = await res.json();
        if (data.layout && !data.isDefault) {
          window.open(appPath(`/configurator?id=${productId}`), "_blank");
          setCheckingLayout(null);
          return;
        }
      }
    } catch {
      // No layout found
    }
    setCheckingLayout(null);
    setPendingProductId(productId);
    setShowTemplatePicker(true);
  };

  // Open configurator with theme picker
  const openThemePicker = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    setPendingProductId(productId);
    setShowTemplatePicker(true);
  };

  // Delete product layout
  const handleDelete = async (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    const product = products.find((p) => p.id === productId);
    setDeleteConfirm({
      open: true,
      productId,
      productName: product?.name || "this layout",
    });
  };

  const executeDelete = async (productId: string) => {
    try {
      const res = await fetch(`/api/products/${productId}/layout`, {
        method: "DELETE",
      });
      if (res.ok) {
        toast.success("Layout deleted");
        fetchProducts();
      } else {
        toast.error("Failed to delete layout");
      }
    } catch {
      toast.error("Failed to delete layout");
    }
  };

  // Handle template selection — open configurator with template param
  const handleTemplateSelect = (templateId: string) => {
    if (pendingProductId) {
      window.open(
        appPath(`/configurator?id=${pendingProductId}&template=${templateId}`),
        "_blank",
      );
    }
    setShowTemplatePicker(false);
    setPendingProductId(null);
  };

  // ============================================================================
  // RENDER
  // ============================================================================

  return (
    <>
      <div className="flex flex-col h-full p-6 gap-4">
        {/* Template Picker Dialog */}
        {showTemplatePicker && (
          <TemplatePickerDialog
            onSelect={handleTemplateSelect}
            onClose={() => {
              setShowTemplatePicker(false);
              setPendingProductId(null);
            }}
          />
        )}

        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold text-white flex items-center gap-2">
              <Palette className="w-6 h-6 text-orange-500" />
              Configurator Builder
            </h1>
            <p className="text-sm text-gray-400 mt-1">
              Select a product to open the configurator builder in a new tab
            </p>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                type="text"
                placeholder="Search products..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder:text-gray-500 focus:outline-none focus:border-orange-500 w-64"
              />
            </div>
            <div className="flex items-center bg-slate-800 rounded-lg p-1">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-2 rounded-md transition-colors ${viewMode === "grid" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"}`}
                title="Grid view"
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-2 rounded-md transition-colors ${viewMode === "list" ? "bg-orange-500 text-white" : "text-gray-400 hover:text-white"}`}
                title="List view"
              >
                <List className="w-4 h-4" />
              </button>
            </div>
            <button
              onClick={fetchProducts}
              className="flex items-center gap-2 px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg transition-colors"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh
            </button>
          </div>
        </div>

        {/* Content */}
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <Loader2 className="w-8 h-8 text-orange-400 animate-spin" />
          </div>
        ) : filteredProducts.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl flex items-center justify-center mb-4">
              <Box className="w-8 h-8 text-gray-500" />
            </div>
            <h3 className="text-lg font-medium text-white mb-2">
              No Configured Products
            </h3>
            <p className="text-gray-400 max-w-sm">
              Products will appear here once they have been set up and run
              through automation at least once.
            </p>
          </div>
        ) : viewMode === "list" ? (
          /* ── LIST VIEW: Table with sortable columns ── */
          <div className="flex-1 overflow-hidden flex flex-col bg-slate-800/30 backdrop-blur-lg rounded-xl border border-slate-700/50">
            <div className="flex-1 overflow-auto">
              <table className="w-full min-w-[700px]">
                <thead className="bg-slate-800/50 sticky top-0 z-10">
                  <tr className="border-b border-slate-700/50">
                    {/* Name */}
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => handleSort("name")}
                        className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-white"
                      >
                        Name
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    {/* Category */}
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => handleSort("category")}
                        className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-white"
                      >
                        Category
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    {/* Status */}
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => handleSort("status")}
                        className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-white"
                      >
                        Status
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    {/* Parameters */}
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => handleSort("parameters")}
                        className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-white"
                      >
                        Parameters
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    {/* Last Edited */}
                    <th className="text-left px-4 py-3">
                      <button
                        onClick={() => handleSort("updatedAt")}
                        className="flex items-center gap-1 text-sm font-medium text-gray-400 hover:text-white"
                      >
                        Last Edited
                        <ArrowUpDown className="w-3.5 h-3.5" />
                      </button>
                    </th>
                    {/* Actions */}
                    <th className="w-36 px-4 py-3 text-right">
                      <span className="text-sm font-medium text-gray-400">
                        Actions
                      </span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedProducts.map((product) => (
                    <tr
                      key={product.id}
                      onClick={() => openConfigurator(product.id)}
                      className="border-b border-slate-700/30 hover:bg-slate-700/30 cursor-pointer transition-colors group"
                    >
                      {/* Name */}
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center overflow-hidden shrink-0">
                            {product.thumbnail ? (
                              <img
                                src={product.thumbnail}
                                alt={product.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              <Box className="w-4 h-4 text-gray-600" />
                            )}
                          </div>
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-sm text-white font-medium truncate group-hover:text-orange-400 transition-colors">
                              {product.name}
                            </span>
                            {checkingLayout === product.id && (
                              <Loader2 className="w-3.5 h-3.5 text-orange-400 animate-spin shrink-0" />
                            )}
                          </div>
                        </div>
                      </td>
                      {/* Category */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400">
                          {product.category || "Uncategorized"}
                        </span>
                      </td>
                      {/* Status */}
                      <td className="px-4 py-3">
                        {product.status === "draft" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-slate-600/50 text-slate-300 rounded text-xs font-medium">
                            <Edit className="w-3 h-3" />
                            Draft
                          </span>
                        )}
                        {product.status === "testing" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-yellow-500/20 text-yellow-400 rounded text-xs font-medium">
                            <Eye className="w-3 h-3" />
                            Testing
                          </span>
                        )}
                        {product.status === "live" && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-green-500/20 text-green-400 rounded text-xs font-medium">
                            <Zap className="w-3 h-3" />
                            Live
                          </span>
                        )}
                      </td>
                      {/* Parameters */}
                      <td className="px-4 py-3">
                        <span className="flex items-center gap-1.5 text-sm text-gray-400">
                          <Sliders className="w-3.5 h-3.5" />
                          {product.parameters?.length || 0}
                        </span>
                      </td>
                      {/* Last Edited */}
                      <td className="px-4 py-3">
                        <span className="text-sm text-gray-400">
                          {product.updatedAt &&
                          !isNaN(new Date(product.updatedAt).getTime())
                            ? new Date(product.updatedAt).toLocaleDateString(
                                "en-US",
                                {
                                  month: "2-digit",
                                  day: "2-digit",
                                  year: "2-digit",
                                },
                              )
                            : "-"}
                        </span>
                      </td>
                      {/* Actions */}
                      <td className="px-4 py-3">
                        <div
                          className="flex items-center justify-end gap-1"
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            onClick={() =>
                              window.open(
                                appPath(`/configure?id=${product.id}`),
                                "_blank",
                              )
                            }
                            className="p-1.5 text-gray-400 hover:text-green-400 hover:bg-green-500/20 rounded transition-colors"
                            title="Preview Configure Page"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => openConfigurator(product.id)}
                            className="p-1.5 text-gray-400 hover:text-orange-400 hover:bg-orange-500/20 rounded transition-colors"
                            title="Open Builder"
                          >
                            <ExternalLink className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => openThemePicker(e, product.id)}
                            className="p-1.5 text-gray-400 hover:text-purple-400 hover:bg-purple-500/20 rounded transition-colors"
                            title="Change Template"
                          >
                            <Palette className="w-4 h-4" />
                          </button>
                          <button
                            onClick={(e) => handleDelete(e, product.id)}
                            className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                            title="Delete Layout"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* ── GRID VIEW ── */
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {sortedProducts.map((product) => (
              <button
                key={product.id}
                onClick={() => openConfigurator(product.id)}
                className="group bg-slate-800/50 hover:bg-slate-800 border border-slate-700/50 hover:border-orange-500/50 rounded-xl p-4 text-left transition-all"
              >
                {/* Thumbnail/Icon */}
                <div className="aspect-video bg-slate-900 rounded-lg mb-3 flex items-center justify-center overflow-hidden relative">
                  {product.thumbnail ? (
                    <img
                      src={product.thumbnail}
                      alt={product.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Box className="w-12 h-12 text-gray-600" />
                  )}
                  <div className="absolute inset-0 bg-slate-900/80 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                    {checkingLayout === product.id ? (
                      <div className="flex items-center gap-2 text-orange-400">
                        <Loader2 className="w-5 h-5 animate-spin" />
                        <span className="text-sm font-medium">Checking...</span>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-orange-400">
                        <ExternalLink className="w-5 h-5" />
                        <span className="text-sm font-medium">
                          Open Builder
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Info */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-white truncate group-hover:text-orange-400 transition-colors">
                      {product.name}
                    </h3>
                    <p className="text-sm text-gray-400 truncate">
                      {product.category || "Uncategorized"}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 text-orange-400">
                    <Zap className="w-4 h-4" />
                  </div>
                </div>

                {product.parameters?.length > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-xs text-gray-500">
                    <Sliders className="w-3 h-3" />
                    {product.parameters.length} parameters
                  </div>
                )}

                {/* Action buttons */}
                <div
                  className="mt-3 flex items-center gap-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    onClick={() =>
                      window.open(appPath(`/configure?id=${product.id}`), "_blank")
                    }
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg text-xs font-medium transition-colors"
                    title="Preview Configure Page"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Configure
                  </button>
                  <button
                    onClick={() => openConfigurator(product.id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 bg-orange-500/10 hover:bg-orange-500/20 text-orange-400 rounded-lg text-xs font-medium transition-colors"
                    title="Open Builder"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Builder
                  </button>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteConfirm.open}
        title={`Delete layout for "${deleteConfirm.productName}"?`}
        message="This will delete the configurator layout. The product itself will not be removed."
        confirmLabel="Delete Layout"
        onConfirm={() => {
          executeDelete(deleteConfirm.productId);
          setDeleteConfirm({ open: false, productId: "", productName: "" });
        }}
        onCancel={() =>
          setDeleteConfirm({ open: false, productId: "", productName: "" })
        }
      />
    </>
  );
}
