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
let allLogs = [];
let authMode = 'login';
let activeReactMsgId = null; 

// --- ПЕРЕМЕННЫЕ ЧАТА ---
let currentChatTab = 'global';
let dmTarget = null; // Ник собеседника для ЛС
let globalMessages = {};
let catMessages = {};
const catUsers = ['mishkafazbear', 'amonphous', 'SharizMound'];

// --- СИНХРОНИЗАЦИЯ С БД ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.entries(data.users).map(([id, val]) => ({ uid: id, ...val })) : [];
        allLogs = data.logs ? Object.values(data.logs).sort((a, b) => b.time - a.time) : [];
        
        globalMessages = data.messages || {};
        catMessages = data.cat_messages || {};
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
            }
        }
        
        refreshChatUI(data);
        
        if (document.getElementById('admin')?.classList.contains('active')) {
            renderAdmin();
        }
    }
});

// --- ЛОГИКА ЧАТОВ И ЛС ---
function refreshChatUI(data) {
    if (currentChatTab === 'global') renderChat(globalMessages);
    else if (currentChatTab === 'cats') renderChat(catMessages);
    else if (currentChatTab === 'dm' && dmTarget) {
        const pair = [currentUser.name, dmTarget].sort().join('_');
        renderChat(data.pms ? data.pms[pair] || {} : {});
    }
}

window.switchChat = (tab, target = null) => {
    currentChatTab = tab;
    if (target) dmTarget = target;
    
    renderChatTabs();
    
    // Принудительный рендер текущего состояния
    if (tab === 'global') renderChat(globalMessages);
    else if (tab === 'cats') renderChat(catMessages);
    else if (tab === 'dm') {
        const pair = [currentUser.name, dmTarget].sort().join('_');
        get(ref(db, `pms/${pair}`)).then(s => renderChat(s.val() || {}));
    }
};

window.startDM = (name) => {
    if (!currentUser) return notify("Войдите в аккаунт!");
    if (name === currentUser.name) return;
    switchChat('dm', name);
};

function renderChatTabs() {
    const box = document.getElementById('chatTabs');
    if (!box) return;

    let html = `<div class="chat-tab ${currentChatTab === 'global' ? 'active' : ''}" onclick="switchChat('global')">Глобальный</div>`;
    
    if (currentUser && catUsers.includes(currentUser.name)) {
        html += `<div class="chat-tab tab-cats ${currentChatTab === 'cats' ? 'active' : ''}" onclick="switchChat('cats')">Котики <3</div>`;
    }

    if (dmTarget) {
        html += `<div class="chat-tab tab-dm ${currentChatTab === 'dm' ? 'active' : ''}" onclick="switchChat('dm', '${dmTarget}')">ЛС: ${dmTarget}</div>`;
    }
    
    box.innerHTML = html;
}

