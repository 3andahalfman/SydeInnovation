/**
 * Product Configuration Schema API Routes
 * Handles product schemas, pricing, validation, and Design Automation integration
 * for Autodesk Inventor models
 */

const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

// Paths
const SCHEMAS_DIR = path.join(__dirname, '../data/product-schemas');
const CONFIGURATIONS_FILE = path.join(__dirname, '../data/configurations.json');

// Ensure directories exist
function ensureDir(dirPath) {
    if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
    }
}

function ensureFile(filePath, defaultContent = '{}') {
    if (!fs.existsSync(filePath)) {
        fs.writeFileSync(filePath, defaultContent, 'utf8');
    }
}

ensureDir(SCHEMAS_DIR);
ensureFile(CONFIGURATIONS_FILE, JSON.stringify({ configurations: [] }, null, 2));

console.log('[ProductsConfig] Routes loaded');
console.log('[ProductsConfig] Schemas directory:', SCHEMAS_DIR);
const schemaFiles = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json'));
console.log('[ProductsConfig] Found schemas:', schemaFiles);

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Load a schema by ID
 */
function loadSchema(schemaId) {
    const files = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json'));
    for (const file of files) {
        const content = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
        if (content.productId === schemaId) {
            return content;
        }
    }
    return null;
}

/**
 * Calculate price based on schema and configuration
 */
function calculatePrice(schema, configuration, quantity = 1) {
    const pricing = schema.pricing;
    let basePrice = pricing.basePrice || 0;
    let materialMultiplier = 1;
    let optionPrices = 0;
    let calculations = {};

    // Process each parameter
    for (const param of schema.parameters) {
        const value = configuration[param.id];
        if (value === undefined) continue;

        // Handle material/option multipliers
        if (param.options) {
            if (Array.isArray(value)) {
                // Checkbox - multiple values
                for (const v of value) {
                    const opt = param.options.find(o => o.value === v);
                    if (opt) {
                        if (opt.priceAdd) optionPrices += opt.priceAdd;
                        if (opt.priceMultiplier) materialMultiplier *= opt.priceMultiplier;
                    }
                }
            } else {
                // Single selection
                const opt = param.options.find(o => o.value === value);
                if (opt) {
                    if (opt.priceAdd) optionPrices += opt.priceAdd;
                    if (opt.priceMultiplier && param.id === 'material') {
                        materialMultiplier = opt.priceMultiplier;
                    } else if (opt.priceMultiplier) {
                        materialMultiplier *= opt.priceMultiplier;
                    }
                }
            }
        }
    }

    // Calculate volume/surface based pricing
    let volumePrice = 0;
    let surfacePrice = 0;
    
    if (pricing.calculations) {
        const calc = pricing.calculations;
        
        // Volume calculation (for enclosures, boxes)
        if (calc.volume && calc.volumeRate) {
            const height = configuration.height || configuration.length || 100;
            const width = configuration.width || 100;
            const depth = configuration.depth || configuration.thickness || 50;
            const volume = height * width * depth;
            volumePrice = volume * calc.volumeRate;
            calculations.volume = volume;
            calculations.volumePrice = volumePrice;
        }
        
        // Surface area calculation (for brackets, plates)
        if (calc.surfaceArea && calc.surfaceRate) {
            const length = configuration.length || configuration.height || 100;
            const width = configuration.width || 100;
            const surfaceArea = length * width;
            surfacePrice = surfaceArea * calc.surfaceRate;
            calculations.surfaceArea = surfaceArea;
            calculations.surfacePrice = surfacePrice;
        }
    }

    // Apply material multiplier to base + volume/surface
    let subtotal = (basePrice + volumePrice + surfacePrice) * materialMultiplier + optionPrices;
    
    // Apply quantity discount
    let discountPercent = 0;
    if (pricing.discounts && quantity > 1) {
        for (const discount of pricing.discounts) {
            if (quantity >= discount.minQuantity) {
                discountPercent = discount.percentage;
            }
        }
    }
    
    const discount = subtotal * (discountPercent / 100);
    const unitPrice = subtotal - discount;
    const totalPrice = unitPrice * quantity;

    return {
        currency: pricing.currency || 'USD',
        unitPrice: Math.round(unitPrice * 100) / 100,
        quantity: quantity,
        totalPrice: Math.round(totalPrice * 100) / 100,
        breakdown: {
            basePrice: basePrice,
            volumePrice: Math.round(volumePrice * 100) / 100,
            surfacePrice: Math.round(surfacePrice * 100) / 100,
            materialMultiplier: materialMultiplier,
            optionPrices: optionPrices,
            subtotal: Math.round(subtotal * 100) / 100,
            discountPercent: discountPercent,
            discount: Math.round(discount * 100) / 100
        },
        calculations: calculations
    };
}

