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

let currentUser = JSON.parse(localStorage.getItem('hurus_user')) || null;
let allUsers = [];
let authMode = 'login';

// СИНХРОНИЗАЦИЯ
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
    if (!l || !p) return notify("Заполните все поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Никнейм занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role });
        notify("Успешная регистрация!"); setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверный ник или пароль!");
        currentUser = found;
        localStorage.setItem('hurus_user', JSON.stringify(found));
        updateUI(); closeModal(); notify("Добро пожаловать!");
    }
};

function updateUI() {
    if (!currentUser) return;
    document.getElementById('authZone').innerHTML = `
        <div style="text-align:right">
            <div style="font-weight:800; color:var(--primary)">${currentUser.name}</div>
            <div style="font-size:12px; color:var(--subtext)">${currentUser.balance} ₽</div>
        </div>
    `;
    if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'block';
}

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser) return notify("Войдите в аккаунт!");
    if (!inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).slice(-50).map(m => `
        <div class="chat-msg">
            <span class="badge badge-${m.r}">${m.r}</span>
            <strong style="color:var(--primary)">${m.u}:</strong> <span>${m.t}</span>
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+id)?.classList.add('active');
    if (id === 'admin') renderAdmin();
};

window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><strong>${u.name}</strong></td>
            <td>${u.balance} ₽</td>
            <td><button class="btn-main" style="padding:5px 10px" onclick="giveBal('${u.name}')">Баланс</button></td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; border:1px solid #333; padding:5px; border-radius:5px;">
                    <option value="">Роль...</option>
                    <option value="user">User</option>
                    <option value="vip">VIP</option>
                    <option value="premium">Prem</option>
                    <option value="admin">Admin</option>
                </select>
            </td>
        </tr>
    `).join('');
};

window.giveBal = (name) => {
    const val = prompt("Сколько начислить?");
    if (val && !isNaN(val)) update(ref(db, 'users/'+name), { balance: (allUsers.find(u=>u.name===name).balance || 0) + parseInt(val) });
};

window.changeRole = (name, role) => {
    if (role) update(ref(db, 'users/'+name), { role: role });
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.getElementById('authModal').style.display = 'none';
window.setAuthMode = (m) => { 
    authMode = m; 
    document.getElementById('tab-login').classList.toggle('active', m==='login');
    document.getElementById('tab-reg').classList.toggle('active', m==='reg');
};
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Недостаточно средств!");
    const items = ["★ Нож-бабочка", "AK-47 | Неоновая революция", "Glock-18 | Дух воды", "Ничего"];
    const win = items[Math.floor(Math.random()*items.length)];
    update(ref(db, 'users/'+currentUser.name), { balance: currentUser.balance - 50 });
    document.getElementById('caseDisplay').innerText = win;
    notify("Вы выбили: " + win);
};

if (currentUser) updateUI();