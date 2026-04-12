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
let selectedUserForMenu = null; // Хранит имя пользователя для контекстного меню

// --- ПЕРЕМЕННЫЕ ДЛЯ ЧАТА ---
let currentChatTab = 'global'; 
let globalMessages = {};
let catMessages = {};
let privateMessages = {}; 
let activePmListeners = {}; 
let unreadPms = new Set(); 

const catUsers = ['mishkafazbear', 'amonphous', 'SharizMound', 'HuRuS'];

// --- АВТОРИЗАЦИЯ ---
const urlParams = new URLSearchParams(window.location.search);
const steamNick = urlParams.get('nickname') || urlParams.get('name'); 
if (steamNick) {
    localStorage.setItem('hurus_session', steamNick);
    window.history.replaceState({}, document.title, window.location.pathname);
}

onValue(ref(db, 'users'), (snapshot) => {
    const data = snapshot.val() || {};
    allUsers = Object.entries(data).map(([id, val]) => ({ uid: id, ...val }));
    
    const savedNick = localStorage.getItem('hurus_session');
    if (savedNick) {
        const found = allUsers.find(u => u.name === savedNick);
        if (found) {
            if (!currentUser || currentUser.name !== found.name) {
                currentUser = found;
                updateUI();
                initChat(); 
            } else {
                currentUser = found;
                updateUI();
            }
        }
    } else {
        currentUser = null;
        updateUI();
        renderChatPlaceHolder("Войдите, чтобы читать чат");
    }
});

// --- ДВИЖОК ЧАТА ---
function initChat() {
    listenToGlobalChat();
    if (currentUser && catUsers.includes(currentUser.name)) listenToCatsChat();
    if (currentUser) listenToPmList();
}

function getPmRoomId(user1, user2) {
    return [user1, user2].sort().join('_##_');
}

function listenToGlobalChat() {
    onValue(query(ref(db, 'messages'), limitToLast(50)), (snapshot) => {
        globalMessages = snapshot.val() || {};
        if (currentChatTab === 'global') renderChat(globalMessages);
        renderChatTabs();
    });
}

function listenToCatsChat() {
    onValue(query(ref(db, 'cat_messages'), limitToLast(50)), (snapshot) => {
        catMessages = snapshot.val() || {};
        if (currentChatTab === 'cats') renderChat(catMessages);
        renderChatTabs();
    });
}

function listenToPrivateMessages(targetUser) {
    if (!currentUser || activePmListeners[targetUser]) return; 
    if (!privateMessages[targetUser]) privateMessages[targetUser] = {};

    const roomId = getPmRoomId(currentUser.name, targetUser);
    activePmListeners[targetUser] = onValue(query(ref(db, `pms/${roomId}`), limitToLast(50)), (snapshot) => {
        const msgs = snapshot.val() || {};
        privateMessages[targetUser] = msgs;
        if (snapshot.exists()) {
            const lastMsg = Object.values(msgs).sort((a,b) => b.time - a.time)[0];
            if (lastMsg.u !== currentUser.name && currentChatTab !== `pm_${targetUser}`) {
                unreadPms.add(targetUser);
                notify(`Сообщение от ${targetUser}`);
            }
        }
        renderChatTabs();
        if (currentChatTab === `pm_${targetUser}`) renderChat(msgs, true, targetUser);
    });
}

function listenToPmList() {
    if (!currentUser) return;
    onValue(ref(db, `user_pms/${currentUser.name}`), (snapshot) => {
        const data = snapshot.val() || {};
        Object.keys(data).forEach(partner => {
            if (!activePmListeners[partner]) listenToPrivateMessages(partner);
        });
        renderChatTabs();
    });
}

// Делаем функции переключения чатов глобальными
window.switchChat = (tabType, targetUser = null) => {
    const newTabId = tabType === 'pm' ? `pm_${targetUser}` : tabType;
    if (currentChatTab === newTabId) return;
    currentChatTab = newTabId;

    if (tabType === 'pm') {
        unreadPms.delete(targetUser);
        if (!activePmListeners[targetUser]) listenToPrivateMessages(targetUser);
    }

    renderChatTabs();
    if (tabType === 'global') renderChat(globalMessages);
    else if (tabType === 'cats') {
        if (!currentUser || !catUsers.includes(currentUser.name)) renderChatPlaceHolder("Доступ запрещен =^.^=");
        else renderChat(catMessages);
    } 
    else if (tabType === 'pm') renderChat(privateMessages[targetUser] || {}, true, targetUser);
};

