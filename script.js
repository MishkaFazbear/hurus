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

// СИНХРОНИЗАЦИЯ С Firebase
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        if (currentUser) {
            const freshData = allUsers.find(u => u.name === currentUser.name);
            if (freshData) {
                currentUser = freshData;
                updateHeaderProfile(); // Обновляем баланс в шапке
            }
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (document.getElementById('tab-reg').classList.contains('active')) {
        // Регистрация
        if (allUsers.some(u => u.name === l)) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role, inv: [] });
        notify("Успешно! Теперь войди.");
        setAuthMode('login');
    } else {
        // Вход
        const user = allUsers.find(u => u.name === l && u.pass === p);
        if (!user) return notify("Ошибка входа!");
        currentUser = user;
        onLoginSuccess();
    }
};

function onLoginSuccess() {
    closeModal();
    notify("Привет, " + currentUser.name);
    updateHeaderProfile();
    if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'block';
}

// ФУНКЦИЯ ОБНОВЛЕНИЯ ШАПКИ (Добавлен ник, баланс и кнопка ВЫЙТИ)
function updateHeaderProfile() {
    const authZone = document.getElementById('authZone');
    authZone.innerHTML = `
        <div style="display:flex; align-items:center; gap:20px;">
            <div style="text-align:right;">
                <div style="font-weight:800; font-size:14px; color:#fff;">${currentUser.name}</div>
                <div style="font-size:12px; color:var(--success); font-weight:600;">${currentUser.balance} ₽</div>
            </div>
            <button class="btn btn-danger btn-sm" onclick="logout()" style="padding: 8px 16px; font-size:10px;">ВЫЙТИ</button>
        </div>
    `;
}

// ФУНКЦИЯ ВЫХОДА
window.logout = () => {
    currentUser = null;
    location.reload(); // Самый простой способ сбросить состояние
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
        <div style="margin-bottom:10px;"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// АДМИНКА
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance} ₽</td>
            <td><button class="btn btn-primary btn-sm" onclick="giveBal('${u.name}')" style="padding:5px 10px; font-size:10px;">+ ₽</button></td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td><button class="btn btn-danger btn-sm" onclick="changeRole('${u.name}', 'admin')" style="padding:5px 10px; font-size:10px;">UP</button></td>
        </tr>
    `).join('');
}

window.giveBal = (name) => {
    const amt = prompt("Сколько выдать?");
    const user = allUsers.find(u => u.name === name);
    if (amt && !isNaN(amt)) update(ref(db, 'users/'+name), { balance: user.balance + parseInt(amt) });
};

window.changeRole = (name, role) => update(ref(db, 'users/'+name), { role: role });

// ОБЩЕЕ
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+id)?.classList.add('active');
    if (id === 'admin') renderAdmin();
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
    if (currentUser.balance < 50) return notify("Мало денег!");
    const items = ["Aura Knife", "Retro AK-47", "Neon Glock"];
    const win = items[Math.floor(Math.random() * items.length)];
    update(ref(db, 'users/' + currentUser.name), { balance: currentUser.balance - 50 });
    document.getElementById('caseDisplay').innerText = win;
    notify("Выпало: " + win);
};