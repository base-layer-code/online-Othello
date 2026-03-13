const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    // ホストがルームを作成
    socket.on('create-room', (config) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        rooms[roomId] = {
            maxPlayers: config.maxPlayers, // 2 or 3
            players: [socket.id],
            gameStarted: false
        };
        socket.join(roomId);
        socket.emit('init', { roomId, myIdx: 0, maxPlayers: config.maxPlayers });
    });

    // ゲストが既存のルームに参加
    socket.on('join-room', (roomId) => {
        const room = rooms[roomId];
        if (room && room.players.length < room.maxPlayers && !room.gameStarted) {
            room.players.push(socket.id);
            socket.join(roomId);
            const myIdx = room.players.length - 1;
            socket.emit('init', { roomId, myIdx, maxPlayers: room.maxPlayers });

            // 全員揃ったか確認
            if (room.players.length === room.maxPlayers) {
                room.gameStarted = true;
                io.to(roomId).emit('game-start-broadcast');
            } else {
                io.to(roomId).emit('update-waiting', { current: room.players.length, max: room.maxPlayers });
            }
        } else {
            socket.emit('error-msg', 'ルームが見つからないか、満員です。');
        }
    });

    // アクションの同期
    socket.on('sync-action', (data) => {
        socket.to(data.roomId).emit('receive-action', data);
    });

    socket.on('disconnect', () => {
        // ルームの削除処理（簡易版）
        for (let id in rooms) {
            if (rooms[id].players.includes(socket.id)) {
                io.to(id).emit('error-msg', 'プレイヤーが切断されました。');
                delete rooms[id];
            }
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
