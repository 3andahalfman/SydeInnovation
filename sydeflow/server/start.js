// Load environment variables - try sydeflow folder first, then root
const path = require('path');
const fs = require('fs');
const sydeflowEnv = path.join(__dirname, '..', '.env');
const rootEnv = path.join(__dirname, '../..', '.env');
const envPath = fs.existsSync(sydeflowEnv) ? sydeflowEnv : rootEnv;
console.log('Loading .env from:', envPath);
require('dotenv').config({ path: envPath });

const app = require('./server');
const socketIO = require('./socket.io')(app);

// Global error handlers
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});

let server = socketIO.http.listen(app.get('port'), () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   SydeFlow - Design Automation Server                         ║
║   Powered by Autodesk Platform Services (APS)                 ║
║                                                               ║
║   Server listening on port ${app.get('port')}                             ║
║   Status Page:    http://localhost:${app.get('port')}                     ║
║   Admin Console:  http://localhost:${app.get('port')}/admin               ║
║   API Endpoint:   http://localhost:${app.get('port')}/api                 ║
║                                                               ║
╚═══════════════════════════════════════════════════════════════╝
    `);
});

server.on('error', (err) => {
    if (err.errno === 'EACCES') {
        console.error(`Port ${app.get('port')} already in use.\nExiting...`);
        process.exit(1);
    }
});
