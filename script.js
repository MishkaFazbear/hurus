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
        // ИСПРАВЛЕНИЕ: Теперь мы сохраняем уникальный ключ пользователя (uid) для админ-панели
        allUsers = data.users ? Object.entries(data.users).map(([key, val]) => ({ uid: key, ...val })) : [];
        renderChat(data.messages || {});
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
            } else {
                // Если админ удалил юзера, разлогиниваем его
                currentUser = null;
                localStorage.removeItem('hurus_session');
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

// --- ИНТЕРФЕЙС И АВТОРИЗАЦИЯ ---
function updateUI() {
    if (!currentUser) {
        document.getElementById('adminLink').style.display = 'none';
        document.getElementById('clearChatBtn').style.display = 'none';
        document.getElementById('authZone').innerHTML = `<button class="btn btn-primary" onclick="openModal('authModal')">ВОЙТИ</button>`;
        return;
    }

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

// ИСПРАВЛЕНИЕ: Логика переключения вкладок авторизации (Вход / Регистрация)
window.setAuthMode = (mode) => {
    authMode = mode;
    document.getElementById('tab-login').classList.toggle('active', mode === 'login');
    document.getElementById('tab-reg').classList.toggle('active', mode === 'reg');
    const btn = document.querySelector('.modal-form .btn-primary');
    if (btn) btn.innerText = mode === 'login' ? 'ВЫПОЛНИТЬ' : 'ЗАРЕГИСТРИРОВАТЬСЯ';
};

// ИСПРАВЛЕНИЕ: Полноценная обработка Входа и Регистрации
window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if (!l || !p) return notify("Заполните логин и пароль!");

    if (authMode === 'login') {
        const found = allUsers.find(u => u.name === l && u.pass === p);
        if (!found) return notify("Неверный логин или пароль!");
        localStorage.setItem('hurus_session', found.name);
        location.reload();
    } else {
        const found = allUsers.find(u => u.name === l);
        if (found) return notify("Этот никнейм уже занят!");

        // Создаем нового пользователя
        const newUserRef = push(ref(db, 'users'));
        await set(newUserRef, {
            name: l,
            pass: p,
            balance: 0,
            role: 'user',
            avatar: ''
        });
        
        notify("Успешная регистрация!");
        localStorage.setItem('hurus_session', l);
        setTimeout(() => location.reload(), 800);
    }
};

// ИСПРАВЛЕНИЕ: Заглушка для Steam, так как бэкенда нет (создает тестовый профиль Steam)
window.loginWithSteam = () => {
    const steamMockName = "SteamUser_" + Math.floor(Math.random() * 9999);
    const newUserRef = push(ref(db, 'users'));
    set(newUserRef, {
        name: steamMockName,
        pass: "steam_hidden_pass",
        balance: 0,
        role: 'user',
        avatar: "https://avatars.steamstatic.com/fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb_full.jpg"
    });
    localStorage.setItem('hurus_session', steamMockName);
    location.reload();
    
    // Когда починишь бэкенд, удали код выше и раскомментируй строку ниже:
    // window.location.href = "https://hurus-backend.onrender.com/auth/steam";
};

window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

// ИСПРАВЛЕНИЕ: Вызов renderAdmin при переходе в панель
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'admin') renderAdmin();
};

// --- ПАНЕЛЬ УПРАВЛЕНИЯ (ИСПРАВЛЕНО) ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    if (!list) return;
    
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name}</td>
            <td>${u.balance || 0} ₽</td>
            <td>
                <button class="btn-ok" onclick="addBalance('${u.uid}', 100)">+100₽</button>
            </td>
            <td>
                <select onchange="changeRole('${u.uid}', this.value)" style="background:var(--bg); color:var(--text); padding:5px; border:1px solid var(--border); border-radius:5px;">
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
};

window.addBalance = (uid, amount) => {
    if (!currentUser || !['admin', 'moder'].includes(currentUser.role)) return notify("Нет прав!");
    const u = allUsers.find(user => user.uid === uid);
    if (u) {
        update(ref(db, `users/${uid}`), { balance: (u.balance || 0) + amount });
        notify(`Баланс игрока ${u.name} пополнен`);
    }
};

window.changeRole = (uid, newRole) => {
    if (!currentUser || currentUser.role !== 'admin') return notify("Только админ может менять роли!");
    update(ref(db, `users/${uid}`), { role: newRole });
    notify(`Роль изменена`);
};

window.deleteUser = (uid) => {
    if (!currentUser || currentUser.role !== 'admin') return notify("Только админ может удалять!");
    if (confirm("Точно удалить пользователя?")) {
        remove(ref(db, `users/${uid}`));
        notify("Пользователь удален");
    }
};

// --- ЛОГИКА ПИКЕРА ЭМОДЗИ ---
document.addEventListener('DOMContentLoaded', () => {
    const globalPicker = document.getElementById('global-emoji-picker');
    const pickerElement = document.querySelector('emoji-picker');

    window.openEmojiPicker = (msgId, event) => {
        event.stopPropagation(); 
        if (!currentUser) return notify("Сначала войдите в аккаунт!");
        
        activeReactMsgId = msgId;
        globalPicker.style.display = 'block';
        
        const btnRect = event.currentTarget.getBoundingClientRect();
        
        let topPos = btnRect.bottom + window.scrollY + 5;
        let leftPos = btnRect.left + window.scrollX;
        
        if (topPos + 350 > window.innerHeight + window.scrollY) {
            topPos = btnRect.top + window.scrollY - 355; 
        }
        if (leftPos + 320 > window.innerWidth) {
            leftPos = window.innerWidth - 330;
        }

        globalPicker.style.top = topPos + 'px';
        globalPicker.style.left = leftPos + 'px';
    };

    pickerElement.addEventListener('emoji-click', event => {
        if (activeReactMsgId) {
            const emoji = event.detail.unicode; 
            toggleReaction(activeReactMsgId, emoji);
            globalPicker.style.display = 'none'; 
        }
    });

    document.addEventListener('click', (e) => {
        if (globalPicker.style.display === 'block' && !globalPicker.contains(e.target)) {
            globalPicker.style.display = 'none';
        }
    });
});