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

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role });
        notify("Регистрация успешна!"); setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверные данные!");
        currentUser = found; updateUI(); closeModal(); notify("Привет, " + l);
    }
};

function updateUI() {
    document.getElementById('authZone').innerHTML = `<div style="text-align:right"><b>${currentUser.name}</b><br><span style="color:#9d50bb">${currentUser.balance} ₽</span></div>`;
    if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'block';
}

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div style="margin-bottom:8px"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance} ₽</td>
            <td><button class="btn-main" style="padding:5px" onclick="giveBal('${u.name}')">Баланс</button></td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <select onchange="changeRole('${u.name}', this.value)">
                    <option value="">Сменить...</option>
                    <option value="vip">VIP</option>
                    <option value="premium">PREM</option>
                    <option value="admin">ADM</option>
                </select>
            </td>
        </tr>
    `).join('');
}

window.giveBal = (name) => {
    const val = prompt("Введите сумму:");
    if (val) update(ref(db, 'users/'+name), { balance: (allUsers.find(u=>u.name===name).balance || 0) + parseInt(val) });
};

window.changeRole = (name, role) => {
    if (role) update(ref(db, 'users/'+name), { role: role });
};

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+id)?.classList.add('active');
    if (id === 'admin') renderAdmin();
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.getElementById('authModal').style.display = 'none';
window.setAuthMode = (m) => { authMode = m; };
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Мало денег!");
    const items = ["Aura Knife", "Neon AK", "Glock Water"];
    const win = items[Math.floor(Math.random()*items.length)];
    update(ref(db, 'users/'+currentUser.name), { balance: currentUser.balance - 50 });
    document.getElementById('caseDisplay').innerText = win;
};