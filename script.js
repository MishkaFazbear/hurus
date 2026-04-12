let db = JSON.parse(localStorage.getItem('hurus_final_db')) || {
    users: [],
    messages: [{u: 'System', t: 'Добро пожаловать в HuRuS Project!', r: 'admin'}],
    tasks: [
        {id: 1, name: "Подписка на соцсети", reward: 50, done: []},
        {id: 2, name: "Бонус новичка", reward: 100, done: []}
    ]
};

let currentUser = null;
let authMode = 'login';

function save() { localStorage.setItem('hurus_final_db', JSON.stringify(db)); }

// Навигация
function showSection(id) {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    const navBtn = document.getElementById('nav-' + id);
    if(navBtn) navBtn.classList.add('active');

    if(id === 'admin') renderAdmin();
    if(id === 'tasks') renderTasks();
}

// Авторизация
function openModal(id) { document.getElementById(id).style.display = 'flex'; }
function closeModal() { document.querySelectorAll('.modal-overlay').forEach(m => m.style.display = 'none'); }
function closeModalOnOverlay(e) { if(e.target.classList.contains('modal-overlay')) closeModal(); }

function setAuthMode(m) {
    authMode = m;
    document.getElementById('tab-login').classList.toggle('active', m === 'login');
    document.getElementById('tab-reg').classList.toggle('active', m === 'reg');
    document.getElementById('authBtn').innerText = m === 'login' ? 'Войти' : 'Создать аккаунт';
}

function handleAuth() {
    const l = document.getElementById('authLogin').value.trim();
    const p = document.getElementById('authPass').value.trim();
    if(!l || !p) return notify("Заполните все поля!");

    if(authMode === 'reg') {
        if(db.users.some(u => u.name.toLowerCase() === l.toLowerCase())) return notify("Никнейм занят!");
        db.users.push({ name: l, pass: p, balance: 0, role: l.toLowerCase() === 'admin' ? 'admin' : 'user', inv: [] });
        save();
        notify("Регистрация успешна!");
        setAuthMode('login');
    } else {
        const found = db.users.find(u => u.name === l && u.pass === p);
        if(!found) return notify("Неверный ник или пароль!");
        currentUser = found;
        onLogin();
    }
}

function onLogin() {
    closeModal();
    notify("Добро пожаловать, " + currentUser.name);
    document.getElementById('authZone').innerHTML = `
        <div style="display:flex; align-items:center; gap:12px">
            <div style="text-align:right">
                <div style="font-weight:700">${currentUser.name}</div>
                <div style="color:var(--success); font-size:12px" id="headerBal">${currentUser.balance} ₽</div>
            </div>
            <button class="btn" style="padding:5px 10px; background:var(--border); color:#fff" onclick="location.reload()">Выход</button>
        </div>
    `;
    if(currentUser.role === 'admin' || currentUser.role === 'moder') {
        document.getElementById('adminLink').style.display = 'inline-block';
    }
    renderChat();
}

// ПАНЕЛЬ УПРАВЛЕНИЯ
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    const isOwner = currentUser.role === 'admin';
    document.getElementById('wipeZone').style.display = isOwner ? 'block' : 'none';

    list.innerHTML = db.users.map(u => `
        <tr>
            <td>${u.name}</td>
            <td><b>${u.balance} ₽</b></td>
            <td>
                <input type="number" id="give-${u.name}" class="admin-input-sum" placeholder="0">
                <button class="btn" style="padding:4px 8px; background:var(--success); color:#fff" onclick="giveBal('${u.name}')">OK</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                ${isOwner ? `
                    <select class="role-select" onchange="changeRole('${u.name}', this.value)">
                        <option value="user" ${u.role==='user'?'selected':''}>User</option>
                        <option value="moder" ${u.role==='moder'?'selected':''}>Moder</option>
                        <option value="admin" ${u.role==='admin'?'selected':''}>Admin</option>
                    </select>
                ` : '---'}
            </td>
        </tr>
    `).join('');
}

function giveBal(name) {
    const sum = parseInt(document.getElementById('give-'+name).value);
    if(isNaN(sum)) return notify("Введите сумму!");
    const user = db.users.find(u => u.name === name);
    if(user) {
        user.balance += sum;
        save();
        notify(`Выдано ${sum}₽ игроку ${name}`);
        renderAdmin();
    }
}

function changeRole(name, role) {
    if(currentUser.role !== 'admin') return notify("Нет прав!");
    const user = db.users.find(u => u.name === name);
    if(user) {
        user.role = role;
        save();
        notify(`Роль ${name} изменена на ${role}`);
        renderAdmin();
    }
}

// ЧАТ
function sendChatMessage() {
    if(!currentUser) return openModal('authModal');
    const inp = document.getElementById('chatInput');
    if(!inp.value.trim()) return;
    db.messages.push({ u: currentUser.name, t: inp.value, r: currentUser.role });
    if(db.messages.length > 50) db.messages.shift();
    save();
    inp.value = '';
    renderChat();
}

function renderChat() {
    const box = document.getElementById('chatMessages');
    box.innerHTML = db.messages.map(m => `
        <div class="msg">
            <span class="badge badge-${m.r || 'user'}">${m.r || 'user'}</span>
            <b>${m.u}:</b> ${m.t.replace(/</g, "&lt;")}
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// ЗАДАНИЯ
function renderTasks() {
    const list = document.getElementById('taskList');
    list.innerHTML = db.tasks.map(t => {
        const done = currentUser && t.done.includes(currentUser.name);
        return `<div class="card" style="display:flex; justify-content:space-between; align-items:center">
            <div><h4>${t.name}</h4><span style="color:var(--success)">+${t.reward} ₽</span></div>
            <button class="btn btn-primary" ${done?'disabled':''} onclick="doTask(${t.id})">${done?'Выполнено':'Забрать'}</button>
        </div>`;
    }).join('');
}

function doTask(id) {
    if(!currentUser) return openModal('authModal');
    const t = db.tasks.find(x => x.id === id);
    if(!t.done.includes(currentUser.name)) {
        t.done.push(currentUser.name);
        currentUser.balance += t.reward;
        save();
        notify("Бонус получен!");
        showSection('tasks');
    }
}

// КЕЙСЫ
function openCase() {
    if(!currentUser) return openModal('authModal');
    if(currentUser.balance < 50) return notify("Недостаточно средств!");
    currentUser.balance -= 50;
    const items = ["Desert Eagle", "AWP Dragon Lore", "Knife", "P250"];
    const disp = document.getElementById('caseDisplay');
    disp.innerText = "ROLLING...";
    setTimeout(() => {
        const win = items[Math.floor(Math.random()*items.length)];
        disp.innerText = win;
        save();
        notify("Выпало: " + win);
    }, 800);
}

function notify(t) {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
}

function wipeDatabase() {
    if(confirm("Удалить все данные HuRuS?")) { localStorage.clear(); location.reload(); }
}

document.addEventListener('DOMContentLoaded', () => {
    document.getElementById('serverList').innerHTML = `<div class="card">HuRuS MIRAGE #1 (12/20)</div>`;
    renderChat();
});

document.getElementById('chatInput').addEventListener('keypress', e => { if(e.key==='Enter') sendChatMessage(); });