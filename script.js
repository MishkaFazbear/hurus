import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove, get, query, limitToLast, onDisconnect } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- ПЕРЕМЕННЫЕ ДЛЯ ЧАТА ---
let currentChatTab = 'global';
let globalMessages = {};
let catMessages = {};
const catUsers = ['mishkafazbear', 'amonphous', 'SharizMound', 'hurus'];

// --- НОВЫЕ ПЕРЕМЕННЫЕ ДЛЯ ПИНГОВ ---
let processedMessages = new Set();
let unreadMentions = { global: 0, cats: 0 };

// --- ПЕРЕМЕННЫЕ ДЛЯ ОНЛАЙНА ---
let onlineUsersList = [];
let myOnlineRef = null;

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
            currentUser = found;
            updateUI();
            setOnlineStatus();
        }
    }
    
    if (document.getElementById('admin') && document.getElementById('admin').classList.contains('active')) {
        renderAdmin();
    }
});

// --- СИНХРОНИЗАЦИЯ ГЛОБАЛЬНОГО ЧАТА ---
const globalChatQuery = query(ref(db, 'messages'), limitToLast(50));
onValue(globalChatQuery, (snapshot) => {
    globalMessages = snapshot.val() || {};
    processMentions('global', globalMessages); // Проверка пингов
    if (currentChatTab === 'global') renderChat(globalMessages);
});

// --- СИНХРОНИЗАЦИЯ ЧАТА КОТИКОВ ---
const catChatQuery = query(ref(db, 'cat_messages'), limitToLast(50));
onValue(catChatQuery, (snapshot) => {
    catMessages = snapshot.val() || {};
    processMentions('cats', catMessages); // Проверка пингов
    if (currentChatTab === 'cats') renderChat(catMessages);
});

// --- СИСТЕМА УВЕДОМЛЕНИЙ (ПИНГОВ) ---
function processMentions(chatTab, messagesObj) {
    if (!currentUser) {
        Object.keys(messagesObj).forEach(id => processedMessages.add(id));
        return;
    }
    
    const myMention = `@${currentUser.name}`;
    let updated = false;

    Object.entries(messagesObj).forEach(([id, m]) => {
        if (!processedMessages.has(id)) {
            processedMessages.add(id);
            // Если сообщение в другом табе и там есть наш ник
            if (currentChatTab !== chatTab && m.t && m.t.includes(myMention)) {
                unreadMentions[chatTab]++;
                updated = true;
            }
        }
    });

    if (updated) updateTabsUI();
}

// --- СИНХРОНИЗАЦИЯ ЛОГОВ ---
const logsQuery = query(ref(db, 'logs'), limitToLast(50));
onValue(logsQuery, (snapshot) => {
    const data = snapshot.val() || {};
    allLogs = Object.values(data).sort((a, b) => b.time - a.time);
    if (document.getElementById('admin') && document.getElementById('admin').classList.contains('active')) {
        renderLogs();
    }
});

// --- СИСТЕМА ОНЛАЙНА ---
onValue(ref(db, 'online_users'), (snapshot) => {
    const data = snapshot.val() || {};
    onlineUsersList = Object.values(data).map(u => u.name);
    if (document.getElementById('admin') && document.getElementById('admin').classList.contains('active')) {
        renderOnlineUsersAdmin();
    }
});

const connectedRef = ref(db, '.info/connected');
onValue(connectedRef, (snap) => {
    if (snap.val() === true && currentUser) setOnlineStatus();
});

function setOnlineStatus() {
    if (!currentUser) return;
    if (myOnlineRef) onDisconnect(myOnlineRef).cancel();
    myOnlineRef = ref(db, `online_users/${currentUser.uid}`);
    onDisconnect(myOnlineRef).remove().then(() => {
        set(myOnlineRef, { name: currentUser.name, time: Date.now() });
    });
}

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

