"use client";

import { useState, useEffect, useCallback } from "react";
import {
  FileText,
  Search,
  Filter,
  RefreshCw,
  Loader2,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle,
  XCircle,
  MessageSquare,
  DollarSign,
  Mail,
  Phone,
  Building,
  User,
  Package,
  Trash2,
  Eye,
  ArrowUpRight,
  AlertCircle,
  Copy,
  ExternalLink,
} from "lucide-react";
import { useNotifications } from "@/contexts/NotificationContext";

interface Quote {
  id: string;
  productId: string;
  productName: string;
  configuration: Record<string, any>;
  pricing: {
    unitPrice: number;
    totalPrice: number;
    currency: string;
    breakdown: { label: string; amount: number }[];
    quantity: number;
  };
  quantity: number;
  customer: {
    name: string;
    email: string;
    phone: string;
    company: string;
    notes: string;
  };
  status: "new" | "contacted" | "quoted" | "won" | "lost";
  adminNotes: string;
  createdAt: string;
  updatedAt: string;
}

interface QuoteStats {
  total: number;
  new: number;
  contacted: number;
  quoted: number;
  won: number;
  lost: number;
  totalValue: number;
  wonValue: number;
}

const STATUS_CONFIG: Record<
  string,
  { label: string; color: string; bg: string; icon: React.ElementType }
> = {
  new: {
    label: "New",
    color: "text-blue-400",
    bg: "bg-blue-500/20",
    icon: Clock,
  },
  contacted: {
    label: "Contacted",
    color: "text-yellow-400",
    bg: "bg-yellow-500/20",
    icon: MessageSquare,
  },
  quoted: {
    label: "Quoted",
    color: "text-purple-400",
    bg: "bg-purple-500/20",
    icon: FileText,
  },
  won: {
    label: "Won",
    color: "text-green-400",
    bg: "bg-green-500/20",
    icon: CheckCircle,
  },
  lost: {
    label: "Lost",
    color: "text-red-400",
    bg: "bg-red-500/20",
    icon: XCircle,
  },
};

