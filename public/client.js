const socket = io();
let currentUser = '';
let typingTimeout;
let currentPrivateChat = null;

// DOM элементы
const messagesDiv = document.getElementById('messages');
const messageInput = document.getElementById('message-text');
const sendButton = document.getElementById('send-message');
const usersList = document.getElementById('users-list');
const onlineCount = document.getElementById('online-count');
const typingStatus = document.getElementById('typing-status');
const chatTitle = document.querySelector('.chat-info h2');
const chatSubtitle = document.getElementById('chat-status');

// Элементы табов
const tabChats = document.getElementById('tab-chats');
const tabContacts = document.getElementById('tab-contacts');
const chatsList = document.getElementById('chats-list');
const contactsSection = document.getElementById('contacts-section');

// Элементы модалки
const modal = document.getElementById('private-modal');
const modalUsername = document.getElementById('modal-username');
const modalYes = document.getElementById('modal-yes');
const modalNo = document.getElementById('modal-no');

// Элементы пикера
const emojiButton = document.getElementById('emoji-button');
const pickerContainer = document.getElementById('picker-container');
const pickerContent = document.getElementById('picker-content');
const pickerTabs = document.querySelectorAll('.picker-tab');

// Элементы для файлов
const attachButton = document.getElementById('attach-button');
const fileInput = document.getElementById('file-input');
const previewContainer = document.getElementById('preview-container');
const previewMedia = document.getElementById('preview-media');
const previewInfo = document.getElementById('preview-info');
const previewSend = document.getElementById('preview-send');
const previewCancel = document.getElementById('preview-cancel');
const previewClose = document.getElementById('preview-close');

// Элементы авторизации
const authContainer = document.getElementById('auth-container');
const chatContainer = document.getElementById('chat-container');
const loginTab = document.getElementById('login-tab');
const registerTab = document.getElementById('register-tab');
const loginForm = document.getElementById('login-form');
const registerForm = document.getElementById('register-form');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const currentUsernameSpan = document.getElementById('current-username');

let currentPickerTab = 'emoji';
let chats = [{ id: 'public', name: 'Общий чат', type: 'public', lastMsg: '' }];
let activeChat = 'public';
let selectedFile = null;

// Константы
const MAX_FILE_SIZE = 50 * 1024 * 1024;
const MAX_IMAGE_WIDTH = 1280;
const MAX_VIDEO_SIZE = 20 * 1024 * 1024;

// Данные
const emojiList = ['😊', '😂', '❤️', '👍', '🔥', '😢', '😍', '🎉', '🤔', '👌', '🤣', '💀', '😘', '🥺', '😎', '🙏', '💯', '✨', '⭐', '🌟', '💔', '💕', '💞', '💓'];
const stickersList = [
    { id: 1, url: '/stickers/1.jpg' }, { id: 2, url: '/stickers/2.jpg' },
    { id: 3, url: '/stickers/3.jpg' }, { id: 4, url: '/stickers/4.jpg' },
    { id: 5, url: '/stickers/5.jpg' }, { id: 6, url: '/stickers/6.jpg' },
    { id: 7, url: '/stickers/7.jpg' }, { id: 8, url: '/stickers/8.jpg' },
    { id: 9, url: '/stickers/9.jpg' }, { id: 10, url: '/stickers/10.jpg' },
    { id: 11, url: '/stickers/11.jpg' }, { id: 12, url: '/stickers/12.jpg' }
];

// ===== АВТОРИЗАЦИЯ =====
// Переключение табов
loginTab.addEventListener('click', () => {
    loginTab.classList.add('active');
    registerTab.classList.remove('active');
    loginForm.classList.add('active');
    registerForm.classList.remove('active');
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
});

registerTab.addEventListener('click', () => {
    registerTab.classList.add('active');
    loginTab.classList.remove('active');
    registerForm.classList.add('active');
    loginForm.classList.remove('active');
    document.getElementById('login-error').textContent = '';
    document.getElementById('register-error').textContent = '';
});

