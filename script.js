import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove, get, query, limitToLast, orderByChild, equalTo } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
    apiKey: "AIzaSyA7j4u6K3HlgRWULMP0KAOUbjIHAuv5K6s",
    authDomain: "hurus-1.firebaseapp.com",
    projectId: "hurus-1",
    storageBucket: "hurus-1.firebasestorage.app",
    messagingSenderId: "646638352213",
    appId: "1:646638352213:web:1c4605bfea30e7c14fa1dc",
    measurementId: "G-6P7CG9Z04Y",
    databaseURL: "https://hurus-1-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;
let allUsers = [];
let allLogs = [];
let authMode = 'login';
let activeReactMsgId = null; 

// --- ПЕРЕМЕННЫЕ ДЛЯ ЧАТА (РАСШИРЕННЫЕ) ---
let currentChatTab = null; // По умолчанию никакой чат не выбран
let globalMessages = {};
let catMessages = {};
let privateMessages = {}; // Хранилище для ЛС: { собеседник: { msgId: data } }
let activePmListeners = {}; // Храним отписчики от ЛС
let unreadPms = new Set(); // Сет ников, от которых есть непрочитанные

const catUsers = ['mishkafazbear', 'amonphous', 'SharizMound', 'HuRuS']; // HuRuS добавлен для тестов

// --- 1. ОБРАБОТКА ВОЗВРАТА ИЗ STEAM ---
const urlParams = new URLSearchParams(window.location.search);
const steamNick = urlParams.get('nickname') || urlParams.get('name'); 
if (steamNick) {
    localStorage.setItem('hurus_session', steamNick);
    window.history.replaceState({}, document.title, window.location.pathname);
}

// --- СИНХРОНИЗАЦИЯ ПОЛЬЗОВАТЕЛЕЙ ---
onValue(ref(db, 'users'), (snapshot) => {
    const data = snapshot.val() || {};
    allUsers = Object.entries(data).map(([id, val]) => ({ uid: id, ...val }));
    
    const savedNick = localStorage.getItem('hurus_session');
    if (savedNick) {
        const found = allUsers.find(u => u.name === savedNick);
        if (found) {
            // Если пользователь залогинился впервые или сменился
            if (!currentUser || currentUser.name !== found.name) {
                currentUser = found;
                updateUI();
                // По умолчанию открываем глобальный чат при логине
                switchChat('global'); 
                // Начинаем слушать список ЛС для этого пользователя
                listenToPmList();
            } else {
                currentUser = found; // Просто обновляем данные (баланс и т.д.)
                updateUI();
            }
        }
    } else {
        currentUser = null;
        updateUI();
        // Если не залогинен, показываем заглушку в чате
        renderChatPlaceHolder("Войдите, чтобы читать чат");
    }
    
    if (document.getElementById('admin') && document.getElementById('admin').classList.contains('active')) {
        renderAdmin();
    }
});

// --- СИНХРОНИЗАЦИЯ ГЛОБАЛЬНОГО ЧАТА (только последние 50 сообщений) ---
const globalChatQuery = query(ref(db, 'messages'), limitToLast(50));
onValue(globalChatQuery, (snapshot) => {
    globalMessages = snapshot.val() || {};
    if (currentChatTab === 'global') renderChat(globalMessages);
});

// --- СИНХРОНИЗАЦИЯ ЧАТА КОТИКОВ (только последние 50 сообщений) ---
const catChatQuery = query(ref(db, 'cat_messages'), limitToLast(50));
onValue(catChatQuery, (snapshot) => {
    catMessages = snapshot.val() || {};
    if (currentChatTab === 'cats') renderChat(catMessages);
});

// --- СИНХРОНИЗАЦИЯ ЛОГОВ (только последние 50 логов) ---
const logsQuery = query(ref(db, 'logs'), limitToLast(50));
onValue(logsQuery, (snapshot) => {
    const data = snapshot.val() || {};
    allLogs = Object.values(data).sort((a, b) => b.time - a.time);
    
    if (document.getElementById('admin') && document.getElementById('admin').classList.contains('active')) {
        renderLogs();
    }
});

