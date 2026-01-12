//
// Socket.IO initialization for real-time workitem status updates
// SydeIngenis - SydeFlow Integration
//

module.exports = (app) => {
    const http = require('http').Server(app);
    const io = require('socket.io')(http, {
        cors: {
            origin: ["http://localhost:5173", "http://localhost:3000", "http://localhost:8080"],
            methods: ["GET", "POST"]
        }
    });
    
    // Make io globally accessible
    global.socketIO = io;
    app.io = io;

    let clients = 0;
    io.on('connection', (socket) => {
        clients++;
        console.log('Client connected. Total clients:', clients);

        // Whenever someone disconnects
        socket.on('disconnect', function () {
            clients--;
            console.log('Client disconnected. Total clients:', clients);
        });
    });

    return {
        http: http,
        io: io
    };
};