// Регистрация
registerBtn.addEventListener('click', async () => {
    const username = document.getElementById('register-username').value.trim();
    const password = document.getElementById('register-password').value;
    const errorDiv = document.getElementById('register-error');
    
    errorDiv.textContent = '';
    
    if (!username || !password) {
        errorDiv.textContent = '❌ Заполните все поля';
        return;
    }
    
    if (username.length < 3 || username.length > 20) {
        errorDiv.textContent = '❌ Ник должен быть 3-20 символов';
        return;
    }
    
    if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        errorDiv.textContent = '❌ Только буквы, цифры и _';
        return;
    }
    
    if (password.length < 6) {
        errorDiv.textContent = '❌ Пароль минимум 6 символов';
        return;
    }
    
    try {
        const response = await fetch('/api/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            errorDiv.style.color = '#4CAF50';
            errorDiv.textContent = '✅ Регистрация успешна! Теперь войдите';
            document.getElementById('register-username').value = '';
            document.getElementById('register-password').value = '';
            
            setTimeout(() => {
                loginTab.click();
                errorDiv.style.color = '#ff4444';
            }, 2000);
        } else {
            errorDiv.textContent = `❌ ${data.error || 'Ошибка регистрации'}`;
        }
    } catch (err) {
        errorDiv.textContent = '❌ Ошибка сервера';
    }
});

// Вход
loginBtn.addEventListener('click', async () => {
    const username = document.getElementById('login-username').value.trim();
    const password = document.getElementById('login-password').value;
    const errorDiv = document.getElementById('login-error');
    
    errorDiv.textContent = '';
    
    if (!username || !password) {
        errorDiv.textContent = '❌ Заполните все поля';
        return;
    }
    
    try {
        const response = await fetch('/api/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password })
        });
        
        const data = await response.json();
        
        if (data.success) {
            authContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            currentUsernameSpan.textContent = data.user.username;
            currentUser = data.user.username;
            socket.emit('set username', currentUser);
            
            messageInput.disabled = false;
            sendButton.disabled = false;
            
            document.getElementById('login-username').value = '';
            document.getElementById('login-password').value = '';
        } else {
            errorDiv.textContent = `❌ ${data.error || 'Неверный логин или пароль'}`;
        }
    } catch (err) {
        errorDiv.textContent = '❌ Ошибка сервера';
    }
});

// Выход
logoutBtn.addEventListener('click', async () => {
    await fetch('/api/logout', { method: 'POST' });
    
    authContainer.style.display = 'flex';
    chatContainer.style.display = 'none';
    currentUser = '';
    
    messageInput.disabled = true;
    sendButton.disabled = true;
    messagesDiv.innerHTML = '';
});

// Проверка авторизации
async function checkAuth() {
    try {
        const response = await fetch('/api/me');
        const data = await response.json();
        
        if (data.authenticated) {
            authContainer.style.display = 'none';
            chatContainer.style.display = 'flex';
            currentUsernameSpan.textContent = data.user.username;
            currentUser = data.user.username;
            socket.emit('set username', currentUser);
            messageInput.disabled = false;
            sendButton.disabled = false;
        } else {
            authContainer.style.display = 'flex';
            chatContainer.style.display = 'none';
            messageInput.disabled = true;
            sendButton.disabled = true;
        }
    } catch (err) {
        console.log('Ошибка проверки авторизации');
    }
}

// Запускаем проверку
checkAuth();

// ===== ПЕРЕКЛЮЧЕНИЕ ВКЛАДОК =====
tabChats.addEventListener('click', () => {
    tabChats.classList.add('active');
    tabContacts.classList.remove('active');
    chatsList.style.display = 'block';
    contactsSection.style.display = 'none';
});

tabContacts.addEventListener('click', () => {
    tabContacts.classList.add('active');
    tabChats.classList.remove('active');
    chatsList.style.display = 'none';
    contactsSection.style.display = 'block';
});

// ===== ФУНКЦИИ ЧАТОВ =====
function addPrivateChat(username) {
    if (!chats.find(c => c.id === username)) {
        chats.push({ 
            id: username, 
            name: username, 
            type: 'private', 
            lastMsg: '' 
        });
        renderChats();
    }
}

