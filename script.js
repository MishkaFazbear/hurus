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

// СИНХРОНИЗАЦИЯ С БАЗОЙ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        if (currentUser) {
            const myData = allUsers.find(u => u.name === currentUser.name);
            if (myData) {
                currentUser = myData;
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
        const role = l.toLowerCase() === 'мишутка фазбер' ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role, inv: [] });
        notify("Готово! Теперь войди.");
        setAuthMode('login');
    } else {
        const user = allUsers.find(u => u.name === l && u.pass === p);
        if (!user) return notify("Ошибка входа!");
        currentUser = user;
        onLogin();
    }
};

function onLogin() {
    closeModal();
    notify("Привет, " + currentUser.name);
    document.getElementById('authZone').innerHTML = `
        <div style="text-align:right; margin-right:10px">
            <b>${currentUser.name}</b><br><span id="headerBal" style="color:var(--success)">${currentUser.balance} ₽</span>
        </div>
        <button class="btn" style="background:var(--border); color:#fff" onclick="location.reload()">Выход</button>
    `;
    if (currentUser.role === 'admin' || currentUser.role === 'moder') {
        document.getElementById('adminLink').style.display = 'inline-block';
    }
}

// ЧАТ
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser) return openModal('authModal');
    if (!inp.value.trim()) return;

    push(ref(db, 'messages'), {
        u: currentUser.name,
        t: inp.value,
        r: currentUser.role,
        time: Date.now()
    });
    inp.value = '';
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div class="msg">
            <span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}
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
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" class="admin-input-sum">
                <button onclick="giveBal('${u.name}')" style="background:var(--success); border:none; border-radius:4px; color:#fff; cursor:pointer">OK</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                ${isOwner ? `
                    <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; border:1px solid var(--border)">
                        <option value="user" ${u.role==='user'?'selected':''}>User</option>
                        <option value="moder" ${u.role==='moder'?'selected':''}>Moder</option>
                        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                    </select>
                ` : '---'}
            </td>
        </tr>
    `).join('');
}

window.giveBal = (name) => {
    const val = parseInt(document.getElementById('sum-'+name).value);
    const user = allUsers.find(u => u.name === name);
    if (!isNaN(val)) update(ref(db, 'users/'+name), { balance: user.balance + val });
};

window.changeRole = (name, role) => {
    update(ref(db, 'users/'+name), { role: role });
};

// ОБЩЕЕ
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    if (id !== 'admin') document.getElementById('nav-'+id).classList.add('active');
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
window.closeModalOnOverlay = (e) => { if(e.target.classList.contains('modal-overlay')) closeModal(); };
window.wipeDatabase = () => { if(confirm("Вайпнуть всех?")) set(ref(db, 'users'), null); };