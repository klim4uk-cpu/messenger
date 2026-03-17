const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
    maxHttpBufferSize: 50 * 1024 * 1024
});

// Мидлвары
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// ===== POSTGRESQL ПОДКЛЮЧЕНИЕ =====
const pool = new Pool({
    connectionString: process.env.DATABASE_URL || 'postgresql://messenger_user:Lg29ypGpcCGJRMAfUY6COcoHjzvB9vH6@dpg-d6smrrggjchc73buvc30-a/messenger_lgun',
    ssl: {
        rejectUnauthorized: false
    }
});

// ===== СОЗДАЕМ ТАБЛИЦЫ =====
async function initDb() {
    try {
        // Таблица пользователей
        await pool.query(`
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password VARCHAR(255) NOT NULL,
                avatar VARCHAR(10) DEFAULT '👤',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                last_seen TIMESTAMP
            );
        `);
        console.log('✅ Таблица users создана');

        // Таблица для сессий
        await pool.query(`
            CREATE TABLE IF NOT EXISTS "session" (
                "sid" varchar NOT NULL COLLATE "default",
                "sess" json NOT NULL,
                "expire" timestamp(6) NOT NULL
            )
            WITH (OIDS=FALSE);
        `);
        console.log('✅ Таблица session создана');

        // Добавляем первичный ключ если его нет
        await pool.query(`
            DO $$
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'session_pkey') THEN
                    ALTER TABLE "session" ADD CONSTRAINT "session_pkey" PRIMARY KEY ("sid");
                END IF;
            END $$;
        `);
        console.log('✅ Первичный ключ для session добавлен');

    } catch (err) {
        console.error('❌ Ошибка при создании таблиц:', err);
    }
}

initDb();

// ===== СЕССИИ С POSTGRESQL =====
app.use(session({
    store: new pgSession({
        pool: pool,
        tableName: 'session',
        createTableIfMissing: true
    }),
    secret: 'messenger-secret-key-123',
    resave: false,
    saveUninitialized: false,
    cookie: { maxAge: 30 * 24 * 60 * 60 * 1000 }
}));

// ===== РЕГИСТРАЦИЯ =====
app.post('/api/register', async (req, res) => {
    const { username, password } = req.body;
    
    if (!username || username.length < 3 || username.length > 20) {
        return res.json({ success: false, error: 'Ник должен быть 3-20 символов' });
    }
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        return res.json({ success: false, error: 'Только буквы, цифры и _' });
    }
    if (!password || password.length < 6) {
        return res.json({ success: false, error: 'Пароль минимум 6 символов' });
    }
    
    try {
        const hashedPassword = await bcrypt.hash(password, 10);
        
        await pool.query(
            'INSERT INTO users (username, password) VALUES ($1, $2)',
            [username, hashedPassword]
        );
        
        res.json({ success: true });
    } catch (err) {
        console.error('Register error:', err);
        if (err.constraint === 'users_username_key' || err.code === '23505') {
            res.json({ success: false, error: 'Ник уже занят' });
        } else {
            res.json({ success: false, error: 'Ошибка сервера' });
        }
    }
});

