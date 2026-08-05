const express = require('express');
const router = express.Router();
const { supabase } = require('../supabase');
const path = require('path');
const fs = require('fs');

// POST /api/configurations - Create a new configuration (user submits parameters)
router.post('/', async (req, res) => {
    try {
        const { product_id, parameters, name } = req.body;

        // Validate product exists
        const { data: product, error: productError } = await supabase
            .from('products')
            .select('*')
            .eq('id', product_id)
            .single();

        if (productError || !product) {
            return res.status(404).json({ success: false, error: 'Product not found' });
        }

        // Create configuration
        const { data: config, error } = await supabase
            .from('configurations')
            .insert({
                product_id,
                name: name || `Config-${Date.now()}`,
                parameters,
                status: 'pending'
            })
            .select()
            .single();

        if (error) throw error;

        // Log activity
        try {
            const ActivityLog = require('./ActivityLog');
            ActivityLog.logActivity('config:created', {
                title: 'Configuration Created',
                message: `New configuration "${name || 'Config-' + Date.now()}" created`,
                details: { configId: config.id, productId: product_id }
            });
        } catch (err) {
            // Silently fail
        }

        res.json({ 
            success: true, 
            configuration: config,
            message: 'Configuration created. Call /generate to start regeneration.'
        });
    } catch (error) {
        console.error('Error creating configuration:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/configurations - List all configurations
router.get('/', async (req, res) => {
    try {
        const { product_id } = req.query;

        // Avoid PostgREST embedded joins — products FK relationship is not
        // always present in the schema cache on this project.
        let query = supabase
            .from('configurations')
            .select('*')
            .order('created_at', { ascending: false });

        if (product_id) {
            query = query.eq('product_id', product_id);
        }

        const { data, error } = await query;

        if (error) throw error;
        res.json({ success: true, configurations: data || [] });
    } catch (error) {
        console.error('Error fetching configurations:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/configurations/:id - Get single configuration
router.get('/:id', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('configurations')
            .select('*')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;
        res.json({ success: true, configuration: data });
    } catch (error) {
        console.error('Error fetching configuration:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// POST /api/configurations/:id/generate - Start model regeneration
router.post('/:id/generate', async (req, res) => {
    try {
        const { getInternalToken } = require('./common/oauth');

        // Get configuration with product
        const { data: config, error: fetchError } = await supabase
            .from('configurations')
            .select('*, products(*)')
            .eq('id', req.params.id)
            .single();

        if (fetchError) throw fetchError;

        // Update status to processing
        await supabase
            .from('configurations')
            .update({ status: 'processing', started_at: new Date().toISOString() })
            .eq('id', req.params.id);

        // Get settings
        const settingsPath = path.join(__dirname, '../data/settings.json');
        const settings = JSON.parse(fs.readFileSync(settingsPath, 'utf8'));

        // Get OAuth token
        const oauth = await getInternalToken();

        // Create Design Automation work item
        // This would call the APS Design Automation API to:
        // 1. Download source model from OSS
        // 2. Apply parameters via iLogic
        // 3. Save regenerated model
        // 4. Upload output to OSS

        // For now, simulate the work item creation
        const workItemId = `WI-${Date.now()}`;

        // Update configuration with work item ID
        await supabase
            .from('configurations')
            .update({ work_item_id: workItemId })
            .eq('id', req.params.id);

        // Log activity
        try {
            const ActivityLog = require('./ActivityLog');
            ActivityLog.logActivity('config:generation:started', {
                title: 'Configuration Regeneration Started',
                message: `Generation started for configuration with work item ${workItemId}`,
                details: { configId: req.params.id, workItemId, productId: config.product_id }
            });
        } catch (err) {
            // Silently fail
        }

        res.json({ 
            success: true, 
            message: 'Regeneration started',
            workItemId,
            configuration: config
        });
    } catch (error) {
        console.error('Error starting generation:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/configurations/:id/status - Check generation status
router.get('/:id/status', async (req, res) => {
    try {
        const { data: config, error } = await supabase
            .from('configurations')
            .select('id, status, work_item_id, output_url, error_message, started_at, completed_at')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        // If processing, check work item status from APS
        if (config.status === 'processing' && config.work_item_id) {
            // Would poll APS Design Automation for work item status
            // For now, return current status
        }

        res.json({ success: true, ...config });
    } catch (error) {
        console.error('Error checking status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// GET /api/configurations/:id/download - Get download URL for output
router.get('/:id/download', async (req, res) => {
    try {
        const { data: config, error } = await supabase
            .from('configurations')
            .select('status, output_url, output_oss_key, products(oss_bucket_key)')
            .eq('id', req.params.id)
            .single();

        if (error) throw error;

        if (config.status !== 'completed') {
            return res.status(400).json({ 
                success: false, 
                error: 'Configuration not ready for download',
                status: config.status
            });
        }

        // If we have an OSS key, generate signed URL
        if (config.output_oss_key && config.products?.oss_bucket_key) {
            const { getInternalToken } = require('./common/oauth');
            const { ObjectsApi } = require('forge-apis');

            const oauth = await getInternalToken();
            const objectsApi = new ObjectsApi();

            // Create signed URL (valid for 5 minutes)
            const signedUrl = await objectsApi.createSignedResource(
                config.products.oss_bucket_key,
                config.output_oss_key,
                { minutesExpiration: 5 },
                { access: 'read' },
                oauth,
                oauth.credentials
            );

            return res.json({ 
                success: true, 
                downloadUrl: signedUrl.body.signedUrl 
            });
        }

        // Return stored URL
        res.json({ 
            success: true, 
            downloadUrl: config.output_url 
        });
    } catch (error) {
        console.error('Error getting download URL:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// DELETE /api/configurations/:id - Delete configuration
router.delete('/:id', async (req, res) => {
    try {
        // Fetch config details before deleting
        const { data: config } = await supabase
            .from('configurations')
            .select('*')
            .eq('id', req.params.id)
            .single();

        const { error } = await supabase
            .from('configurations')
            .delete()
            .eq('id', req.params.id);

        if (error) throw error;
        
        // Log activity
        try {
            const ActivityLog = require('./ActivityLog');
            ActivityLog.logActivity('config:deleted', {
                title: 'Configuration Deleted',
                message: `Configuration "${config?.name || req.params.id}" has been deleted`,
                details: { configId: req.params.id, configName: config?.name }
            });
        } catch (err) {
            // Silently fail
        }
        
        res.json({ success: true, message: 'Configuration deleted' });
    } catch (error) {
        console.error('Error deleting configuration:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
