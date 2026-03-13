const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);

// CORS対策（Render等での通信を安定させる）
const io = new Server(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (config) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const size = config.maxPlayers === 2 ? 8 : 12;
        let bonusPositions = [];
        // ボーナス位置をホスト側で一意に決定
        while(bonusPositions.length < (config.maxPlayers * 5)) {
            let r = Math.floor(Math.random() * size);
            let c = Math.floor(Math.random() * size);
            if (!bonusPositions.some(p => p.r === r && p.c === c)) {
                bonusPositions.push({r, c});
            }
        }

        rooms[roomId] = {
            maxPlayers: config.maxPlayers,
            useCards: config.useCards,
            bonusPositions: bonusPositions,
            players: [socket.id],
            gameStarted: false
        };
        socket.join(roomId);
        socket.emit('init', { roomId, myIdx: 0, config: rooms[roomId] });
    });

    socket.on('join-room', (roomId) => {
        const id = roomId.toUpperCase();
        const room = rooms[id];
        if (room && room.players.length < room.maxPlayers && !room.gameStarted) {
            room.players.push(socket.id);
            socket.join(id);
            const myIdx = room.players.length - 1;
            socket.emit('init', { roomId: id, myIdx, config: room });

            if (room.players.length === room.maxPlayers) {
                room.gameStarted = true;
                io.to(id).emit('game-start-broadcast');
            } else {
                io.to(id).emit('update-waiting', { current: room.players.length, max: room.maxPlayers });
            }
        } else {
            socket.emit('error-msg', 'ルームが見つからないか、満員です。');
        }
    });

    socket.on('sync-action', (data) => {
        // 重要：自分以外ではなく「全員」に送ることで、処理のタイミングを完全に一致させる
        io.to(data.roomId).emit('receive-action', data);
    });

    socket.on('disconnect', () => {
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
