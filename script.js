import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove, get, runTransaction } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// --- STEAM AUTH LOGIC ---
const urlParams = new URLSearchParams(window.location.search);
const steamId = urlParams.get('steamid');
const steamName = urlParams.get('name');
const steamAvatar = urlParams.get('avatar');

if (steamId && steamName) {
    handleSteamLogin(steamId, steamName, steamAvatar);
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function handleSteamLogin(id, name, avatarUrl) {
    const avatar = avatarUrl || "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg";
    const userRef = ref(db, 'users/' + name);
    const snapshot = await get(userRef);
    if (!snapshot.exists()) {
        await set(userRef, { name: name, steamId: id, avatar: avatar, balance: 100, role: 'user', inventory: [] });
    } else {
        await update(userRef, { steamId: id, avatar: avatar });
    }
    localStorage.setItem('hurus_session', name);
    location.reload();
}

// --- SYNC WITH DB ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages || {});
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
                updateInventory();
            }
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// --- UI & PROFILE ---
function updateUI() {
    if (!currentUser) return;
    const avatarHtml = currentUser.avatar 
        ? `<img src="${currentUser.avatar}" class="profile-avatar">` 
        : `<i class="fas fa-user-circle"></i>`;

    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            ${avatarHtml}
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i></button>
        </div>
    `;
    const isAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('clearChatBtn').style.display = isAdmin ? 'block' : 'none';
}

// --- CHAT WITH TIME & REACTIONS ---
window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), {
        u: currentUser.name,
        r: currentUser.role,
        t: inp.value,
        time: Date.now(),
        reactions: {}
    });
    inp.value = '';
};

function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj).map(([id, data]) => ({ id, ...data }));
    
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        // Рендер существующих реакций
        let reactHtml = '';
        if (m.reactions) {
            reactHtml = Object.entries(m.reactions).map(([emoji, count]) => `
                <span class="chat-react-badge" onclick="addReaction('${m.id}', '${emoji}')">${emoji} ${count}</span>
            `).join('');
        }

        return `
            <div class="msg">
                <div class="msg-header">
                    <span class="badge badge-${m.r}">${m.r}</span>
                    <span class="msg-author">${m.u}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${m.t}</div>
                <div class="msg-footer">
                    <div class="reactions-list">${reactHtml}</div>
                    <div class="reaction-picker">
                        <button onclick="addReaction('${m.id}', '🔥')">🔥</button>
                        <button onclick="addReaction('${m.id}', '❤️')">❤️</button>
                        <button onclick="addReaction('${m.id}', '👍')">👍</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.addReaction = (msgId, emoji) => {
    if (!currentUser) return notify("Войдите, чтобы ставить реакции");
    const reactRef = ref(db, `messages/${msgId}/reactions/${emoji}`);
    
    runTransaction(reactRef, (currentCount) => {
        return (currentCount || 0) + 1;
    });
};

window.clearChat = () => {
    if (confirm("Очистить чат?")) set(ref(db, 'messages'), null);
};

// --- STAFF PANEL ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.avatar ? `<img src="${u.avatar}" class="admin-table-av">` : ''} <b>${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" placeholder="₽" class="admin-input">
                <button onclick="giveBal('${u.name}')" class="btn-ok">+</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <button onclick="removeUser('${u.name}')" class="btn-del"><i class="fas fa-trash"></i></button>
                <select onchange="changeRole('${u.name}', this.value)" class="admin-select">
                    <option value="">Роль...</option>
                    <option value="user">User</option><option value="vip">VIP</option>
                    <option value="moder">Moder</option><option value="admin">Admin</option>
                </select>
            </td>
        </tr>
    `).join('');
};

window.giveBal = (name) => {
    const input = document.getElementById('sum-' + name);
    const val = parseInt(input.value);
    const u = allUsers.find(x => x.name === name);
    if (!isNaN(val)) {
        update(ref(db, 'users/' + name), { balance: (u.balance || 0) + val });
        input.value = '';
    }
};

window.changeRole = (name, role) => { if (role) update(ref(db, 'users/' + name), { role: role }); };
window.removeUser = (name) => {
    if (name === currentUser.name) return notify("Себя нельзя!");
    if (confirm(`Удалить ${name}?`)) remove(ref(db, 'users/' + name));
};

// --- GENERAL ---
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+id)?.classList.add('active');
    if (id === 'admin') renderAdmin();
};

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (authMode === 'reg') {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        await set(ref(db, 'users/' + l), { name: l, pass: p, balance: 100, role: 'user' });
        setAuthMode('login');
    } else {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка!");
        localStorage.setItem('hurus_session', found.name);
        closeModal();
    }
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };
window.loginWithSteam = () => { window.location.href = "https://hurus-backend.onrender.com/auth/steam"; };
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
function updateInventory() {} // Заглушка