import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push, remove, get } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

// Конфигурация Firebase
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

// Глобальные переменные состояния
let currentUser = null;
let allUsers = [];
let authMode = 'login';
let activeReactMsgId = null;

// --- 1. БАЗА ПРЕДМЕТОВ (ДЛЯ КЕЙСОВ) ---
const ITEMS_POOL = [
    { name: "M4A4 | Howl", rarity: "legendary", chance: 0.02, img: "https://community.fastly.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpou-6kejhjx2zFJTwW09Kzm7-FmP7mDLbUkmne5bp9i_vG8In32A3nqhdlYm72cYecIA9vYVvR_1W3x7--jJ-978zOnXJquXIn7S7VzEPl108ZbbZngvSZA1uYVvVvspS_vFmX" },
    { name: "AK-47 | Redline", rarity: "epic", chance: 0.15, img: "https://community.fastly.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot7HxfDhjx2jJemkV09-5lpKKqPrxN7LEmyVQ7MEpiLuSrY6i2lHj-0VvN23yIdTDe1A-Y13X-1S2w-7n08Xo6Z6YyXJ9-n5KW4_8X6M" },
    { name: "AWP | Atheris", rarity: "rare", chance: 0.35, img: "https://community.fastly.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgpot621FAR17PLfYQJD_9W7m5a0mvLwOq7cqWdQ-sJ0xOzAot-ki12Lpxo4OdiidI-Sd1RvYV_V_Vfsl7_u05S_753AynVguyYh43_cm0G00R9SbeZxxavJzX79Sg" },
    { name: "Glock-18 | Moonrise", rarity: "common", chance: 0.48, img: "https://community.fastly.steamstatic.com/economy/image/-9a81dlWLwJ2UUGcVs_nsVtzdOEdtWwKGZZLQHTxDZ7I56KU0Zwwo4NUX4oFJZEHLbXH5ApeO4YmlhxYQknCRvCo04DEVlxkKgposbaqKAxf0v73fyhB4Nm3hr-KkP_7NbeInmdf-8p9j8vP946l31Xgr0A_am3zIdSccQU3N1vU_FO5w7_qhMK5vJ_AnXFqu3Ym4n_fyxapwUYb_K69waM" }
];

// --- 2. СИНХРОНИЗАЦИЯ С FIREBASE ---
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val() || {};
    
    // Обновляем список пользователей
    allUsers = data.users ? Object.entries(data.users).map(([id, val]) => ({ uid: id, ...val })) : [];
    
    // Проверка сессии
    const savedNick = localStorage.getItem('hurus_session');
    if (savedNick) {
        const found = allUsers.find(u => u.name === savedNick);
        if (found) {
            currentUser = found;
            updateUI();
            renderInventory();
        }
    }

    // Рендерим общие компоненты
    renderChat(data.messages || {});
    if (document.getElementById('admin').classList.contains('active')) {
        renderAdmin();
        renderLogs(data.logs || {});
    }
});

// --- 3. ЛОГИКА КЕЙСОВ И ИНВЕНТАРЯ ---
window.openCase = async () => {
    if (!currentUser) return notify("Сначала войдите!");
    const price = 100;

    if (currentUser.balance < price) return notify("Недостаточно средств!");

    // Алгоритм рандома
    const roll = Math.random();
    let cumulativeChance = 0;
    let wonItem = ITEMS_POOL[ITEMS_POOL.length - 1]; // Дефолт - самый дешевый

    for (const item of ITEMS_POOL) {
        cumulativeChance += item.chance;
        if (roll < cumulativeChance) {
            wonItem = item;
            break;
        }
    }

    try {
        const newBalance = currentUser.balance - price;
        // Обновляем баланс
        await update(ref(db, `users/${currentUser.uid}`), { balance: newBalance });
        // Добавляем предмет в инвентарь
        await push(ref(db, `users/${currentUser.uid}/inventory`), {
            ...wonItem,
            dropDate: Date.now()
        });
        // Пишем лог
        await addLog(`Игрок ${currentUser.name} открыл кейс: выпал ${wonItem.name}`);
        
        document.getElementById('caseDisplay').innerHTML = `ВЫПАЛО: <span class="skin-${wonItem.rarity}">${wonItem.name}</span>`;
        notify(`Поздравляем! Вы выбили ${wonItem.name}`);
    } catch (e) {
        notify("Ошибка при открытии!");
    }
};

