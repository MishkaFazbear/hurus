import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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
        
        // Авто-вход
        const saved = localStorage.getItem('hurus_session');
        if (saved && !currentUser) {
            const found = allUsers.find(u => u.name === saved);
            if (found) {
                currentUser = found;
                updateUI();
                updateInventory();
            }
        } else if (currentUser) {
            currentUser = allUsers.find(u => u.name === currentUser.name) || currentUser;
            updateUI();
            updateInventory();
        }
    }
});

function updateUI() {
    if (!currentUser) return;
    document.getElementById('authZone').innerHTML = `
        <div class="profile-compact">
            <b>${currentUser.name}</b> | <span style="color:var(--success)">${currentUser.balance}₽</span>
            <button onclick="logout()" class="logout-btn">ВЫЙТИ</button>
        </div>
    `;
    
    // Показываем STAFF панель сразу
    if (['admin', 'moder'].includes(currentUser.role)) {
        document.getElementById('adminLink').style.display = 'block';
        document.getElementById('clearChatBtn').style.display = 'block';
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
}

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: role, inventory: [] });
        notify("Успех! Войдите."); setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка!");
        currentUser = found;
        localStorage.setItem('hurus_session', currentUser.name);
        updateUI(); closeModal();
    }
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

// Кейсы и Инвентарь
const skins = [
    {n: "AWP | Dragon Lore", r: "legendary", img: "🐲"},
    {n: "M9 Bayonet | Doppler", r: "legendary", img: "🔪"},
    {n: "AK-47 | Neon Rider", r: "epic", img: "🔫"},
    {n: "Glock-18 | Fade", r: "rare", img: "🌈"}
];

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 100) return notify("Мало ₽");
    const win = skins[Math.floor(Math.random()*skins.length)];
    const inv = currentUser.inventory ? [...Object.values(currentUser.inventory)] : [];
    inv.push({...win, id: Date.now()});
    update(ref(db, 'users/'+currentUser.name), { balance: currentUser.balance - 100, inventory: inv });
    document.getElementById('caseDisplay').innerHTML = `<span class="skin-${win.r}">${win.n}</span>`;
};

function updateInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!currentUser || !currentUser.inventory) return grid.innerHTML = 'Пусто';
    grid.innerHTML = Object.values(currentUser.inventory).map(i => `
        <div class="inventory-item skin-${i.r}">
            <div class="item-icon">${i.img}</div>
            <div class="item-name">${i.n}</div>
        </div>
    `).join('');
}

// Админка
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance}₽</td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <button onclick="removeUser('${u.name}')" class="btn-del"><i class="fas fa-trash"></i></button>
                <button onclick="giveBal('${u.name}')" class="btn-add">+</button>
            </td>
        </tr>
    `).join('');
}

window.removeUser = (n) => { if(confirm('Удалить?')) remove(ref(db, 'users/'+n)); };
window.giveBal = (n) => { let s = prompt('Сколько?'); if(s) update(ref(db,'users/'+n), {balance: (allUsers.find(u=>u.name===n).balance || 0) + parseInt(s)}); };

// Чат
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (currentUser && inp.value.trim()) {
        push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
        inp.value = '';
    }
};
window.clearChat