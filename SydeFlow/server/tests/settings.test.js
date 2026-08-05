/**
 * Settings API Tests
 * Tests for /api/settings endpoints
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
    console.log('\n🧪 Running Settings API Tests...\n');
    let passed = 0;
    let failed = 0;

    // Test 1: GET /api/settings - should return settings with masked secret
    try {
        const res = await request('GET', '/api/settings');
        assert.strictEqual(res.status, 200, 'Should return 200');
        assert.ok(res.data.hasOwnProperty('hasClientId'), 'Should have hasClientId');
        assert.ok(res.data.hasOwnProperty('hasClientSecret'), 'Should have hasClientSecret');
        // Secret should be masked
        if (res.data.apsClientSecret && res.data.apsClientSecret !== '') {
            assert.ok(res.data.apsClientSecret.includes('••'), 'Secret should be masked');
        }
        console.log('✅ GET /api/settings - returns masked settings');
        passed++;
    } catch (err) {
        console.log('❌ GET /api/settings -', err.message);
        failed++;
    }

    // Test 2: GET /api/settings/status - should return connection status
    try {
        const res = await request('GET', '/api/settings/status');
        assert.strictEqual(res.status, 200, 'Should return 200');
        assert.ok(res.data.hasOwnProperty('hasCredentials'), 'Should have hasCredentials');
        console.log('✅ GET /api/settings/status - returns connection status');
        passed++;
    } catch (err) {
        console.log('❌ GET /api/settings/status -', err.message);
        failed++;
    }

    // Test 3: POST /api/settings with empty credentials - should fail validation
    try {
        const res = await request('POST', '/api/settings', {
            apsClientId: '',
            apsClientSecret: ''
        });
        // Should either return 400 or save empty (depends on implementation)
        assert.ok([200, 400].includes(res.status), 'Should handle empty credentials');
        console.log('✅ POST /api/settings - handles empty credentials');
        passed++;
    } catch (err) {
        console.log('❌ POST /api/settings -', err.message);
        failed++;
    }

    // Test 4: GET /api/settings/test - should test APS connection
    try {
        const res = await request('GET', '/api/settings/test');
        assert.ok([200, 401, 503].includes(res.status), 'Should return valid status');
        assert.ok(res.data.hasOwnProperty('success') || res.data.hasOwnProperty('connected') || res.data.hasOwnProperty('diagnostic'), 
            'Should have connection result');
        console.log('✅ GET /api/settings/test - tests APS connection');
        passed++;
    } catch (err) {
        console.log('❌ GET /api/settings/test -', err.message);
        failed++;
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