// ===== ВХОД =====
app.post('/api/login', async (req, res) => {
    const { username, password } = req.body;
    
    try {
        const result = await pool.query(
            'SELECT * FROM users WHERE username = $1',
            [username]
        );
        
        const user = result.rows[0];
        if (!user) {
            return res.json({ success: false, error: 'Неверный логин или пароль' });
        }
        
        const match = await bcrypt.compare(password, user.password);
        if (!match) {
            return res.json({ success: false, error: 'Неверный логин или пароль' });
        }
        
        await pool.query(
            'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = $1',
            [user.id]
        );
        
        req.session.userId = user.id;
        req.session.username = user.username;
        
        res.json({ 
            success: true, 
            user: {
                id: user.id,
                username: user.username,
                avatar: user.avatar
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.json({ success: false, error: 'Ошибка сервера' });
    }
});

// ===== ПРОВЕРКА АВТОРИЗАЦИИ =====
app.get('/api/me', async (req, res) => {
    if (req.session.userId) {
        try {
            const result = await pool.query(
                'SELECT id, username, avatar FROM users WHERE id = $1',
                [req.session.userId]
            );
            
            if (result.rows[0]) {
                res.json({ authenticated: true, user: result.rows[0] });
            } else {
                res.json({ authenticated: false });
            }
        } catch (err) {
            console.error('Me error:', err);
            res.json({ authenticated: false });
        }
    } else {
        res.json({ authenticated: false });
    }
});

// ===== ВЫХОД =====
app.post('/api/logout', (req, res) => {
    req.session.destroy();
    res.json({ success: true });
});

// ===== ХРАНИЛИЩА ДЛЯ СООБЩЕНИЙ =====
let publicMessages = [];
const privateMessages = {};
const onlineUsers = new Map();

// ===== СОКЕТЫ =====
io.on('connection', (socket) => {
    console.log('Новое подключение:', socket.id);
    
    socket.emit('load messages', publicMessages.slice(-50));
    
    socket.on('set username', (username) => {
        onlineUsers.set(socket.id, username);
        io.emit('users online', Array.from(onlineUsers.values()));
        socket.broadcast.emit('user joined', username);
    });
    
    socket.on('chat message', (data) => {
        console.log('Получено сообщение от:', data.user);
        console.log('Кому:', data.to || 'всем');
        
        const messageData = {
            id: Date.now() + Math.random(),
            text: data.text,
            user: data.user,
            time: new Date().toLocaleTimeString(),
            userId: socket.id,
            readBy: data.readBy || []
        };
        
        if (data.isSticker) {
            messageData.isSticker = true;
            messageData.stickerUrl = data.stickerUrl;
        }
        
        if (data.isImage) {
            messageData.isImage = true;
            messageData.imageData = data.imageData;
            messageData.fileName = data.fileName;
            messageData.fileSize = data.fileSize;
        }
        
        if (data.isVideo) {
            messageData.isVideo = true;
            messageData.videoData = data.videoData;
            messageData.fileName = data.fileName;
            messageData.fileSize = data.fileSize;
        }
        
        if (data.reactions) {
            messageData.reactions = data.reactions;
        }
        
        if (data.to) {
            messageData.to = data.to;
            messageData.from = data.user;
            
            const chatKey = [data.user, data.to].sort().join('_');
            
            if (!privateMessages[chatKey]) {
                privateMessages[chatKey] = [];
            }
            privateMessages[chatKey].push(messageData);
            
            const receiverEntry = [...onlineUsers.entries()].find(([id, name]) => name === data.to);
            const receiverSocket = receiverEntry ? receiverEntry[0] : null;
            
            if (receiverSocket) {
                io.to(receiverSocket).emit('chat message', messageData);
                io.to(receiverSocket).emit('new private chat', { with: data.user });
            }
            
            socket.emit('chat message', messageData);
        } else {
            publicMessages.push(messageData);
            if (publicMessages.length > 500) {
                publicMessages = publicMessages.slice(-500);
            }
            io.emit('chat message', messageData);
        }
    });
    
    socket.on('load private chat', (data) => {
        const chatKey = [data.user1, data.user2].sort().join('_');
        socket.emit('private chat history', {
            with: data.user2,
            messages: privateMessages[chatKey] || []
        });
    });
    
    socket.on('load messages', () => {
        socket.emit('load messages', publicMessages.slice(-50));
    });
    
    socket.on('typing', (data) => {
        if (data.to) {
            const receiverEntry = [...onlineUsers.entries()].find(([id, name]) => name === data.to);
            const receiverSocket = receiverEntry ? receiverEntry[0] : null;
            if (receiverSocket) {
                io.to(receiverSocket).emit('typing', {
                    user: data.user,
                    typing: data.typing,
                    to: data.to
                });
            }
        } else {
            socket.broadcast.emit('typing', { user: data.user, typing: data.typing });
        }
    });
    
    socket.on('add reaction', (data) => {
        const { messageId, reaction, user, to } = data;
        
        let message = publicMessages.find(m => m.id == messageId);
        let isPrivate = false;
        let chatKey = null;
        
        if (!message && to) {
            chatKey = [user, to].sort().join('_');
            if (privateMessages[chatKey]) {
                message = privateMessages[chatKey].find(m => m.id == messageId);
            }
            isPrivate = true;
        }
        
        if (message) {
            if (!message.reactions) message.reactions = {};
            
            if (message.reactions[reaction] && message.reactions[reaction].includes(user)) {
                message.reactions[reaction] = message.reactions[reaction].filter(u => u !== user);
                if (message.reactions[reaction].length === 0) {
                    delete message.reactions[reaction];
                }
            } else {
                for (let r in message.reactions) {
                    message.reactions[r] = message.reactions[r].filter(u => u !== user);
                    if (message.reactions[r].length === 0) {
                        delete message.reactions[r];
                    }
                }
                if (!message.reactions[reaction]) {
                    message.reactions[reaction] = [];
                }
                message.reactions[reaction].push(user);
            }
            
            const reactionData = {
                messageId,
                reactions: message.reactions,
                isPrivate,
                to
            };
            
            if (isPrivate && chatKey) {
                const [user1, user2] = chatKey.split('_');
                const sockets = [...onlineUsers.entries()]
                    .filter(([id, name]) => name === user1 || name === user2)
                    .map(([id]) => id);
                
                sockets.forEach(sid => {
                    io.to(sid).emit('reaction update', reactionData);
                });
            } else {
                io.emit('reaction update', reactionData);
            }
        }
    });
    
    socket.on('message read', (data) => {
        const { messageId, reader, chatId } = data;
        
        let message = publicMessages.find(m => m.id == messageId);
        let isPrivate = false;
        let chatKey = null;
        
        if (!message && chatId && chatId !== 'public') {
            chatKey = [chatId, reader].sort().join('_');
            if (privateMessages[chatKey]) {
                message = privateMessages[chatKey].find(m => m.id == messageId);
            }
            isPrivate = true;
        }
        
        if (message) {
            if (!message.readBy) {
                message.readBy = [];
            }
            
            if (!message.readBy.includes(reader)) {
                message.readBy.push(reader);
            }
            
            const readData = {
                messageId,
                readBy: message.readBy,
                isPrivate,
                chatId: chatId || 'public'
            };
            
            if (isPrivate && chatKey) {
                const [user1, user2] = chatKey.split('_');
                const sockets = [...onlineUsers.entries()]
                    .filter(([id, name]) => name === user1 || name === user2)
                    .map(([id]) => id);
                
                sockets.forEach(sid => {
                    io.to(sid).emit('message read update', readData);
                });
            } else {
                io.emit('message read update', readData);
            }
        }
    });
    
    socket.on('disconnect', () => {
        const username = onlineUsers.get(socket.id);
        if (username) {
            onlineUsers.delete(socket.id);
            io.emit('users online', Array.from(onlineUsers.values()));
            io.emit('user left', username);
            
            pool.query(
                'UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE username = $1',
                [username]
            ).catch(err => console.error('Update last_seen error:', err));
        }
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`Сервер на порту ${PORT}`));