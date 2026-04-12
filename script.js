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

// ГЛАВНЫЙ СЛУШАТЕЛЬ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        // Восстановление сессии
        const saved = localStorage.getItem('hurus_session');
        if (saved) {
            currentUser = allUsers.find(u => u.name === saved);
            if (currentUser) {
                updateUI(); // Обновляем интерфейс (включая админку)
                updateInventory();
            }
        }

        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА И ПРАВ
function updateUI() {
    if (!currentUser) return;
    
    // Профиль
    document.getElementById('authZone').innerHTML = `
        <div class="profile-block">
            <div class="p-info">
                <span class="p-name">${currentUser.name}</span>
                <span class="p-money">${currentUser.balance} ₽</span>
            </div>
            <button class="logout-link" onclick="logout()">ВЫЙТИ</button>
        </div>
    `;

    // Права STAFF (ВИДИМОСТЬ КНОПОК)
    const isAdmin = currentUser.role === 'admin';
    const isModer = currentUser.role === 'moder';

    if (isAdmin || isModer) {
        document.getElementById('adminLink').style.display = 'block';
        document.getElementById('clearChatBtn').style.display = 'flex';
    } else {
        document.getElementById('adminLink').style.display = 'none';
        document.getElementById('clearChatBtn').style.display = 'none';
    }
}

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: role, inventory: [] });
        notify("Успешно! Войди в аккаунт");
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка входа!");
        currentUser = found;
        localStorage.setItem('hurus_session', currentUser.name);
        updateUI();
        closeModal();
    }
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

// ЧАТ
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

window.clearChat = () => {
    if (confirm("Удалить всю историю чата?")) set(ref(db, 'messages'), null);
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
    {n: "M9 Bayonet | Doppler", r: "legendary", img: "🔪"},
    {n: "AK-47 | Neon Rider", r: "epic", img: "🔫"},
    {n: "Glock-18 | Fade", r: "rare", img: "🌈"}
];

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 100) return notify("Нужно 100 ₽");

    const btn = document.getElementById('openBtn');
    btn.disabled = true;
    document.getElementById('caseDisplay').innerText = "Крутим...";

    setTimeout(() => {
        const win = skins[Math.floor(Math.random()*skins.length)];
        const currentInv = currentUser.inventory ? [...Object.values(currentUser.inventory)] : [];
        currentInv.push({ ...win, id: Date.now() });

        update(ref(db, 'users/' + currentUser.name), { 
            balance: currentUser.balance - 100,
            inventory: currentInv
        });
        document.getElementById('caseDisplay').innerHTML = `<span class="skin-${win.r}">${win.n}</span>`;
        btn.disabled = false;
    }, 1000);
};

function updateInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!currentUser || !currentUser.inventory) return grid.innerHTML = 'Пусто';
    grid.innerHTML = Object.values(currentUser.inventory).map(i => `
        <div class="inventory-item skin-${i.r}">
            <div class="item-icon">${i.img}</div>
            <div class="item-name">${i.n}</div>
        </div>
    `).join('');
}

// STAFF ПАНЕЛЬ (ПРАВА)
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    const isAdmin = currentUser.role === 'admin';

    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b>${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                ${isAdmin ? `
                    <button class="btn-sm btn-danger" onclick="removeUser('${u.name}')"><i class="fas fa-user-times"></i></button>
                    <input type="number" id="give-${u.name}" placeholder="₽" style="width:50px; background:#000; border:1px solid #333; color:#fff;">
                    <button class="btn-sm btn-success" onclick="giveBal('${u.name}')">+</button>
                    <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; font-size:10px;">
                        <option value="">Роль</option>
                        <option value="user">User</option>
                        <option value="vip">VIP</option>
                        <option value="moder">Moder</option>
                        <option value="admin">Admin</option>
                    </select>
                ` : `<span style="color:gray; font-size:11px;">Нет доступа</span>`}
            </td>
        </tr>
    `).join('');
}

window.giveBal = (name) => {
    const val = parseInt(document.getElementById('give-'+name).value);
    const u = allUsers.find(x => x.name === name);
    if (!isNaN(val)) update(ref(db, 'users/'+name), { balance: (u.balance || 0) + val });
};
window.changeRole = (name, role) => { if(role) update(ref(db, 'users/'+name), { role: role }); };
window.removeUser = (name) => { if(confirm(`Удалить ${name}?`)) remove(ref(db, 'users/'+name)); };

// НАВИГАЦИЯ
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