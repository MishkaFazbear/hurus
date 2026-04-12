import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// 1. ПРОВЕРКА ВХОДА ЧЕРЕЗ STEAM (сразу при загрузке)
const urlParams = new URLSearchParams(window.location.search);
const steamId = urlParams.get('steamid');
const steamName = urlParams.get('name');
const steamAvatar = urlParams.get('avatar');

if (steamId && steamName) {
    handleSteamLogin(steamId, steamName, steamAvatar);
    // Очищаем URL от параметров, чтобы при перезагрузке не входить заново
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function handleSteamLogin(id, name, avatarUrl) {
    const avatar = avatarUrl || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";
    const userRef = ref(db, 'users/' + name);
    
    // Проверяем, есть ли такой юзер в базе
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
        // Если новый — регистрируем
        await set(userRef, { 
            name: name, 
            steamId: id,
            avatar: avatar,
            balance: 100, 
            role: 'user', 
            inventory: [] 
        });
    } else {
        // Если старый — обновляем аватарку и ID
        await update(userRef, { steamId: id, avatar: avatar });
    }

    // Сохраняем сессию в браузере
    localStorage.setItem('hurus_session', name);
    location.reload(); // Перезагружаем, чтобы onValue подхватил данные
}

// 2. СИНХРОНИЗАЦИЯ С БАЗОЙ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
                updateInventory();
            } else {
                logout();
            }
        }

        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// 3. ОБНОВЛЕНИЕ ИНТЕРФЕЙСА АККАУНТА
function updateUI() {
    if (!currentUser) return;
    
    // Генерируем HTML для блока профиля с аватаркой
    const avatarImg = currentUser.avatar ? `<img src="${currentUser.avatar}" class="profile-avatar">` : '';

    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            ${avatarImg}
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()" title="Выйти"><i class="fas fa-sign-out-alt"></i></button>
        </div>
    `;
    
    const hasAdminRights = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = hasAdminRights ? 'block' : 'none';
    document.getElementById('clearChatBtn').style.display = hasAdminRights ? 'block' : 'none';
    
    if (!hasAdminRights && document.getElementById('admin').classList.contains('active')) {
        showSection('home');
    }
}

// --- ОСТАЛЬНЫЕ ФУНКЦИИ ---

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполни поля!");

    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        const role = ['мишутка фазбер', 'sharizmound'].includes(l.toLowerCase()) ? 'admin' : 'user';
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: role, inventory: [] });
        notify("Готово! +100₽ бонусом"); 
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверный вход!");
        currentUser = found; 
        localStorage.setItem('hurus_session', currentUser.name);
        updateUI(); 
        closeModal();
    }
};

window.loginWithSteam = () => {
    notify("Перенаправление в Steam...");
    window.location.href = "https://hurus-backend.onrender.com/auth/steam";
};

window.logout = () => {
    localStorage.removeItem('hurus_session');
    location.reload(); 
};

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

const skins = [
    {n: "AWP | Dragon Lore", r: "legendary", img: "https://stash.clash.gg/storage/img/skin_sideview/s422.png"},
    {n: "Karambit | Doppler", r: "legendary", img: "https://community.fastly.steamstatic.com/economy/image/i0CoZ81Ui0m-9KwlBY1L_18myuGuq1wfhWSaZgMttyVfPaERSR0Wqmu7LAocGIGz3UqlXOLrxM-vMGmW8VNxu5Dx60noTyL6kJ_m-B1Q7uCvZaZkNM-SA1iUzv5mvOR7cDm7lA4i4gKJk4jxNWXFb1cpDJR2FOFbsBTql9bjYbzq7gPZiN1MxH7_2ytNuCdpte1UB_Ui5OSJ2GbkVqni/330x192?allow_animated=1"},
    {n: "AK-47 | Neon Rider", r: "epic", img: "https://ss.bitskins.com/ab/ab6308d8e743e1fcc04fd5b10fd48489-front.webp"},
    {n: "P250 | Sand Dune", r: "common", img: "https://pub-5f12f7508ff04ae5925853dee0438460.r2.dev/data/images/wiki_gf1Kc6S_preview.png"}
];

window.openCase = () => {
    if (!currentUser) return openModal('authModal');
    if (currentUser.balance < 100) return notify("Недостаточно баланса!");
    const btn = document.getElementById('openBtn');
    btn.disabled = true;
    document.getElementById('caseDisplay').innerText = "Открытие...";
    setTimeout(() => {
        const win = skins[Math.floor(Math.random() * skins.length)];
        const currentInv = currentUser.inventory ? [...Object.values(currentUser.inventory)] : [];
        currentInv.push({ ...win, id: Date.now() });
        update(ref(db, 'users/' + currentUser.name), { 
            balance: currentUser.balance - 100,
            inventory: currentInv
        });
        document.getElementById('caseDisplay').innerHTML = `
            <img src="${win.img}" style="width: 140px; margin: 10px auto; display: block;">
            <span class="skin-${win.r}">${win.n}</span>
        `;
        btn.disabled = false;
    }, 1200);
};

function updateInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!currentUser || !currentUser.inventory) {
        grid.innerHTML = '<p>Тут пока пусто...</p>';
        return;
    }
    grid.innerHTML = Object.values(currentUser.inventory).map(item => `
        <div class="inventory-item">
            <div class="item-icon"><img src="${item.img}"></div>
            <div class="item-name skin-${item.r}">${item.n}</div>
        </div>
    `).join('');
}

function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>
                ${u.avatar ? `<img src="${u.avatar}" style="width:20px; border-radius:50%; vertical-align:middle; margin-right:5px;">` : ''}
                <b>${u.name}</b>
            </td>
            <td>${u.balance} ₽</td>
            <td><button onclick="giveBal('${u.name}')" class="btn-ok">+</button></td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td><button onclick="removeUser('${u.name}')" class="btn-del">УДАЛИТЬ</button></td>
        </tr>
    `).join('');
}

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
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