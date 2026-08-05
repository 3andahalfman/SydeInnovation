/**
 * Supabase Database Operations Helper
 * Centralizes database operations with proper error handling
 */

const { supabase } = require('./supabase');

/**
 * Products CRUD Operations
 */
const Products = {
    /**
     * Get all products
     * @param {Object} options - Query options
     * @param {string} options.status - Filter by status
     * @param {number} options.limit - Limit results
     * @returns {Promise<{data: Array, error: Error|null}>}
     */
    async getAll(options = {}) {
        let query = supabase
            .from('products')
            .select('*')
            .order('created_at', { ascending: false });

        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        return { data: data || [], error };
    },

    /**
     * Get single product with parameters
     * @param {string} id - Product UUID
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async getById(id) {
        const { data, error } = await supabase
            .from('products')
            .select('*, product_parameters(*)')
            .eq('id', id)
            .single();
        return { data, error };
    },

    /**
     * Create new product
     * @param {Object} product - Product data
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async create(product) {
        const { data, error } = await supabase
            .from('products')
            .insert({
                name: product.name,
                description: product.description,
                local_path: product.localPath,
                oss_bucket_key: product.ossBucketKey,
                oss_object_key: product.ossObjectKey,
                oss_urn: product.ossUrn,
                storage_type: product.storageType || 'local',
                status: product.status || 'pending_extraction',
                app_bundle_id: product.appBundleId,
                activity_id: product.activityId
            })
            .select()
            .single();
        return { data, error };
    },

    /**
     * Update product
     * @param {string} id - Product UUID
     * @param {Object} updates - Fields to update
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async update(id, updates) {
        // Convert camelCase to snake_case for Supabase
        const snakeUpdates = {};
        if (updates.name) snakeUpdates.name = updates.name;
        if (updates.description) snakeUpdates.description = updates.description;
        if (updates.status) snakeUpdates.status = updates.status;
        if (updates.localPath) snakeUpdates.local_path = updates.localPath;
        if (updates.ossBucketKey) snakeUpdates.oss_bucket_key = updates.ossBucketKey;
        if (updates.ossObjectKey) snakeUpdates.oss_object_key = updates.ossObjectKey;
        if (updates.ossUrn) snakeUpdates.oss_urn = updates.ossUrn;
        if (updates.storageType) snakeUpdates.storage_type = updates.storageType;
        if (updates.appBundleId) snakeUpdates.app_bundle_id = updates.appBundleId;
        if (updates.activityId) snakeUpdates.activity_id = updates.activityId;

        const { data, error } = await supabase
            .from('products')
            .update(snakeUpdates)
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    /**
     * Delete product
     * @param {string} id - Product UUID
     * @returns {Promise<{error: Error|null}>}
     */
    async delete(id) {
        const { error } = await supabase
            .from('products')
            .delete()
            .eq('id', id);
        return { error };
    }
};

/**
 * Product Parameters Operations
 */
