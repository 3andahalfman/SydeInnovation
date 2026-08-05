"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import {
import { appPath } from '@/lib/config';
  Code2,
  Copy,
  Check,
  ExternalLink,
  Eye,
  EyeOff,
  Monitor,
  Tablet,
  Smartphone,
  RefreshCw,
  Globe,
  ChevronDown,
  ChevronRight,
  Zap,
  BookOpen,
  Palette,
  Settings2,
  Link2,
  Play,
  Square,
  AlertCircle,
  CheckCircle,
  ArrowRight,
} from "lucide-react";

// ============================================================================
// TYPES
// ============================================================================

interface Product {
  id: string;
  name: string;
  description: string;
  status: string;
  lastOutputUrn?: string;
  configuratorLayout?: any;
  thumbnail?: string;
  productImage?: string;
}

interface EmbedConfig {
  productId: string;
  width: string;
  height: string;
  theme: "dark" | "light";
  showHeader: boolean;
  responsive: boolean;
}

type PreviewDevice = "desktop" | "tablet" | "mobile";

// ============================================================================
// COMPONENT
// ============================================================================

export default function IntegrationView() {
  // ── Data State ──
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [serverUrl, setServerUrl] = useState("");

  // ── Embed Config ──
  const [config, setConfig] = useState<EmbedConfig>({
    productId: "",
    width: "100%",
    height: "700",
    theme: "dark",
    showHeader: false,
    responsive: true,
  });

  // ── UI State ──
  const [copied, setCopied] = useState<string | null>(null);
  const [previewDevice, setPreviewDevice] = useState<PreviewDevice>("desktop");
  const [showPreview, setShowPreview] = useState(false);
  const [activeTab, setActiveTab] = useState<"iframe" | "api" | "events" | "platforms" | "webhooks">(
    "iframe",
  );
  const [expandedPlatform, setExpandedPlatform] = useState<string | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // ── Load products ──
  useEffect(() => {
    const loadProducts = async () => {
      try {
        const token = localStorage.getItem("token");
        const headers: Record<string, string> = {};
        if (token) {
          headers["Authorization"] = `Bearer ${token}`;
        }
        const res = await fetch("/api/products", { headers });
        const data = await res.json();
        if (data.success && data.products) {
          setProducts(data.products);
          // Auto-select first product with a configurator layout
          const configurable = data.products.find(
            (p: Product) => p.configuratorLayout,
          );
          if (configurable) {
            setConfig((c) => ({ ...c, productId: configurable.id }));
          } else if (data.products.length > 0) {
            setConfig((c) => ({ ...c, productId: data.products[0].id }));
          }
        }
      } catch (err) {
        console.error("Failed to load products:", err);
      } finally {
        setLoading(false);
      }
    };
    loadProducts();

    // Detect the server URL
    if (typeof window !== "undefined") {
      setServerUrl(window.location.origin);
    }
  }, []);

  // ── Build URLs ──
  const configureUrl = `${serverUrl}/configure?id=${config.productId}&embed=true`;

  const iframeSnippet = `<iframe
  src="${configureUrl}"
  width="${config.responsive ? "100%" : config.width}"
  height="${config.height}px"
  frameborder="0"
  allow="fullscreen"
  style="border: none; border-radius: 8px;${config.responsive ? " max-width: 100%;" : ""}"
></iframe>`;

  const responsiveSnippet = `<div style="position: relative; width: 100%; max-width: 1200px; margin: 0 auto;">
  <iframe
    src="${configureUrl}"
    width="100%"
    height="${config.height}px"
    frameborder="0"
    allow="fullscreen"
    style="border: none; border-radius: 8px;"
  ></iframe>
</div>`;

  const selectedProduct = products.find((p) => p.id === config.productId);

  // ── Copy Handler ──
  const handleCopy = useCallback((text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(label);
      setTimeout(() => setCopied(null), 2000);
    });
  }, []);

  // ── Device widths for preview ──
  const deviceWidths: Record<PreviewDevice, string> = {
    desktop: "100%",
    tablet: "768px",
    mobile: "375px",
  };

  // ── Platform guides ──
  const platforms = [
    {
      id: "shopify",
      name: "Shopify",
      icon: "🛒",
      steps: [
        "In your Shopify admin go to Online Store → Themes → Edit code",
        'Create a new section: sections/sydeflow-configurator.liquid',
        "Paste the Liquid snippet below into that file and save",
        "Add the section to any product page template via the theme editor",
        "In the section settings, enter your SydeFlow server URL and product ID",
      ],
      tip: "The snippet auto-syncs price to the Add-to-Cart button and shows a success message on quote submit.",
      snippetLabel: "Shopify Liquid Section (sections/sydeflow-configurator.liquid)",
      snippet: `{% schema %}
{
  "name": "SydeFlow Configurator",
  "settings": [
    { "type": "text", "id": "server_url", "label": "SydeFlow Server URL", "default": "https://your-server.com" },
    { "type": "text", "id": "product_id", "label": "SydeFlow Product ID" },
    { "type": "range", "id": "height", "label": "Height (px)", "min": 400, "max": 1200, "step": 50, "default": 700 }
  ],
  "presets": [{ "name": "SydeFlow Configurator" }]
}
{% endschema %}

<div class="sydeflow-wrapper" style="margin: 2rem 0;">
  <iframe
    id="sydeflow-frame"
    src="{{ section.settings.server_url }}/configure?id={{ section.settings.product_id }}&embed=true"
    width="100%"
    height="{{ section.settings.height }}px"
    frameborder="0"
    allow="fullscreen"
    style="border: none; border-radius: 8px;"
  ></iframe>

  <div id="sydeflow-quote-success"
    style="display:none; padding:1rem; background:#d1fae5; border-radius:8px; margin-top:1rem; color:#065f46;">
    Your quote has been submitted! We'll be in touch shortly.
  </div>
</div>

<script>
window.addEventListener('message', function(e) {
  if (e.data && e.data.source === 'sydeflow-configurator') {
    if (e.data.type === 'PRICE_UPDATED') {
      // Sync price into Shopify's product price display
      var price = e.data.total;
      document.querySelectorAll('.price__regular .price-item, .price-item--regular').forEach(function(el) {
        el.textContent = '$' + price.toFixed(2) + ' ' + (e.data.currency || 'USD');
      });
    }
    if (e.data.type === 'QUOTE_SUBMITTED') {
      document.getElementById('sydeflow-quote-success').style.display = 'block';
      document.getElementById('sydeflow-frame').scrollIntoView({ behavior: 'smooth' });
    }
  }
});
</script>`,
    },
    {
      id: "webflow",
      name: "Webflow",
      icon: "🌊",
      steps: [
        "Open the Webflow Designer for your site",
        'Add an "Embed" element (HTML Embed) where you want the configurator',
        "Paste the complete HTML embed snippet below into the embed block",
        'Replace YOUR_SERVER_URL and YOUR_PRODUCT_ID with your values',
        "Publish your site",
      ],
      tip: "Add a Text element with class 'config-price' anywhere on the page — it auto-updates as the customer configures.",
      snippetLabel: "Webflow HTML Embed Block",
      snippet: `<!-- SydeFlow Configurator Embed -->
<div style="width:100%; max-width:1200px; margin:0 auto;">
  <iframe
    id="sydeflow-frame"
    src="YOUR_SERVER_URL/configure?id=YOUR_PRODUCT_ID&embed=true"
    width="100%"
    height="700px"
    frameborder="0"
    allow="fullscreen"
    style="border:none; border-radius:8px;"
  ></iframe>

  <!-- Add a text element with class "config-price" to show live price -->
  <!-- Add an element with class "quote-success" to show on submission -->
</div>

<script>
window.addEventListener('message', function(e) {
  if (!e.data || e.data.source !== 'sydeflow-configurator') return;

  if (e.data.type === 'PRICE_UPDATED') {
    // Update any element with class "config-price"
    document.querySelectorAll('.config-price').forEach(function(el) {
      el.textContent = '$' + e.data.total.toFixed(2);
    });
  }

  if (e.data.type === 'GENERATION_COMPLETE') {
    // Show a "Model ready" indicator
    document.querySelectorAll('.model-status').forEach(function(el) {
      el.textContent = 'Your custom model is ready';
      el.style.color = '#22c55e';
    });
  }

  if (e.data.type === 'QUOTE_SUBMITTED') {
    // Show success message, hide form
    document.querySelectorAll('.quote-success').forEach(function(el) {
      el.style.display = 'block';
    });
  }
});
</script>`,
    },
    {
      id: "wordpress",
      name: "WordPress / WooCommerce",
      icon: "📝",
      steps: [
        "Edit the page where you want the configurator",
        'Add a "Custom HTML" block (Gutenberg) or switch to "Text" tab (Classic editor)',
        "Paste the iframe embed code from the Embed Code tab",
        "Update/publish the page",
      ],
      tip: "For WooCommerce, add the embed code to a product's description or use a shortcode plugin.",
      snippet: null,
      snippetLabel: null,
    },
    {
      id: "wix",
      name: "Wix",
      icon: "✨",
      steps: [
        "Open the Wix Editor for your site",
        'Click "Add" (+) → Embed Code → Embed a Widget',
        'Click "Enter Code" on the widget',
        "Paste the iframe embed code from the Embed Code tab",
        "Resize the widget to fit your page layout",
        "Publish your site",
      ],
      tip: "Use the Wix full-width container for best results.",
      snippet: null,
      snippetLabel: null,
    },
    {
      id: "squarespace",
      name: "Squarespace",
      icon: "◼️",
      steps: [
        "Edit the page in Squarespace",
        'Add a "Code" block from the insert menu',
        "Paste the iframe embed code from the Embed Code tab",
        'Toggle off the "Display Source" option',
        "Save and preview",
      ],
      tip: "Squarespace may require a Business plan or higher for custom code blocks.",
      snippet: null,
      snippetLabel: null,
    },
    {
      id: "custom",
      name: "Custom Website",
      icon: "🌐",
      steps: [
        "Open your HTML file in a code editor",
        "Place the iframe embed code where you want the configurator to appear",
        "Ensure your page allows iframes (check Content-Security-Policy headers)",
        "Deploy your updated page",
      ],
      tip: "Works with any HTML page — React, Vue, Angular, static HTML, etc.",
      snippet: null,
      snippetLabel: null,
    },
  ];

  // ── API Examples ──
  const apiExamples = [
    {
      label: "Get Product",
      method: "GET",
      endpoint: `/api/products/${config.productId || ":productId"}`,
      description:
        "Retrieve product details, parameters, and pricing configuration",
    },
    {
      label: "Get Layout",
      method: "GET",
      endpoint: `/api/products/${config.productId || ":productId"}/layout`,
      description:
        "Get the configurator layout for rendering the parameter form",
    },
    {
      label: "Calculate Price",
      method: "POST",
      endpoint: `/api/products/${config.productId || ":productId"}/calculate-price`,
      description: "Calculate price based on parameter values",
    },
    {
      label: "Submit Quote",
      method: "POST",
      endpoint: "/api/quotes",
      description:
        "Submit a quote request with customer details and configuration",
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-6 h-6 animate-spin text-orange-500" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ═══════════ TOP TABS ═══════════ */}
      <div className="flex items-center gap-1 p-1 bg-slate-800/50 rounded-xl border border-slate-700/50 w-fit mb-6 shrink-0">
        {[
          { id: "iframe" as const, label: "Embed Code", icon: Code2 },
          { id: "api" as const, label: "API Reference", icon: Zap },
          { id: "events" as const, label: "Events API", icon: Zap },
          { id: "platforms" as const, label: "Platform Guides", icon: Globe },
          { id: "webhooks" as const, label: "Webhooks", icon: ArrowRight },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              activeTab === id
                ? "bg-orange-500 text-white shadow-sm"
                : "text-gray-400 hover:text-white hover:bg-slate-700/50"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* ═══════════ IFRAME EMBED TAB ═══════════ */}
      {activeTab === "iframe" && (
        <div className="flex-1 min-h-0">
          {/* ── Config + Code ── */}
          <div className="space-y-5">
            {/* Product Selector */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-4 flex items-center gap-2">
                <Settings2 className="w-4 h-4 text-orange-400" />
                Embed Configuration
              </h3>
              <div className="space-y-4">
                {/* Product */}
                <div>
                  <label className="block text-xs font-medium text-gray-400 mb-1.5">
                    Product
                  </label>
                  <select
                    value={config.productId}
                    onChange={(e) =>
                      setConfig((c) => ({ ...c, productId: e.target.value }))
                    }
                    title="Select a product to embed"
                    className="w-full px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/80 outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  >
                    <option value="">Select a product...</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name}
                        {p.configuratorLayout ? " ✓" : ""}
                      </option>
                    ))}
                  </select>
                  {selectedProduct && !selectedProduct.configuratorLayout && (
                    <p className="text-xs text-yellow-400 mt-1 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      This product doesn't have a configurator layout yet
                    </p>
                  )}
                </div>

                {/* Dimensions */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Width
                    </label>
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={config.width}
                        onChange={(e) =>
                          setConfig((c) => ({ ...c, width: e.target.value }))
                        }
                        disabled={config.responsive}
                        className="flex-1 px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/80 outline-none focus:ring-2 focus:ring-orange-500 disabled:opacity-40 disabled:cursor-not-allowed"
                        placeholder="100%"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-400 mb-1.5">
                      Height (px)
                    </label>
                    <input
                      type="text"
                      value={config.height}
                      onChange={(e) =>
                        setConfig((c) => ({ ...c, height: e.target.value }))
                      }
                      className="w-full px-3 py-2 rounded-lg border border-slate-600 text-sm text-white bg-slate-800/80 outline-none focus:ring-2 focus:ring-orange-500"
                      placeholder="700"
                    />
                  </div>
                </div>

                {/* Toggles */}
                <div className="flex items-center gap-6">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={config.responsive}
                      onChange={(e) =>
                        setConfig((c) => ({
                          ...c,
                          responsive: e.target.checked,
                        }))
                      }
                      className="w-4 h-4 accent-orange-500 rounded"
                    />
                    <span className="text-sm text-gray-300">
                      Responsive width
                    </span>
                  </label>
                </div>
              </div>
            </div>

            {/* Generated Code */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
              <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
                <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                  <Code2 className="w-4 h-4 text-orange-400" />
                  Embed Code
                </h3>
                <button
                  onClick={() =>
                    handleCopy(
                      config.responsive ? responsiveSnippet : iframeSnippet,
                      "iframe",
                    )
                  }
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                    copied === "iframe"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                  }`}
                >
                  {copied === "iframe" ? (
                    <Check className="w-3.5 h-3.5" />
                  ) : (
                    <Copy className="w-3.5 h-3.5" />
                  )}
                  {copied === "iframe" ? "Copied!" : "Copy Code"}
                </button>
              </div>
              <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono leading-relaxed">
                <code>
                  {config.responsive ? responsiveSnippet : iframeSnippet}
                </code>
              </pre>
            </div>

            {/* Direct Link */}
            <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
              <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
                <Link2 className="w-4 h-4 text-orange-400" />
                Direct Link
              </h3>
              <p className="text-xs text-gray-400 mb-3">
                Share this URL to let customers access the configurator
                directly.
              </p>
              <div className="flex items-center gap-2">
                <div className="flex-1 px-3 py-2 bg-slate-900/60 border border-slate-700 rounded-lg text-xs text-gray-300 font-mono truncate">
                  {serverUrl}/configure?id={config.productId}
                </div>
                <button
                  onClick={() =>
                    handleCopy(
                      `${serverUrl}/configure?id=${config.productId}`,
                      "link",
                    )
                  }
                  className={`p-2 rounded-lg transition-all ${
                    copied === "link"
                      ? "bg-green-500/20 text-green-400"
                      : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                  }`}
                  title="Copy link"
                >
                  {copied === "link" ? (
                    <Check className="w-4 h-4" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
                <a
                  href={appPath(`/configure?id=${config.productId}`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 rounded-lg bg-slate-700 text-gray-300 hover:bg-slate-600 transition-all"
                  title="Open in new tab"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ API REFERENCE TAB ═══════════ */}
      {activeTab === "api" && (
        <div className="space-y-5">
          {/* Base URL */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-orange-400" />
              Base URL
            </h3>
            <div className="flex items-center gap-2">
              <code className="flex-1 px-4 py-2.5 bg-slate-900/60 border border-slate-700 rounded-lg text-sm text-orange-300 font-mono">
                {serverUrl}
              </code>
              <button
                onClick={() => handleCopy(serverUrl, "baseUrl")}
                className={`p-2 rounded-lg transition-all ${
                  copied === "baseUrl"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                }`}
              >
                {copied === "baseUrl" ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          {/* Endpoints */}
          <div className="space-y-3">
            {apiExamples.map((api, i) => (
              <div
                key={i}
                className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 py-3">
                  <div className="flex items-center gap-3">
                    <span
                      className={`px-2 py-0.5 rounded text-xs font-bold tracking-wide ${
                        api.method === "GET"
                          ? "bg-green-500/20 text-green-400"
                          : "bg-blue-500/20 text-blue-400"
                      }`}
                    >
                      {api.method}
                    </span>
                    <code className="text-sm text-gray-200 font-mono">
                      {api.endpoint}
                    </code>
                  </div>
                  <button
                    onClick={() =>
                      handleCopy(`${serverUrl}${api.endpoint}`, `api-${i}`)
                    }
                    className={`p-1.5 rounded transition-all ${
                      copied === `api-${i}`
                        ? "text-green-400"
                        : "text-gray-500 hover:text-gray-300"
                    }`}
                    title="Copy full URL"
                  >
                    {copied === `api-${i}` ? (
                      <Check className="w-3.5 h-3.5" />
                    ) : (
                      <Copy className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
                <div className="px-5 pb-3">
                  <p className="text-xs text-gray-400">{api.description}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Usage Example */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <h3 className="text-white font-semibold text-sm flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-orange-400" />
                Usage Example
              </h3>
              <button
                onClick={() => handleCopy(fetchExample, "fetchExample")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  copied === "fetchExample"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                }`}
              >
                {copied === "fetchExample" ? (
                  <Check className="w-3.5 h-3.5" />
                ) : (
                  <Copy className="w-3.5 h-3.5" />
                )}
                {copied === "fetchExample" ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono leading-relaxed">
              <code>{fetchExample}</code>
            </pre>
          </div>
        </div>
      )}

      {/* ═══════════ EVENTS API TAB ═══════════ */}
      {activeTab === "events" && (
        <div className="space-y-5">
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-2">PostMessage Events</h3>
            <p className="text-gray-400 text-sm mb-4">
              The embedded configurator sends <code className="text-orange-400 bg-slate-900 px-1 rounded">window.postMessage</code> events to the parent page. Listen to these to sync prices, detect quote submissions, and react to model generation in your Shopify/Webflow/custom site.
            </p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-gray-300 mb-4 overflow-x-auto">
              <pre>{`window.addEventListener('message', (event) => {
  // Always check the source to avoid other iframes
  if (event.data?.source !== 'sydeflow-configurator') return;

  const { type, productId, ...payload } = event.data;

  switch (type) {
    case 'CONFIG_CHANGED':
      // payload.parameters — current parameter values
      // payload.price      — { total, currency, breakdown }
      // payload.quantity   — current quantity
      console.log('Config changed:', payload.parameters);
      break;

    case 'PRICE_UPDATED':
      // payload.total      — numeric price
      // payload.currency   — e.g. "USD"
      // payload.quantity   — current quantity
      document.getElementById('price-display').textContent =
        '$' + payload.total.toFixed(2);
      break;

    case 'GENERATION_STARTED':
      // payload.parameters — parameters sent to Inventor
      console.log('Model generating…');
      break;

    case 'GENERATION_COMPLETE':
      // payload.urn        — Autodesk Viewer URN of new model
      // payload.parameters — parameters used
      console.log('New model ready:', payload.urn);
      break;

    case 'QUOTE_SUBMITTED':
      // payload.quoteId    — SydeFlow quote ID
      // payload.customer   — { name, email, company }
      // payload.pricing    — { total, currency, quantity }
      console.log('Quote submitted by', payload.customer.email);
      break;
  }
});`}</pre>
            </div>
          </div>

          {/* Shopify example */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-2">Shopify: Sync Price to Cart</h3>
            <p className="text-gray-400 text-xs mb-3">Add this script to your Shopify theme to update a product's line-item price when the configurator price changes.</p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
              <pre>{`<script>
window.addEventListener('message', (e) => {
  if (e.data?.source !== 'sydeflow-configurator') return;
  if (e.data.type === 'PRICE_UPDATED') {
    // Update visible price on the page
    document.querySelectorAll('.price__regular .price-item')
      .forEach(el => el.textContent = '$' + e.data.total.toFixed(2));
  }
  if (e.data.type === 'QUOTE_SUBMITTED') {
    // Redirect to thank-you or show success banner
    document.getElementById('quote-success').style.display = 'block';
  }
});
</script>`}</pre>
            </div>
          </div>

          {/* Webflow example */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-2">Webflow: Update Price Text</h3>
            <p className="text-gray-400 text-xs mb-3">Add an HTML Embed block to your Webflow page with this code.</p>
            <div className="bg-slate-900 rounded-lg p-4 font-mono text-xs text-gray-300 overflow-x-auto">
              <pre>{`<script>
window.addEventListener('message', (e) => {
  if (e.data?.source !== 'sydeflow-configurator') return;
  if (e.data.type === 'PRICE_UPDATED') {
    // Target a Webflow text element with class "config-price"
    const el = document.querySelector('.config-price');
    if (el) el.textContent = '$' + e.data.total.toFixed(2);
  }
});
</script>`}</pre>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ WEBHOOKS TAB ═══════════ */}
      {activeTab === "webhooks" && (
        <div className="space-y-5">
          {/* Intro */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-2 flex items-center gap-2">
              <ArrowRight className="w-4 h-4 text-orange-400" />
              Server-Side Webhooks
            </h3>
            <p className="text-gray-400 text-sm">
              Receive real-time HTTP POST callbacks on your server when SydeFlow events occur.
              Unlike PostMessage (browser-only), webhooks work server-to-server — ideal for
              creating Shopify draft orders, updating your CRM, or triggering custom workflows.
            </p>
          </div>

          {/* Events reference */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl p-5">
            <h3 className="text-white font-semibold text-sm mb-3">Available Events</h3>
            <div className="space-y-2">
              {[
                { event: "quote.created", desc: "A customer submitted a quote request" },
                { event: "quote.status_changed", desc: "An admin updated a quote's status (won, lost, contacted…)" },
                { event: "product.updated", desc: "A product was saved or modified" },
                { event: "generation.complete", desc: "A Design Automation work item finished" },
              ].map(({ event, desc }) => (
                <div key={event} className="flex items-start gap-3 p-3 bg-slate-900/40 rounded-lg">
                  <code className="text-orange-400 text-xs font-mono shrink-0 mt-0.5">{event}</code>
                  <span className="text-gray-400 text-xs">{desc}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Subscribe */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <h3 className="text-white font-semibold text-sm">Register a Webhook</h3>
              <button
                type="button"
                onClick={() => handleCopy(webhookSubscribeExample, "wh-subscribe")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  copied === "wh-subscribe"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                }`}
              >
                {copied === "wh-subscribe" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "wh-subscribe" ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono leading-relaxed">
              <code>{webhookSubscribeExample}</code>
            </pre>
          </div>

          {/* Verify signature */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <h3 className="text-white font-semibold text-sm">Verify Payload Signature</h3>
              <button
                type="button"
                onClick={() => handleCopy(webhookVerifyExample, "wh-verify")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  copied === "wh-verify"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                }`}
              >
                {copied === "wh-verify" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "wh-verify" ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono leading-relaxed">
              <code>{webhookVerifyExample}</code>
            </pre>
          </div>

          {/* Payload shape */}
          <div className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3 border-b border-slate-700/50">
              <h3 className="text-white font-semibold text-sm">Example Payload — quote.created</h3>
              <button
                type="button"
                onClick={() => handleCopy(webhookPayloadExample, "wh-payload")}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  copied === "wh-payload"
                    ? "bg-green-500/20 text-green-400"
                    : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                }`}
              >
                {copied === "wh-payload" ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                {copied === "wh-payload" ? "Copied!" : "Copy"}
              </button>
            </div>
            <pre className="p-4 text-sm text-gray-300 overflow-x-auto font-mono leading-relaxed">
              <code>{webhookPayloadExample}</code>
            </pre>
          </div>

          {/* Security note */}
          <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl flex items-start gap-3">
            <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
            <div className="text-xs text-gray-400">
              <span className="font-medium text-blue-400">Security: </span>
              Each delivery includes an <code className="text-orange-400">X-SydeFlow-Signature: sha256=…</code> header.
              Always verify this against your webhook secret before processing the payload.
              Webhooks are automatically disabled after 5 consecutive delivery failures.
            </div>
          </div>
        </div>
      )}

      {/* ═══════════ PLATFORM GUIDES TAB ═══════════ */}
      {activeTab === "platforms" && (
        <div className="space-y-3">
          <p className="text-gray-400 text-sm mb-4">
            Step-by-step instructions for embedding the configurator on popular
            platforms. Copy the embed code from the{" "}
            <button
              type="button"
              onClick={() => setActiveTab("iframe")}
              className="text-orange-400 hover:underline font-medium"
            >
              Embed Code
            </button>{" "}
            tab first.
          </p>

          {platforms.map((platform) => (
            <div
              key={platform.id}
              className="bg-slate-800/50 border border-slate-700/50 rounded-xl overflow-hidden"
            >
              <button
                onClick={() =>
                  setExpandedPlatform(
                    expandedPlatform === platform.id ? null : platform.id,
                  )
                }
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-slate-700/20 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xl">{platform.icon}</span>
                  <span className="text-white font-medium">
                    {platform.name}
                  </span>
                </div>
                {expandedPlatform === platform.id ? (
                  <ChevronDown className="w-4 h-4 text-gray-400" />
                ) : (
                  <ChevronRight className="w-4 h-4 text-gray-400" />
                )}
              </button>

              {expandedPlatform === platform.id && (
                <div className="px-5 pb-5 border-t border-slate-700/30">
                  <ol className="mt-4 space-y-3">
                    {platform.steps.map((step, i) => (
                      <li key={i} className="flex items-start gap-3">
                        <span className="w-6 h-6 rounded-full bg-orange-500/20 text-orange-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">
                          {i + 1}
                        </span>
                        <span className="text-sm text-gray-300">{step}</span>
                      </li>
                    ))}
                  </ol>
                  {platform.tip && (
                    <div className="mt-4 p-3 bg-slate-700/30 border border-slate-600/30 rounded-lg flex items-start gap-2">
                      <AlertCircle className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
                      <p className="text-xs text-gray-400">
                        <span className="font-medium text-blue-400">Tip:</span>{" "}
                        {platform.tip}
                      </p>
                    </div>
                  )}
                  {platform.snippet && (
                    <div className="mt-4 bg-slate-900/60 border border-slate-700/50 rounded-xl overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-700/30">
                        <span className="text-xs text-gray-400 font-mono">{platform.snippetLabel}</span>
                        <button
                          type="button"
                          onClick={() => handleCopy(platform.snippet!, `snippet-${platform.id}`)}
                          className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium transition-all ${
                            copied === `snippet-${platform.id}`
                              ? "bg-green-500/20 text-green-400"
                              : "bg-slate-700 text-gray-300 hover:bg-slate-600"
                          }`}
                        >
                          {copied === `snippet-${platform.id}` ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                          {copied === `snippet-${platform.id}` ? "Copied!" : "Copy"}
                        </button>
                      </div>
                      <pre className="p-4 text-xs text-gray-300 overflow-x-auto font-mono leading-relaxed max-h-80">
                        <code>{platform.snippet}</code>
                      </pre>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Fetch example code ──
const fetchExample = `// Fetch product details and display configuration options
const response = await fetch('/api/products/YOUR_PRODUCT_ID');
const { product } = await response.json();

console.log('Product:', product.name);
console.log('Parameters:', product.parameters);

// Calculate price with specific parameter values
const priceRes = await fetch('/api/products/YOUR_PRODUCT_ID/calculate-price', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    values: { length: 30, width: 20, height: 15 },
    quantity: 2
  })
});
const pricing = await priceRes.json();
console.log('Total:', pricing.total);

// Submit a quote request
const quoteRes = await fetch('/api/quotes', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    productId: 'YOUR_PRODUCT_ID',
    productName: product.name,
    parameters: { length: 30, width: 20, height: 15 },
    quantity: 2,
    customer: {
      name: 'John Smith',
      email: 'john@example.com',
      company: 'Acme Corp'
    }
  })
});
const quote = await quoteRes.json();
console.log('Quote ID:', quote.id);`;

// ── Webhook code examples ──
const webhookSubscribeExample = `# Register your server URL to receive events
curl -X POST YOUR_SERVER_URL/api/webhooks/subscribe \\
  -H "Content-Type: application/json" \\
  -d '{
    "url": "https://your-server.com/webhooks/sydeflow",
    "events": ["quote.created", "quote.status_changed"],
    "secret": "your-shared-secret"
  }'

# Response:
# {
#   "success": true,
#   "webhook": {
#     "id": "wh-1234-abc",
#     "url": "https://your-server.com/webhooks/sydeflow",
#     "events": ["quote.created", "quote.status_changed"],
#     "secret": "your-shared-secret"   ← store this securely
#   }
# }

# List active webhooks
curl YOUR_SERVER_URL/api/webhooks

# Remove a webhook
curl -X DELETE YOUR_SERVER_URL/api/webhooks/wh-1234-abc`;

const webhookVerifyExample = `// Node.js — verify the HMAC signature on incoming webhooks
const crypto = require('crypto');

app.post('/webhooks/sydeflow', express.raw({ type: 'application/json' }), (req, res) => {
  const signature = req.headers['x-sydeflow-signature']; // "sha256=abc123…"
  const secret    = process.env.SYDEFLOW_WEBHOOK_SECRET;

  const expected = 'sha256=' + crypto
    .createHmac('sha256', secret)
    .update(req.body)           // raw body buffer
    .digest('hex');

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return res.status(401).send('Invalid signature');
  }

  const { event, timestamp, data } = JSON.parse(req.body);

  if (event === 'quote.created') {
    console.log('New quote from', data.customer.email, '— total:', data.pricing.totalPrice);
    // → Create Shopify draft order, update CRM, send Slack notification…
  }

  res.sendStatus(200); // Always respond 200 quickly
});`;

const webhookPayloadExample = `// POST to your registered URL
// Headers:
//   Content-Type: application/json
//   X-SydeFlow-Event: quote.created
//   X-SydeFlow-Signature: sha256=<hmac-sha256-of-body>
//   X-SydeFlow-Timestamp: 2025-03-10T14:32:11.000Z
//   User-Agent: SydeFlow-Webhooks/1.0

{
  "event": "quote.created",
  "timestamp": "2025-03-10T14:32:11.000Z",
  "data": {
    "quoteId": "quote-1741617131-x7k2m9",
    "productId": "prod-bracket-v3",
    "productName": "Custom Mounting Bracket",
    "customer": {
      "name": "Jane Smith",
      "email": "jane@acme.com",
      "company": "Acme Corp"
    },
    "pricing": {
      "totalPrice": 249.00,
      "currency": "USD",
      "breakdown": [{ "label": "Base price", "amount": 200 }, { "label": "Custom finish", "amount": 49 }]
    },
    "quantity": 2,
    "status": "new",
    "createdAt": "2025-03-10T14:32:11.000Z"
  }
}`;