function switchChat(chatId) {
    activeChat = chatId;
    
    document.querySelectorAll('.chat-item').forEach(item => {
        item.classList.toggle('active', item.dataset.chat === chatId);
    });
    
    if (chatId === 'public') {
        currentPrivateChat = null;
        chatTitle.textContent = 'Общий чат';
        chatSubtitle.textContent = '';
        messagesDiv.innerHTML = '';
        socket.emit('load messages');
    } else {
        currentPrivateChat = chatId;
        chatTitle.textContent = `Чат с ${chatId}`;
        chatSubtitle.textContent = 'личный чат';
        messagesDiv.innerHTML = '<div style="text-align: center; padding: 20px;">Загрузка истории...</div>';
        
        // Загружаем историю личного чата
        socket.emit('load private chat', {
            user1: currentUser,
            user2: chatId
        });
    }
}

function renderChats() {
    chatsList.innerHTML = '';
    chats.forEach(chat => {
        const chatItem = document.createElement('div');
        chatItem.className = `chat-item ${chat.id === activeChat ? 'active' : ''}`;
        chatItem.dataset.chat = chat.id;
        
        chatItem.innerHTML = `
            <div class="chat-avatar">${chat.type === 'public' ? '💬' : '👤'}</div>
            <div class="chat-info">
                <div class="chat-name">${chat.name}</div>
                <div class="chat-last-msg">${escapeHtml(chat.lastMsg)}</div>
            </div>
        `;
        
        chatItem.addEventListener('click', () => switchChat(chat.id));
        chatsList.appendChild(chatItem);
    });
}

// ===== ОТПРАВКА СООБЩЕНИЙ =====
sendButton.addEventListener('click', sendMessage);

messageInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

function sendMessage() {
    const text = messageInput.value.trim();
    if (text && currentUser) {
        socket.emit('chat message', {
            text: text,
            user: currentUser,
            to: currentPrivateChat,
            readBy: []
        });
        messageInput.value = '';
        messageInput.style.height = 'auto';
    }
}

// ===== ФАЙЛЫ =====
attachButton.addEventListener('click', () => {
    fileInput.click();
});

fileInput.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > MAX_FILE_SIZE) {
        alert(`Файл слишком большой! Максимум 50 МБ`);
        fileInput.value = '';
        return;
    }
    
    if (file.type.startsWith('video/') && file.size > MAX_VIDEO_SIZE) {
        alert(`Видео слишком большое! Максимум 20 МБ`);
        fileInput.value = '';
        return;
    }
    
    selectedFile = file;
    
    previewMedia.innerHTML = '';
    previewInfo.textContent = `Файл: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} МБ)`;
    
    if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => {
            const img = document.createElement('img');
            img.src = e.target.result;
            img.className = 'preview-image';
            previewMedia.appendChild(img);
        };
        reader.readAsDataURL(file);
    } else if (file.type.startsWith('video/')) {
        const video = document.createElement('video');
        video.src = URL.createObjectURL(file);
        video.controls = true;
        video.className = 'preview-video';
        previewMedia.appendChild(video);
    }
    
    previewContainer.style.display = 'flex';
});

previewSend.addEventListener('click', () => {
    const fileToSend = selectedFile;
    
    if (!fileToSend || !currentUser) {
        alert('Выберите файл');
        return;
    }
    
    previewContainer.style.display = 'none';
    
    const reader = new FileReader();
    
    reader.onload = (e) => {
        const messageData = {
            text: fileToSend.type.startsWith('image/') ? '[фото]' : '[видео]',
            user: currentUser,
            fileName: fileToSend.name,
            fileSize: fileToSend.size,
            to: currentPrivateChat
        };
        
        if (fileToSend.type.startsWith('image/')) {
            messageData.isImage = true;
            messageData.imageData = e.target.result;
        } else if (fileToSend.type.startsWith('video/')) {
            messageData.isVideo = true;
            messageData.videoData = e.target.result;
        }
        
        socket.emit('chat message', messageData);
    };
    
    reader.readAsDataURL(fileToSend);
    
    fileInput.value = '';
    selectedFile = null;
    previewMedia.innerHTML = '';
    previewInfo.textContent = '';
});

function closePreview() {
    previewContainer.style.display = 'none';
    fileInput.value = '';
    selectedFile = null;
    previewMedia.innerHTML = '';
    previewInfo.textContent = '';
}

previewCancel.addEventListener('click', closePreview);
previewClose.addEventListener('click', closePreview);

