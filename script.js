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

// СЛУШАТЕЛЬ ДАННЫХ
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

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни все поля!");

    const isReg = document.getElementById('tab-reg').classList.contains('active');
    if (isReg) {
        if (allUsers.some(u => u.name === l)) return notify("Ник занят!");
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: 'user' });
        notify("Успешная регистрация!");
        setAuthMode('login');
    } else {
        const u = allUsers.find(u => u.name === l && u.pass === p);
        if (!u) return notify("Неверный логин или пароль!");
        currentUser = u;
        closeModal();
        updateHeader();
        if (currentUser.role === 'admin' || currentUser.role === 'moder') {
            document.getElementById('adminLink').style.display = 'block';
        }
        notify("С возвращением!");
    }
};

function updateHeader() {
    const az = document.getElementById('authZone');
    az.innerHTML = `
        <div style="text-align:right">
            <div style="font-weight:800; font-size:14px;">${currentUser.name}</div>
            <div style="font-size:12px; color:var(--success); font-weight:bold;">${currentUser.balance} ₽</div>
        </div>
    `;
}

// STAFF ПАНЕЛЬ
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td style="font-weight:bold">${u.name}</td>
            <td>${u.balance} ₽</td>
            <td>
                <div style="display:flex; gap:5px">
                    <input type="number" id="amt-${u.name}" placeholder="₽" style="width:60px">
                    <button class="btn-ok" onclick="giveBalDirect('${u.name}')">ОК</button>
                </div>
            </td>
            <td>
                <select id="role-${u.name}">
                    <option value="user" ${u.role==='user'?'selected':''}>user</option>
                    <option value="vip" ${u.role==='vip'?'selected':''}>vip</option>
                    <option value="premium" ${u.role==='premium'?'selected':''}>premium</option>
                    <option value="moder" ${u.role==='moder'?'selected':''}>moder</option>
                    <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
                </select>
            </td>
            <td><button class="btn-ok" onclick="saveRoleDirect('${u.name}')">ОК</button></td>
        </tr>
    `).join('');
}

window.giveBalDirect = (name) => {
    const amt = document.getElementById(`amt-${name}`).value;
    const user = allUsers.find(u => u.name === name);
    if (amt) {
        update(ref(db, 'users/'+name), { balance: user.balance + parseInt(amt) });
        document.getElementById(`amt-${name}`).value = '';
        notify(`Выдано ${amt} ₽`);
    }
};

window.saveRoleDirect = (name) => {
    const role = document.getElementById(`role-${name}`).value;
    update(ref(db, 'users/'+name), { role: role });
    notify(`Роль обновлена на ${role}`);
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
        <div style="margin-bottom:2px; font-size:13px; line-height:1.4;">
            <span class="badge badge-${m.r}">${m.r}</span> 
            <b style="color:${m.r==='moder'?'var(--moder)': (m.r==='admin'?'var(--danger)':'inherit')}">${m.u}:</b> 
            <span style="color:#d1d5db">${m.t}</span>
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// УТИЛИТЫ НАВИГАЦИИ
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
    toast.innerText = t; 
    toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Недостаточно средств!");
    const res = ["Dragon Lore", "Нож", "Ширпотреб", "Тайное"][Math.floor(Math.random()*4)];
    update(ref(db, 'users/'+currentUser.name), { balance: currentUser.balance - 50 });
    document.getElementById('caseDisplay').innerText = res;
};