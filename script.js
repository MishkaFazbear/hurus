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


// --- КЕЙСЫ И ИНВЕНТАРЬ ---
window.openCase = () => {
    if (!currentUser) return notify("Сначала войдите в аккаунт!");
    if ((currentUser.balance || 0) < 100) return notify("Недостаточно средств (нужно 100 ₽)!");

    update(ref(db, `users/${currentUser.uid}`), { balance: currentUser.balance - 100 });

    const rand = Math.random();
    let item = {};

    // 👇 ВСТАВЬ СЮДА НАЗВАНИЯ И ССЫЛКИ НА СВОИ СТАРЫЕ КАРТИНКИ 👇
    if (rand < 0.05) { 
        item = { name: "Твое Легендарное", rarity: "legendary", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    } else if (rand < 0.20) { 
        item = { name: "Твое Тайное", rarity: "epic", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    } else if (rand < 0.50) { 
        item = { name: "Твое Засекреченное", rarity: "rare", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    } else { 
        item = { name: "Твое Армейское", rarity: "common", img: "ССЫЛКА_НА_СТАРУЮ_КАРТИНКУ" };
    }
    // 👆 ======================================================= 👆
    
    item.time = Date.now();

    push(ref(db, `users/${currentUser.uid}/inventory`), item);
    addLog(`Пользователь ${currentUser.name} открыл кейс и выбил ${item.name}`);

    const caseDisplay = document.getElementById('caseDisplay');
    caseDisplay.innerHTML = `<span class="skin-${item.rarity}" style="animation: fadeIn 0.5s;">Вам выпало: <br>${item.name}</span>`;
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
            <div class="item-icon"><img src="${i.img}" alt="${i.name}"></div>
            <div class="item-name skin-${i.rarity}">${i.name}</div>
        </div>
    `).join('');
}


// --- ЧАТ И РЕАКЦИИ ---
window.switchChat = (tab) => {
    currentChatTab = tab;
    
    // Стили вкладок
    document.getElementById('tab-global').style.color = tab === 'global' ? 'var(--primary)' : 'var(--text-dim)';
    document.getElementById('tab-global').style.borderBottom = tab === 'global' ? '2px solid var(--primary)' : 'none';
    
    const catTab = document.getElementById('tab-cats');
    if (catTab) {
        catTab.style.color = tab === 'cats' ? '#ff66b2' : 'var(--text-dim)';
        catTab.style.borderBottom = tab === 'cats' ? '2px solid #ff66b2' : 'none';
    }

    renderChat(tab === 'global' ? globalMessages : catMessages);
};

function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj || {}).map(([id, data]) => ({ id, ...data }));
    
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let reactHtml = '';
        if (m.reactions) {
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

        return `
            <div class="msg">
                <div class="msg-header">
                    <span class="badge badge-${m.r}">${m.r}</span>
                    <span class="msg-author">${m.u}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${m.t}</div>
                <div class="msg-footer">
                    <div class="reactions-container">
                        ${reactHtml}
                        <button class="btn-add-emoji" onclick="openEmojiPicker('${m.id}', event)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return notify("Сначала войдите в аккаунт!");
    const dbPath = currentChatTab === 'global' ? 'messages' : 'cat_messages';
    const reactRef = ref(db, `${dbPath}/${msgId}/reactions/${emoji}/${currentUser.name}`);
    const snap = await get(reactRef);
    if (snap.exists()) remove(reactRef);
    else set(reactRef, true);
};

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    
    const dbPath = currentChatTab === 'global' ? 'messages' : 'cat_messages';
    push(ref(db, dbPath), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
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
    } else {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user', avatar: '' });
        localStorage.setItem('hurus_session', l);
    }
    location.reload();
};

window.loginWithSteam = () => window.location.href = "https://hurus-backend.onrender.com/auth/steam";
window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

function updateUI() {
    const isAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    const clearChatBtn = document.getElementById('clearChatBtn');
    if (clearChatBtn) clearChatBtn.style.display = isAdmin ? 'block' : 'none';
    
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

    // Показываем Чат Котиков только для своих
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
                <button class="btn-del" onclick="clearInventory('${u.uid}')" title="Очистить инвентарь" style="color: var(--vip-color); margin-right: 10px;"><i class="fas fa-box-open"></i></button>
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

window.clearInventory = (uid) => {
    const u = allUsers.find(user => user.uid === uid);
    if (confirm(`Очистить инвентарь ${u.name}?`)) {
        remove(ref(db, `users/${uid}/inventory`));
        addLog(`Администратор ${currentUser.name} очистил инвентарь пользователя ${u.name}`);
        notify("Инвентарь очищен");
    }
};

window.deleteUser = (uid) => {
    const u = allUsers.find(user => user.uid === uid);
    if (confirm(`Удалить аккаунт ${u.name}? Это действие нельзя отменить.`)) {
        remove(ref(db, `users/${uid}`));
        addLog(`Администратор ${currentUser.name} УДАЛИЛ аккаунт ${u.name}`);
    }
};

window.clearChat = () => {
    if (confirm("Очистить глобальный чат?")) {
        set(ref(db, 'messages'), null);
        addLog(`Администратор ${currentUser.name} очистил глобальный чат`);
    }
};

// --- ВСПОМОГАТЕЛЬНОЕ ---
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    const activeBtn = document.getElementById(`nav-${id}`) || document.getElementById('adminLink');
    if(activeBtn) activeBtn.classList.add('active');

    if (id === 'admin') renderAdmin();
    if (id === 'inventory') renderInventory();
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