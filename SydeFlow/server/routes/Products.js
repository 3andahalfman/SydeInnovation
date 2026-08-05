const express = require("express");
const router = express.Router();
const { verifyToken } = require("../middleware/auth");
const { Users } = require("./Users");
const { ProductsStore } = require("../db");

// ─── Shared transform: flatten a raw product object for frontend consumption ──
function transformProduct(p) {
  return {
    id: p.id,
    name: p.name,
    description: p.description || "",
    category: p.category || "",
    status: p.status || "draft",
    owner: p.owner || "Admin",
    source: p.source || (p.ossBucket ? "oss" : null),
    sourceFile: p.ossBucket
      ? { bucketKey: p.ossBucket, objectKey: p.ossObjectKey, fileName: p.ossObjectKey }
      : p.sourceFile || null,
    activityId: p.activityId || p.automation?.activityId || null,
    parameters: p.parameters || [],
    properties: p.properties || null,
    lastOutputUrn: p.lastOutputUrn || null,
    drawingFile: p.drawingFile || null,
    automation: p.automation || null,
    pricing: p.pricing || null,
    configuratorLayout: p.configuratorLayout || null,
    createdAt: p.createdAt || new Date().toISOString(),
    updatedAt: p.updatedAt || new Date().toISOString(),
  };
}

// ─── GET /api/products ────────────────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    let userRole = "user";
    let userId = null;
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = verifyToken(authHeader.substring(7));
        if (decoded) {
          if (decoded.role) userRole = decoded.role;
          if (decoded.id) userId = decoded.id;
        }
      } catch (_) { /* invalid token — treat as unauthenticated */ }
    }

    let rawProducts = await ProductsStore.getAll();

    // Admins see everything; others see test products + their own
    if (userRole !== "admin") {
      const testProducts = rawProducts.filter(p => p.status === "test").slice(0, 2);
      const userProducts = userId
        ? rawProducts.filter(p => (p.ownerId === userId || p.owner === userId) && p.status !== "test")
        : [];
      const seen = new Set();
      rawProducts = [...testProducts, ...userProducts].filter(p => {
        if (seen.has(p.id)) return false;
        seen.add(p.id);
        return true;
      });
    }

    res.json({ success: true, products: rawProducts.map(transformProduct) });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /api/products/:id ────────────────────────────────────────────────────