const Parameters = {
    /**
     * Save extracted parameters for a product
     * @param {string} productId - Product UUID
     * @param {Array} parameters - Array of parameter definitions
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async saveForProduct(productId, parameters) {
        // Delete existing parameters
        await supabase
            .from('product_parameters')
            .delete()
            .eq('product_id', productId);

        // Insert new parameters
        const rows = parameters.map((param, index) => ({
            product_id: productId,
            name: param.name,
            type: param.type || 'number',
            unit: param.unit,
            default_value: String(param.defaultValue),
            min_value: param.min,
            max_value: param.max,
            options: param.options,
            editable: param.editable !== false,
            display_name: param.displayName || param.name,
            description: param.description,
            display_order: index
        }));

        const { data, error } = await supabase
            .from('product_parameters')
            .insert(rows)
            .select();
        return { data, error };
    },

    /**
     * Get parameters for a product
     * @param {string} productId - Product UUID
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async getForProduct(productId) {
        const { data, error } = await supabase
            .from('product_parameters')
            .select('*')
            .eq('product_id', productId)
            .order('display_order', { ascending: true });
        return { data: data || [], error };
    }
};

/**
 * Configurations Operations
 */
const Configurations = {
    /**
     * Create new configuration
     * @param {Object} config - Configuration data
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async create(config) {
        const { data, error } = await supabase
            .from('configurations')
            .insert({
                product_id: config.productId,
                name: config.name || `Config-${Date.now()}`,
                parameters: config.parameters,
                status: 'pending'
            })
            .select()
            .single();
        return { data, error };
    },

    /**
     * Update configuration status
     * @param {string} id - Configuration UUID
     * @param {Object} updates - Status updates
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async updateStatus(id, updates) {
        const { data, error } = await supabase
            .from('configurations')
            .update({
                status: updates.status,
                work_item_id: updates.workItemId,
                output_url: updates.outputUrl,
                output_oss_key: updates.outputOssKey,
                error_message: updates.errorMessage,
                started_at: updates.startedAt,
                completed_at: updates.completedAt
            })
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    /**
     * Get configuration with product info
     * @param {string} id - Configuration UUID
     * @returns {Promise<{data: Object|null, error: Error|null}>}
     */
    async getById(id) {
        const { data, error } = await supabase
            .from('configurations')
            .select('*, products(*)')
            .eq('id', id)
            .single();
        return { data, error };
    },

    /**
     * List configurations
     * @param {Object} options - Query options
     * @returns {Promise<{data: Array|null, error: Error|null}>}
     */
    async list(options = {}) {
        let query = supabase
            .from('configurations')
            .select('*, products(name)')
            .order('created_at', { ascending: false });

        if (options.productId) {
            query = query.eq('product_id', options.productId);
        }
        if (options.status) {
            query = query.eq('status', options.status);
        }
        if (options.limit) {
            query = query.limit(options.limit);
        }

        const { data, error } = await query;
        return { data: data || [], error };
    }
};

/**
 * Health check for database connection
 * @returns {Promise<{connected: boolean, error: string|null}>}
 */
async function checkConnection() {
    try {
        const { error } = await supabase
            .from('products')
            .select('id')
            .limit(1);
        
        if (error) {
            return { connected: false, error: error.message };
        }
        return { connected: true, error: null };
    } catch (err) {
        return { connected: false, error: err.message };
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// ParamCache — parameter-hash-based regeneration cache
// Table: param_cache (id uuid PK, source_bucket, source_object_key, param_hash, ...)
// ─────────────────────────────────────────────────────────────────────────────
const ParamCache = {
    /**
     * Look up a cached result by source file + parameter hash
     */
    async findByHash(sourceBucket, sourceObjectKey, paramHash) {
        const { data, error } = await supabase
            .from('param_cache')
            .select('*')
            .eq('source_bucket', sourceBucket)
            .eq('source_object_key', sourceObjectKey)
            .eq('param_hash', paramHash)
            .single();
        if (error && error.code !== 'PGRST116') return { data: null, error }; // PGRST116 = no rows
        return { data: data || null, error: null };
    },

    /**
     * Create a new cache entry (status='pending') when starting a work item
     */
    async create({ sourceBucket, sourceObjectKey, paramHash, parameters, workItemId, outputBucket, outputObjectKey }) {
        const { data, error } = await supabase
            .from('param_cache')
            .insert({
                source_bucket: sourceBucket,
                source_object_key: sourceObjectKey,
                param_hash: paramHash,
                parameters,
                status: 'pending',
                work_item_id: workItemId,
                output_bucket: outputBucket,
                output_object_key: outputObjectKey
            })
            .select()
            .single();
        return { data, error };
    },

    /**
     * Mark cache entry as completed with output details
     */
    async markCompleted(id, { outputBucket, outputObjectKey, outputUrn }) {
        const { data, error } = await supabase
            .from('param_cache')
            .update({
                status: 'completed',
                output_bucket: outputBucket,
                output_object_key: outputObjectKey,
                output_urn: outputUrn,
                completed_at: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();
        return { data, error };
    },

    /**
     * Mark cache entry as failed
     */
    async markFailed(id, errorMessage) {
        const { error } = await supabase
            .from('param_cache')
            .update({
                status: 'failed',
                error_message: errorMessage,
                completed_at: new Date().toISOString()
            })
            .eq('id', id);
        return { error };
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Products (JSONB flat store) — used by routes/Products.js
// Table: products (id text PK, data jsonb, created_at, updated_at)
// ─────────────────────────────────────────────────────────────────────────────
const ProductsStore = {
    async getAll() {
        const { data, error } = await supabase
            .from('products')
            .select('id, data')
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        return (data || []).map(row => ({ id: row.id, ...row.data }));
    },
    async getById(id) {
        const { data, error } = await supabase
            .from('products')
            .select('id, data')
            .eq('id', id)
            .single();
        if (error) return null;
        return { id: data.id, ...data.data };
    },
    async save(product) {
        const { id, ...rest } = product;
        const { error } = await supabase
            .from('products')
            .upsert({ id, data: rest, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw new Error(error.message);
    },
    async delete(id) {
        const { error } = await supabase.from('products').delete().eq('id', id);
        if (error) throw new Error(error.message);
    }
};

// ─────────────────────────────────────────────────────────────────────────────
// Quotes (JSONB flat store) — used by routes/Quotes.js
// Table: quotes (id text PK, data jsonb, created_at, updated_at)
// ─────────────────────────────────────────────────────────────────────────────
const QuotesStore = {
    async getAll(filters = {}) {
        const { data, error } = await supabase
            .from('quotes')
            .select('id, data')
            .order('created_at', { ascending: false });
        if (error) throw new Error(error.message);
        let quotes = (data || []).map(row => ({ id: row.id, ...row.data }));
        if (filters.status) quotes = quotes.filter(q => q.status === filters.status);
        if (filters.productId) quotes = quotes.filter(q => q.productId === filters.productId);
        return quotes;
    },
    async getById(id) {
        const { data, error } = await supabase
            .from('quotes')
            .select('id, data')
            .eq('id', id)
            .single();
        if (error) return null;
        return { id: data.id, ...data.data };
    },
    async save(quote) {
        const { id, ...rest } = quote;
        const { error } = await supabase
            .from('quotes')
            .upsert({ id, data: rest, updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw new Error(error.message);
    },
    async delete(id) {
        const { error } = await supabase.from('quotes').delete().eq('id', id);
        if (error) throw new Error(error.message);
    }
};

module.exports = {
    Products,
    Parameters,
    Configurations,
    ParamCache,
    ProductsStore,
    QuotesStore,
    checkConnection,
    supabase  // Export raw client for advanced queries
};
