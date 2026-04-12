import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove, get, query, limitToLast } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

let currentChatTab = 'global';
let globalMessages = {};
let catMessages = {};
const catUsers = ['mishkafazbear', 'amonphous', 'SharizMound'];

// --- ЛОГИКА ЗАГРУЗКИ ---
onValue(ref(db, 'users'), (snapshot) => {
    const data = snapshot.val() || {};
    allUsers = Object.entries(data).map(([id, val]) => ({ uid: id, ...val }));
    const savedNick = localStorage.getItem('hurus_session');
    if (savedNick) {
        const found = allUsers.find(u => u.name === savedNick);
        if (found) { currentUser = found; updateUI(); }
    }
    if (document.getElementById('admin').classList.contains('active')) renderAdmin();
});

// Слушатели чатов
onValue(query(ref(db, 'messages'), limitToLast(50)), (snap) => {
    globalMessages = snap.val() || {};
    if (currentChatTab === 'global') renderChat(globalMessages);
});
onValue(query(ref(db, 'cat_messages'), limitToLast(50)), (snap) => {
    catMessages = snap.val() || {};
    if (currentChatTab === 'cats') renderChat(catMessages);
});

onValue(query(ref(db, 'logs'), limitToLast(50)), (snapshot) => {
    const data = snapshot.val() || {};
    allLogs = Object.values(data).sort((a, b) => b.time - a.time);
    if (document.getElementById('admin').classList.contains('active')) renderLogs();
});

// --- ФУНКЦИИ ЧАТА ---
window.switchChat = (tab) => {
    currentChatTab = tab;
    document.querySelectorAll('.chat-tab-btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`tab-${tab}`);
    if (btn) btn.classList.add('active');
    renderChat(tab === 'global' ? globalMessages : catMessages);
};

function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj || {}).map(([id, data]) => ({ id, ...data }));
    
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        let reactHtml = '';
        if (m.reactions) {
            reactHtml = Object.entries(m.reactions).map(([emoji, users]) => {
                const count = Object.keys(users).length;
                const hasMyReact = currentUser && users[currentUser.name] ? 'active' : '';
                return `<div class="react-item ${hasMyReact}" onclick="toggleReaction('${m.id}', '${emoji}')">
                    <span class="react-emoji">${emoji}</span><span class="react-count">${count}</span>
                </div>`;
            }).join('');
        }

        return `<div class="msg">
            <div class="msg-header">
                <span class="badge badge-${m.r || 'user'}">${(m.r || 'user').toUpperCase()}</span>
                <span class="msg-author">${m.u}</span>
                <span class="msg-time">${timeStr}</span>
            </div>
            <div class="msg-text">${m.t}</div>
            <div class="msg-footer">
                <div class="reactions-container">
                    ${reactHtml}
                    <button class="btn-add-emoji" onclick="openEmojiPicker('${m.id}', event)"><i class="fas fa-plus"></i></button>
                </div>
            </div>
        </div>`;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    const path = currentChatTab === 'global' ? 'messages' : 'cat_messages';
    push(ref(db, path), { u: currentUser.name, r: currentUser.role, t: inp.value, time: Date.now() });
    inp.value = '';
};

window.toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return notify("Войдите в аккаунт!");
    const path = `${currentChatTab === 'global' ? 'messages' : 'cat_messages'}/${msgId}/reactions/${emoji}/${currentUser.name}`;
    const snap = await get(ref(db, path));
    snap.exists() ? remove(ref(db, path)) : set(ref(db, path), true);
};

// --- АДМИН-ПАНЕЛЬ ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `<tr>
        <td>${u.name}</td>
        <td style="color:var(--success)">${u.balance || 0} ₽</td>
        <td>
            <input type="number" id="bal_${u.uid}" style="width:60px; background:#000; color:#fff; border:1px solid #333">
            <button onclick="addBalance('${u.uid}')" class="btn-ok">+</button>
        </td>
        <td>
            <select onchange="changeRole('${u.uid}', this.value)">
                <option value="user" ${u.role==='user'?'selected':''}>User</option>
                <option value="vip" ${u.role==='vip'?'selected':''}>VIP</option>
                <option value="moder" ${u.role==='moder'?'selected':''}>Moder</option>
                <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
            </select>
        </td>
        <td><button onclick="deleteUser('${u.uid}')" class="btn-del">Удалить</button></td>
    </tr>`).join('');
    renderLogs();
};

window.addBalance = (uid) => {
    const val = parseInt(document.getElementById(`bal_${uid}`).value);
    const u = allUsers.find(x => x.uid === uid);
    if (u && val) update(ref(db, `users/${uid}`), { balance: (u.balance || 0) + val });
};

window.changeRole = (uid, role) => update(ref(db, `users/${uid}`), { role });
window.deleteUser = (uid) => confirm('Удалить?') && remove(ref(db, `users/${uid}`));

function renderLogs() {
    document.getElementById('adminLogs').innerHTML = allLogs.map(l => 
        `<div style="padding:5px 10px; border-bottom:1px solid #222; font-size:12px">
            <span style="color:var(--primary)">[${new Date(l.time).toLocaleTimeString()}]</span> ${l.text}
        </div>`).join('');
}

// --- СИСТЕМНОЕ ---
function updateUI() {
    const isAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            <div class="profile-nick">${currentUser.name}</div>
            <div class="profile-balance">${currentUser.balance || 0} ₽</div>
            <button onclick="logout()" class="btn-logout"><i class="fas fa-sign-out-alt"></i></button>
        </div>`;
    
    if (catUsers.includes(currentUser.name) && !document.getElementById('tab-cats')) {
        document.getElementById('chatTabs').innerHTML += `<button id="tab-cats" class="chat-tab-btn" onclick="switchChat('cats')">КОТИКИ</button>`;
    }
}

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value;
    const p = document.getElementById('authPass').value;
    if (authMode === 'login') {
        const u = allUsers.find(x => x.name === l && x.pass === p);
        if (u) localStorage.setItem('hurus_session', u.name);
    } else {
        await push(ref(db, 'users'), { name: l, pass: p, balance: 0, role: 'user' });
        localStorage.setItem('hurus_session', l);
    }
    location.reload();
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(p => p.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'admin') renderAdmin();
};
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

document.addEventListener('DOMContentLoaded', () => {
    const picker = document.querySelector('emoji-picker');
    window.openEmojiPicker = (id, e) => {
        e.stopPropagation(); activeReactMsgId = id;
        const pop = document.getElementById('global-emoji-picker');
        pop.style.display = 'block';
        pop.style.top = (e.clientY + window.scrollY) + 'px';
        pop.style.left = (e.clientX - 250) + 'px';
    };
    picker.addEventListener('emoji-click', e => {
        toggleReaction(activeReactMsgId, e.detail.unicode);
        document.getElementById('global-emoji-picker').style.display = 'none';
    });
});