// ===== ПРОСМОТР ФОТО =====
function openImageViewer(imageSrc) {
    const viewer = document.createElement('div');
    viewer.className = 'image-viewer';
    viewer.innerHTML = `
        <div class="viewer-content">
            <img src="${imageSrc}" class="viewer-image">
            <button class="viewer-close">✕</button>
        </div>
    `;
    
    viewer.addEventListener('click', (e) => {
        if (e.target === viewer || e.target.classList.contains('viewer-close')) {
            viewer.remove();
        }
    });
    
    document.body.appendChild(viewer);
}

// ===== КАСТОМНЫЙ ВИДЕО ПЛЕЕР =====
function createVideoPlayer(container, videoSrc, fileName, fileSize) {
    const playerDiv = document.createElement('div');
    playerDiv.className = 'custom-video-player';
    
    const previewDiv = document.createElement('div');
    previewDiv.className = 'video-preview';
    
    const previewVideo = document.createElement('video');
    previewVideo.src = videoSrc;
    previewVideo.muted = true;
    previewVideo.loop = true;
    previewVideo.className = 'preview-video';
    
    const playButton = document.createElement('div');
    playButton.className = 'big-play-btn';
    playButton.innerHTML = `
        <svg width="60" height="60" viewBox="0 0 24 24">
            <circle cx="12" cy="12" r="10" fill="#7ac9c9" stroke="white" stroke-width="2"/>
            <polygon points="10,8 16,12 10,16" fill="white"/>
        </svg>
    `;
    
    previewDiv.appendChild(previewVideo);
    previewDiv.appendChild(playButton);
    playerDiv.appendChild(previewDiv);
    
    const controlsDiv = document.createElement('div');
    controlsDiv.className = 'video-controls';
    controlsDiv.style.display = 'none';
    controlsDiv.innerHTML = `
        <div class="controls-progress">
            <div class="progress-bar" style="width: 0%"></div>
        </div>
        <div class="controls-buttons">
            <button class="ctrl-play">
                <svg width="24" height="24" viewBox="0 0 24 24">
                    <polygon points="8,5 19,12 8,19" fill="white"/>
                </svg>
            </button>
            <span class="ctrl-time">0:00 / 0:00</span>
            <button class="ctrl-mute">
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M3 10v4h4l5 5V5l-5 5H3z" fill="white"/>
                </svg>
            </button>
            <button class="ctrl-fullscreen">
                <svg width="20" height="20" viewBox="0 0 24 24">
                    <path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z" fill="white"/>
                </svg>
            </button>
        </div>
    `;
    playerDiv.appendChild(controlsDiv);
    
    const fileInfo = document.createElement('div');
    fileInfo.className = 'file-info';
    fileInfo.textContent = `${fileName || 'Видео'} (${(fileSize/1024/1024).toFixed(2)} МБ)`;
    playerDiv.appendChild(fileInfo);
    
    container.innerHTML = '';
    container.appendChild(playerDiv);
    
    const video = document.createElement('video');
    video.src = videoSrc;
    video.className = 'chat-video';
    video.style.display = 'none';
    video.controls = false;
    
    playButton.addEventListener('click', () => {
        previewDiv.style.display = 'none';
        video.style.display = 'block';
        controlsDiv.style.display = 'block';
        playerDiv.insertBefore(video, controlsDiv);
        video.play();
        
        const playBtn = controlsDiv.querySelector('.ctrl-play');
        playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="white"/><rect x="14" y="4" width="4" height="16" fill="white"/></svg>';
    });
    
    const playBtn = controlsDiv.querySelector('.ctrl-play');
    const timeSpan = controlsDiv.querySelector('.ctrl-time');
    const progressBar = controlsDiv.querySelector('.progress-bar');
    const muteBtn = controlsDiv.querySelector('.ctrl-mute');
    const fullscreenBtn = controlsDiv.querySelector('.ctrl-fullscreen');
    const progressDiv = controlsDiv.querySelector('.controls-progress');
    
    playBtn.addEventListener('click', () => {
        if (video.paused) {
            video.play();
            playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><rect x="6" y="4" width="4" height="16" fill="white"/><rect x="14" y="4" width="4" height="16" fill="white"/></svg>';
        } else {
            video.pause();
            playBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24"><polygon points="8,5 19,12 8,19" fill="white"/></svg>';
        }
    });
    
    video.addEventListener('timeupdate', () => {
        const progress = (video.currentTime / video.duration) * 100;
        progressBar.style.width = progress + '%';
        
        const currentMins = Math.floor(video.currentTime / 60);
        const currentSecs = Math.floor(video.currentTime % 60);
        const totalMins = Math.floor(video.duration / 60);
        const totalSecs = Math.floor(video.duration % 60);
        timeSpan.textContent = `${currentMins}:${currentSecs.toString().padStart(2,'0')} / ${totalMins}:${totalSecs.toString().padStart(2,'0')}`;
    });
    
    progressDiv.addEventListener('click', (e) => {
        const rect = progressDiv.getBoundingClientRect();
        const pos = (e.clientX - rect.left) / rect.width;
        video.currentTime = pos * video.duration;
    });
    
    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        muteBtn.innerHTML = video.muted 
            ? '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5l-5 5H3z" fill="white"/><line x1="18" y1="8" x2="22" y2="12" stroke="white" stroke-width="2"/><line x1="22" y1="8" x2="18" y2="12" stroke="white" stroke-width="2"/></svg>'
            : '<svg width="20" height="20" viewBox="0 0 24 24"><path d="M3 10v4h4l5 5V5l-5 5H3z" fill="white"/></svg>';
    });
    
    fullscreenBtn.addEventListener('click', () => {
        const player = video.closest('.custom-video-player');
        
        if (!document.fullscreenElement) {
            if (player.requestFullscreen) {
                player.requestFullscreen();
            } else if (player.webkitRequestFullscreen) {
                player.webkitRequestFullscreen();
            } else if (player.msRequestFullscreen) {
                player.msRequestFullscreen();
            }
        } else {
            if (document.exitFullscreen) {
                document.exitFullscreen();
            } else if (document.webkitExitFullscreen) {
                document.webkitExitFullscreen();
            } else if (document.msExitFullscreen) {
                document.msExitFullscreen();
            }
        }
    });
}

