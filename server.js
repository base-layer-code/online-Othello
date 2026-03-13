const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);

// Render等のプロキシ環境で安定させる設定
const io = new Server(server, {
    cors: { origin: "*" },
    transports: ['websocket', 'polling'] // 接続方式を安定させる
});

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    // --- 以前のロジックをここに貼り付け ---
    // (create-room, join-room, sync-action などのイベント)
});

// 重要：process.env.PORT を使わないとRenderでは動きません
const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Server is running on port ${PORT}`);
});
