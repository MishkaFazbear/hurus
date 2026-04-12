import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
const catUsers = ['mishkafazbear', 'amonphous', 'SharizMound'];

// --- 1. ОБРАБОТКА ВОЗВРАТА ИЗ STEAM ---
const urlParams = new URLSearchParams(window.location.search);
const steamNick = urlParams.get('nickname') || urlParams.get('name'); 
if (steamNick) {
    localStorage.setItem('hurus_session', steamNick);
    window.history.replaceState({}, document.title, window.location.pathname);
}

// --- СИНХРОНИЗАЦИЯ С БД ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.entries(data.users).map(([id, val]) => ({ uid: id, ...val })) : [];
        allLogs = data.logs ? Object.values(data.logs).sort((a, b) => b.time - a.time) : [];
        
        globalMessages = data.messages || {};
        catMessages = data.cat_messages || {};
        
        // Рендерим нужный чат
        renderChat(currentChatTab === 'global' ? globalMessages : catMessages);
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
                renderInventory();
            }
        }
        
        if (document.getElementById('admin') && document.getElementById('admin').classList.contains('active')) {
            renderAdmin();
        }
    }
});

// --- СИСТЕМА ЛОГОВ ---
function addLog(text) {
    push(ref(db, 'logs'), { text, time: Date.now() });
}

// --- КЕЙСЫ И ИНВЕНТАРЬ ---
window.openCase = () => {
    if (!currentUser) return notify("Сначала войдите в аккаунт!");
    if ((currentUser.balance || 0) < 100) return notify("Недостаточно средств (нужно 100 ₽)!");

    update(ref(db, `users/${currentUser.uid}`), { balance: currentUser.balance - 100 });

    const rand = Math.random();
    let item = {};

    // Оставляем структуру для старых предметов
    if (rand < 0.05) { 
        item = { name: "Твое Легендарное", rarity: "legendary", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    } else if (rand < 0.20) { 
        item = { name: "Твое Тайное", rarity: "epic", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    } else if (rand < 0.50) { 
        item = { name: "Твое Засекреченное", rarity: "rare", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    } else { 
        item = { name: "Твое Армейское", rarity: "common", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    }
    
    item.time = Date.now();
    push(ref(db, `users/${currentUser.uid}/inventory`), item);
    addLog(`Пользователь ${currentUser.name} выбил ${item.name}`);

    document.getElementById('caseDisplay').innerHTML = `<span class="skin-${item.rarity}">Вам выпало: <br>${item.name}</span>`;
};

function renderInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;
    if (!currentUser || !currentUser.inventory) {
        grid.innerHTML = '<div style="grid-column: 1 / -1; text-align: center; color: var(--text-dim); padding: 40px;">Ваш инвентарь пуст</div>';
        return;
    }
    const items = Object.values(currentUser.inventory).sort((a, b) => b.time - a.time);
    grid.innerHTML = items.map(i => `
        <div class="inventory-item">
            <div class="item-icon"><img src="${i.img}"></div>
            <div class="item-name skin-${i.rarity}">${i.name}</div>
        </div>
    `).join('');
}

// --- ЧАТ И РЕАКЦИИ ---
window.switchChat = (tab) => {
    currentChatTab = tab;
    
    // Переключаем классы активности для вкладок
    document.getElementById('tab-global').classList.toggle('active', tab === 'global');
    const catTab = document.getElementById('tab-cats');
    if (catTab) catTab.classList.toggle('active', tab === 'cats');

    renderChat(tab === 'global' ? globalMessages : catMessages);
};

function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    if (!box) return;

    const msgs = Object.entries(messagesObj || {}).map(([id, data]) => ({ id, ...data }));
    
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let reactHtml = '';
        if (m.reactions) {
            reactHtml = Object.entries(m.reactions).map(([emoji, users]) => {
                const count = Object.keys(users).length;
                const hasMyReact = currentUser && users[currentUser.name] ? 'active' : '';
                return `<div class="react-item ${hasMyReact}" onclick="toggleReaction('${m.id}', '${emoji}')"><span class="react-emoji">${emoji}</span><span class="react-count">${count}</span></div>`;
            }).join('');
        }

        return `
            <div class="msg">
                <div class="msg-header">
                    <span class="badge badge-${m.r}">${m.r}</span>
                    <span class="msg-author">${m.u}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${m.t}</div>
                <div class="msg-footer">
                    <div class="reactions-container">${reactHtml}
                        <button class="btn-add-emoji" onclick="openEmojiPicker('${m.id}', event)"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
            </div>`;
    }).join('');

    // Авто-прокрутка вниз
    setTimeout(() => {
        box.scrollTo({ top: box.scrollHeight, behavior: 'smooth' });
    }, 50);
}

window.toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return notify("Войдите в аккаунт!");
    const dbPath = currentChatTab === 'global' ? 'messages' : 'cat_messages';
    const reactRef = ref(db, `${dbPath}/${msgId}/reactions/${emoji}/${currentUser.name}`);
    const snap = await get(reactRef);
    if (snap.exists()) remove(reactRef); else set(reactRef, true);
};

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    const dbPath = currentChatTab === 'global' ? 'messages' : 'cat_messages';
    push(ref(db, dbPath), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
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

    // Чат Котиков
    const chatTabs = document.getElementById('chatTabs');
    if (catUsers.includes(currentUser.name)) {
        if (!document.getElementById('tab-cats')) {
            const catBtn = document.createElement('button');
            catBtn.id = 'tab-cats';
            catBtn.innerHTML = 'Чат Котиков <3';
            catBtn.onclick = () => switchChat('cats');
            chatTabs.appendChild(catBtn);
        }
    }
}

// --- ВСПОМОГАТЕЛЬНОЕ ---
window.setAuthMode = (mode) => {
    authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-reg').classList.toggle('active', mode === 'reg');
};

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполните поля!");
    if (authMode === 'login') {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка!");
        localStorage.setItem('hurus_session', found.name);
    } else {
        if (allUsers.find(u => u.name === l)) return notify("Занято!");
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user', avatar: '' });
        localStorage.setItem('hurus_session', l);
    }
    location.reload();
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'admin') renderAdmin();
    if (id === 'inventory') renderInventory();
};
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
        if (!currentUser) return notify("Войдите!");
        activeReactMsgId = msgId;
        globalPicker.style.display = 'block';
        const rect = event.currentTarget.getBoundingClientRect();
        globalPicker.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        globalPicker.style.left = (rect.left + window.scrollX - 200) + 'px';
    };
    pickerElement.addEventListener('emoji-click', e => {
        toggleReaction(activeReactMsgId, e.detail.unicode);
        globalPicker.style.display = 'none';
    });
});