document.addEventListener('fullscreenchange', () => {
    const player = document.querySelector('.custom-video-player');
    if (player) {
        if (document.fullscreenElement) {
            player.classList.add('fullscreen-active');
        } else {
            player.classList.remove('fullscreen-active');
        }
    }
});

// ===== ГАЛОЧКИ ПРОЧИТАНО =====
function markAsRead(messageId, chatId) {
    if (!currentUser) return;
    
    socket.emit('message read', {
        messageId,
        reader: currentUser,
        chatId: chatId || 'public'
    });
}

const observer = new IntersectionObserver((entries) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            const messageDiv = entry.target;
            const messageId = messageDiv.dataset.messageId;
            
            if (!messageDiv.classList.contains('own-message')) {
                markAsRead(messageId, currentPrivateChat || 'public');
            }
        }
    });
}, { threshold: 0.5 });

socket.on('message read update', (data) => {
    const messageDiv = document.querySelector(`.message[data-message-id="${data.messageId}"]`);
    if (messageDiv) {
        messageDiv.dataset.readBy = JSON.stringify(data.readBy);
        
        const badgeSpan = messageDiv.querySelector('.read-badge');
        if (badgeSpan) {
            if (data.readBy.length > 0) {
                badgeSpan.innerHTML = '<span class="check-double"></span>';
            } else {
                badgeSpan.innerHTML = '<span class="check-single"></span>';
            }
        }
    }
});

// ===== ПОЛУЧЕНИЕ СООБЩЕНИЙ =====
socket.on('chat message', (data) => {
    const shouldShow = 
        (!data.to && !currentPrivateChat) ||
        (data.to === currentUser && data.user === currentPrivateChat) ||
        (data.user === currentUser && data.to === currentPrivateChat);
    
    if (shouldShow) addMessageToChat(data);
    
    let chatId = 'public';
    if (data.to) {
        chatId = data.user === currentUser ? data.to : data.user;
    }
    
    const chat = chats.find(c => c.id === chatId);
    if (chat) {
        if (data.isImage) chat.lastMsg = '📷 Фото';
        else if (data.isVideo) chat.lastMsg = '🎥 Видео';
        else if (data.isSticker) chat.lastMsg = '🖼️ Стикер';
        else chat.lastMsg = data.text.length > 20 ? data.text.slice(0,20)+'...' : data.text;
        renderChats();
    }
});