// --- РЕНДЕРИНГ ---
function renderChatTabs() {
    const tabsBox = document.getElementById('chatTabs');
    if (!tabsBox) return;
    let html = `<button class="chat-tab-btn ${currentChatTab === 'global' ? 'active' : ''}" onclick="switchChat('global')">Глобальный</button>`;
    if (currentUser && catUsers.includes(currentUser.name)) {
        html += `<button class="chat-tab-btn tab-cats ${currentChatTab === 'cats' ? 'active' : ''}" onclick="switchChat('cats')">Чат Котиков <3</button>`;
    }
    Object.keys(privateMessages).forEach(withUser => {
        const isActive = currentChatTab === `pm_${withUser}`;
        html += `<button class="chat-tab-btn tab-pm ${isActive ? 'active' : ''} ${unreadPms.has(withUser) && !isActive ? 'has-unread' : ''}" onclick="switchChat('pm', '${withUser}')"><i class="fas fa-envelope"></i> ${withUser}</button>`;
    });
    tabsBox.innerHTML = html;
}

window.renderChat = (messagesObj, isPm = false, pmPartner = null) => {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj || {}).map(([id, data]) => ({ id, ...data }));
    if (msgs.length === 0) {
        box.innerHTML = `<div class="chat-placeholder">${isPm ? 'Напишите первое сообщение...' : 'Сообщений нет'}</div>`;
        return;
    }
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userRole = isPm ? 'user' : (m.r || 'user');
        const badge = isPm ? '' : `<span class="badge badge-${userRole}">${userRole.toUpperCase()}</span>`;
        const authorClick = (currentUser && m.u !== currentUser.name) ? `onclick="openUserMenu('${m.u}', event)"` : ''; // Вызов меню
        return `
            <div class="msg ${currentUser && m.u === currentUser.name ? 'msg-me' : ''}">
                <div class="msg-header">
                    ${badge}
                    <span class="msg-author" ${authorClick}>${m.u}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${m.t}</div>
            </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
};

// --- КОНТЕКСТНОЕ МЕНЮ (ИСПРАВЛЕНО) ---
window.openUserMenu = (userName, event) => {
    event.preventDefault();
    event.stopPropagation(); // Останавливаем всплытие, чтобы документ не закрыл меню сразу
    
    selectedUserForMenu = userName;
    const menu = document.getElementById('userContextMenu');
    document.getElementById('menuUserName').innerText = userName;
    
    menu.style.display = 'block';
    menu.style.position = 'fixed'; // Используем fixed для надежности
    menu.style.left = event.clientX + 'px';
    menu.style.top = event.clientY + 'px';
};

window.menuStartPm = () => {
    if (selectedUserForMenu) {
        switchChat('pm', selectedUserForMenu);
        document.getElementById('userContextMenu').style.display = 'none';
    }
};

document.addEventListener('click', (e) => {
    const menu = document.getElementById('userContextMenu');
    if (menu && !menu.contains(e.target)) menu.style.display = 'none'; // Закрытие при клике мимо
});

// --- ОСТАЛЬНЫЕ ФУНКЦИИ ---
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    const text = inp.value.trim();
    if (!currentUser || !text) return;
    const msg = { u: currentUser.name, r: currentUser.role, t: text, time: Date.now() };
    if (currentChatTab === 'global') push(ref(db, 'messages'), msg);
    else if (currentChatTab === 'cats') push(ref(db, 'cat_messages'), msg);
    else if (currentChatTab.startsWith('pm_')) {
        const target = currentChatTab.replace('pm_', '');
        push(ref(db, `pms/${getPmRoomId(currentUser.name, target)}`), { u: currentUser.name, t: text, time: Date.now() });
        update(ref(db, `user_pms/${currentUser.name}/${target}`), { last_time: Date.now() });
        update(ref(db, `user_pms/${target}/${currentUser.name}`), { last_time: Date.now() });
    }
    inp.value = '';
};

function renderChatPlaceHolder(text) {
    document.getElementById('chatMessages').innerHTML = `<div class="chat-placeholder">${text}</div>`;
}

window.logout = () => {
    localStorage.removeItem('hurus_session');
    location.reload();
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
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user' });
        localStorage.setItem('hurus_session', l);
    }
    location.reload();
};

window.setAuthMode = (mode) => {
    authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-reg').classList.toggle('active', mode === 'reg');
};

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${id}`) || document.getElementById('adminLink');
    if(activeBtn) activeBtn.classList.add('active');
};

function updateUI() {
    const zone = document.getElementById('authZone');
    const isAdmin = currentUser && ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    if (currentUser) {
        zone.innerHTML = `
            <div class="profile-info-block">
                <div class="profile-avatar-placeholder"><i class="fas fa-user"></i></div>
                <div class="profile-text-data">
                    <div class="profile-nick">${currentUser.name}</div>
                    <div class="profile-balance">${currentUser.balance || 0} ₽</div>
                </div>
                <button class="btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i></button>
            </div>`;
    } else {
        zone.innerHTML = `<button class="btn btn-primary" onclick="openModal('authModal')">ВОЙТИ</button>`;
    }
}

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};