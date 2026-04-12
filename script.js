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

// СЛУШАТЕЛЬ БАЗЫ
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
            if (fresh) {
                currentUser = fresh;
                const balEl = document.getElementById('headerBal');
                if(balEl) balEl.innerText = `${currentUser.balance} ₽`;
            }
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Введите данные!");

    if (authMode === 'reg') {
        if (allUsers.some(u => u.name.toLowerCase() === l.toLowerCase())) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role, inv: [] });
        notify("Регистрация завершена!");
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка входа!");
        currentUser = found;
        localStorage.setItem('hurus_session', currentUser.name);
        onLogin(false);
    }
};

function onLogin(auto) {
    closeModal();
    if(!auto) notify("С возвращением, " + currentUser.name + "!");
    document.getElementById('authZone').innerHTML = `
        <div style="display:flex; align-items:center; gap:15px">
            <div style="text-align:right">
                <div style="font-weight:800; font-size:0.9rem">${currentUser.name}</div>
                <div id="headerBal" style="color:var(--primary); font-weight:800; font-size:0.8rem">${currentUser.balance} ₽</div>
            </div>
            <button class="btn" style="background:var(--border); color:#fff; border-radius:10px" onclick="logout()">Выход</button>
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
        <div style="margin-bottom:12px; font-size:0.85rem">
            <span class="badge badge-${m.r}" style="padding:2px 6px; border-radius:4px; font-weight:800; background:var(--border); font-size:10px; margin-right:5px">${m.r}</span>
            <b style="color:var(--primary)">${m.u}:</b> <span style="color:#ddd">${m.t}</span>
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// КЕЙСЫ
window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Пополни баланс!");
    const items = ["AK-47 | Ледяной", "M4A4 | Вой", "Нож-бабочка", "Glock | Дух", "AWP | Азимов"];
    const win = items[Math.floor(Math.random() * items.length)];
    update(ref(db, 'users/' + currentUser.name), { balance: currentUser.balance - 50, inv: [...(currentUser.inv || []), win] });
    document.getElementById('caseDisplay').innerText = "КРУТИМ...";
    setTimeout(() => { document.getElementById('caseDisplay').innerText = win; notify("Выпало: " + win); }, 1000);
};

// АДМИНКА
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b style="color:#fff">${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" style="width:50px; background:#000; color:#fff; border:1px solid var(--border); padding:5px; border-radius:5px">
                <button onclick="giveBal('${u.name}')" class="btn btn-primary" style="padding:5px 10px; font-size:10px">ОК</button>
            </td>
            <td><span class="badge">${u.role}</span></td>
        </tr>
    `).join('');
}

window.giveBal = (n) => {
    const v = parseInt(document.getElementById('sum-'+n).value);
    const u = allUsers.find(x => x.name === n);
    if (!isNaN(v)) update(ref(db, 'users/'+n), { balance: u.balance + v });
};

// ОБЩЕЕ
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const n = document.getElementById('nav-'+id); if(n) n.classList.add('active');
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