// --- УПРАВЛЕНИЕ ТАБАМИ ---
window.updateTabsUI = () => {
    const globalTab = document.getElementById('tab-global');
    if (globalTab) {
        globalTab.style.color = currentChatTab === 'global' ? 'var(--primary)' : 'var(--text-dim)';
        globalTab.style.borderBottom = currentChatTab === 'global' ? '2px solid var(--primary)' : 'none';
        let badge = unreadMentions.global > 0 ? `<span class="mention-badge">${unreadMentions.global}</span>` : '';
        globalTab.innerHTML = `Глобальный ${badge}`;
    }
    
    const catTab = document.getElementById('tab-cats');
    if (catTab) {
        catTab.style.color = currentChatTab === 'cats' ? '#ff66b2' : 'var(--text-dim)';
        catTab.style.borderBottom = currentChatTab === 'cats' ? '2px solid #ff66b2' : 'none';
        let badge = unreadMentions.cats > 0 ? `<span class="mention-badge">${unreadMentions.cats}</span>` : '';
        catTab.innerHTML = `Чат Котиков <3 ${badge}`;
    }
};

window.switchChat = (tab) => {
    currentChatTab = tab;
    unreadMentions[tab] = 0; // Сбрасываем счетчик при переходе
    updateTabsUI();
    renderChat(tab === 'global' ? globalMessages : catMessages);
};

// --- ЧАТ И РЕАКЦИИ ---
function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj || {}).map(([id, data]) => ({ id, ...data }));
    
    const formatTags = (text) => {
        if (!text) return '';
        let safeText = text.replace(/</g, "&lt;").replace(/>/g, "&gt;");
        safeText = safeText.replace(/@([a-zA-Z0-9_а-яА-ЯёЁ]+)/g, '<span class="mention" onclick="document.getElementById(\'chatInput\').value += \'@$1 \'">@$1</span>');
        safeText = safeText.replace(/#([a-zA-Z0-9_а-яА-ЯёЁ]+)/g, '<span class="hashtag">#$1</span>');
        return safeText;
    };

    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userRole = m.r || 'user';
        
        let reactHtml = '';
        if (m.reactions) {
            reactHtml = Object.entries(m.reactions).map(([emoji, users]) => {
                const userList = Object.keys(users);
                const hasMyReact = currentUser && users[currentUser.name] ? 'active' : '';
                return `<div class="react-item ${hasMyReact}" onclick="toggleReaction('${m.id}', '${emoji}')" title="${userList.join(', ')}">
                    <span class="react-emoji">${emoji}</span> <span class="react-count">${userList.length}</span>
                </div>`;
            }).join('');
        }

        return `
            <div class="msg">
                <div class="msg-header">
                    <span class="badge badge-${userRole}">${userRole.toUpperCase()}</span>
                    <span class="msg-author" onclick="document.getElementById('chatInput').value += '@${m.u} '" style="cursor:pointer;">${m.u}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${formatTags(m.t)}</div>
                <div class="msg-footer">
                    <div class="reactions-container">
                        ${reactHtml}
                        <button class="btn-add-emoji" onclick="openEmojiPicker('${m.id}', event)"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

// --- АВТОДОПОЛНЕНИЕ НИКОВ (@) ---
window.handleInputMentions = () => {
    const inp = document.getElementById('chatInput');
    const val = inp.value;
    const cursorPos = inp.selectionStart;
    const textBefore = val.slice(0, cursorPos);
    const words = textBefore.split(/\s+/);
    const lastWord = words[words.length - 1];

    const popup = document.getElementById('mentionPopup');
    if (!popup) return;

    if (lastWord.startsWith('@')) {
        const search = lastWord.slice(1).toLowerCase();
        const matched = allUsers.filter(u => u.name.toLowerCase().startsWith(search));
        
        if (matched.length > 0) {
            popup.innerHTML = matched.map(u => `
                <div class="mention-option" onclick="insertMention('${u.name}')">
                    <i class="fas fa-at" style="font-size: 10px; opacity: 0.5; margin-right: 5px;"></i>${u.name}
                </div>
            `).join('');
            popup.style.display = 'flex';
        } else popup.style.display = 'none';
    } else popup.style.display = 'none';
};

window.insertMention = (name) => {
    const inp = document.getElementById('chatInput');
    const words = inp.value.slice(0, inp.selectionStart).split(/\s+/);
    words.pop();
    words.push(`@${name} `);
    inp.value = words.join(' ') + inp.value.slice(inp.selectionStart);
    document.getElementById('mentionPopup').style.display = 'none';
    inp.focus();
};

window.toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return notify("Сначала войдите!");
    const dbPath = currentChatTab === 'global' ? 'messages' : 'cat_messages';
    const reactRef = ref(db, `${dbPath}/${msgId}/reactions/${emoji}/${currentUser.name}`);
    const snap = await get(reactRef);
    if (snap.exists()) {
        remove(reactRef);
    } else {
        set(reactRef, true);
    }
};

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    const dbPath = currentChatTab === 'global' ? 'messages' : 'cat_messages';
    push(ref(db, dbPath), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    addLog(`Пользователь ${currentUser.name} написал в ${currentChatTab === 'global' ? 'глобальный чат' : 'чат котиков'}: ${inp.value}`);
    inp.value = '';
    document.getElementById('mentionPopup').style.display = 'none';
};

// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
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
        await addLog(`Пользователь ${found.name} вошел в систему`);
    } else {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user', avatar: '' });
        localStorage.setItem('hurus_session', l);
        await addLog(`Новый пользователь ${l} зарегистрировался`);
    }
    setTimeout(() => { location.reload(); }, 200);
};

window.loginWithSteam = () => window.location.href = "https://hurus-backend.onrender.com/auth/steam";

window.logout = async () => { 
    if (myOnlineRef) await remove(myOnlineRef);
    localStorage.removeItem('hurus_session'); 
    location.reload(); 
};

function updateUI() {
    const isAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    
    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            ${currentUser.avatar ? `<img src="${currentUser.avatar}" class="profile-avatar">` : '<div class="profile-avatar-placeholder"><i class="fas fa-user"></i></div>'}
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance || 0} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
        </div>
    `;

    const chatTabs = document.getElementById('chatTabs');
    if (catUsers.includes(currentUser.name)) {
        if (!document.getElementById('tab-cats')) {
            chatTabs.innerHTML += `<button id="tab-cats" onclick="switchChat('cats')" style="background: none; border: none; color: var(--text-dim); cursor: pointer; font-weight: 800; padding: 5px; margin-left: 10px;">Чат Котиков <3</button>`;
        }
    } else {
        const catTab = document.getElementById('tab-cats');
        if (catTab) catTab.remove();
        if (currentChatTab === 'cats') switchChat('global');
    }
    updateTabsUI();
}

