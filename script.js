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

// Список скинов с твоими картинками
const skins = [
    {n: "AWP | Dragon Lore", r: "legendary", img: "https://stash.clash.gg/storage/img/skin_sideview/s422.png"},
    {n: "Karambit | Doppler", r: "legendary", img: "https://community.fastly.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Q7uCvZaZkNM-SA1iUzv5mvOR7cDm7lA4i4gKJk4jxNWXFb1cpDJR2FOFbsBTql9bjYbzq7gPZiN1MxH7_2ytNuCdpte1UB_Ui5OSJ2GbkVqni/330x192?allow_animated=1"},
    {n: "AK-47 | Neon Rider", r: "epic", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcSvVWLxgb2VaDeU9L7JERaduIfcDRcBo-oBFw&s"},
    {n: "M4A4 | Howl", r: "legendary", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcRVudeuZU4_u5OKoWkAx2VXzHaIwowEaosrQQ&s"},
    {n: "Glock-18 | Fade", r: "rare", img: "https://encrypted-tbn0.gstatic.com/images?q=tbn:ANd9GcTXawvlE7ptxbIp-WiCbyqRL-CRVOKKthwa1A&s"},
    {n: "P250 | Sand Dune", r: "common", img: "https://pub-5f12f7508ff04ae5925853dee0438460.r2.dev/data/images/wiki_gf1Kc6S_preview.png"}
];

// ГЛАВНЫЙ СЛУШАТЕЛЬ ДАННЫХ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        // Проверка сессии (вход после перезагрузки)
        const saved = localStorage.getItem('hurus_session');
        if (saved && !currentUser) {
            const found = allUsers.find(u => u.name === saved);
            if (found) {
                currentUser = found;
                updateUI();
                updateInventory();
            }
        } else if (currentUser) {
            // Обновляем данные текущего юзера, если они изменились в БД
            currentUser = allUsers.find(u => u.name === currentUser.name) || currentUser;
            updateUI();
            updateInventory();
        }
    }
});

// ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
function updateUI() {
    if (!currentUser) return;
    
    document.getElementById('authZone').innerHTML = `
        <div class="profile-compact" style="display: flex; align-items: center; gap: 10px;">
            <b>${currentUser.name}</b> | <span style="color:var(--success)">${currentUser.balance} ₽</span>
            <button onclick="logout()" class="logout-btn" style="background: none; border: none; color: var(--danger); cursor: pointer; font-weight: 700; font-size: 11px;">ВЫЙТИ</button>
        </div>
    `;
    
    // Видимость STAFF контроля
    if (['admin', 'moder'].includes(currentUser.role)) {
        document.getElementById('adminLink').style.display = 'block';
        document.getElementById('clearChatBtn').style.display = 'block';
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    } else {
        document.getElementById('adminLink').style.display = 'none';
        document.getElementById('clearChatBtn').style.display = 'none';
    }
}

// ОТКРЫТИЕ КЕЙСА
window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 100) return notify("Недостаточно баланса!");

    const btn = document.getElementById('openBtn');
    btn.disabled = true;
    document.getElementById('caseDisplay').innerText = "Открытие...";

    setTimeout(() => {
        const win = skins[Math.floor(Math.random() * skins.length)];
        const currentInv = currentUser.inventory ? [...Object.values(currentUser.inventory)] : [];
        
        // Добавляем ID, чтобы предметы были уникальными
        currentInv.push({ ...win, id: Date.now() });

        update(ref(db, 'users/' + currentUser.name), { 
            balance: currentUser.balance - 100,
            inventory: currentInv
        });

        // Вывод результата с уменьшенной картинкой
        document.getElementById('caseDisplay').innerHTML = `
            <img src="${win.img}" style="width: 140px; height: auto; display: block; margin: 10px auto; filter: drop-shadow(0 0 10px rgba(255,255,255,0.2));">
            <span class="skin-${win.r}" style="font-weight: 800;">${win.n}</span>
        `;
        
        notify("Выпало: " + win.n);
        btn.disabled = false;
    }, 1200);
};

// ОБНОВЛЕНИЕ ИНВЕНТАРЯ
function updateInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!currentUser || !currentUser.inventory) {
        grid.innerHTML = '<p style="color:var(--text-dim)">Тут пока пусто...</p>';
        return;
    }
    
    const items = Object.values(currentUser.inventory);
    grid.innerHTML = items.map(item => `
        <div class="inventory-item skin-${item.r}">
            <div class="item-icon">
                <img src="${item.img}" style="width: 100%; max-width: 90px; height: auto; display: block; margin: 0 auto;">
            </div>
            <div class="item-name" style="font-size: 11px; margin-top: 8px; font-weight: 600;">${item.n}</div>
        </div>
    `).join('');
}

// АВТОРИЗАЦИЯ
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: role, inventory: [] });
        notify("Готово! Теперь войди."); 
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверные данные!");
        currentUser = found; 
        localStorage.setItem('hurus_session', currentUser.name); // Сохраняем сессию
        updateUI(); 
        closeModal();
        notify("С возвращением!");
    }
};

window.logout = () => {
    localStorage.removeItem('hurus_session'); 
    location.reload(); 
};

// ЧАТ
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

window.clearChat = () => {
    if (confirm("Очистить чат для всех?")) set(ref(db, 'messages'), null);
};

function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div class="msg"><span class="badge badge-${m.r}">${m.r}</span> <b>${m.u}:</b> ${m.t}</div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// STAFF ПАНЕЛЬ
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b>${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <button onclick="removeUser('${u.name}')" style="background:none; border:none; color:var(--danger); cursor:pointer;"><i class="fas fa-trash"></i></button>
                <button onclick="giveBal('${u.name}')" style="background:none; border:none; color:var(--success); cursor:pointer; font-size: 16px; margin-left: 10px;">+</button>
            </td>
        </tr>
    `).join('');
}

window.giveBal = (name) => {
    let amount = prompt("Сколько начислить?");
    if (amount && !isNaN(amount)) {
        const u = allUsers.find(x => x.name === name);
        update(ref(db, 'users/'+name), { balance: (u.balance || 0) + parseInt(amount) });
    }
};

window.removeUser = (name) => {
    if (name === currentUser.name) return notify("Себя нельзя!");
    if (confirm(`Удалить юзера ${name}?`)) remove(ref(db, 'users/' + name));
};

// НАВИГАЦИЯ
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
    authMode = m;
    document.getElementById('tab-login').classList.toggle('active', m === 'login');
    document.getElementById('tab-reg').classList.toggle('active', m === 'reg');
};

window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};