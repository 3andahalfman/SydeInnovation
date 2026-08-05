const express = require('express');
const router = express.Router();
const { QuotesStore } = require('../db');
const { sendQuoteEmails } = require('../services/email');
const { fireWebhook } = require('./Webhooks');

// ─── POST /api/quotes — Submit a new quote (customer-facing) ─────────────────
router.post('/', async (req, res) => {
    try {
        const { productId, productName, configuration, pricing, customer, quantity } = req.body;
        if (!productId || !customer?.email) {
            return res.status(400).json({ success: false, error: 'Product ID and customer email are required' });
        }

        const quote = {
            id: `quote-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
            productId,
            productName: productName || 'Unknown Product',
            configuration: configuration || {},
            pricing: pricing || {},
            quantity: quantity || 1,
            customer: {
                name: customer.name || '',
                email: customer.email,
                phone: customer.phone || '',
                company: customer.company || '',
                notes: customer.notes || '',
            },
            status: 'new',
            adminNotes: '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
        };

        await QuotesStore.save(quote);

        // Non-blocking email notifications
        sendQuoteEmails(quote).catch(err => console.error('Quote email error:', err));

        // Non-blocking webhook dispatch
        fireWebhook('quote.created', {
            quoteId: quote.id,
            productId: quote.productId,
            productName: quote.productName,
            customer: { name: quote.customer.name, email: quote.customer.email, company: quote.customer.company },
            pricing: quote.pricing,
            quantity: quote.quantity,
            status: quote.status,
            createdAt: quote.createdAt,
        }).catch(err => console.error('Webhook dispatch error:', err));

        // Real-time notification to admin console
        global.socketIO?.emit('activity', {
            type: 'quote',
            status: 'new',
            message: `New quote request from ${customer.name || customer.email}`,
            productName,
            quoteId: quote.id,
            timestamp: quote.createdAt,
        });
        global.socketIO?.emit('quote-received', quote);

        res.status(201).json({ success: true, quote: { id: quote.id, status: quote.status } });
    } catch (error) {
        console.error('Error creating quote:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── GET /api/quotes — List all quotes (admin) ───────────────────────────────
router.get('/', async (req, res) => {
    try {
        const { status, productId, limit, offset } = req.query;
        let quotes = await QuotesStore.getAll({ status, productId });

        const total = quotes.length;
        const off = parseInt(offset) || 0;
        const lim = parseInt(limit) || 50;
        quotes = quotes.slice(off, off + lim);

        res.json({ success: true, quotes, total, offset: off, limit: lim });
    } catch (error) {
        console.error('Error fetching quotes:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── GET /api/quotes/stats — Quote statistics (admin dashboard) ──────────────
router.get('/stats', async (req, res) => {
    try {
        const quotes = await QuotesStore.getAll();
        const stats = {
            total: quotes.length,
            new: quotes.filter(q => q.status === 'new').length,
            contacted: quotes.filter(q => q.status === 'contacted').length,
            quoted: quotes.filter(q => q.status === 'quoted').length,
            won: quotes.filter(q => q.status === 'won').length,
            lost: quotes.filter(q => q.status === 'lost').length,
            totalValue: quotes.reduce((sum, q) => sum + (q.pricing?.totalPrice || 0), 0),
            wonValue: quotes.filter(q => q.status === 'won').reduce((sum, q) => sum + (q.pricing?.totalPrice || 0), 0),
        };
        res.json({ success: true, stats });
    } catch (error) {
        console.error('Error fetching quote stats:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── GET /api/quotes/:id — Single quote detail (admin) ───────────────────────
router.get('/:id', async (req, res) => {
    try {
        const quote = await QuotesStore.getById(req.params.id);
        if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });
        res.json({ success: true, quote });
    } catch (error) {
        console.error('Error fetching quote:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── PUT /api/quotes/:id/status — Update quote status (admin) ───────────────
router.put('/:id/status', async (req, res) => {
    try {
        const { status, adminNotes } = req.body;
        const validStatuses = ['new', 'contacted', 'quoted', 'won', 'lost'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ success: false, error: `Invalid status. Must be one of: ${validStatuses.join(', ')}` });
        }

        const quote = await QuotesStore.getById(req.params.id);
        if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });

        quote.status = status;
        if (adminNotes !== undefined) quote.adminNotes = adminNotes;
        quote.updatedAt = new Date().toISOString();

        await QuotesStore.save(quote);

        // Non-blocking webhook dispatch
        fireWebhook('quote.status_changed', {
            quoteId: quote.id,
            productId: quote.productId,
            status: quote.status,
            updatedAt: quote.updatedAt,
        }).catch(err => console.error('Webhook dispatch error:', err));

        res.json({ success: true, quote });
    } catch (error) {
        console.error('Error updating quote status:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

// ─── DELETE /api/quotes/:id — Delete a quote (admin) ────────────────────────
router.delete('/:id', async (req, res) => {
    try {
        const quote = await QuotesStore.getById(req.params.id);
        if (!quote) return res.status(404).json({ success: false, error: 'Quote not found' });
        await QuotesStore.delete(req.params.id);
        res.json({ success: true, message: 'Quote deleted' });
    } catch (error) {
        console.error('Error deleting quote:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});

module.exports = router;