// --- ПАНЕЛЬ УПРАВЛЕНИЯ (ADMIN) ---
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
                    <button class="btn-ok" onclick="addBalance('${u.uid}')"><i class="fas fa-plus"></i></button>
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
            <td><button class="btn-del" onclick="deleteUser('${u.uid}')"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
    renderLogs();
    renderOnlineUsersAdmin();
};

window.renderOnlineUsersAdmin = () => {
    const countEl = document.getElementById('onlineCount');
    const listEl = document.getElementById('adminOnlineUsers');
    if (!countEl || !listEl) return;
    countEl.innerText = onlineUsersList.length;
    listEl.innerHTML = onlineUsersList.length === 0 ? '<span style="color: var(--text-dim);">Нет онлайн пользователей</span>' : 
        onlineUsersList.map(name => `<span class="online-tag"><i class="fas fa-circle" style="font-size: 8px; color: var(--success); margin-right: 6px;"></i>${name}</span>`).join('');
};

window.addBalance = (uid) => {
    const inp = document.getElementById(`balInput_${uid}`);
    const amount = parseInt(inp.value);
    if (isNaN(amount) || amount <= 0) return notify("Введите сумму!");
    const u = allUsers.find(user => user.uid === uid);
    if (u) {
        update(ref(db, `users/${uid}`), { balance: (u.balance || 0) + amount });
        addLog(`Админ ${currentUser.name} выдал ${amount} ₽ пользователю ${u.name}`);
        inp.value = '';
    }
};

window.changeRole = (uid, newRole) => {
    update(ref(db, `users/${uid}`), { role: newRole });
};

window.deleteUser = (uid) => {
    if (confirm(`Удалить аккаунт?`)) remove(ref(db, `users/${uid}`));
};

// --- ВСПОМОГАТЕЛЬНОЕ ---
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
    
    // Закрытие попапа пингов при клике вне
    document.addEventListener('click', (e) => {
        const popup = document.getElementById('mentionPopup');
        if (popup && e.target.id !== 'chatInput' && !e.target.closest('.mention-option')) {
            popup.style.display = 'none';
        }
    });
});