function addMessageToChat(data) {
    const messageDiv = document.createElement('div');
    messageDiv.className = 'message';
    messageDiv.dataset.messageId = data.id;
    
    const isOwn = data.user === currentUser;
    if (isOwn) messageDiv.classList.add('own-message');
    if (data.to) messageDiv.classList.add('private');
    if (data.readBy) {
        messageDiv.dataset.readBy = JSON.stringify(data.readBy);
    }
    
    const time = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    const userDisplay = isOwn ? 'Вы' : data.user;
    
    let content = '';
    
    if (data.isSticker) {
        content = `
            <div class="sticker-message-fixed">
                <img src="${data.stickerUrl}" class="sticker-image-fixed">
            </div>
        `;
    } else if (data.isImage) {
        content = `
            <div class="image-message">
                <img src="${data.imageData}" class="chat-image" onclick="openImageViewer('${data.imageData}')">
                <div class="file-info">${data.fileName || 'Фото'} (${(data.fileSize/1024/1024).toFixed(2)} МБ)</div>
            </div>
        `;
    } else if (data.isVideo) {
        const videoId = 'video-' + data.id;
        content = `<div id="${videoId}" class="video-container"></div>`;
        
        setTimeout(() => {
            const container = document.getElementById(videoId);
            if (container) {
                createVideoPlayer(container, data.videoData, data.fileName, data.fileSize);
            }
        }, 0);
    } else {
        content = `<div class="message-text">${escapeHtml(data.text)}</div>`;
    }
    
    let reactionsHtml = '';
    if (data.reactions && Object.keys(data.reactions).length > 0) {
        reactionsHtml = '<div class="message-reactions">';
        for (let [reaction, users] of Object.entries(data.reactions)) {
            reactionsHtml += `<span class="reaction-badge" data-reaction="${reaction}" data-message-id="${data.id}">${reaction} ${users.length}</span>`;
        }
        reactionsHtml += '</div>';
    }
    
    messageDiv.innerHTML = `
        <div class="message-header">
            <span class="message-user">${escapeHtml(userDisplay)}</span>
            ${data.to ? '<span class="private-badge">🔒</span>' : ''}
        </div>
        ${content}
        ${reactionsHtml}
        <div class="message-time">${time}</div>
    `;
    
    // САМОДЕЛЬНЫЕ ГАЛОЧКИ
    if (isOwn) {
        const timeElement = messageDiv.querySelector('.message-time');
        const badgeSpan = document.createElement('span');
        badgeSpan.className = 'read-badge';
        
        if (data.readBy && data.readBy.length > 0) {
            badgeSpan.innerHTML = '<span class="check-double"></span>';
        } else {
            badgeSpan.innerHTML = '<span class="check-single"></span>';
        }
        
        timeElement.appendChild(badgeSpan);
    }
    
    // Обработчики долгого нажатия
    let pressTimer;
    let longPressTriggered = false;

    messageDiv.addEventListener('mousedown', (e) => {
        if (e.target.closest('.reaction-badge')) return;
        longPressTriggered = false;
        pressTimer = setTimeout(() => {
            longPressTriggered = true;
            showReactionMenu(data.id, e.clientX, e.clientY);
        }, 500);
    });

    messageDiv.addEventListener('mouseup', (e) => {
        clearTimeout(pressTimer);
        if (longPressTriggered) {
            e.preventDefault();
            return;
        }
    });

    messageDiv.addEventListener('mouseleave', () => {
        clearTimeout(pressTimer);
    });
    
    messagesDiv.appendChild(messageDiv);
    observer.observe(messageDiv);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
}

