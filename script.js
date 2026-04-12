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

// Список доступных эмодзи
const EMOJI_LIST = ['🔥', '❤️', '👍', '😂', '🤡', '😮', '😢'];

// --- СИНХРОНИЗАЦИЯ ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        // Сохраняем пользователей как массив объектов с их ключами из БД для удобства обновления
        allUsers = data.users ? Object.entries(data.users).map(([id, val]) => ({ id, ...val })) : [];
        renderChat(data.messages || {});
        
        const savedNick = localStorage.getItem('hurus_session');
        if (savedNick) {
            const found = allUsers.find(u => u.name === savedNick);
            if (found) {
                currentUser = found;
                updateUI();
            }
        }
        // Если активна секция админки, перерисовываем её при любых изменениях данных
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// --- ПАНЕЛЬ УПРАВЛЕНИЯ (STAFF) ---
// Исправленная функция отрисовки админ-панели
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    if (!list) return;

    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>
                <div style="display:flex; align-items:center; gap:10px">
                    ${u.avatar ? `<img src="${u.avatar}" style="width:30px; height:30px; border-radius:50%">` : '<i class="fas fa-user"></i>'}
                    <b>${u.name}</b>
                </div>
            </td>
            <td>
                <input type="number" value="${u.balance}" id="bal-${u.id}" style="width:70px; background:#000; border:1px solid #333; color:#fff; padding:5px; border-radius:5px">
                <button class="btn-ok" onclick="updateUserBalance('${u.id}')"><i class="fas fa-check"></i></button>
            </td>
            <td>
                <button class="btn-del" onclick="deleteUser('${u.id}')"><i class="fas fa-trash"></i></button>
            </td>
            <td>
                <select id="role-${u.id}" onchange="updateUserRole('${u.id}', this.value)" style="background:#000; color:#fff; border:1px solid #333; padding:5px; border-radius:5px">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>USER</option>
                    <option value="vip" ${u.role === 'vip' ? 'selected' : ''}>VIP</option>
                    <option value="moder" ${u.role === 'moder' ? 'selected' : ''}>MODER</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>ADMIN</option>
                </select>
            </td>
            <td>
                <button class="btn-ok" onclick="notify('Логи игрока ${u.name} пусты')">ЛОГИ</button>
            </td>
        </tr>
    `).join('');
};

// Функции для управления пользователями
window.updateUserBalance = (userId) => {
    const newVal = document.getElementById(`bal-${userId}`).value;
    update(ref(db, `users/${userId}`), { balance: parseInt(newVal) });
    notify("Баланс обновлен");
};

window.updateUserRole = (userId, newRole) => {
    update(ref(db, `users/${userId}`), { role: newRole });
    notify("Роль обновлена");
};

window.deleteUser = (userId) => {
    if (confirm("Удалить пользователя навсегда?")) {
        remove(ref(db, `users/${userId}`));
        notify("Пользователь удален");
    }
};

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
                        <div class="add-react-dropdown">
                            <button class="btn-add-emoji"><i class="fas fa-plus"></i></button>
                            <div class="emoji-menu">
                                ${EMOJI_LIST.map(e => `<span onclick="toggleReaction('${m.id}', '${e}')">${e}</span>`).join('')}
                            </div>
                        </div>
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
    if (snap.exists()) {
        remove(reactRef);
    } else {
        set(reactRef, true);
    }
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

// --- ИНТЕРФЕЙС И НАВИГАЦИЯ ---
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

window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('.main-nav button').forEach(b => b.classList.remove('active'));
    
    const target = document.getElementById(id);
    if (target) target.classList.add('active');
    
    // Подсвечиваем активную кнопку навигации
    const navBtn = document.getElementById(`nav-${id}`) || (id === 'admin' ? document.getElementById('adminLink') : null);
    if (navBtn) navBtn.classList.add('active');

    // Если перешли в админку — запускаем рендер списка
    if (id === 'admin') renderAdmin();
};

window.handleAuth = async () => {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    const found = allUsers.find(u => u.name === l && u.pass === p);
    if (!found) return notify("Ошибка входа!");
    localStorage.setItem('hurus_session', found.name);
    location.reload();
};

window.loginWithSteam = () => window.location.href = "https://hurus-backend.onrender.com/auth/steam";
window.logout = () => { localStorage.removeItem('hurus_session'); location.reload(); };
window.openModal = (id) => document.getElementById(id).style.display = 'flex';
window.closeModal = () => document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none');
window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};