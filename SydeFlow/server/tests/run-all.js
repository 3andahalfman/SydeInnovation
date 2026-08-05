#!/usr/bin/env node
/**
 * SydeFlow Test Runner
 * Runs all API tests - requires server running on port 8080
 * 
 * Usage: node server/tests/run-all.js
 */

const settingsTests = require('./settings.test');
const productsTests = require('./products.test');

async function runAllTests() {
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║               SydeFlow API Test Suite                         ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log('\n⚠️  Ensure server is running: node server/start.js\n');

    const results = {
        settings: false,
        products: false
    };

    try {
        results.settings = await settingsTests.runTests();
    } catch (err) {
        console.error('Settings tests failed to run:', err.message);
    }

    try {
        results.products = await productsTests.runTests();
    } catch (err) {
        console.error('Products tests failed to run:', err.message);
    }

    // Final summary
    console.log('╔═══════════════════════════════════════════════════════════════╗');
    console.log('║                     Test Summary                              ║');
    console.log('╚═══════════════════════════════════════════════════════════════╝');
    console.log(`  Settings API: ${results.settings ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`  Products API: ${results.products ? '✅ PASS' : '❌ FAIL'}`);
    console.log('');

    const allPassed = Object.values(results).every(r => r);
    process.exit(allPassed ? 0 : 1);
}

runAllTests();