router.get("/:id", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    res.json({ success: true, product: transformProduct(product) });
  } catch (error) {
    console.error("Error fetching product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /api/products ───────────────────────────────────────────────────────
router.post("/", async (req, res) => {
  console.log(`[${new Date().toISOString()}] POST /api/products`);
  try {
    let userId = "Admin";
    let ownerName = "Admin";
    const authHeader = req.headers.authorization;
    if (authHeader?.startsWith("Bearer ")) {
      try {
        const decoded = verifyToken(authHeader.substring(7));
        if (decoded?.id) {
          userId = decoded.id;
          const { data: user } = await Users.getById(userId);
          ownerName = user?.full_name || decoded.email?.split("@")[0] || "User";
        }
      } catch (_) { /* invalid token */ }
    }

    const { name, description, category } = req.body;
    if (!name?.trim()) return res.status(400).json({ success: false, error: "Product name is required" });

    const now = new Date().toISOString();
    const newProduct = {
      id: `product-${Date.now()}`,
      name: name.trim(),
      description: description?.trim() || "",
      category: category || "",
      status: "draft",
      owner: ownerName,
      ownerId: userId,
      source: null,
      sourceFile: null,
      ossBucket: null,
      ossObjectKey: null,
      activityId: null,
      parameters: [],
      createdAt: now,
      updatedAt: now,
    };

    await ProductsStore.save(newProduct);

    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:created", {
        title: "Product Created",
        message: `New product "${name}" created successfully`,
        details: { productId: newProduct.id, productName: name, category },
      });
    } catch (err) {
      console.error("logActivity error:", err.message);
    }

    res.json({ success: true, product: transformProduct(newProduct) });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PUT /api/products/:id ────────────────────────────────────────────────────
router.put("/:id", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    const {
      name, description, category, status, sourceFile, activityId, parameters,
      owner, source, lastOutputUrn, categories, subcategories, functions,
      sku, quantityPerSku, productImage, pricing, drawingFile, automation,
    } = req.body;

    if (name !== undefined) product.name = name.trim();
    if (description !== undefined) product.description = description.trim();
    if (category !== undefined) product.category = category;
    if (status !== undefined) product.status = status;
    if (owner !== undefined) product.owner = owner;
    if (activityId !== undefined) product.activityId = activityId;
    if (parameters !== undefined) product.parameters = parameters;
    if (req.body.properties !== undefined) product.properties = req.body.properties;
    if (lastOutputUrn !== undefined) product.lastOutputUrn = lastOutputUrn;
    if (categories !== undefined) product.categories = categories;
    if (subcategories !== undefined) product.subcategories = subcategories;
    if (functions !== undefined) product.functions = functions;
    if (sku !== undefined) product.sku = sku;
    if (quantityPerSku !== undefined) product.quantityPerSku = quantityPerSku;
    if (productImage !== undefined) product.productImage = productImage;
    if (pricing !== undefined) product.pricing = pricing;
    if (drawingFile !== undefined) product.drawingFile = drawingFile;
    if (automation !== undefined) product.automation = { ...(product.automation || {}), ...automation };
    if (sourceFile !== undefined) {
      product.sourceFile = sourceFile;
      product.ossBucket = sourceFile?.bucketKey || null;
      product.ossObjectKey = sourceFile?.objectKey || null;
      product.source = sourceFile?.bucketKey ? "oss" : null;
    }
    if (source !== undefined) product.source = source;
    product.updatedAt = new Date().toISOString();

    await ProductsStore.save(product);

    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:updated", {
        title: "Product Updated",
        message: `Product "${product.name}" updated successfully`,
        details: { productId: product.id, productName: product.name, status },
      });
    } catch (_) { /* silently ignore */ }

    res.json({ success: true, product: transformProduct(product) });
  } catch (error) {
    console.error("Error updating product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PATCH /api/products/:id — partial update ─────────────────────────────────
router.patch("/:id", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    Object.assign(product, req.body);
    product.updatedAt = new Date().toISOString();
    await ProductsStore.save(product);
    res.json({ success: true, product: transformProduct(product) });
  } catch (error) {
    console.error("Error patching product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DELETE /api/products/:id ─────────────────────────────────────────────────
router.delete("/:id", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    await ProductsStore.delete(req.params.id);
    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:deleted", {
        title: "Product Deleted",
        message: `Product "${product.name}" has been deleted`,
        details: { productId: req.params.id, productName: product.name },
      });
    } catch (_) { /* silently ignore */ }
    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    console.error("Error deleting product:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /api/products/:id/parameters ───────────────────────────────────────
router.post("/:id/parameters", async (req, res) => {
  try {
    const { parameters } = req.body;
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    product.parameters = parameters || [];
    product.updatedAt = new Date().toISOString();
    await ProductsStore.save(product);
    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:updated", {
        title: "Parameters Updated",
        message: `Parameters updated for "${product.name}" (${(parameters || []).length} parameters)`,
        details: { productId: req.params.id, parameterCount: (parameters || []).length },
      });
    } catch (_) { /* silently ignore */ }
    res.json({ success: true, parameters: product.parameters });
  } catch (error) {
    console.error("Error saving parameters:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /api/products/:id/pricing ───────────────────────────────────────────
router.get("/:id/pricing", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    res.json({ success: true, pricing: product.pricing || { basePrice: 0, currency: "USD", showPrice: false } });
  } catch (error) {
    console.error("Error fetching pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PUT /api/products/:id/pricing ───────────────────────────────────────────
router.put("/:id/pricing", async (req, res) => {
  try {
    const { pricing } = req.body;
    if (!pricing) return res.status(400).json({ success: false, error: "Pricing config is required" });
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    product.pricing = pricing;
    product.updatedAt = new Date().toISOString();
    await ProductsStore.save(product);
    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:updated", {
        title: "Pricing Updated",
        message: `Pricing configured for "${product.name}"`,
        details: { productId: req.params.id, basePrice: pricing.basePrice, currency: pricing.currency },
      });
    } catch (_) { /* silently ignore */ }
    res.json({ success: true, pricing });
  } catch (error) {
    console.error("Error saving pricing:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /api/products/:id/calculate-price ───────────────────────────────────
router.post("/:id/calculate-price", async (req, res) => {
  try {
    const { values = {}, quantity } = req.body;
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    const pricing = product.pricing;
    if (!pricing) return res.json({ success: true, currency: "USD", unitPrice: 0, quantity: 1, totalPrice: 0, breakdown: [] });

    const breakdown = [];
    let total = pricing.basePrice || 0;
    breakdown.push({ label: "Base price", amount: pricing.basePrice || 0 });

    const rules = pricing.parameterRules || {};
    for (const [paramName, rule] of Object.entries(rules)) {
      if (rule.type === "none") continue;
      const val = values[paramName];
      const param = (product.parameters || []).find(p => p.name === paramName);
      const label = (param && (param.displayName || param.name)) || paramName;

      if (rule.type === "per-unit" && typeof val === "number" && rule.value) {
        const amount = val * rule.value;
        breakdown.push({ label, amount });
        total += amount;
      } else if (rule.type === "fixed" && rule.value) {
        breakdown.push({ label, amount: rule.value });
        total += rule.value;
      } else if (rule.type === "multiplier" && rule.value) {
        const mult = (rule.value - 1) * total;
        breakdown.push({ label: `${label} (x${rule.value})`, amount: mult });
        total *= rule.value;
      } else if (rule.type === "option-based" && rule.optionPrices) {
        const optPrice = rule.optionPrices[String(val)] || 0;
        if (optPrice !== 0) {
          breakdown.push({ label: `${label}: ${val}`, amount: optPrice });
          total += optPrice;
        }
      }
    }

    if (pricing.setupFee && pricing.setupFee > 0) {
      breakdown.push({ label: "Setup fee", amount: pricing.setupFee });
      total += pricing.setupFee;
    }

    const qty = quantity || 1;
    res.json({ success: true, currency: pricing.currency, unitPrice: Math.max(0, total), quantity: qty, totalPrice: Math.max(0, total) * qty, breakdown });
  } catch (error) {
    console.error("Error calculating price:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── GET /api/products/:id/layout ────────────────────────────────────────────
router.get("/:id/layout", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    if (product.configuratorLayout) {
      res.json({ success: true, layout: product.configuratorLayout });
    } else {
      const parameterNames = (product.parameters || []).map(p => p.name || p.inventorName);
      res.json({ success: true, layout: createDefaultLayout(parameterNames), isDefault: true });
    }
  } catch (error) {
    console.error("Error fetching layout:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PUT /api/products/:id/layout ────────────────────────────────────────────
router.put("/:id/layout", async (req, res) => {
  try {
    const { layout } = req.body;
    if (!layout) return res.status(400).json({ success: false, error: "Layout is required" });
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    product.configuratorLayout = layout;
    product.updatedAt = new Date().toISOString();
    await ProductsStore.save(product);
    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:updated", {
        title: "Layout Saved",
        message: `Configurator layout saved for "${product.name}"`,
        details: { productId: req.params.id },
      });
    } catch (_) { /* silently ignore */ }
    res.json({ success: true, layout: product.configuratorLayout });
  } catch (error) {
    console.error("Error saving layout:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── DELETE /api/products/:id/layout ─────────────────────────────────────────
// Clears the saved configurator layout. The product itself is kept.
router.delete("/:id/layout", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    if (!product.configuratorLayout) {
      return res.json({ success: true, message: "No custom layout to delete" });
    }

    product.configuratorLayout = null;
    product.updatedAt = new Date().toISOString();
    await ProductsStore.save(product);

    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:updated", {
        title: "Layout Deleted",
        message: `Configurator layout deleted for "${product.name}"`,
        details: { productId: req.params.id },
      });
    } catch (_) { /* silently ignore */ }

    res.json({ success: true, message: "Layout deleted" });
  } catch (error) {
    console.error("Error deleting layout:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── PATCH /api/products/:id/status ──────────────────────────────────────────
// Must be defined on Products (Supabase store). Without this, the request falls
// through to DesignAutomation's separate JSON product store and returns 404.
router.patch("/:id/status", async (req, res) => {
  try {
    const { status } = req.body || {};
    if (!["draft", "testing", "live", "published", "archived"].includes(status)) {
      return res.status(400).json({
        success: false,
        diagnostic: "Invalid status. Must be draft, testing, live, published, or archived",
      });
    }

    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });

    product.status = status;
    product.updatedAt = new Date().toISOString();
    await ProductsStore.save(product);

    try {
      const ActivityLog = require("./ActivityLog");
      ActivityLog.logActivity("product:updated", {
        title: "Status Updated",
        message: `Product "${product.name}" status set to ${status}`,
        details: { productId: req.params.id, status },
      });
    } catch (_) { /* silently ignore */ }

    res.json({ success: true, product: transformProduct(product) });
  } catch (error) {
    console.error("Error updating product status:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── POST /api/products/:id/test ─────────────────────────────────────────────
// Runs Design Automation against the product's source file (Products store).
router.post("/:id/test", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, diagnostic: "Product not found" });

    const source = product.sourceFile
      || (product.ossBucket
        ? { bucketKey: product.ossBucket, objectKey: product.ossObjectKey }
        : null);
    const activityId = product.activityId || product.automation?.activityId;
    if (!source?.bucketKey || !source?.objectKey || !activityId) {
      return res.status(400).json({
        success: false,
        diagnostic: "Product not fully configured (missing source file or activity)",
      });
    }

    const port = process.env.APS_PORT || process.env.PORT || 8080;
    const response = await fetch(
      `http://localhost:${port}/api/aps/designautomation/workitems/from-oss`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bucketKey: source.bucketKey,
          objectKey: source.objectKey,
          activityName: activityId,
          parameters: req.body?.parameterValues || req.body?.parameters || {},
          browserConnectionId: req.body?.browserConnectionId,
        }),
      },
    );

    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      return res.status(response.status).json({
        success: false,
        diagnostic: data.diagnostic || data.error || "Failed to start test workitem",
      });
    }

    res.json({
      success: true,
      workItemId: data.workItemId,
      status: data.status || "pending",
      outputFileName: data.outputFile,
      bucket: data.bucket,
    });
  } catch (error) {
    console.error("Error testing product:", error);
    res.status(500).json({ success: false, diagnostic: error.message });
  }
});

// ─── GET /api/products/:id/download ──────────────────────────────────────────
// Returns a short-lived signed OSS download URL for the product's last output.
router.get("/:id/download", async (req, res) => {
  try {
    const product = await ProductsStore.getById(req.params.id);
    if (!product) return res.status(404).json({ success: false, error: "Product not found" });
    if (!product.lastOutputUrn) {
      return res.status(404).json({ success: false, error: "No output available yet. Run a configuration first." });
    }

    // Decode URN: base64(urn:adsk.objects:os.object:BUCKET/KEY)
    let decoded;
    try {
      const padded = product.lastOutputUrn + "=".repeat((4 - (product.lastOutputUrn.length % 4)) % 4);
      decoded = Buffer.from(padded, "base64").toString("utf8");
    } catch {
      return res.status(400).json({ success: false, error: "Invalid output URN stored on product" });
    }

    const match = decoded.match(/^urn:adsk\.objects:os\.object:([^/]+)\/(.+)$/);
    if (!match) return res.status(400).json({ success: false, error: "Could not parse output URN" });
    const [, bucketKey, objectKey] = match;

    const { getInternalToken } = require("./common/oauth");
    const ForgeAPI = require("forge-apis");
    const oauth = await getInternalToken();
    const objectsApi = new ForgeAPI.ObjectsApi();

    const response = await objectsApi.getS3DownloadURL(
      bucketKey, objectKey,
      { useAcceleration: false, minutesExpiration: 60 },
      oauth.client, oauth.credentials
    );

    const signedUrl = response.body?.url || response.body?.signedUrl;
    if (!signedUrl) return res.status(500).json({ success: false, error: "Failed to generate download URL" });

    res.json({ success: true, url: signedUrl, fileName: objectKey.split("/").pop() || "output.ipt", bucketKey, objectKey });
  } catch (error) {
    console.error("Error generating download URL:", error);
    const status = error?.response?.status || error?.statusCode;
    if (status === 404) {
      return res.status(404).json({
        success: false,
        error: "Output file no longer available (OSS objects may expire). Run the configurator again to regenerate.",
      });
    }
    res.status(500).json({ success: false, error: error.message });
  }
});

// ─── Helper: create default configurator layout ───────────────────────────────
function createDefaultLayout(parameters) {
  return {
    version: 1,
    sections: [
      {
        id: "default",
        label: "Parameters",
        collapsible: false,
        defaultExpanded: true,
        order: 0,
        parameters: parameters,
      },
    ],
    styling: {
      theme: "dark",
      accentColor: "#f97316",
      panelPosition: "right",
      panelWidth: "medium",
      sectionStyle: "card",
      controlSize: "normal",
    },
    actions: {
      primaryButton: { label: "Request Quote", action: "quote", style: "primary" },
      showResetButton: true,
    },
    unassignedParameters: [],
  };
}

module.exports = router;
