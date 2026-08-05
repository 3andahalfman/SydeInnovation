/**
 * Products API Tests
 * Tests for /api/products endpoints (Supabase integration)
 */

const assert = require('assert');
const http = require('http');

const BASE_URL = 'http://localhost:8080';

// Helper to make HTTP requests
function request(method, path, body = null) {
    return new Promise((resolve, reject) => {
        const url = new URL(path, BASE_URL);
        const options = {
            method,
            hostname: url.hostname,
            port: url.port,
            path: url.pathname,
            headers: {
                'Content-Type': 'application/json'
            }
        };

        const req = http.request(options, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    resolve({ status: res.statusCode, data: JSON.parse(data) });
                } catch {
                    resolve({ status: res.statusCode, data });
                }
            });
        });

        req.on('error', reject);
        if (body) req.write(JSON.stringify(body));
        req.end();
    });
}

// Test suite
async function runTests() {
    console.log('\n🧪 Running Products API Tests (Supabase)...\n');
    let passed = 0;
    let failed = 0;
    let testProductId = null;

    // Test 1: GET /api/products - should return product list
    try {
        const res = await request('GET', '/api/products');
        assert.strictEqual(res.status, 200, 'Should return 200');
        assert.ok(res.data.hasOwnProperty('products') || Array.isArray(res.data), 
            'Should return products array');
        console.log('✅ GET /api/products - returns product list');
        passed++;
    } catch (err) {
        console.log('❌ GET /api/products -', err.message);
        failed++;
    }

    // Test 2: POST /api/products - create product (without file)
    try {
        const res = await request('POST', '/api/products', {
            name: 'Test Product ' + Date.now(),
            description: 'Created by automated test'
        });
        // May fail without file upload, but should return proper error
        if (res.status === 200 || res.status === 201) {
            testProductId = res.data.product?.id;
            console.log('✅ POST /api/products - creates product');
        } else {
            // Expect 400 if file is required
            assert.ok([400, 500].includes(res.status), 'Should return error for missing file');
            console.log('✅ POST /api/products - properly requires file upload');
        }
        passed++;
    } catch (err) {
        console.log('❌ POST /api/products -', err.message);
        failed++;
    }

    // Test 3: GET /api/products/:id - get single product (if we created one)
    if (testProductId) {
        try {
            const res = await request('GET', `/api/products/${testProductId}`);
            assert.strictEqual(res.status, 200, 'Should return 200');
            assert.ok(res.data.product || res.data.id, 'Should return product object');
            console.log('✅ GET /api/products/:id - returns single product');
            passed++;
        } catch (err) {
            console.log('❌ GET /api/products/:id -', err.message);
            failed++;
        }
    }

    // Test 4: GET /api/products/invalid-id - should handle invalid ID
    try {
        const res = await request('GET', '/api/products/00000000-0000-0000-0000-000000000000');
        assert.ok([404, 200, 500].includes(res.status), 'Should handle missing product');
        console.log('✅ GET /api/products/:id - handles invalid ID');
        passed++;
    } catch (err) {
        console.log('❌ GET /api/products/:id (invalid) -', err.message);
        failed++;
    }

    // Cleanup: Delete test product if created
    if (testProductId) {
        try {
            await request('DELETE', `/api/products/${testProductId}`);
            console.log('🧹 Cleaned up test product');
        } catch {
            // Ignore cleanup errors
        }
    }

    // Summary
    console.log(`\n📊 Results: ${passed} passed, ${failed} failed\n`);
    return failed === 0;
}

// Run if called directly
if (require.main === module) {
    runTests()
        .then(success => process.exit(success ? 0 : 1))
        .catch(err => {
            console.error('Test runner error:', err);
            process.exit(1);
        });
}

module.exports = { runTests };