export default function QuotesView() {
  const { addNotification } = useNotifications();
  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [stats, setStats] = useState<QuoteStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedQuote, setSelectedQuote] = useState<Quote | null>(null);
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [editingNotes, setEditingNotes] = useState(false);
  const [notesText, setNotesText] = useState("");

  // ── Fetch data ──
  const fetchQuotes = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (statusFilter !== "all") params.set("status", statusFilter);

      const [quotesRes, statsRes] = await Promise.all([
        fetch(`/api/quotes?${params}`),
        fetch("/api/quotes/stats"),
      ]);

      const quotesData = await quotesRes.json();
      const statsData = await statsRes.json();

      if (quotesData.success) setQuotes(quotesData.quotes);
      if (statsData.success) setStats(statsData.stats);
    } catch (error) {
      console.error("Failed to fetch quotes:", error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchQuotes();
  }, [fetchQuotes]);

  // Listen for real-time quote notifications
  useEffect(() => {
    const handleQuote = () => {
      fetchQuotes();
      addNotification("quotes");
    };
    // Socket.IO events if available
    if (typeof window !== "undefined" && (window as any).io) {
      try {
        const socket = (window as any).io();
        socket.on("quote-received", handleQuote);
        return () => {
          socket.off("quote-received", handleQuote);
        };
      } catch {
        /* no-op */
      }
    }
  }, [fetchQuotes, addNotification]);

  // ── Status update ──
  const updateStatus = async (
    quoteId: string,
    newStatus: string,
    notes?: string,
  ) => {
    try {
      setUpdatingStatus(true);
      const res = await fetch(`/api/quotes/${quoteId}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus, adminNotes: notes }),
      });

      const data = await res.json();
      if (data.success) {
        // Update local state
        setQuotes((prev) =>
          prev.map((q) => (q.id === quoteId ? { ...q, ...data.quote } : q)),
        );
        if (selectedQuote?.id === quoteId) {
          setSelectedQuote(data.quote);
        }
        fetchQuotes(); // Refresh stats
      }
    } catch (error) {
      console.error("Failed to update status:", error);
    } finally {
      setUpdatingStatus(false);
    }
  };

  // ── Delete quote ──
  const deleteQuote = async (quoteId: string) => {
    if (!confirm("Are you sure you want to delete this quote?")) return;
    try {
      const res = await fetch(`/api/quotes/${quoteId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.success) {
        setQuotes((prev) => prev.filter((q) => q.id !== quoteId));
        if (selectedQuote?.id === quoteId) setSelectedQuote(null);
        fetchQuotes();
      }
    } catch (error) {
      console.error("Failed to delete quote:", error);
    }
  };

  // ── Filtered quotes ──
  const filteredQuotes = quotes.filter((q) => {
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      return (
        q.customer.name.toLowerCase().includes(query) ||
        q.customer.email.toLowerCase().includes(query) ||
        q.customer.company.toLowerCase().includes(query) ||
        q.productName.toLowerCase().includes(query) ||
        q.id.toLowerCase().includes(query)
      );
    }
    return true;
  });

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  const formatTime = (dateStr: string) => {
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const currencySymbol = (c: string) =>
    c === "EUR" ? "€" : c === "GBP" ? "£" : "$";

  // ============================================================================
  // DETAIL VIEW
  // ============================================================================
  if (selectedQuote) {
    const q = selectedQuote;
    const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.new;
    const StatusIcon = statusCfg.icon;
    const sym = currencySymbol(q.pricing?.currency || "USD");

    return (
      <div className="space-y-6">
        {/* Back button */}
        <button
          onClick={() => setSelectedQuote(null)}
          className="flex items-center gap-2 text-sm text-gray-400 hover:text-white transition-colors"
        >
          <ChevronRight className="w-4 h-4 rotate-180" />
          Back to Quotes
        </button>

        {/* Header */}
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h2 className="text-xl font-bold text-white">
                {q.customer.name || q.customer.email}
              </h2>
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
              >
                <StatusIcon className="w-3.5 h-3.5" />
                {statusCfg.label}
              </span>
            </div>
            <p className="text-sm text-gray-500 mt-1">
              {q.productName} &middot; {formatDate(q.createdAt)} at{" "}
              {formatTime(q.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => deleteQuote(q.id)}
              className="p-2 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors"
              title="Delete quote"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Customer Info */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <User className="w-4 h-4 text-orange-400" />
              Customer
            </h3>
            <div className="space-y-3">
              {q.customer.name && (
                <div className="flex items-center gap-2 text-sm">
                  <User className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-300">{q.customer.name}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-sm">
                <Mail className="w-3.5 h-3.5 text-gray-500" />
                <a
                  href={`mailto:${q.customer.email}`}
                  className="text-blue-400 hover:text-blue-300"
                >
                  {q.customer.email}
                </a>
              </div>
              {q.customer.phone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-3.5 h-3.5 text-gray-500" />
                  <a href={`tel:${q.customer.phone}`} className="text-gray-300">
                    {q.customer.phone}
                  </a>
                </div>
              )}
              {q.customer.company && (
                <div className="flex items-center gap-2 text-sm">
                  <Building className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-gray-300">{q.customer.company}</span>
                </div>
              )}
              {q.customer.notes && (
                <div className="pt-2 border-t border-slate-700/50">
                  <p className="text-xs text-gray-500 mb-1">Customer Notes:</p>
                  <p className="text-sm text-gray-300">{q.customer.notes}</p>
                </div>
              )}
            </div>
          </div>

          {/* Configuration */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Package className="w-4 h-4 text-orange-400" />
              Configuration
            </h3>
            <div className="space-y-2">
              {Object.entries(q.configuration).map(([key, val]) => (
                <div
                  key={key}
                  className="flex items-center justify-between text-sm"
                >
                  <span className="text-gray-500">{key}</span>
                  <span className="text-gray-200 font-medium">
                    {typeof val === "boolean"
                      ? val
                        ? "Yes"
                        : "No"
                      : String(val)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <DollarSign className="w-4 h-4 text-orange-400" />
              Pricing
            </h3>
            {q.pricing?.breakdown && (
              <div className="space-y-2">
                {q.pricing.breakdown.map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between text-sm"
                  >
                    <span className="text-gray-500">{item.label}</span>
                    <span className="text-gray-200">
                      {sym}
                      {item.amount.toFixed(2)}
                    </span>
                  </div>
                ))}
              </div>
            )}
            <div className="pt-3 border-t border-slate-700/50 space-y-2">
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Unit Price</span>
                <span className="text-white font-medium">
                  {sym}
                  {(q.pricing?.unitPrice || 0).toFixed(2)}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-400">Quantity</span>
                <span className="text-white">{q.quantity}</span>
              </div>
              <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
                <span className="text-gray-300 font-semibold">Total</span>
                <span className="text-lg font-bold text-orange-400">
                  {sym}
                  {(q.pricing?.totalPrice || 0).toFixed(2)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Status Management + Admin Notes */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Status update */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-4">
            <h3 className="text-sm font-semibold text-white">Update Status</h3>
            <div className="flex flex-wrap gap-2">
              {Object.entries(STATUS_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon;
                const isActive = q.status === key;
                return (
                  <button
                    key={key}
                    onClick={() => updateStatus(q.id, key)}
                    disabled={updatingStatus || isActive}
                    className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? `${cfg.bg} ${cfg.color} ring-1 ring-current`
                        : "bg-slate-700/50 text-gray-400 hover:bg-slate-700 hover:text-white"
                    } disabled:opacity-50`}
                  >
                    <Icon className="w-3.5 h-3.5" />
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Admin notes */}
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-white">Admin Notes</h3>
              {!editingNotes ? (
                <button
                  onClick={() => {
                    setEditingNotes(true);
                    setNotesText(q.adminNotes || "");
                  }}
                  className="text-xs text-orange-400 hover:text-orange-300"
                >
                  Edit
                </button>
              ) : (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setEditingNotes(false)}
                    className="text-xs text-gray-400 hover:text-white"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => {
                      updateStatus(q.id, q.status, notesText);
                      setEditingNotes(false);
                    }}
                    className="text-xs text-orange-400 hover:text-orange-300 font-medium"
                  >
                    Save
                  </button>
                </div>
              )}
            </div>
            {editingNotes ? (
              <textarea
                value={notesText}
                onChange={(e) => setNotesText(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 rounded-lg bg-slate-700/50 border border-slate-600 text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none resize-none"
                placeholder="Add internal notes about this quote..."
                aria-label="Admin notes"
              />
            ) : (
              <p className="text-sm text-gray-400">
                {q.adminNotes || "No notes yet. Click Edit to add."}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ============================================================================
  // LIST VIEW
  // ============================================================================
  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Quotes</p>
            <p className="text-2xl font-bold text-white">{stats.total}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-xs text-gray-500 mb-1">New / Pending</p>
            <p className="text-2xl font-bold text-blue-400">{stats.new}</p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Total Value</p>
            <p className="text-2xl font-bold text-orange-400">
              ${stats.totalValue.toFixed(0)}
            </p>
          </div>
          <div className="bg-slate-800/50 rounded-xl border border-slate-700/50 p-4">
            <p className="text-xs text-gray-500 mb-1">Won Value</p>
            <p className="text-2xl font-bold text-green-400">
              ${stats.wonValue.toFixed(0)}
            </p>
          </div>
        </div>
      )}

      {/* Filters + Search */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="flex items-center bg-slate-800/50 rounded-lg p-0.5 border border-slate-700/50">
            {[
              { key: "all", label: "All" },
              ...Object.entries(STATUS_CONFIG).map(([key, cfg]) => ({
                key,
                label: cfg.label,
              })),
            ].map((tab) => (
              <button
                key={tab.key}
                onClick={() => setStatusFilter(tab.key)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                  statusFilter === tab.key
                    ? "bg-orange-500 text-white"
                    : "text-gray-400 hover:text-white"
                }`}
              >
                {tab.label}
                {tab.key !== "all" && stats && (
                  <span className="ml-1 text-[10px] opacity-60">
                    {stats[tab.key as keyof QuoteStats] || 0}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search quotes..."
              className="pl-9 pr-4 py-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-sm text-gray-200 placeholder-gray-500 focus:ring-2 focus:ring-orange-500 focus:border-transparent outline-none w-64"
              aria-label="Search quotes"
            />
          </div>
          <button
            onClick={fetchQuotes}
            className="p-2 bg-slate-800/50 border border-slate-700/50 rounded-lg text-gray-400 hover:text-white hover:bg-slate-700 transition-colors"
            title="Refresh"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>

      {/* Quotes Table */}
      {loading && quotes.length === 0 ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-orange-500" />
        </div>
      ) : filteredQuotes.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <FileText className="w-12 h-12 text-slate-600 mb-4" />
          <h3 className="text-lg font-semibold text-white mb-1">
            No Quotes Yet
          </h3>
          <p className="text-sm text-gray-500 max-w-sm">
            Quote requests from the customer configurator will appear here.
            Share your product link to start receiving quotes.
          </p>
        </div>
      ) : (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-700/50">
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Product
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Total
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="text-right px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-700/30">
              {filteredQuotes.map((q) => {
                const statusCfg = STATUS_CONFIG[q.status] || STATUS_CONFIG.new;
                const StatusIcon = statusCfg.icon;
                const sym = currencySymbol(q.pricing?.currency || "USD");
                return (
                  <tr
                    key={q.id}
                    className="hover:bg-slate-700/20 transition-colors cursor-pointer"
                    onClick={() => setSelectedQuote(q)}
                  >
                    <td className="px-5 py-4">
                      <div>
                        <p className="text-sm font-medium text-white">
                          {q.customer.name || q.customer.email}
                        </p>
                        {q.customer.name && (
                          <p className="text-xs text-gray-500">
                            {q.customer.email}
                          </p>
                        )}
                        {q.customer.company && (
                          <p className="text-xs text-gray-600">
                            {q.customer.company}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-300">{q.productName}</p>
                      <p className="text-xs text-gray-600">Qty: {q.quantity}</p>
                    </td>
                    <td className="px-5 py-4">
                      <span className="text-sm font-semibold text-orange-400">
                        {sym}
                        {(q.pricing?.totalPrice || 0).toFixed(2)}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${statusCfg.bg} ${statusCfg.color}`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {statusCfg.label}
                      </span>
                    </td>
                    <td className="px-5 py-4">
                      <p className="text-sm text-gray-400">
                        {formatDate(q.createdAt)}
                      </p>
                      <p className="text-xs text-gray-600">
                        {formatTime(q.createdAt)}
                      </p>
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div
                        className="flex items-center justify-end gap-1"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <button
                          onClick={() => setSelectedQuote(q)}
                          className="p-1.5 text-gray-500 hover:text-white hover:bg-slate-700 rounded-lg transition-colors"
                          title="View details"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => deleteQuote(q.id)}
                          className="p-1.5 text-gray-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                          title="Delete quote"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Configurator Link Helper */}
      {!loading && stats && stats.total === 0 && (
        <div className="bg-slate-800/30 rounded-xl border border-slate-700/50 p-6">
          <h3 className="text-sm font-semibold text-white mb-2 flex items-center gap-2">
            <ExternalLink className="w-4 h-4 text-orange-400" />
            Share Your Configurator
          </h3>
          <p className="text-sm text-gray-400 mb-3">
            Customers can configure products and submit quote requests through
            the configurator page. Share the link below with your customers:
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 px-4 py-2 bg-slate-900 border border-slate-700 rounded-lg text-sm text-orange-400 font-mono">
              {typeof window !== "undefined"
                ? `${window.location.origin}/configure?id=<productId>`
                : "/configure?id=<productId>"}
            </code>
            <button
              onClick={() => {
                const url = `${window.location.origin}/configure?id=<productId>`;
                navigator.clipboard.writeText(url);
              }}
              className="p-2 text-gray-400 hover:text-white bg-slate-700/50 rounded-lg transition-colors"
              title="Copy link"
            >
              <Copy className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