/**
 * Validate configuration against schema rules
 */
function validateConfiguration(schema, configuration) {
    const errors = [];
    const warnings = [];
    const appliedRules = [];
    const adjustedLimits = {};

    // Check required parameters have values
    for (const param of schema.parameters) {
        const value = configuration[param.id];
        if (value === undefined || value === null || value === '') {
            // Use default if available
            if (param.default !== undefined) {
                configuration[param.id] = param.default;
            }
        }
        
        // Validate numeric ranges
        if (param.type === 'slider' || param.type === 'number') {
            const numVal = parseFloat(value);
            if (param.min !== undefined && numVal < param.min) {
                errors.push({
                    parameter: param.id,
                    message: `${param.label} must be at least ${param.min}${param.unit || ''}`
                });
            }
            if (param.max !== undefined && numVal > param.max) {
                errors.push({
                    parameter: param.id,
                    message: `${param.label} must be at most ${param.max}${param.unit || ''}`
                });
            }
        }
    }

    // Evaluate rules
    if (schema.rules) {
        for (const rule of schema.rules) {
            try {
                // Build evaluation context from configuration
                const evalContext = { ...configuration };
                
                // Create a safe evaluation function
                const conditionFn = new Function(...Object.keys(evalContext), `return ${rule.condition};`);
                const conditionMet = conditionFn(...Object.values(evalContext));
                
                if (conditionMet) {
                    appliedRules.push({ id: rule.id, name: rule.name });
                    
                    for (const action of rule.actions) {
                        switch (action.type) {
                            case 'setMin':
                                if (!adjustedLimits[action.parameter]) {
                                    adjustedLimits[action.parameter] = {};
                                }
                                adjustedLimits[action.parameter].min = action.value;
                                break;
                                
                            case 'setMax':
                                if (!adjustedLimits[action.parameter]) {
                                    adjustedLimits[action.parameter] = {};
                                }
                                adjustedLimits[action.parameter].max = action.value;
                                break;
                                
                            case 'disable':
                                if (!adjustedLimits[action.parameter]) {
                                    adjustedLimits[action.parameter] = { disabled: [] };
                                }
                                if (!adjustedLimits[action.parameter].disabled) {
                                    adjustedLimits[action.parameter].disabled = [];
                                }
                                if (action.optionValue) {
                                    adjustedLimits[action.parameter].disabled.push(action.optionValue);
                                }
                                break;
                                
                            case 'hide':
                                if (!adjustedLimits[action.parameter]) {
                                    adjustedLimits[action.parameter] = {};
                                }
                                adjustedLimits[action.parameter].hidden = true;
                                break;
                                
                            case 'warn':
                                warnings.push({
                                    rule: rule.id,
                                    message: action.message || rule.message
                                });
                                break;
                                
                            case 'error':
                                errors.push({
                                    rule: rule.id,
                                    message: action.message || rule.message
                                });
                                break;
                        }
                    }
                }
            } catch (e) {
                console.error(`Error evaluating rule ${rule.id}:`, e);
            }
        }
    }

    return {
        valid: errors.length === 0,
        errors,
        warnings,
        appliedRules,
        adjustedLimits
    };
}

/**
 * Generate Inventor parameter JSON for Design Automation
 */
function generateInventorParams(schema, configuration) {
    const inventorParams = {};
    
    for (const param of schema.parameters) {
        if (param.inventorParam) {
            let value = configuration[param.id];
            
            // Handle different value types
            if (Array.isArray(value)) {
                // For checkboxes, join values or use count
                value = value.join(',');
            } else if (typeof value === 'boolean') {
                value = value ? 1 : 0;
            } else if (param.type === 'slider' || param.type === 'number') {
                value = parseFloat(value);
            }
            
            inventorParams[param.inventorParam] = value;
        }
    }
    
    return inventorParams;
}

// ============================================
// SCHEMA ROUTES
// ============================================

