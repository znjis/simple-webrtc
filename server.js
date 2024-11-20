const http = require('http');
const express = require('express');
const app = express();
const server = http.createServer(app);
const socket = require('socket.io');
const io = socket(server);


const rooms = {};

io.on('connection', socket => {
    socket.on('join-room', roomId => {
        if (rooms[roomId]) {
            rooms[roomId].push(socket.id);
        } else {
            rooms[roomId] = [socket.id];
        }

        const otherUser = rooms[roomId].find(id => id !== socket.id);
        if (otherUser) {
            socket.emit("There is another user", otherUser);
            socket.to(otherUser).emit("A user joined", socket.id);
        }
    });

    socket.on('offer', payload => {
        io.to(payload.target).emit('offer', payload);
    });

    socket.on('answer', payload => {
        io.to(payload.target).emit('answer', paylaod);
    });

    socket.on('ice-candidate', incoming => {
        io.to(incoming.target).emit('ice-candidate', incoming.candidate);
    });
})


servre.listen(8000, () => console.log('server is listening on port 8000'));