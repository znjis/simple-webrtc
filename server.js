const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);

const rooms = {};

io.on('connection', (socket) => {
    console.log(`New connection: ${socket.id}`);

    socket.on("join-room", (roomId) => {
        if (!roomId) {
            console.error("Room ID is missing");
            return;
        }

        if (rooms[roomId]) {
            rooms[roomId].push(socket.id);
        } else {
            rooms[roomId] = [socket.id];
        }

        console.log(`Room ${roomId} participants:`, rooms[roomId]);

        const otherUser = rooms[roomId].find((id) => id !== socket.id);
        if (otherUser) {
            socket.emit("other-user", otherUser);
            socket.to(otherUser).emit("user-joined", socket.id);
        }
    });

    socket.on('offer', (payload) => {
        io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', (payload) => {
        io.to(payload.target).emit('answer', payload);
    });

    socket.on('ice-candidate', (incoming) => {
        io.to(incoming.target).emit('ice-candidate', {
            candidate: incoming.candidate,
        });
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected: ${socket.id}`);
        for (const roomId in rooms) {
            rooms[roomId] = rooms[roomId].filter((id) => id !== socket.id);
            if (rooms[roomId].length === 0) {
                delete rooms[roomId];
            }
        }
    });
});

server.listen(8000, () => console.log('Server is listening on port 8000'));
