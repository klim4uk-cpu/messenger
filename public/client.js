const socket = io();
let currentUser = '';
let typingTimeout;

// DOM элементы
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-text');
const sendButton = document.getElementById('send-message');
const usernameInput = document.getElementById('username-input');
const setUsernameButton = document.getElementById('set-username');
const usersList = document.getElementById('users-list');
const onlineCount = document.getElementById('online-count');
const typingStatus = document.getElementById('typing-status');
const userAvatar = document.getElementById('user-avatar');
const chatStatus = document.getElementById('chat-status');

// Функция для получения инициалов
function getInitials(name) {
    return name ? name.charAt(0).toUpperCase() : '?';
}

// Установка имени пользователя
setUsernameButton.addEventListener('click', () => {
    const username = usernameInput.value.trim();
    if (username) {
        currentUser = username;
        socket.emit('set username', username);
        usernameInput.disabled = true;
        setUsernameButton.style.display = 'none';
        messageInput.disabled = false;
        sendButton.disabled = false;
        userAvatar.textContent = getInitials(username);
        messageInput.focus();
    }
});

usernameInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
        setUsernameButton.click();
    }
});

// Отправка сообщения
function sendMessage() {
    const text = messageInput.value.trim();
    if (text && currentUser) {
        socket.emit('chat message', {
            text: text,
            user: currentUser
        });
        messageInput.value = '';
        messageInput.style.height = 'auto';
    }
}

sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Индикатор печатания
messageInput.addEventListener('input', function() {
    socket.emit('typing', { user: currentUser, typing: true });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { user: currentUser, typing: false });
    }, 1000);
    
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

// Получение истории сообщений
socket.on('load messages', (messages) => {
    messagesDiv.innerHTML = '';
    messages.forEach(addMessageToChat);
});

// Получение нового сообщения
socket.on('chat message', (data) => {
    addMessageToChat(data);
});

// Приватные сообщения
socket.on('private message', (data) => {
    const messageData = {
        ...data,
        user: data.from,
        text: data.message,
        private: true
    };
    addMessageToChat(messageData);
    
    // Уведомление
    if (data.from !== currentUser) {
        showSystemMessage(`📩 Приватное сообщение от ${data.from}`);
    }
});

socket.on('private message sent', (data) => {
    const messageData = {
        ...data,
        user: `Вы → ${data.to}`,
        text: data.message,
        private: true,
        own: true
    };
    addMessageToChat(messageData);
});

// Добавление сообщения в чат
function addMessageToChat(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    
    if (data.user === currentUser || data.own) {
        messageDiv.classList.add('own-message');
    }
    
    if (data.private) {
        messageDiv.classList.add('private');
    }
    
    const time = data.time || new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    let userDisplay = data.user;
    if (data.user === currentUser) {
        userDisplay = 'Вы';
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-user">${escapeHtml(userDisplay)}</span>
            <span class="message-time">${time}</span>
            ${data.private ? '<span class="private-badge">🔒</span>' : ''}
        </div>
        <div class="message-text">${escapeHtml(data.text || data.message)}</div>
    `;
    
    messagesDiv.appendChild(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// Индикатор печатания
socket.on('typing', (data) => {
    if (data.user && data.user !== currentUser) {
        if (data.typing) {
            typingStatus.textContent = `${data.user} печатает...`;
        } else {
            typingStatus.textContent = '';
        }
    }
});

// Список пользователей онлайн
socket.on('users online', (users) => {
    usersList.innerHTML = '';
    onlineCount.textContent = users.length;
    
    users.forEach(user => {
        const li = document.createElement('li');
        li.innerHTML = `
            <span class="user-avatar-mini">${getInitials(user)}</span>
            <span class="user-name">${escapeHtml(user)}</span>
        `;
        li.addEventListener('click', () => {
            const message = prompt(`Приватное сообщение для ${user}:`);
            if (message && message.trim()) {
                socket.emit('private message', {
                    to: user,
                    message: message.trim()
                });
            }
        });
        usersList.appendChild(li);
    });
    
    // Обновляем статус чата
    if (users.length === 1) {
        chatStatus.textContent = 'только вы';
    } else {
        chatStatus.textContent = `${users.length - 1} участников`;
    }
});

// Системные сообщения
socket.on('user joined', (username) => {
    showSystemMessage(`✨ ${username} присоединился`);
});

socket.on('user left', (username) => {
    showSystemMessage(`👋 ${username} покинул чат`);
});

function showSystemMessage(text) {
    const systemDiv = document.createElement('div');
    systemDiv.className = 'system-message';
    systemDiv.textContent = text;
    messagesDiv.appendChild(systemDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    
    setTimeout(() => {
        systemDiv.remove();
    }, 3000);
}

// Ошибки
socket.on('error', (error) => {
    showSystemMessage(`❌ ${error}`);
});

// Утилиты
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

// Блокируем отправку пока нет имени
messageInput.disabled = true;
sendButton.disabled = true;