function renderInventory() {
    const grid = document.getElementById('inventoryGrid');
    if (!grid) return;

    if (!currentUser.inventory) {
        grid.innerHTML = '<div class="empty-msg">У вас пока нет скинов</div>';
        return;
    }

    const items = Object.entries(currentUser.inventory);
    grid.innerHTML = items.map(([id, item]) => `
        <div class="inventory-item">
            <div class="item-icon"><img src="${item.img}" alt="${item.name}"></div>
            <div class="item-name skin-${item.rarity}">${item.name}</div>
        </div>
    `).join('');
}

// --- 4. ПАНЕЛЬ УПРАВЛЕНИЯ (ADMIN) ---
window.renderAdmin = () => {
    const list = document.getElementById('adminUserList');
    if (!list) return;

    list.innerHTML = allUsers.map(u => `
        <tr>
            <td>${u.name} ${u.uid === currentUser.uid ? '(Вы)' : ''}</td>
            <td><b>${u.balance || 0} ₽</b></td>
            <td>
                <div style="display:flex; gap:5px">
                    <input type="number" id="amt_${u.uid}" placeholder="Сумма" style="width:60px; padding:2px; background:#000; border:1px solid #333; color:#fff">
                    <button class="btn-ok" onclick="adminAddBalance('${u.uid}')">OK</button>
                </div>
            </td>
            <td>
                <select onchange="changeRole('${u.uid}', this.value)" style="background:#000; color:#fff; border:1px solid #333;">
                    <option value="user" ${u.role === 'user' ? 'selected' : ''}>User</option>
                    <option value="moder" ${u.role === 'moder' ? 'selected' : ''}>Moder</option>
                    <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
                </select>
            </td>
            <td>
                <div style="display:flex; gap:10px; align-items:center">
                    <button title="Очистить инвентарь" class="btn-clear-chat" onclick="adminClearInv('${u.uid}')"><i class="fas fa-box-open"></i> Сброс</button>
                    <button class="btn-del" onclick="deleteUser('${u.uid}')"><i class="fas fa-trash"></i></button>
                </div>
            </td>
        </tr>
    `).join('');
};

window.adminAddBalance = async (uid) => {
    const input = document.getElementById(`amt_${uid}`);
    const amount = parseInt(input.value);
    if (isNaN(amount)) return notify("Введите число!");

    const user = allUsers.find(u => u.uid === uid);
    await update(ref(db, `users/${uid}`), { balance: (user.balance || 0) + amount });
    await addLog(`Админ ${currentUser.name} изменил баланс ${user.name} на ${amount} ₽`);
    input.value = '';
    notify("Баланс обновлен");
};

window.adminClearInv = async (uid) => {
    if (!confirm("Вы уверены, что хотите полностью очистить инвентарь игрока?")) return;
    const user = allUsers.find(u => u.uid === uid);
    await remove(ref(db, `users/${uid}/inventory`));
    await addLog(`Админ ${currentUser.name} очистил инвентарь игрока ${user.name}`);
    notify("Инвентарь очищен");
};

// --- 5. СИСТЕМА ЛОГОВ ---
async function addLog(msg) {
    await push(ref(db, 'logs'), {
        text: msg,
        time: Date.now()
    });
}

function renderLogs(logsObj) {
    const logBox = document.getElementById('adminLogs');
    if (!logBox) return;

    const logs = Object.values(logsObj).reverse().slice(0, 30); // Последние 30 логов
    logBox.innerHTML = logs.map(l => `
        <div class="log-entry">
            <span class="log-time">[${new Date(l.time).toLocaleTimeString()}]</span>
            <span class="log-text">${l.text}</span>
        </div>
    `).join('');
}

// --- 6. ЧАТ И ВСПОМОГАТЕЛЬНОЕ (БЕЗ ИЗМЕНЕНИЙ) ---
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    if (id === 'admin') renderAdmin();
};

window.notify = (t) => {
    const toast = document.getElementById('toast');
    toast.innerText = t; toast.style.display = 'block';
    setTimeout(() => toast.style.display = 'none', 3000);
};

// ... (Функции renderChat, toggleReaction, handleAuth остаются как в оригинале)