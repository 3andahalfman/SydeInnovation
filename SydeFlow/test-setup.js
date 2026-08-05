// Test setup endpoint
async function testSetup() {
    try {
        const response = await fetch('http://localhost:8080/api/extract-parameters/setup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ engine: 'Autodesk.Inventor+2024' })
        });
        const data = await response.json();
        console.log('Setup response:', JSON.stringify(data, null, 2));
    } catch (error) {
        console.error('Setup error:', error.message);
    }
}

testSetup();
