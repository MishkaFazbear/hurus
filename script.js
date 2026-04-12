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

// --- ЛОГИКА STEAM (Должна быть выше onValue) ---
const urlParams = new URLSearchParams(window.location.search);
const steamId = urlParams.get('steamid');
const steamName = urlParams.get('name');
const steamAvatar = urlParams.get('avatar');

if (steamId && steamName) {
    handleSteamLogin(steamId, steamName, steamAvatar);
    // Убираем мусор из адресной строки
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function handleSteamLogin(id, name, avatarUrl) {
    const avatar = avatarUrl || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";
    const userRef = ref(db, 'users/' + name);
    
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
        // Регистрация нового через Steam
        await set(userRef, { 
            name: name, 
            steamId: id,
            avatar: avatar,
            balance: 100, 
            role: 'user', 
            inventory: [] 
        });
    } else {
        // Обновляем данные существующего
        await update(userRef, { steamId: id, avatar: avatar });
    }

    // КРИТИЧЕСКИЙ МОМЕНТ: Сохраняем ник в память браузера
    localStorage.setItem('hurus_session', name);
    notify(`Авторизация успешна: ${name}`);
    
    // Перезагрузка не нужна, onValue подхватит изменения автоматически
}

// --- СИНХРОНИЗАЦИЯ С БАЗОЙ ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
                updateInventory();
            }
        }
    }
});

// Обновление интерфейса (профиль)
function updateUI() {
    if (!currentUser) return;
    
    const avatarHtml = currentUser.avatar 
        ? `<img src="${currentUser.avatar}" class="profile-avatar">` 
        : `<div class="profile-avatar-placeholder"><i class="fas fa-user"></i></div>`;

    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            ${avatarHtml}
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i></button>
        </div>
    `;
    
    const hasAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = hasAdmin ? 'block' : 'none';
    document.getElementById('clearChatBtn').style.display = hasAdmin ? 'block' : 'none';
}

// Обычная авторизация
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: 'user' });
        notify("Регистрация успешна!");
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка входа!");
        localStorage.setItem('hurus_session', found.name);
        closeModal();
    }
};

window.loginWithSteam = () => {
    window.location.href = "https://hurus-backend.onrender.com/auth/steam";
};

window.logout = () => {
    localStorage.removeItem('hurus_session');
    location.reload();
};

// --- ОСТАЛЬНЫЕ ФУНКЦИИ (Чат, Кейсы, Админка) ---
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div class="msg"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'admin') renderAdmin();
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.setAuthMode = (m) => {
    authMode = m;
    document.getElementById('tab-login').classList.toggle('active', m === 'login');
    document.getElementById('tab-reg').classList.toggle('active', m === 'reg');
};
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

// Заглушки для инвентаря и админки, чтобы не было ошибок
function updateInventory() {}
function renderAdmin() {}