// ===== РЕАКЦИИ =====
function showReactionMenu(messageId, x, y) {
    const oldMenu = document.querySelector('.reaction-menu');
    if (oldMenu) oldMenu.remove();
    
    const menu = document.createElement('div');
    menu.className = 'reaction-menu';
    menu.style.position = 'fixed';
    
    const messageDiv = document.querySelector(`.message[data-message-id="${messageId}"]`);
    const isOwnMessage = messageDiv?.classList.contains('own-message');
    
    if (isOwnMessage) {
        menu.style.right = (window.innerWidth - x + 10) + 'px';
        menu.style.left = 'auto';
    } else {
        menu.style.left = x + 'px';
        menu.style.right = 'auto';
    }
    menu.style.top = (y - 60) + 'px';
    
    menu.addEventListener('mousedown', (e) => e.stopPropagation());
    
    const reactions = ['❤️', '💔', '👍', '🔥', '😂', '😢'];
    
    reactions.forEach(reaction => {
        const btn = document.createElement('button');
        btn.className = 'reaction-btn';
        btn.textContent = reaction;
        
        btn.onclick = (e) => {
            e.stopPropagation();
            
            socket.emit('add reaction', {
                messageId: messageId,
                reaction: reaction,
                user: currentUser,
                to: currentPrivateChat
            });
            menu.remove();
        };
        
        menu.appendChild(btn);
    });
    
    document.body.appendChild(menu);
    
    setTimeout(() => {
        function closeMenu(e) {
            if (!menu.contains(e.target) && !e.target.closest('.message')) {
                menu.remove();
                document.removeEventListener('click', closeMenu);
            }
        }
        document.addEventListener('click', closeMenu);
    }, 100);
}

// ===== КЛИК ПО РЕАКЦИИ =====
document.addEventListener('click', (e) => {
    const reactionBadge = e.target.closest('.reaction-badge');
    if (reactionBadge) {
        e.preventDefault();
        e.stopPropagation();
        
        const messageId = reactionBadge.dataset.messageId;
        const reaction = reactionBadge.dataset.reaction;
        
        socket.emit('add reaction', {
            messageId: messageId,
            reaction: reaction,
            user: currentUser,
            to: currentPrivateChat
        });
    }
});

socket.on('reaction update', (data) => {
    const messageDiv = document.querySelector(`.message[data-message-id="${data.messageId}"]`);
    if (messageDiv) {
        let reactionsHtml = '';
        if (data.reactions && Object.keys(data.reactions).length > 0) {
            reactionsHtml = '<div class="message-reactions">';
            for (let [reaction, users] of Object.entries(data.reactions)) {
                reactionsHtml += `<span class="reaction-badge" data-reaction="${reaction}" data-message-id="${data.messageId}">${reaction} ${users.length}</span>`;
            }
            reactionsHtml += '</div>';
        }
        
        const oldReactions = messageDiv.querySelector('.message-reactions');
        if (oldReactions) {
            if (reactionsHtml) {
                oldReactions.outerHTML = reactionsHtml;
            } else {
                oldReactions.remove();
            }
        } else if (reactionsHtml) {
            messageDiv.insertAdjacentHTML('beforeend', reactionsHtml);
        }
    }
});

// ===== ИНДИКАТОР ПЕЧАТАНИЯ =====
messageInput.addEventListener('input', function() {
    socket.emit('typing', { user: currentUser, typing: true, to: currentPrivateChat });
    
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(() => {
        socket.emit('typing', { user: currentUser, typing: false, to: currentPrivateChat });
    }, 1000);
    
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
});

socket.on('typing', (data) => {
    if (data.user && data.user !== currentUser) {
        const showTyping = 
            (!data.to && !currentPrivateChat) ||
            (data.to === currentUser && data.user === currentPrivateChat);
        
        typingStatus.textContent = showTyping && data.typing ? `${data.user} печатает...` : '';
    }
});

// ===== СПИСОК ПОЛЬЗОВАТЕЛЕЙ =====
socket.on('users online', (users) => {
    usersList.innerHTML = '';
    onlineCount.textContent = users.length;
    
    users.forEach(user => {
        if (user === currentUser) return;
        
        const li = document.createElement('li');
        li.textContent = user;
        li.style.cursor = 'pointer';
        
        li.addEventListener('click', () => {
            console.log('Клик по пользователю:', user);
            
            // Показываем модалку подтверждения
            modalUsername.textContent = user;
            modal.style.display = 'flex';
            
            // Обработчик кнопки "Да"
            modalYes.onclick = () => {
                console.log('Создаем чат с:', user);
                modal.style.display = 'none';
                
                // Добавляем в список чатов
                addPrivateChat(user);
                
                // Переключаемся на этот чат
                switchChat(user);
                
                // Переключаем на вкладку чатов
                tabChats.click();
            };
            
            // Обработчик кнопки "Нет"
            modalNo.onclick = () => {
                modal.style.display = 'none';
            };
        });
        
        usersList.appendChild(li);
    });
});

