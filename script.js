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
let authMode = 'login';
let activeReactMsgId = null;

// Настройки кейсов (предметы)
const items = [
    { name: "AWP | Dragon Lore", rarity: "legendary", price: 50000 },
    { name: "M4A4 | Howl", rarity: "legendary", price: 40000 },
    { name: "AK-47 | Fire Serpent", rarity: "epic", price: 15000 },
    { name: "Knife | Doppler", rarity: "epic", price: 20000 },
    { name: "Glock | Fade", rarity: "rare", price: 5000 },
    { name: "USP-S | Kill Confirmed", rarity: "rare", price: 3000 },
    { name: "P250 | Sand Dune", rarity: "common", price: 10 }
];

// --- ОБРАБОТКА ВХОДА STEAM (ТВОЯ СИСТЕМА) ---
const urlParams = new URLSearchParams(window.location.search);
const steamNick = urlParams.get('nickname') || urlParams.get('name');
if (steamNick) {
    localStorage.setItem('hurus_session', steamNick);
    window.history.replaceState({}, document.title, window.location.pathname);
}

// --- СИНХРОНИЗАЦИЯ ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.entries(data.users).map(([id, val]) => ({ uid: id, ...val })) : [];
        renderChat(data.messages || {});
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
                renderInventory(); // Обновляем инвентарь при входе
            }
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// --- ЛОГИКА КЕЙСОВ И ИНВЕНТАРЯ (ИСПРАВЛЕНО) ---
window.openCase = (casePrice) => {
    if (!currentUser) return notify("Сначала войдите в аккаунт!");
    if (currentUser.balance < casePrice) return notify("Недостаточно средств!");

    // Случайный предмет
    const wonItem = items[Math.floor(Math.random() * items.length)];
    const newBalance = currentUser.balance - casePrice;
    
    // Добавляем в инвентарь
    const userInv = currentUser.inventory || [];
    userInv.push({ ...wonItem, id: Date.now() });

    update(ref(db, `users/${currentUser.uid}`), {
        balance: newBalance,
        inventory: userInv
    });

    notify(`Вы выбили: ${wonItem.name}!`);
};

function renderInventory() {
    const box = document.getElementById('inventoryList');
    if (!box || !currentUser) return;

    if (!currentUser.inventory || currentUser.inventory.length === 0) {
        box.innerHTML = '<div class="empty-msg">Ваш инвентарь пуст</div>';
        return;
    }

    box.innerHTML = currentUser.inventory.map(item => `
        <div class="item-card rarity-${item.rarity}">
            <div class="item-name">${item.name}</div>
            <div class="item-price">${item.price} ₽</div>
        </div>
    `).join('');
}

// --- ПАНЕЛЬ УПРАВЛЕНИЯ (ИСПРАВЛЕНО) ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    if (!list) return;
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance || 0} ₽</td>
            <td>
                <button class="btn-ok" onclick="promptAddBalance('${u.uid}')">Добавить ₽</button>
            </td>
            <td>
                <select onchange="changeRole('${u.uid}', this.value)">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="vip" ${u.role === 'vip' ? 'selected' : ''}>VIP</option>
                    <option value="moder" ${u.role === 'moder' ? 'selected' : ''}>Moder</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <button class="btn-del" onclick="clearUserInventory('${u.uid}')" style="background:#f39c12; margin-bottom:5px;">Очистить инв.</button>
                <button class="btn-del" onclick="deleteUser('${u.uid}')">Удалить</button>
            </td>
        </tr>
    `).join('');
};

// Выдача баланса (Админ пишет сколько добавить)
window.promptAddBalance = (uid) => {
    const amount = prompt("Введите сумму, которую хотите добавить на баланс:");
    if (amount === null || amount === "" || isNaN(amount)) return;
    
    const u = allUsers.find(user => user.uid === uid);
    if (u) {
        const newTotal = (u.balance || 0) + parseInt(amount);
        update(ref(db, `users/${uid}`), { balance: newTotal });
        notify(`Баланс ${u.name} пополнен на ${amount}₽`);
    }
};

// Очистка инвентаря из панели
window.clearUserInventory = (uid) => {
    if (confirm("Вы точно хотите очистить инвентарь этого пользователя?")) {
        update(ref(db, `users/${uid}`), { inventory: null });
        notify("Инвентарь очищен");
    }
};

window.changeRole = (uid, newRole) => update(ref(db, `users/${uid}`), { role: newRole });
window.deleteUser = (uid) => confirm("Удалить пользователя?") && remove(ref(db, `users/${uid}`));

// --- ВСЁ ОСТАЛЬНОЕ (БЕЗ ИЗМЕНЕНИЙ) ---
window.loginWithSteam = () => window.location.href = "https://hurus-backend.onrender.com/auth/steam";
window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

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
        if (!found) return notify("Ошибка!");
        localStorage.setItem('hurus_session', found.name);
    } else {
        if (allUsers.find(u => u.name === l)) return notify("Занято!");
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user', inventory: [] });
        localStorage.setItem('hurus_session', l);
    }
    location.reload();
};

function updateUI() {
    const isAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            <div class="profile-nick">${currentUser.name}</div>
            <div class="profile-balance">${currentUser.balance} ₽</div>
            <button class="btn-logout" onclick="logout()">Выйти</button>
        </div>
    `;
}

function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj).map(([id, data]) => ({ id, ...data }));
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div class="msg">
            <div class="msg-header"><span class="badge badge-${m.r}">${m.r}</span> <span class="msg-author">${m.u}</span></div>
            <div class="msg-text">${m.t}</div>
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'admin') renderAdmin();
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};