// --- СИСТЕМА ЛОГОВ ---
function addLog(text) {
    return push(ref(db, 'logs'), { text, time: Date.now() });
}

function renderLogs() {
    const logsBox = document.getElementById('adminLogs');
    if (!logsBox) return;
    
    if (allLogs.length === 0) {
        logsBox.innerHTML = '<div style="padding: 15px; color: var(--text-dim);">Логов пока нет...</div>';
        return;
    }

    logsBox.innerHTML = allLogs.map(l => {
        const timeStr = new Date(l.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        return `<div style="padding: 8px 15px; border-bottom: 1px solid var(--border); font-size: 13px; color: #ccc;">
            <span style="color: var(--primary);">[${timeStr}]</span> ${l.text}
        </div>`;
    }).join('');
}

// ============================================================
// --- ДВИЖОК ЧАТА (НОВЫЙ, С ЛС) ---
// ============================================================

// Генерирует уникальный ID для комнаты ЛС на основе двух ников (алфавитный порядок)
function getPmRoomId(user1, user2) {
    return [user1, user2].sort().join('_##_');
}

// Функция переключения чатов (включая ЛС)
window.switchChat = (tabType, targetUser = null) => {
    // tabType может быть: 'global', 'cats', 'pm'
    const newTabId = tabType === 'pm' ? `pm_${targetUser}` : tabType;
    
    if (currentChatTab === newTabId) return; // Уже тут
    currentChatTab = newTabId;

    // Очищаем непрочитанные, если переключились на ЛС
    if (tabType === 'pm') {
        unreadPms.delete(targetUser);
    }

    renderChatTabs(); // Перерисовываем табы (обновить active класс)

    // Рендерим сообщения
    if (tabType === 'global') {
        renderChat(globalMessages);
    } else if (tabType === 'cats') {
        if (!currentUser || !catUsers.includes(currentUser.name)) {
            renderChatPlaceHolder("Доступ запрещен =^.^=");
            return;
        }
        renderChat(catMessages);
    } else if (tabType === 'pm') {
        // Если сообщений с этим юзером еще нет в кэше, показываем загрузку
        if (!privateMessages[targetUser]) {
            renderChatPlaceHolder(`Загрузка чата с ${targetUser}...`);
            // listenToPrivateMessages(targetUser); // Это вызовется автоматически из listenToPmList
        } else {
            renderChat(privateMessages[targetUser], true, targetUser);
        }
    }
};

// Функция отрисовки вкладок чата (динамическая)
function renderChatTabs() {
    const tabsBox = document.getElementById('chatTabs');
    if (!tabsBox) return;

    let html = '';

    // 1. Глобальный
    html += `<button class="chat-tab-btn ${currentChatTab === 'global' ? 'active' : ''}" onclick="switchChat('global')">Глобальный</button>`;

    // 2. Чат Котиков (только для котиков)
    if (currentUser && catUsers.includes(currentUser.name)) {
        html += `<button class="chat-tab-btn tab-cats ${currentChatTab === 'cats' ? 'active' : ''}" onclick="switchChat('cats')">Чат Котиков <3</button>`;
    }

    // 3. Вкладки ЛС (динамические)
    Object.keys(privateMessages).forEach(withUser => {
        const isActive = currentChatTab === `pm_${withUser}`;
        const hasUnread = unreadPms.has(withUser) && !isActive;
        const classes = `chat-tab-btn tab-pm ${isActive ? 'active' : ''} ${hasUnread ? 'has-unread' : ''}`;
        html += `<button class="${classes}" onclick="switchChat('pm', '${withUser}')">[ЛС] ${withUser}</button>`;
    });

    tabsBox.innerHTML = html;
}

// Заглушка, если чат пуст или недоступен
function renderChatPlaceHolder(text) {
    document.getElementById('chatMessages').innerHTML = `<div class="chat-placeholder">${text}</div>`;
}

// Основная функция рендеринга сообщений
function renderChat(messagesObj, isPm = false, pmPartner = null) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj || {}).map(([id, data]) => ({ id, ...data }));
    
    if (msgs.length === 0) {
        renderChatPlaceHolder(isPm ? `Напишите первое сообщение ${pmPartner}...` : "Сообщений пока нет...");
        return;
    }

    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // В ЛС не показываем баджи ролей
        const userRole = isPm ? 'user' : (m.r || 'user');
        const roleName = userRole.toUpperCase();
        const badgeHtml = isPm ? '' : `<span class="badge badge-${userRole}">${roleName}</span>`;

        let reactHtml = '';
        // Реакции только для публичных чатов
        if (!isPm && m.reactions) {
            reactHtml = Object.entries(m.reactions).map(([emoji, users]) => {
                const userList = Object.keys(users);
                const count = userList.length;
                const hasMyReact = currentUser && users[currentUser.name] ? 'active' : '';
                return `
                    <div class="react-item ${hasMyReact}" onclick="toggleReaction('${m.id}', '${emoji}')" title="${userList.join(', ')}">
                        <span class="react-emoji">${emoji}</span>
                        <span class="react-count">${count}</span>
                    </div>
                `;
            }).join('');
        }

        // Кнопка добавления эмодзи тоже только для публичных
        const addEmojiBtn = isPm ? '' : `
            <button class="btn-add-emoji" onclick="openEmojiPicker('${m.id}', event)">
                <i class="fas fa-plus"></i>
            </button>
        `;

        // Обработка клика на ник для начала ЛС
        const authorClickAction = (currentUser && m.u !== currentUser.name) ? `onclick="startPm('${m.u}')"` : '';

        return `
            <div class="msg">
                <div class="msg-header">
                    ${badgeHtml}
                    <span class="msg-author" ${authorClickAction}>${m.u}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${m.t}</div>
                <div class="msg-footer">
                    <div class="reactions-container">
                        ${reactHtml}
                        ${addEmojiBtn}
                    </div>
                </div>
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

// Реакции (без изменений, работают только в глобале/котиках)
window.toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return notify("Сначала войдите в аккаунт!");
    // Определяем путь базы на основе ТЕКУЩЕЙ активной вкладки
    let dbPath = '';
    if (currentChatTab === 'global') dbPath = 'messages';
    else if (currentChatTab === 'cats') dbPath = 'cat_messages';
    else return; // В ЛС реакций нет

    const reactRef = ref(db, `${dbPath}/${msgId}/reactions/${emoji}/${currentUser.name}`);
    const snap = await get(reactRef);
    if (snap.exists()) {
        remove(reactRef);
    } else {
        set(reactRef, true);
    }
};

// Отправка сообщения
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    const msgText = inp.value.trim();
    if (!currentUser || !msgText) return;
    
    if (currentChatTab === 'global') {
        push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: msgText, time: Date.now() });
    } else if (currentChatTab === 'cats') {
        push(ref(db, 'cat_messages'), { u: currentUser.name, r: currentUser.role, t: msgText, time: Date.now() });
    } else if (currentChatTab && currentChatTab.startsWith('pm_')) {
        const targetUser = currentChatTab.replace('pm_', '');
        const roomId = getPmRoomId(currentUser.name, targetUser);
        
        // Пушим сообщение в комнату ЛС
        push(ref(db, `pms/${roomId}`), { u: currentUser.name, t: msgText, time: Date.now() });
        
        // Обновляем "индекс" ЛС для обоих пользователей (чтобы вкладка появилась)
        update(ref(db, `user_pms/${currentUser.name}/${targetUser}`), { last_time: Date.now() });
        update(ref(db, `user_pms/${targetUser}/${currentUser.name}`), { last_time: Date.now() });
    }
    
    inp.value = '';
};

// --- ЛОГИКА ЛИЧНЫХ СООБЩЕНИЙ (PM) ---

// Функция для начала ЛС (вызывается при клике на ник)
window.startPm = (targetNick) => {
    if (!currentUser) return notify("Войдите, чтобы писать ЛС!");
    if (targetNick === currentUser.name) return; // Себе нельзя
    
    // Создаем пустую запись в индексе, если чата еще нет, чтобы вкладка появилась
    const indexRef = ref(db, `user_pms/${currentUser.name}/${targetNick}`);
    get(indexRef).then(snap => {
        if (!snap.exists()) {
            update(indexRef, { last_time: Date.now() });
            // listenToPrivateMessages вызовется автоматом через listenToPmList
        }
    });

    switchChat('pm', targetNick);
};

// Функция прослушивания конкретной комнаты ЛС
function listenToPrivateMessages(targetUser) {
    if (!currentUser || activePmListeners[targetUser]) return; // Уже слушаем

    const roomId = getPmRoomId(currentUser.name, targetUser);
    // Ограничиваем последние 50 сообщений в ЛС
    const pmQuery = query(ref(db, `pms/${roomId}`), limitToLast(50));

    // Сохраняем отписчик
    activePmListeners[targetUser] = onValue(pmQuery, (snapshot) => {
        const msgs = snapshot.val() || {};
        privateMessages[targetUser] = msgs;

        // Если это новое сообщение и мы НЕ в этом чате -> уведомление
        if (snapshot.exists()) {
            const lastMsg = Object.values(msgs).sort((a,b)=>b.time-a.time)[0];
            const isMyMsg = lastMsg.u === currentUser.name;
            const isChatActive = currentChatTab === `pm_${targetUser}`;
            
            if (!isMyMsg && !isChatActive) {
                unreadPms.add(targetUser);
            }
        }

        renderChatTabs(); // Обновить табы (вдруг появилось уведомление)
        
        // Если этот чат сейчас открыт -> перерисовать сообщения
        if (currentChatTab === `pm_${targetUser}`) {
            renderChat(msgs, true, targetUser);
        }
    });
}

// Функция прослушивания СПИСКА собеседников ЛС текущего юзера
function listenToPmList() {
    if (!currentUser) return;
    
    // Отписываемся от старых ЛС, если зашли под другим акком
    Object.values(activePmListeners).forEach(off => off());
    activePmListeners = {};
    privateMessages = {};
    unreadPms.clear();

    onValue(ref(db, `user_pms/${currentUser.name}`), (snapshot) => {
        const data = snapshot.val() || {};
        const partners = Object.keys(data);
        
        // Для каждого собеседника начинаем слушать его комнату сообщений
        partners.forEach(partner => {
            listenToPrivateMessages(partner);
        });

        // Если собеседников нет, обновить табы (убрать старые вкладки ЛС)
        if (partners.length === 0) {
            renderChatTabs();
        }
    });
}


// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ (БЕЗ ИЗМЕНЕНИЙ) ---
window.setAuthMode = (mode) => {
    authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-reg').classList.toggle('active', mode === 'reg');
    const btn = document.querySelector('.modal-form .btn-primary');
    if (btn) btn.innerText = mode === 'login' ? 'ВЫПОЛНИТЬ' : 'ЗАРЕГИСТРИРОВАТЬСЯ';
};

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполните поля!");

    if (authMode === 'login') {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка входа!");
        localStorage.setItem('hurus_session', found.name);
    } else {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user', avatar: '' });
        localStorage.setItem('hurus_session', l);
    }
    
    setTimeout(() => { location.reload(); }, 200);
};

window.loginWithSteam = () => window.location.href = "https://hurus-backend.onrender.com/auth/steam";
window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

function updateUI() {
    const authZone = document.getElementById('authZone');
    
    if (currentUser) {
        const isAdmin = ['admin', 'moder'].includes(currentUser.role);
        document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
        
        authZone.innerHTML = `
            <div class="profile-info-block">
                ${currentUser.avatar ? `<img src="${currentUser.avatar}" class="profile-avatar">` : '<div class="profile-avatar-placeholder"><i class="fas fa-user"></i></div>'}
                <div class="profile-text-data">
                    <div class="profile-nick">${currentUser.name}</div>
                    <div class="profile-balance">${currentUser.balance || 0} ₽</div>
                </div>
                <button class="btn-logout" onclick="logout()" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
            </div>
        `;
    } else {
        document.getElementById('adminLink').style.display = 'none';
        authZone.innerHTML = `<button class="btn btn-primary" onclick="openModal('authModal')">ВОЙТИ</button>`;
    }
}

// --- ПАНЕЛЬ УПРАВЛЕНИЯ (ADMIN) (БЕЗ ИЗМЕНЕНИЙ) ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    if (!list) return;
    
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td style="color: var(--success); font-weight: bold;">${u.balance || 0} ₽</td>
            <td>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" id="balInput_${u.uid}" placeholder="Сумма" style="width: 75px; background: #000; border: 1px solid var(--border); color: #fff; padding: 6px; border-radius: 6px; outline:none;">
                    <button class="btn-ok" onclick="addBalance('${u.uid}')" title="Выдать"><i class="fas fa-plus"></i></button>
                </div>
            </td>
            <td>
                <select onchange="changeRole('${u.uid}', this.value)" style="background: #000; color: #fff; border: 1px solid var(--border); padding: 5px; border-radius: 5px;">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="vip" ${u.role === 'vip' ? 'selected' : ''}>VIP</option>
                    <option value="moder" ${u.role === 'moder' ? 'selected' : ''}>Moder</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <button class="btn-del" onclick="deleteUser('${u.uid}')" title="Удалить пользователя"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
    
    renderLogs();
};

window.addBalance = (uid) => {
    const inp = document.getElementById(`balInput_${uid}`);
    const amount = parseInt(inp.value);
    if (isNaN(amount) || amount <= 0) return notify("Введите корректную сумму!");

    const u = allUsers.find(user => user.uid === uid);
    if (u) {
        update(ref(db, `users/${uid}`), { balance: (u.balance || 0) + amount });
        addLog(`Администратор ${currentUser.name} выдал ${amount} ₽ пользователю ${u.name}`);
        notify(`Успешно выдано ${amount} ₽`);
        inp.value = '';
    }
};

window.changeRole = (uid, newRole) => {
    const u = allUsers.find(user => user.uid === uid);
    update(ref(db, `users/${uid}`), { role: newRole });
    addLog(`Администратор ${currentUser.name} изменил роль ${u.name} на ${newRole.toUpperCase()}`);
};

window.deleteUser = (uid) => {
    const u = allUsers.find(user => user.uid === uid);
    if (confirm(`Удалить аккаунт ${u.name}? Это действие нельзя отменить.`)) {
        remove(ref(db, `users/${uid}`));
        addLog(`Администратор ${currentUser.name} УДАЛИЛ аккаунт ${u.name}`);
    }
};

// --- ВСПОМОГАТЕЛЬНОЕ (БЕЗ ИЗМЕНЕНИЙ) ---
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${id}`) || document.getElementById('adminLink');
    if(activeBtn) activeBtn.classList.add('active');

    if (id === 'admin') renderAdmin();
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    const globalPicker = document.getElementById('global-emoji-picker');
    const pickerElement = document.querySelector('emoji-picker');
    window.openEmojiPicker = (msgId, event) => {
        event.stopPropagation();
        if (!currentUser) return notify("Сначала войдите!");
        activeReactMsgId = msgId;
        globalPicker.style.display = 'block';
        const rect = event.currentTarget.getBoundingClientRect();
        globalPicker.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        globalPicker.style.left = (rect.left + window.scrollX) + 'px';
    };
    pickerElement.addEventListener('emoji-click', e => {
        toggleReaction(activeReactMsgId, e.detail.unicode);
        globalPicker.style.display = 'none';
    });
});