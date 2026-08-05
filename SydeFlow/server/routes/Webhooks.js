/**
 * Webhook subscription management + outbound event dispatch.
 * Matches the Integration API documented in the admin console.
 */

const express = require('express');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

const router = express.Router();
const WEBHOOKS_FILE = path.join(__dirname, '../data/webhooks.json');

function loadWebhooks() {
    try {
        if (fs.existsSync(WEBHOOKS_FILE)) {
            return JSON.parse(fs.readFileSync(WEBHOOKS_FILE, 'utf8'));
        }
    } catch (err) {
        console.error('Failed to load webhooks.json:', err.message);
    }
    return [];
}

function saveWebhooks(webhooks) {
    fs.writeFileSync(WEBHOOKS_FILE, JSON.stringify(webhooks, null, 2), 'utf8');
}

function postJson(urlString, body, headers) {
    return new Promise((resolve, reject) => {
        let url;
        try {
            url = new URL(urlString);
        } catch (err) {
            return reject(err);
        }

        const payload = Buffer.from(body, 'utf8');
        const lib = url.protocol === 'https:' ? https : http;
        const req = lib.request(
            {
                protocol: url.protocol,
                hostname: url.hostname,
                port: url.port || (url.protocol === 'https:' ? 443 : 80),
                path: `${url.pathname}${url.search}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Content-Length': payload.length,
                    'User-Agent': 'SydeFlow-Webhooks/1.0',
                    ...headers
                },
                timeout: 10000
            },
            (res) => {
                res.resume();
                resolve(res.statusCode);
            }
        );

        req.on('error', reject);
        req.on('timeout', () => {
            req.destroy(new Error('Webhook request timed out'));
        });
        req.write(payload);
        req.end();
    });
}

/**
 * Dispatch an event to all matching webhook subscriptions.
 * @param {string} event
 * @param {Object} data
 * @returns {Promise<void>}
 */
async function fireWebhook(event, data) {
    const webhooks = loadWebhooks().filter(
        (wh) => Array.isArray(wh.events) && wh.events.includes(event) && wh.url
    );

    if (webhooks.length === 0) return;

    const timestamp = new Date().toISOString();
    const body = JSON.stringify({ event, timestamp, data });

    await Promise.all(
        webhooks.map(async (wh) => {
            try {
                const signature =
                    'sha256=' +
                    crypto.createHmac('sha256', wh.secret || '').update(body).digest('hex');

                await postJson(wh.url, body, {
                    'X-SydeFlow-Event': event,
                    'X-SydeFlow-Signature': signature,
                    'X-SydeFlow-Timestamp': timestamp
                });
            } catch (err) {
                console.error(`Webhook delivery failed for ${wh.id}:`, err.message);
            }
        })
    );
}

// GET /api/webhooks — list subscriptions
router.get('/', (req, res) => {
    const webhooks = loadWebhooks().map(({ secret, ...rest }) => ({
        ...rest,
        hasSecret: !!secret
    }));
    res.json({ success: true, webhooks });
});

// POST /api/webhooks/subscribe — register a webhook
router.post('/subscribe', (req, res) => {
    const { url, events, secret } = req.body || {};

    if (!url || typeof url !== 'string') {
        return res.status(400).json({ success: false, error: 'url is required' });
    }
    if (!Array.isArray(events) || events.length === 0) {
        return res.status(400).json({ success: false, error: 'events must be a non-empty array' });
    }

    try {
        // Validate URL shape early
        // eslint-disable-next-line no-new
        new URL(url);
    } catch {
        return res.status(400).json({ success: false, error: 'url must be a valid absolute URL' });
    }

    const webhook = {
        id: `wh-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        url,
        events,
        secret: secret || crypto.randomBytes(16).toString('hex'),
        createdAt: new Date().toISOString()
    };

    const webhooks = loadWebhooks();
    webhooks.push(webhook);
    saveWebhooks(webhooks);

    res.status(201).json({ success: true, webhook });
});

// DELETE /api/webhooks/:id — remove a subscription
router.delete('/:id', (req, res) => {
    const webhooks = loadWebhooks();
    const next = webhooks.filter((wh) => wh.id !== req.params.id);
    if (next.length === webhooks.length) {
        return res.status(404).json({ success: false, error: 'Webhook not found' });
    }
    saveWebhooks(next);
    res.json({ success: true, message: 'Webhook deleted' });
});

module.exports = router;
module.exports.fireWebhook = fireWebhook;
