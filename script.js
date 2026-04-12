// Импорт Firebase модулей (используем CDN для работы прямо в браузере)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyA7j4u6K3HlgRWULMP0KAOUbjIHAuv5K6s",
  authDomain: "hurus-1.firebaseapp.com",
  projectId: "hurus-1",
  storageBucket: "hurus-1.firebasestorage.app",
  messagingSenderId: "646638352213",
  appId: "1:646638352213:web:1c4605bfea30e7c14fa1dc",
  measurementId: "G-6P7CG9Z04Y",
  databaseURL: "https://hurus-1-default-rtdb.firebaseio.com" // Ссылка на твою базу
};

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

let currentUser = null;
let authMode = 'login';
let allUsers = [];

// СЛУШАТЕЛЬ ДАННЫХ (Обновляет всё в реальном времени)
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        // Если юзер залогинен, обновляем его локальные данные из базы
        if (currentUser) {
            const freshData = allUsers.find(u => u.name === currentUser.name);
            if (freshData) {
                currentUser = freshData;
                document.getElementById('headerBal').innerText = `${currentUser.balance} ₽`;
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

    if (authMode === 'reg') {
        if (allUsers.some(u => u.name.toLowerCase() === l.toLowerCase())) return notify("Ник занят!");
        
        const newUser = {
            name: l,
            pass: p,
            balance: 0,
            role: l.toLowerCase() === 'мишутка фазбер' ? 'admin' : 'user',
            inv: []
        };
        
        await set(ref(db, 'users/' + l), newUser);
        notify("Регистрация успешна!");
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверный логин!");
        currentUser = found;
        onLogin();
    }
};

function onLogin() {
    closeModal();
    notify("Привет, " + currentUser.name);
    document.getElementById('authZone').innerHTML = `
        <div style="display:flex; align-items:center; gap:12px">
            <div style="text-align:right">
                <div style="font-weight:700">${currentUser.name}</div>
                <div style="color:var(--success); font-size:12px" id="headerBal">${currentUser.balance} ₽</div>
            </div>
            <button class="btn-sm" onclick="location.reload()">Выход</button>
        </div>
    `;
    if (currentUser.role === 'admin' || currentUser.role === 'moder') {
        document.getElementById('adminLink').style.display = 'inline-block';
    }
}

// ЧАТ
window.sendChatMessage = () => {
    if (!currentUser) return openModal('authModal');
    const inp = document.getElementById('chatInput');
    if (!inp.value.trim()) return;

    const msgId = Date.now();
    set(ref(db, 'messages/' + msgId), {
        u: currentUser.name,
        t: inp.value,
        r: currentUser.role,
        time: msgId
    });
    inp.value = '';
};

function renderChat(messages) {
    const box = document.getElementById('chatMessages');
    messages.sort((a, b) => a.time - b.time);
    box.innerHTML = messages.map(m => `
        <div class="msg">
            <span class="badge badge-${m.r || 'user'}">${m.r || 'user'}</span>
            <b>${m.u}:</b> ${m.t.replace(/</g, "&lt;")}
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// АДМИНКА
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    const isOwner = currentUser.role === 'admin';
    document.getElementById('wipeZone').style.display = isOwner ? 'block' : 'none';

    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td><b>${u.balance} ₽</b></td>
            <td>
                <input type="number" id="give-${u.name}" class="admin-input-sum" placeholder="0">
                <button class="btn-sm" onclick="giveBal('${u.name}')">OK</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                ${isOwner ? `
                    <select class="role-select" onchange="changeRole('${u.name}', this.value)">
                        <option value="user" ${u.role==='user'?'selected':''}>User</option>
                        <option value="moder" ${u.role==='moder'?'selected':''}>Moder</option>
                        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                    </select>
                ` : '---'}
            </td>
        </tr>
    `).join('');
}

window.giveBal = (userName) => {
    const amount = parseInt(document.getElementById('give-' + userName).value);
    if (isNaN(amount)) return notify("Сумма?");
    const user = allUsers.find(u => u.name === userName);
    update(ref(db, 'users/' + userName), { balance: user.balance + amount });
    notify("Баланс обновлен");
};

window.changeRole = (userName, newRole) => {
    update(ref(db, 'users/' + userName), { role: newRole });
    notify("Роль изменена");
};

// КЕЙСЫ
window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Нет денег!");

    const items = ["AK-47", "AWP", "Knife", "Glock"];
    const win = items[Math.floor(Math.random() * items.length)];
    
    update(ref(db, 'users/' + currentUser.name), { 
        balance: currentUser.balance - 50,
        inv: [...(currentUser.inv || []), win]
    });
    
    document.getElementById('caseDisplay').innerText = win;
    notify("Выпало: " + win);
};

// ТЕХНИЧЕСКИЕ ФУНКЦИИ (Глобальные)
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if(id === 'admin') renderAdmin();
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.setAuthMode = (m) => { authMode = m; };
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

window.wipeDatabase = () => {
    if(confirm("Удалить ВСЕХ юзеров?")) set(ref(db, 'users'), null);
};

// Запуск серверов (визуально)
document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('serverList').innerHTML = `<div class="card">HuRuS MIRAGE #1 (12/20)</div>`;
});