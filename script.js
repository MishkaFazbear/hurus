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

onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        if (currentUser) {
            const fresh = allUsers.find(u => u.name === currentUser.name);
            if (fresh) { currentUser = fresh; updateHeader(); }
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// ВЫХОД ИЗ АККАУНТА
window.logout = () => {
    currentUser = null;
    document.getElementById('adminLink').style.display = 'none';
    document.getElementById('authZone').innerHTML = `<button class="btn btn-primary" onclick="openModal('authModal')">ВОЙТИ</button>`;
    showSection('home');
    notify("Вы вышли из системы");
};

// ОБНОВЛЕНИЕ ШАПКИ
function updateHeader() {
    document.getElementById('authZone').innerHTML = `
        <div style="text-align:right">
            <div style="font-weight:800; color:#fff; font-size:14px;">${currentUser.name}</div>
            <div style="font-size:12px; color:var(--success); font-weight:700;">${currentUser.balance} ₽</div>
            <button class="btn-logout" onclick="logout()">ВЫЙТИ</button>
        </div>
    `;
}

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if(!l || !p) return notify("Заполни поля!");
    
    const isReg = document.getElementById('tab-reg').classList.contains('active');
    
    if (isReg) {
        if (allUsers.some(u => u.name === l)) return notify("Ник уже занят!");
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: 'user' });
        notify("Регистрация успешна!");
        setAuthMode('login');
    } else {
        const u = allUsers.find(u => u.name === l && u.pass === p);
        if (!u) return notify("Неверные данные!");
        currentUser = u;
        closeModal();
        updateHeader();
        if (u.role === 'admin' || u.role === 'moder') document.getElementById('adminLink').style.display = 'block';
        notify("Добро пожаловать!");
    }
};

// STAFF ПАНЕЛЬ
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td style="font-weight:bold">${u.name}</td>
            <td>
                <div style="display:flex; gap:5px">
                    <input type="number" id="amt-${u.name}" placeholder="${u.balance}">
                    <button class="btn-ok" onclick="giveBalDirect('${u.name}')">ОК</button>
                </div>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <select onchange="saveRoleDirect('${u.name}', this.value)">
                    <option value="" disabled selected>Изменить...</option>
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

window.giveBalDirect = (name) => {
    const amt = document.getElementById(`amt-${name}`).value;
    const user = allUsers.find(u => u.name === name);
    if (amt) {
        update(ref(db, 'users/'+name), { balance: user.balance + parseInt(amt) });
        notify("Баланс изменен");
    }
};

window.saveRoleDirect = (name, newRole) => {
    update(ref(db, 'users/'+name), { role: newRole });
    notify(`Роль ${name} теперь ${newRole}`);
};

// ЧАТ
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser) return openModal('authModal');
    if (!inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div style="font-size:13px; line-height:1.5;">
            <span class="badge badge-${m.r}">${m.r}</span> 
            <b style="color:${m.r==='moder'?'var(--moder)': (m.r==='admin'?'var(--danger)':'#fff')}">${m.u}:</b> 
            <span style="color:rgba(255,255,255,0.8)">${m.t}</span>
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

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
    document.getElementById('tab-login').classList.toggle('active', m === 'login');
    document.getElementById('tab-reg').classList.toggle('active', m === 'reg');
};
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};
window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Недостаточно средств!");
    const items = ["Dragon Lore", "Karambit", "M9 Bayonet", "AK-47 Slate"];
    const res = items[Math.floor(Math.random()*items.length)];
    update(ref(db, 'users/'+currentUser.name), { balance: currentUser.balance - 50 });
    document.getElementById('caseDisplay').innerText = res;
    notify("Вы выбили: " + res);
};