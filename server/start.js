// Load environment variables from parent directory
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const app = require('./server');
const socketIO = require('./socket.io')(app);

let server = socketIO.http.listen(app.get('port'), () => {
    console.log(`
╔═══════════════════════════════════════════════════════════════╗
║                                                               ║
║   SydeFlow - Design Automation Server                         ║
║   Powered by Autodesk Platform Services (APS)                 ║
║                                                               ║
║   Server listening on port ${app.get('port')}                             ║
║   API Endpoint: http://localhost:${app.get('port')}/api                   ║
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
