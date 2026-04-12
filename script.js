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
let activeReactMsgId = null;

// --- СИНХРОНИЗАЦИЯ ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        // Сохраняем пользователей с их уникальными ключами (ID) для админки
        allUsers = data.users ? Object.entries(data.users).map(([id, val]) => ({ uid: id, ...val })) : [];
        renderChat(data.messages || {});
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
            }
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// --- ЧАТ И РЕАКЦИИ ---
function renderChat(messagesObj) {
    const box = document.getElementById('chatMessages');
    const msgs = Object.entries(messagesObj).map(([id, data]) => ({ id, ...data }));
    
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => {
        const timeStr = new Date(m.time).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        
        let reactHtml = '';
        if (m.reactions) {
            reactHtml = Object.entries(m.reactions).map(([emoji, users]) => {
                const userList = Object.keys(users);
                const count = userList.length;
                const hasMyReact = currentUser && users[currentUser.name] ? 'active' : '';
                const names = userList.join(', ');

                return `
                    <div class="react-item ${hasMyReact}" 
                         onclick="toggleReaction('${m.id}', '${emoji}')" 
                         title="${names}">
                        <span class="react-emoji">${emoji}</span>
                        <span class="react-count">${count}</span>
                    </div>
                `;
            }).join('');
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
                    <div class="reactions-container">
                        ${reactHtml}
                        <button class="btn-add-emoji" onclick="openEmojiPicker('${m.id}', event)">
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                </div>
            </div>
        `;
    }).join('');
    box.scrollTop = box.scrollHeight;
}

window.toggleReaction = async (msgId, emoji) => {
    if (!currentUser) return notify("Сначала войдите в аккаунт!");
    const reactRef = ref(db, `messages/${msgId}/reactions/${emoji}/${currentUser.name}`);
    const snap = await get(reactRef);
    if (snap.exists()) remove(reactRef);
    else set(reactRef, true);
};

window.sendChatMessage = () => {
    const inp = document.getElementById('chatInput');
    if (!currentUser || !inp.value.trim()) return;
    push(ref(db, 'messages'), {
        u: currentUser.name,
        r: currentUser.role,
        t: inp.value,
        time: Date.now()
    });
    inp.value = '';
};

window.clearChat = () => {
    if (confirm("Вы уверены, что хотите полностью очистить историю чата?")) {
        set(ref(db, 'messages'), null);
        notify("Чат очищен");
    }
};

// --- АВТОРИЗАЦИЯ И ПРОФИЛЬ ---
function updateUI() {
    const isAdmin = ['admin', 'moder'].includes(currentUser.role);
    document.getElementById('adminLink').style.display = isAdmin ? 'block' : 'none';
    document.getElementById('clearChatBtn').style.display = isAdmin ? 'block' : 'none';
    
    document.getElementById('authZone').innerHTML = `
        <div class="profile-info-block">
            ${currentUser.avatar ? `<img src="${currentUser.avatar}" class="profile-avatar">` : '<i class="fas fa-user"></i>'}
            <div class="profile-text-data">
                <div class="profile-nick">${currentUser.name}</div>
                <div class="profile-balance">${currentUser.balance} ₽</div>
            </div>
            <button class="btn-logout" onclick="logout()"><i class="fas fa-sign-out-alt"></i></button>
        </div>
    `;
}

window.setAuthMode = (mode) => {
    authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-reg').classList.toggle('active', mode === 'reg');
    const btn = document.querySelector('.modal-form .btn-primary');
    if (btn) btn.innerText = mode === 'login' ? 'ВЫПОЛНИТЬ' : 'ЗАРЕГИСТРИРОВАТЬСЯ';
};

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполните все поля!");

    if (authMode === 'login') {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверные данные!");
        localStorage.setItem('hurus_session', found.name);
    } else {
        if (allUsers.find(u => u.name === l)) return notify("Никнейм занят!");
        await push(ref(db, 'users'), {
            name: l,
            pass: p,
            balance: 0,
            role: 'user',
            avatar: ''
        });
        localStorage.setItem('hurus_session', l);
    }
    location.reload();
};

window.loginWithSteam = () => {
    // Исправлено: теперь создается локальная сессия для входа
    const mockSteamNick = "SteamUser_" + Math.floor(Math.random() * 1000);
    localStorage.setItem('hurus_session', mockSteamNick);
    
    // Если пользователя нет в базе — добавляем
    const existing = allUsers.find(u => u.name === mockSteamNick);
    if (!existing) {
        push(ref(db, 'users'), {
            name: mockSteamNick,
            balance: 0,
            role: 'user',
            avatar: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"
        });
    }
    location.reload();
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'admin') renderAdmin();
};

// --- ПАНЕЛЬ УПРАВЛЕНИЯ ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    if (!list) return;
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance || 0} ₽</td>
            <td><button class="btn-ok" onclick="addBalance('${u.uid}', 100)">+100₽</button></td>
            <td>
                <select onchange="changeRole('${u.uid}', this.value)">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="vip" ${u.role === 'vip' ? 'selected' : ''}>VIP</option>
                    <option value="moder" ${u.role === 'moder' ? 'selected' : ''}>Moder</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td><button class="btn-del" onclick="deleteUser('${u.uid}')"><i class="fas fa-trash"></i></button></td>
        </tr>
    `).join('');
};

window.addBalance = (uid, amount) => {
    const u = allUsers.find(user => user.uid === uid);
    if (u) update(ref(db, `users/${uid}`), { balance: (u.balance || 0) + amount });
};

window.changeRole = (uid, newRole) => {
    update(ref(db, `users/${uid}`), { role: newRole });
};

window.deleteUser = (uid) => {
    if (confirm("Удалить пользователя?")) remove(ref(db, `users/${uid}`));
};

// --- ЛОГИКА ЭМОДЗИ ---
document.addEventListener('DOMContentLoaded', () => {
    const globalPicker = document.getElementById('global-emoji-picker');
    const pickerElement = document.querySelector('emoji-picker');

    window.openEmojiPicker = (msgId, event) => {
        event.stopPropagation();
        activeReactMsgId = msgId;
        globalPicker.style.display = 'block';
        const rect = event.currentTarget.getBoundingClientRect();
        globalPicker.style.top = (rect.bottom + window.scrollY + 5) + 'px';
        globalPicker.style.left = (rect.left + window.scrollX) + 'px';
    };

    pickerElement.addEventListener('emoji-click', e => {
        toggleReaction(activeReactMsgId, e.detail.unicode);
        globalPicker.style.display = 'none';
    });
});