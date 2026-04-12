import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getDatabase, ref, set, onValue, update, push } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-database.js";

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

// СИНХРОНИЗАЦИЯ
onValue(ref(db, '/'), (snapshot) => {
    const data = snapshot.val();
    if (data) {
        allUsers = data.users ? Object.values(data.users) : [];
        renderChat(data.messages ? Object.values(data.messages) : []);
        
        if (!currentUser) {
            const saved = localStorage.getItem('hurus_session');
            if (saved) {
                const found = allUsers.find(u => u.name === saved);
                if (found) { currentUser = found; onLogin(); }
            }
        }
        if (document.getElementById('admin').classList.contains('active')) renderAdmin();
    }
});

// АДМИН ПАНЕЛЬ
function renderAdmin() {
    const list = document.getElementById('adminUserList');
    list.innerHTML = allUsers.map(u => `
        <tr>
            <td><b>${u.name}</b></td>
            <td>${u.balance} ₽</td>
            <td>
                <input type="number" id="sum-${u.name}" style="width:50px; background:#000; color:#fff; border:1px solid var(--border); padding:5px;">
                <button onclick="giveBal('${u.name}')" class="btn-main" style="padding:5px;">OK</button>
            </td>
            <td><span class="badge badge-${u.role}">${u.role}</span></td>
            <td>
                <select onchange="changeRole('${u.name}', this.value)" style="background:#000; color:#fff; border:1px solid var(--border); padding:5px;">
                    <option value="" disabled selected>Изменить</option>
                    <option value="user">User</option>
                    <option value="vip">VIP</option>
                    <option value="premium">Premium</option>
                    <option value="elite">Elite</option>
                    <option value="admin">Admin</option>
                </select>
            </td>
        </tr>
    `).join('');
}

window.changeRole = (name, newRole) => {
    update(ref(db, 'users/'+name), { role: newRole });
    notify(`Роль ${name} теперь ${newRole}`);
};

// ЧАТ
function renderChat(msgs) {
    const box = document.getElementById('chatMessages');
    box.innerHTML = msgs.sort((a,b) => a.time - b.time).map(m => `
        <div style="margin-bottom:8px">
            <span class="badge badge-${m.r}">${m.r}</span> <b style="color: #a29bfe">${m.u}:</b> ${m.t}
        </div>
    `).join('');
    box.scrollTop = box.scrollHeight;
}

// ... остальной код (auth, showSection, notify) остается прежним ...
window.showSection = (id) => {
    document.querySelectorAll('.page-section').forEach(s => s.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelectorAll('nav button').forEach(b => b.classList.remove('active'));
    document.getElementById('nav-'+id)?.classList.add('active');
    if (id === 'admin') renderAdmin();
};