/**
 * GET /api/schemas
 * List all product schemas
 */
router.get('/', (req, res) => {
    try {
        const files = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json'));
        const schemas = files.map(file => {
            try {
                const content = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
                return {
                    id: content.productId,
                    name: content.name,
                    description: content.description,
                    category: content.category,
                    thumbnail: content.thumbnail,
                    status: content.metadata?.status || 'draft',
                    parameterCount: content.parameters?.length || 0,
                    hasRules: (content.rules?.length || 0) > 0,
                    hasPricing: !!content.pricing,
                    cadModel: content.cadModel
                };
            } catch (e) {
                console.error(`Error parsing schema ${file}:`, e);
                return null;
            }
        }).filter(s => s !== null);
        
        res.json(schemas);
    } catch (error) {
        console.error('Error listing schemas:', error);
        res.status(500).json({ error: 'Failed to list schemas' });
    }
});

/**
 * GET /api/schemas/:id
 * Get a specific schema
 */
router.get('/:id', (req, res) => {
    try {
        const schema = loadSchema(req.params.id);
        if (!schema) {
            return res.status(404).json({ error: 'Schema not found' });
        }
        res.json(schema);
    } catch (error) {
        console.error('Error loading schema:', error);
        res.status(500).json({ error: 'Failed to load schema' });
    }
});

/**
 * POST /api/schemas
 * Create a new schema
 */
