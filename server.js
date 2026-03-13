const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

let rooms = {};

io.on('connection', (socket) => {
    socket.on('create-room', (config) => {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        // ボーナスマスの位置をホスト側で事前に決める
        const size = config.maxPlayers === 2 ? 8 : 12;
        let bonusPositions = [];
        while(bonusPositions.length < (config.maxPlayers * 4)) {
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
        const room = rooms[roomId.toUpperCase()];
        if (room && room.players.length < room.maxPlayers && !room.gameStarted) {
            room.players.push(socket.id);
            socket.join(roomId);
            const myIdx = room.players.length - 1;
            socket.emit('init', { roomId, myIdx, config: room });

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

    socket.on('sync-action', (data) => {
        socket.to(data.roomId).emit('receive-action', data);
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

server.listen(process.env.PORT || 3000);
