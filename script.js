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
let authMode = 'login';
let allUsers = [];

// СЛУШАТЕЛЬ ДАННЫХ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        if (!currentUser) {
            const saved = localStorage.getItem('hurus_session');
            if (saved) {
                const found = allUsers.find(u => u.name === saved);
                if (found) { currentUser = found; onLogin(true); }
            }
        }
        if (currentUser) {
            const fresh = allUsers.find(u => u.name === currentUser.name);
            if (fresh) currentUser = fresh;
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
        if (allUsers.some(u => u.name.toLowerCase() === l.toLowerCase())) return notify("Ник занят!");
        const admins = ['мишутка фазбер', 'sharizmound'];
        const role = admins.includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role, inv: [] });
        notify("Успешная регистрация!");
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверные данные!");
        currentUser = found;
        localStorage.setItem('hurus_session', currentUser.name);
        onLogin(false);
    }
};

function onLogin(auto) {
    closeModal();
    if(!auto) notify("С возвращением!");
    document.getElementById('authZone').innerHTML = `
        <div style="display:flex; align-items:center; gap:12px">
            <div style="text-align:right">
                <div style="font-weight:800; font-size:14px">${currentUser.name}</div>
                <div style="color:var(--primary); font-size:12px; font-weight:800">${currentUser.balance} ₽</div>
            </div>
            <button class="btn btn-main" style="padding:5px 10px; font-size:10px" onclick="logout()">ВЫЙТИ</button>
        </div>
    `;
    if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'inline-block';
}

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

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
        <div style="margin-bottom:8px">
            <span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// АДМИНКА (ВЫДАЧА РОЛЕЙ)
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b>${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" style="width:50px; background:#000; color:#fff; border:1px solid var(--border); padding:5px; border-radius:5px">
                <button onclick="giveBal('${u.name}')" class="btn-main" style="padding:5px 8px; font-size:10px">ОК</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; border:1px solid var(--border); padding:5px; border-radius:5px">
                    <option value="" disabled selected>Изменить</option>
                    <option value="user">User</option>
                    <option value="vip">VIP</option>
                    <option value="premium">Premium</option>
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

window.changeRole = (name, newRole) => {
    update(ref(db, 'users/'+name), { role: newRole });
    notify(`Роль игрока ${name} изменена на ${newRole}`);
};

// ОБЩЕЕ
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById('nav-'+id); if(btn) btn.classList.add('active');
    if (id === 'admin') renderAdmin();
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

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Недостаточно средств!");
    const items = ["Aura Knife", "Cyber AK-47", "Neon Glock", "AWP Retro"];
    const win = items[Math.floor(Math.random() * items.length)];
    update(ref(db, 'users/' + currentUser.name), { balance: currentUser.balance - 50, inv: [...(currentUser.inv || []), win] });
    document.getElementById('caseDisplay').innerText = win;
    notify("Выпало: " + win);
};