router.post('/', (req, res) => {
    try {
        const schema = req.body;
        if (!schema.productId) {
            return res.status(400).json({ error: 'productId is required' });
        }
        
        // Check if schema already exists
        const existing = loadSchema(schema.productId);
        if (existing) {
            return res.status(409).json({ error: 'Schema with this ID already exists' });
        }
        
        // Add metadata
        schema.metadata = {
            ...schema.metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        
        const filePath = path.join(SCHEMAS_DIR, `${schema.productId}.json`);
        fs.writeFileSync(filePath, JSON.stringify(schema, null, 2), 'utf8');
        
        res.status(201).json(schema);
    } catch (error) {
        console.error('Error creating schema:', error);
        res.status(500).json({ error: 'Failed to create schema' });
    }
});

/**
 * PUT /api/schemas/:id
 * Update a schema
 */
router.put('/:id', (req, res) => {
    try {
        const schema = loadSchema(req.params.id);
        if (!schema) {
            return res.status(404).json({ error: 'Schema not found' });
        }
        
        const updated = {
            ...req.body,
            productId: req.params.id,
            metadata: {
                ...req.body.metadata,
                updatedAt: new Date().toISOString()
            }
        };
        
        const filePath = path.join(SCHEMAS_DIR, `${req.params.id}.json`);
        fs.writeFileSync(filePath, JSON.stringify(updated, null, 2), 'utf8');
        
        res.json(updated);
    } catch (error) {
        console.error('Error updating schema:', error);
        res.status(500).json({ error: 'Failed to update schema' });
    }
});

/**
 * DELETE /api/schemas/:id
 * Delete a schema
 */
router.delete('/:id', (req, res) => {
    try {
        const files = fs.readdirSync(SCHEMAS_DIR).filter(f => f.endsWith('.json'));
        for (const file of files) {
            const content = JSON.parse(fs.readFileSync(path.join(SCHEMAS_DIR, file), 'utf8'));
            if (content.productId === req.params.id) {
                fs.unlinkSync(path.join(SCHEMAS_DIR, file));
                return res.json({ success: true });
            }
        }
        res.status(404).json({ error: 'Schema not found' });
    } catch (error) {
        console.error('Error deleting schema:', error);
        res.status(500).json({ error: 'Failed to delete schema' });
    }
});

// ============================================
// CONFIGURATION ROUTES
// ============================================

/**
 * POST /api/schemas/:id/calculate-price
 * Calculate price for a configuration
 */
router.post('/:id/calculate-price', (req, res) => {
    try {
        const schema = loadSchema(req.params.id);
        if (!schema) {
            return res.status(404).json({ error: 'Schema not found' });
        }
        
        const { configuration, quantity = 1 } = req.body;
        const price = calculatePrice(schema, configuration, quantity);
        
        res.json(price);
    } catch (error) {
        console.error('Error calculating price:', error);
        res.status(500).json({ error: 'Failed to calculate price' });
    }
});

/**
 * POST /api/schemas/:id/validate
 * Validate a configuration against schema rules
 */
router.post('/:id/validate', (req, res) => {
    try {
        const schema = loadSchema(req.params.id);
        if (!schema) {
            return res.status(404).json({ error: 'Schema not found' });
        }
        
        const { configuration } = req.body;
        const validation = validateConfiguration(schema, configuration);
        
        res.json(validation);
    } catch (error) {
        console.error('Error validating configuration:', error);
        res.status(500).json({ error: 'Failed to validate configuration' });
    }
});

/**
 * POST /api/schemas/:id/inventor-params
 * Generate Inventor parameter JSON for Design Automation
 */
router.post('/:id/inventor-params', (req, res) => {
    try {
        const schema = loadSchema(req.params.id);
        if (!schema) {
            return res.status(404).json({ error: 'Schema not found' });
        }
        
        const { configuration } = req.body;
        const inventorParams = generateInventorParams(schema, configuration);
        
        res.json({
            schemaId: schema.productId,
            cadModel: schema.cadModel,
            parameters: inventorParams
        });
    } catch (error) {
        console.error('Error generating Inventor params:', error);
        res.status(500).json({ error: 'Failed to generate Inventor parameters' });
    }
});

/**
 * POST /api/schemas/:id/generate
 * Generate configured model via Design Automation
 * This creates a workitem to process the Inventor model
 */
router.post('/:id/generate', async (req, res) => {
    try {
        const schema = loadSchema(req.params.id);
        if (!schema) {
            return res.status(404).json({ error: 'Schema not found' });
        }
        
        const { configuration, outputFormat = 'ipt', browserConnectionId } = req.body;
        
        // Validate configuration first
        const validation = validateConfiguration(schema, configuration);
        if (!validation.valid) {
            return res.status(400).json({
                error: 'Invalid configuration',
                validation
            });
        }
        
        // Generate Inventor parameters
        const inventorParams = generateInventorParams(schema, configuration);
        
        // Calculate price for record
        const pricing = calculatePrice(schema, configuration);
        
        // Create configuration record
        const configId = `config_${Date.now()}`;
        const configRecord = {
            id: configId,
            schemaId: schema.productId,
            configuration,
            inventorParams,
            pricing,
            status: 'pending',
            createdAt: new Date().toISOString()
        };
        
        // Save configuration
        const configs = JSON.parse(fs.readFileSync(CONFIGURATIONS_FILE, 'utf8'));
        configs.configurations = configs.configurations || [];
        configs.configurations.push(configRecord);
        fs.writeFileSync(CONFIGURATIONS_FILE, JSON.stringify(configs, null, 2), 'utf8');
        
        // Return the configuration ready for Design Automation
        // The actual DA workitem should be created by calling the DA API
        res.json({
            success: true,
            configurationId: configId,
            schemaId: schema.productId,
            cadModel: schema.cadModel,
            inventorParams,
            pricing,
            message: 'Configuration created. Use /api/aps/workitems to start Design Automation job.',
            workitemPayload: {
                activityId: schema.cadModel?.activityId,
                inputFile: schema.cadModel?.inputFile,
                parameters: inventorParams,
                outputFormat: outputFormat,
                browserConnectionId
            }
        });
    } catch (error) {
        console.error('Error generating model:', error);
        res.status(500).json({ error: 'Failed to generate model' });
    }
});

/**
 * GET /api/schemas/configurations
 * List saved configurations
 */
router.get('/configurations/list', (req, res) => {
    try {
        const configs = JSON.parse(fs.readFileSync(CONFIGURATIONS_FILE, 'utf8'));
        res.json(configs.configurations || []);
    } catch (error) {
        console.error('Error listing configurations:', error);
        res.status(500).json({ error: 'Failed to list configurations' });
    }
});

/**
 * GET /api/schemas/configurations/:id
 * Get a specific configuration
 */
router.get('/configurations/:id', (req, res) => {
    try {
        const configs = JSON.parse(fs.readFileSync(CONFIGURATIONS_FILE, 'utf8'));
        const config = (configs.configurations || []).find(c => c.id === req.params.id);
        
        if (!config) {
            return res.status(404).json({ error: 'Configuration not found' });
        }
        
        res.json(config);
    } catch (error) {
        console.error('Error loading configuration:', error);
        res.status(500).json({ error: 'Failed to load configuration' });
    }
});

module.exports = router;
