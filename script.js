import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// СИНХРОНИЗАЦИЯ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        // Авто-логин из localStorage или обновление текущего юзера
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick && !currentUser) {
            currentUser = allUsers.find(u => u.name === savedNick);
        } else if (currentUser) {
            currentUser = allUsers.find(u => u.name === currentUser.name);
        }

        if (currentUser) {
            updateUI();
            updateInventory();
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: role, inventory: [] });
        notify("Готово! +100₽ бонусом"); 
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверный вход!");
        currentUser = found; 
        localStorage.setItem('hurus_session', currentUser.name); // Сохраняем сессию
        updateUI(); 
        closeModal();
        notify("Добро пожаловать!");
    }
};

window.logout = () => {
    localStorage.removeItem('hurus_session'); // Удаляем сессию
    location.reload(); 
};

function updateUI() {
    if (!currentUser) return;
    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()">ВЫЙТИ</button>
        </div>
    `;
    if (['admin', 'moder'].includes(currentUser.role)) {
        document.getElementById('adminLink').style.display = 'block';
        document.getElementById('clearChatBtn').style.display = 'block';
    }
}

// ЧАТ
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

window.clearChat = () => {
    if (confirm("Очистить чат для всех?")) set(ref(db, 'messages'), null);
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div class="msg"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// КЕЙСЫ
const skins = [
    {n: "AWP | Dragon Lore", r: "legendary", img: "🐲"},
    {n: "Karambit | Doppler", r: "legendary", img: "🔪"},
    {n: "AK-47 | Neon Rider", r: "epic", img: "🔫"},
    {n: "M4A4 | Howl", r: "legendary", img: "🐺"},
    {n: "Glock-18 | Fade", r: "rare", img: "🌈"},
    {n: "P250 | Sand Dune", r: "common", img: "🏜️"}
];

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 100) return notify("Недостаточно баланса!");

    const btn = document.getElementById('openBtn');
    btn.disabled = true;
    document.getElementById('caseDisplay').innerText = "Открытие...";

    setTimeout(() => {
        const win = skins[Math.floor(Math.random() * skins.length)];
        const currentInv = currentUser.inventory ? [...Object.values(currentUser.inventory)] : [];
        currentInv.push({ ...win, id: Date.now() });

        update(ref(db, 'users/' + currentUser.name), { 
            balance: currentUser.balance - 100,
            inventory: currentInv
        });

        document.getElementById('caseDisplay').innerHTML = `<span class="skin-${win.r}">${win.n}</span>`;
        notify("Выпало: " + win.n);
        btn.disabled = false;
    }, 1200);
};

function updateInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!currentUser || !currentUser.inventory) {
        grid.innerHTML = '<p style="color:var(--text-dim)">Тут пока пусто...</p>';
        return;
    }
    const items = Object.values(currentUser.inventory);
    grid.innerHTML = items.map(item => `
        <div class="inventory-item skin-${item.r}">
            <div class="item-icon">${item.img}</div>
            <div class="item-name">${item.n}</div>
        </div>
    `).join('');
}

// STAFF
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b>${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" placeholder="Сумма" style="width:70px; background:#000; color:#fff; border:1px solid var(--border); padding:4px;">
                <button onclick="giveBal('${u.name}')" class="btn-ok">+</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <button onclick="removeUser('${u.name}')" class="btn-del" title="Удалить юзера"><i class="fas fa-trash"></i></button>
                <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; border:1px solid var(--border); padding:4px;">
                    <option value="">Роль...</option>
                    <option value="user">User</option>
                    <option value="vip">VIP</option>
                    <option value="moder">Moder</option>
                    <option value="admin">Admin</option>
                </select>
            </td>
        </tr>
    `).join('');
}

window.giveBal = (name) => {
    const val = parseInt(document.getElementById('sum-'+name).value);
    const u = allUsers.find(x => x.name === name);
    if (!isNaN(val)) update(ref(db, 'users/'+name), { balance: (u.balance || 0) + val });
};

window.changeRole = (name, role) => {
    if (role) update(ref(db, 'users/'+name), { role: role });
};

window.removeUser = (name) => {
    if (name === currentUser.name) return notify("Себя нельзя!");
    if (confirm(`Удалить ${name}?`)) remove(ref(db, 'users/' + name));
};

// ОБЩЕЕ
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+id)?.classList.add('active');
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