// ===== СИСТЕМНЫЕ СООБЩЕНИЯ =====
socket.on('user joined', (username) => {
    if (!currentPrivateChat) addSystemMessage(`✨ ${username} присоединился`);
});

socket.on('user left', (username) => {
    if (!currentPrivateChat) addSystemMessage(`👋 ${username} покинул чат`);
    if (currentPrivateChat === username) {
        switchChat('public');
        addSystemMessage(`${username} вышел из чата`);
    }
});

socket.on('new private chat', (data) => {
    if (data.with !== currentUser) {
        addPrivateChat(data.with);
        if (currentPrivateChat !== data.with) {
            addSystemMessage(`💬 Новое сообщение от ${data.with}`);
            renderChats();
        }
    }
});

socket.on('private chat history', (data) => {
    messagesDiv.innerHTML = '';
    if (data.messages && data.messages.length > 0) {
        data.messages.forEach(msg => addMessageToChat(msg));
    } else {
        addSystemMessage('Начните диалог');
    }
});

socket.on('load messages', (messages) => {
    messagesDiv.innerHTML = '';
    messages.forEach(addMessageToChat);
});

function addSystemMessage(text) {
    const div = document.createElement('div');
    div.className = 'system-message';
    div.textContent = text;
    messagesDiv.appendChild(div);
    messagesDiv.scrollTop = messagesDiv.scrollHeight;
    setTimeout(() => div.remove(), 3000);
}

// ===== ПИКЕР =====
function updatePickerContent() {
    let html = '';
    
    if (currentPickerTab === 'emoji') {
        html = '<div class="emoji-grid">';
        emojiList.forEach(emoji => {
            html += `<span onclick="addToMessage('${emoji}')">${emoji}</span>`;
        });
        html += '</div>';
    } else if (currentPickerTab === 'stickers') {
        html = '<div class="stickers-grid">';
        stickersList.forEach(sticker => {
            html += `<div class="sticker-item" onclick="sendSticker(${sticker.id})">`;
            html += `<img src="${sticker.url}" alt="стикер" style="width: 100%; height: 100%; object-fit: contain;">`;
            html += `</div>`;
        });
        html += '</div>';
    } else if (currentPickerTab === 'gif') {
        html = '<div style="padding: 30px; text-align: center; color: #7a9f9f;">GIF скоро появятся</div>';
    }
    
    if (pickerContent) pickerContent.innerHTML = html;
}

window.addToMessage = (text) => {
    messageInput.value += text;
    messageInput.focus();
};

window.sendSticker = (stickerId) => {
    const sticker = stickersList.find(s => s.id === stickerId);
    if (sticker && currentUser) {
        socket.emit('chat message', {
            text: `[sticker:${stickerId}]`,
            user: currentUser,
            isSticker: true,
            stickerUrl: sticker.url,
            to: currentPrivateChat
        });
        pickerContainer.style.display = 'none';
    }
};

emojiButton.addEventListener('click', (e) => {
    e.stopPropagation();
    if (pickerContainer.style.display === 'block') {
        pickerContainer.style.display = 'none';
    } else {
        currentPickerTab = 'emoji';
        updatePickerContent();
        document.querySelectorAll('.picker-tab').forEach(t => 
            t.classList.toggle('active', t.dataset.tab === 'emoji'));
        pickerContainer.style.display = 'block';
    }
});

pickerTabs.forEach(tab => {
    tab.addEventListener('click', (e) => {
        e.stopPropagation();
        pickerTabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        currentPickerTab = tab.dataset.tab;
        updatePickerContent();
    });
});

document.addEventListener('click', (e) => {
    if (pickerContainer.style.display === 'block' && 
        !pickerContainer.contains(e.target) && 
        e.target !== emojiButton) {
        pickerContainer.style.display = 'none';
    }
});

window.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
    if (e.target === previewContainer) closePreview();
});

// ===== ЭКРАНИРОВАНИЕ =====
function escapeHtml(unsafe) {
    if (!unsafe) return '';
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

renderChats();