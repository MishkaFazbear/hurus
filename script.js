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
    if (!l || !p) return notify("Заполни поля!");

    const isReg = document.getElementById('tab-reg').classList.contains('active');
    if (isReg) {
        if (allUsers.some(u => u.name === l)) return notify("Ник занят!");
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: 'user', inv: [] });
        notify("Успех! Теперь войди.");
        setAuthMode('login');
    } else {
        const u = allUsers.find(u => u.name === l && u.pass === p);
        if (!u) return notify("Неверные данные!");
        currentUser = u;
        onLogin();
    }
};

function onLogin() {
    closeModal();
    updateHeader();
    if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'block';
    notify("Привет, " + currentUser.name);
}

function updateHeader() {
    const az = document.getElementById('authZone');
    az.innerHTML = `
        <div style="display:flex; align-items:center; gap:15px;">
            <div style="text-align:right">
                <div style="font-weight:800; font-size:13px">${currentUser.name}</div>
                <div style="font-size:11px; color:var(--success)">${currentUser.balance} ₽</div>
            </div>
            <button class="btn btn-danger" onclick="location.reload()" style="padding:5px 10px; font-size:9px">ВЫЙТИ</button>
        </div>
    `;
}

// АДМИНКА (Старая система с кнопками ОК)
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance} ₽</td>
            <td>
                <div style="display:flex; gap:5px">
                    <input type="number" id="amt-${u.name}" placeholder="₽" style="width:50px">
                    <button class="btn-ok" onclick="giveBalDirect('${u.name}')">OK</button>
                </div>
            </td>
            <td>
                <select id="role-${u.name}">
                    <option value="user" ${u.role==='user'?'selected':''}>user</option>
                    <option value="admin" ${u.role==='admin'?'selected':''}>admin</option>
                </select>
            </td>
            <td><button class="btn-ok" onclick="saveRoleDirect('${u.name}')">OK</button></td>
        </tr>
    `).join('');
}

window.giveBalDirect = (name) => {
    const amt = document.getElementById(`amt-${name}`).value;
    const user = allUsers.find(u => u.name === name);
    if (amt) update(ref(db, 'users/'+name), { balance: user.balance + parseInt(amt) });
};

window.saveRoleDirect = (name) => {
    const role = document.getElementById(`role-${name}`).value;
    update(ref(db, 'users/'+name), { role: role });
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
        <div style="margin-bottom:8px; font-size:13px"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// НАВИГАЦИЯ И УТИЛИТЫ
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
    const items = ["Aura Knife", "Dragon Lore", "Asimov AK-47"];
    const win = items[Math.floor(Math.random()*items.length)];
    update(ref(db, 'users/'+currentUser.name), { balance: currentUser.balance - 50 });
    document.getElementById('caseDisplay').innerText = win;
};