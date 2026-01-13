// Load environment variables from parent directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

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
║   Landing Page:   http://localhost:${app.get('port')}                     ║
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
