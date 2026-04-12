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

// СИНХРОНИЗАЦИЯ ДАННЫХ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        if (currentUser) {
            const myData = allUsers.find(u => u.name === currentUser.name);
            if (myData) {
                currentUser = myData;
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
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.some(u => u.name.toLowerCase() === l.toLowerCase())) return notify("Ник занят!");
        const role = l.toLowerCase() === 'мишутка фазбер' ? 'admin' : 'user';
        
        try {
            await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 0, role: role, inv: [] });
            notify("Регистрация успешна! Войди.");
            setAuthMode('login');
        } catch (e) { notify("Ошибка базы! Проверь Rules."); }
    } else {
        const user = allUsers.find(u => u.name === l && u.pass === p);
        if (!user) return notify("Неверный вход!");
        currentUser = user;
        onLogin();
    }
};

function onLogin() {
    closeModal();
    notify("Привет, " + currentUser.name);
    document.getElementById('authZone').innerHTML = `
        <div style="text-align:right; margin-right:12px">
            <div style="font-weight:800">${currentUser.name}</div>
            <div id="headerBal" style="color:var(--success); font-size:12px">${currentUser.balance} ₽</div>
        </div>
        <button class="btn btn-sm" style="background:var(--border); color:#fff" onclick="location.reload()">Выход</button>
    `;
    if (currentUser.role === 'admin') document.getElementById('adminLink').style.display = 'inline-block';
}

// ЧАТ
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser) return openModal('authModal');
    if (!inp.value.trim()) return;

    push(ref(db, 'messages'), {
        u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now()
    });
    inp.value = '';
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div style="margin-bottom:8px"><span class="badge badge-${m.r}">${m.r}</span><b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// АДМИНКА
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    document.getElementById('wipeZone').style.display = currentUser.role === 'admin' ? 'block' : 'none';

    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" class="admin-input-sum" style="width:50px; background:#000; color:#fff; border:1px solid var(--border)">
                <button onclick="giveBal('${u.name}')" class="btn-sm" style="background:var(--success); color:#fff; border:none; padding:3px 7px; border-radius:4px; cursor:pointer">OK</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td><button class="btn-sm" onclick="changeRole('${u.name}', 'admin')" style="font-size:10px">Сделать админом</button></td>
        </tr>
    `).join('');
}

window.giveBal = (name) => {
    const val = parseInt(document.getElementById('sum-'+name).value);
    const user = allUsers.find(u => u.name === name);
    if (!isNaN(val)) update(ref(db, 'users/'+name), { balance: user.balance + val });
};

window.changeRole = (name, role) => update(ref(db, 'users/'+name), { role: role });

// ПЕРЕКЛЮЧЕНИЕ СТРАНИЦ
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    const navBtn = document.getElementById('nav-'+id);
    if (navBtn) navBtn.classList.add('active');
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
window.wipeDatabase = () => { if(confirm("Удалить всех игроков?")) set(ref(db, 'users'), null); };

// КЕЙСЫ
window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 50) return notify("Недостаточно средств!");

    const items = ["AK-47 | Neon", "AWP | Dragon", "Knife | Doppler", "Glock | Water"];
    const win = items[Math.floor(Math.random() * items.length)];
    
    update(ref(db, 'users/' + currentUser.name), { 
        balance: currentUser.balance - 50,
        inv: [...(currentUser.inv || []), win]
    });
    
    document.getElementById('caseDisplay').innerText = "ROLLING...";
    setTimeout(() => {
        document.getElementById('caseDisplay').innerText = win;
        notify("Выпало: " + win);
    }, 1000);
};