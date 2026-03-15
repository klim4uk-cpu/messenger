const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

// Раздаём статические файлы из папки public
app.use(express.static(path.join(__dirname, 'public')));

// Хранилище сообщений (в памяти, заменим позже на БД)
let messages = [];
const users = new Map(); // userId -> username

io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    
    // Отправляем новому пользователю последние 50 сообщений
    socket.emit('load messages', messages.slice(-50));
    
    // Отправляем список пользователей онлайн
    io.emit('users online', Array.from(users.values()));
    
    // Обработка регистрации имени
    socket.on('set username', (username) => {
        users.set(socket.id, username);
        socket.broadcast.emit('user joined', username);
        io.emit('users online', Array.from(users.values()));
    });
    
    // Обработка новых сообщений
    socket.on('chat message', (data) => {
        const messageData = {
            id: Date.now() + Math.random(),
            text: data.text,
            user: data.user,
            time: new Date().toLocaleTimeString(),
            userId: socket.id
        };
        
        messages.push(messageData);
        
        // Ограничиваем историю до 500 сообщений
        if (messages.length > 500) {
            messages = messages.slice(-500);
        }
        
        // Рассылаем сообщение всем
        io.emit('chat message', messageData);
    });
    
    // Печатает сообщение (статус "печатает...")
    socket.on('typing', (data) => {
        socket.broadcast.emit('typing', data);
    });
    
    // Личные сообщения
    socket.on('private message', ({ to, message }) => {
        const fromUser = users.get(socket.id);
        const toSocket = [...users.entries()].find(([id, name]) => name === to)?.[0];
        
        if (toSocket) {
            io.to(toSocket).emit('private message', {
                from: fromUser,
                message: message,
                time: new Date().toLocaleTimeString()
            });
            
            // Отправляем подтверждение отправителю
            socket.emit('private message sent', {
                to: to,
                message: message,
                time: new Date().toLocaleTimeString()
            });
        } else {
            socket.emit('error', 'Пользователь не в сети');
        }
    });
    
    // Отключение пользователя
    socket.on('disconnect', () => {
        const username = users.get(socket.id);
        if (username) {
            users.delete(socket.id);
            io.emit('user left', username);
            io.emit('users online', Array.from(users.values()));
        }
        console.log('Пользователь отключился:', socket.id);
    });
});

const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Сервер запущен на http://localhost:${PORT}`);
});