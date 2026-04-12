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

// --- ЛОГИКА STEAM (Обработка возврата) ---
const urlParams = new URLSearchParams(window.location.search);
const steamId = urlParams.get('steamid');
const steamName = urlParams.get('name');
const steamAvatar = urlParams.get('avatar');

if (steamId && steamName) {
    handleSteamLogin(steamId, steamName, steamAvatar);
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function handleSteamLogin(id, name, avatarUrl) {
    const avatar = avatarUrl || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";
    const userRef = ref(db, 'users/' + name);
    
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
        await set(userRef, { 
            name: name, 
            steamId: id,
            avatar: avatar,
            balance: 100, 
            role: 'user', 
            inventory: [] 
        });
    } else {
        await update(userRef, { steamId: id, avatar: avatar });
    }

    localStorage.setItem('hurus_session', name);
    // После входа через Steam принудительно обновляем страницу один раз
    location.reload(); 
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
                // Если мы сейчас в разделе админки, перерисовываем её
                if (document.getElementById('admin').classList.contains('active')) renderAdmin();
            }
        }
    }
});

// --- ОБНОВЛЕНИЕ ИНТЕРФЕЙСА ---
function updateUI() {
    if (!currentUser) return;
    
    const avatarHtml = currentUser.avatar 
        ? `<img src="${currentUser.avatar}" class="profile-avatar" style="width:35px; border-radius:50%; border:2px solid var(--primary);">` 
        : `<i class="fas fa-user-circle" style="font-size:24px;"></i>`;

    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            ${avatarHtml}
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
        </div>
    `;
    
    // ПРОВЕРКА РОЛИ: admin или moder
    const hasAdminRights = ['admin', 'moder'].includes(currentUser.role);
    const adminBtn = document.getElementById('adminLink');
    const chatClearBtn = document.getElementById('clearChatBtn');
    
    if (adminBtn) adminBtn.style.display = hasAdminRights ? 'block' : 'none';
    if (chatClearBtn) chatClearBtn.style.display = hasAdminRights ? 'block' : 'none';
    
    // Если права пропали, а мы в админке — выкидываем на главную
    if (!hasAdminRights && document.getElementById('admin').classList.contains('active')) {
        showSection('home');
        notify("Доступ ограничен");
    }
}

// --- STAFF ПАНЕЛЬ (ВОССТАНОВЛЕНА) ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    if (!list) return;

    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>
                ${u.avatar ? `<img src="${u.avatar}" style="width:24px; border-radius:50%; vertical-align:middle; margin-right:5px;">` : ''}
                <b>${u.name}</b>
            </td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" placeholder="Сумма" style="width:70px; background:#000; color:#fff; border:1px solid var(--border); padding:4px; border-radius:4px;">
                <button onclick="giveBal('${u.name}')" class="btn-ok" style="background:var(--success); color:#fff; border:none; padding:4px 8px; border-radius:4px; cursor:pointer;">+</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <button onclick="removeUser('${u.name}')" class="btn-del" style="color:var(--danger); background:none; border:none; cursor:pointer; font-size:16px; margin-right:10px;"><i class="fas fa-trash"></i></button>
                <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; border:1px solid var(--border); border-radius:4px;">
                    <option value="">Роль...</option>
                    <option value="user">User</option>
                    <option value="vip">VIP</option>
                    <option value="moder">Moder</option>
                    <option value="admin">Admin</option>
                </select>
            </td>
        </tr>
    `).join('');
};

window.giveBal = (name) => {
    const input = document.getElementById('sum-' + name);
    const val = parseInt(input.value);
    const u = allUsers.find(x => x.name === name);
    if (!isNaN(val) && u) {
        update(ref(db, 'users/' + name), { balance: (u.balance || 0) + val });
        input.value = '';
        notify(`Баланс ${name} обновлен`);
    }
};

window.changeRole = (name, role) => {
    if (role) {
        update(ref(db, 'users/' + name), { role: role });
        notify(`Роль ${name} изменена на ${role}`);
    }
};

window.removeUser = (name) => {
    if (name === currentUser.name) return notify("Себя нельзя!");
    if (confirm(`Удалить пользователя ${name}?`)) {
        remove(ref(db, 'users/' + name));
    }
};

// --- ОСТАЛЬНОЕ ---

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: role, inventory: [] });
        notify("Регистрация успешна!");
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка входа!");
        currentUser = found; 
        localStorage.setItem('hurus_session', currentUser.name);
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

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+id)?.classList.add('active');
    if (id === 'admin') renderAdmin();
};

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

window.clearChat = () => {
    if (confirm("Очистить весь чат?")) set(ref(db, 'messages'), null);
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    if (!box) return;
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div class="msg"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.setAuthMode = (m) => {
    authMode = m;
    document.getElementById('tab-login').classList.toggle('active', m === 'login');
    document.getElementById('tab-reg').classList.toggle('active', m === 'reg');
};
window.notify = (t) => {
    const toast = document.getElementById('toast');
    if(toast) {
        toast.innerText = t; toast.style.display = 'block';
        setTimeout(() => toast.style.display = 'none', 3000);
    }
};

// Заглушки, чтобы не было ошибок
function updateInventory() {}