function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj || {}).map(([id, data]) => ({ id, ...data }));
    
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const userRole = m.r || 'user';
        
        let reactHtml = '';
        if (m.reactions) {
            reactHtml = Object.entries(m.reactions).map(([emoji, users]) => {
                const count = Object.keys(users).length;
                const hasMyReact = currentUser && users[currentUser.name] ? 'active' : '';
                return `<div class="react-item ${hasMyReact}" onclick="toggleReaction('${m.id}', '${emoji}')"><span class="react-emoji">${emoji}</span><span class="react-count">${count}</span></div>`;
            }).join('');
        }

        return `
            <div class="msg">
                <div class="msg-header">
                    <span class="badge badge-${userRole}">${userRole}</span>
                    <span class="msg-author" onclick="startDM('${m.u}')">${m.u}</span>
                    <span class="msg-time">${timeStr}</span>
                </div>
                <div class="msg-text">${m.t}</div>
                <div class="msg-footer">
                    <div class="reactions-container">
                        ${reactHtml}
                        <button class="btn-add-emoji" onclick="openEmojiPicker('${m.id}', event)"><i class="fas fa-plus"></i></button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    
    let path = 'messages';
    if (currentChatTab === 'cats') path = 'cat_messages';
    if (currentChatTab === 'dm' && dmTarget) {
        const pair = [currentUser.name, dmTarget].sort().join('_');
        path = `pms/${pair}`;
    }

    push(ref(db, path), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

// --- АДМИНКА С ПОИСКОМ ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    const searchVal = document.getElementById('userSearch')?.value.toLowerCase() || "";
    if (!list) return;
    
    const filtered = allUsers.filter(u => u.name.toLowerCase().includes(searchVal));

    list.innerHTML = filtered.map(u => `
        <tr>
            <td>${u.name}</td>
            <td style="color: var(--success); font-weight: bold;">${u.balance || 0} ₽</td>
            <td>
                <div style="display:flex; gap:5px; align-items:center;">
                    <input type="number" id="balInput_${u.uid}" placeholder="+" style="width: 60px; background: #000; border: 1px solid var(--border); color: #fff; padding: 5px; border-radius: 5px;">
                    <button class="btn-ok" onclick="addBalance('${u.uid}')"><i class="fas fa-plus"></i></button>
                </div>
            </td>
            <td>
                <select onchange="changeRole('${u.uid}', this.value)" style="background: #000; color: #fff; border: 1px solid var(--border); padding: 5px; border-radius: 5px;">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="vip" ${u.role === 'vip' ? 'selected' : ''}>VIP</option>
                    <option value="moder" ${u.role === 'moder' ? 'selected' : ''}>Moder</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <button class="btn-del" onclick="deleteUser('${u.uid}')"><i class="fas fa-trash"></i></button>
            </td>
        </tr>
    `).join('');
    
    renderLogsUI();
};

// --- ОСТАЛЬНАЯ ЛОГИКА ---
window.addBalance = (uid) => {
    const inp = document.getElementById(`balInput_${uid}`);
    const amount = parseInt(inp.value);
    if (isNaN(amount) || amount <= 0) return;
    const u = allUsers.find(user => user.uid === uid);
    update(ref(db, `users/${uid}`), { balance: (u.balance || 0) + amount });
    push(ref(db, 'logs'), { text: `Админ ${currentUser.name} выдал ${amount}₽ для ${u.name}`, time: Date.now() });
    inp.value = '';
};

window.changeRole = (uid, newRole) => {
    update(ref(db, `users/${uid}`), { role: newRole });
};

window.deleteUser = (uid) => {
    if (confirm("Удалить игрока?")) remove(ref(db, `users/${uid}`));
};

function renderLogsUI() {
    const box = document.getElementById('adminLogs');
    if (box) box.innerHTML = allLogs.map(l => `<div style="padding: 8px 15px; border-bottom: 1px solid var(--border); font-size: 12px;"><span style="color: var(--primary);">[${new Date(l.time).toLocaleTimeString()}]</span> ${l.text}</div>`).join('');
}

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполните поля!");

    if (authMode === 'login') {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Ошибка!");
        localStorage.setItem('hurus_session', found.name);
    } else {
        if (allUsers.find(u => u.name === l)) return notify("Ник занят!");
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user', avatar: '' });
        localStorage.setItem('hurus_session', l);
    }
    location.reload();
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };

function updateUI() {
    const isAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    
    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            <div class="profile-avatar-placeholder"><i class="fas fa-user"></i></div>
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance || 0} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i></button>
        </div>
    `;
    renderChatTabs();
}

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('.main-nav button').forEach(btn => btn.classList.remove('active'));
    if(id === 'admin') renderAdmin();
};

window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

window.setAuthMode = (m) => {
    authMode = m;
    document.getElementById('tab-login').classList.toggle('active', m === 'login');
    document.getElementById('tab-reg').classList.toggle('active', m === 'reg');
};

document.addEventListener('DOMContentLoaded', () => {
    renderChatTabs();
    const picker = document.querySelector('emoji-picker');
    picker?.addEventListener('emoji-click', e => {
        const dbPath = currentChatTab === 'global' ? 'messages' : (currentChatTab === 'cats' ? 'cat_messages' : `pms/${[currentUser.name, dmTarget].sort().join('_')}`);
        const reactRef = ref(db, `${dbPath}/${activeReactMsgId}/reactions/${e.detail.unicode}/${currentUser.name}`);
        set(reactRef, true);
        document.getElementById('global-emoji-picker').style.display = 'none';
    });
});

window.openEmojiPicker = (msgId, event) => {
    event.stopPropagation();
    if (!currentUser) return notify("Войдите!");
    activeReactMsgId = msgId;
    const p = document.getElementById('global-emoji-picker');
    p.style.display = 'block';
    p.style.top = (event.clientY + 10) + 'px';
    p.style.left = (event.clientX - 150) + 'px';
};