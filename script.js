import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// СИНХРОНИЗАЦИЯ С Firebase
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        if (currentUser) {
            currentUser = allUsers.find(u => u.name === currentUser.name) || currentUser;
            updateUI();
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполните поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        // Вставь свой ник вместо "твой_ник", чтобы получить права админа при регистрации
        const role = ['мишутка фазбер', 'sharizmound', 'твой_ник'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role });
        notify("Успешно!"); setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка!");
        currentUser = found; updateUI(); closeModal();
    }
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
    
    // Показываем админ-панель и кнопку очистки чата для стаффа
    if (currentUser.role === 'admin' || currentUser.role === 'moder') {
        document.getElementById('adminLink').style.display = 'block';
        document.getElementById('clearChatBtn').style.display = 'block'; 
    }
}

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

// ЧАТ
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

window.clearChat = () => {
    if (!currentUser || (currentUser.role !== 'admin' && currentUser.role !== 'moder')) return;
    
    if (confirm("Вы уверены, что хотите полностью очистить историю чата?")) {
        set(ref(db, 'messages'), null);
        notify("Чат успешно очищен!");
    }
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div style="margin-bottom:5px"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// STAFF ПАНЕЛЬ
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b>${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" style="width:50px; background:#000; color:#fff; border:1px solid var(--border); padding:5px;">
                <button onclick="giveBal('${u.name}')" class="btn-ok">OK</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; border:1px solid var(--border); padding:5px;">
                    <option value="">Сменить...</option>
                    <option value="user">User</option>
                    <option value="vip">VIP</option>
                    <option value="premium">MVP</option>
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

// КЕЙСЫ
window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Мало монет!");
    const items = ["Aura Knife", "Neon AK", "Glock Water"];
    const win = items[Math.floor(Math.random()*items.length)];
    update(ref(db, 'users/'+currentUser.name), { balance: currentUser.balance - 50 });
    document.getElementById('caseDisplay').innerText = win;
    notify("Выпало: " + win);
};

// Сессия
const saved = localStorage.getItem('hurus_session');
if (saved) {
    currentUser = allUsers.find(u => u.name === saved);
    if (currentUser) updateUI();
}