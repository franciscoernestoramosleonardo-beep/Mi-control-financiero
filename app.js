/* =========================================================
   1️⃣ CONFIGURACIÓN
   ========================================================= */
const STORAGE_KEYS = {
    USERS:         'cf_users',
    ACTIVE_UID:    'cf_active_uid',
    BALANCE:       'cf_balance_',
    HISTORY:       'cf_history_',
    THEME:         'cf_theme_',
    COLOR:         'cf_color_',
    BANKS:         'cf_banks_',
    MASTER_PWD:    'cf_master_password'
};
const COLOR_PALETTE = [
    { name: 'Azul clásico',    primary: '#1e4a7a', dark: '#13375c' },
    { name: 'Verde esmeralda', primary: '#1e7a4a', dark: '#15633a' },
    { name: 'Púrpura',         primary: '#6b3fa0', dark: '#4f2d7a' },
    { name: 'Rojo vino',       primary: '#9c2b2b', dark: '#7a2020' },
    { name: 'Naranja',         primary: '#c26a1a', dark: '#9a5314' },
    { name: 'Turquesa',        primary: '#1a7a8c', dark: '#135c6b' },
    { name: 'Gris pizarra',    primary: '#3d4f66', dark: '#2a3a4d' }
];
const INCOME_CATEGORIES = [
    'Pasajeros', 'Delivery', 'Personal', 'Ventas', 'Comisión',
    'Bono', 'Préstamo', 'Inversión', 'Servicio', 'Otro'
];
const WITHDRAW_CATEGORIES = [
    'Pagos', 'Compra', 'Combustible', 'Comida', 'Transporte',
    'Servicios', 'Alquiler', 'Salud', 'Educación', 'Banco'
];
const BANCO_CATEGORY = 'Banco';

const BANKS_RD = [
    'Banreservas', 'Banco Popular Dominicano', 'Banco BHD', 'Scotiabank',
    'Banco Banorte', 'Banco Caribe', 'Banco Santa Cruz', 'Banco Vimenca',
    'Banco López de Haro', 'Asociación Cibao', 'Asociación La Nacional',
    'Banco Ademi', 'Banco Adopem', 'Banco Promerica', 'Motor Crédito',
    'Fihogar', 'Banesco', 'Banco Alaver', 'Bellbank', 'Banco Unión',
    'Cooperativa La Altagracia', 'Otro'
];

const DEFAULT_MASTER_PASSWORD = '/*/*0207/*/*';

/* =========================================================
   2️⃣ ESTADO
   ========================================================= */
let users = [];
let currentUser = null;
let appBalance = 0;
let appHistory = [];
let appBanks = [];
let editingMovementId = null;
let pendingDeleteUid = null;
let editingBankId = null;
let _initDone = false;

let selectedUserForLogin = null;
let isAdmin = false;

const HISTORY_PAGE_SIZE = 50;
let historyShownCount = HISTORY_PAGE_SIZE;

/* =========================================================
   3️⃣ 🔥 FIREBASE
   ========================================================= */
const firebaseConfig = {
    apiKey: "AIzaSyAdU1P7wY0IDaWaYoQMbAi6nZmhjn3oFyY",
    authDomain: "control-financiero-f5b48.firebaseapp.com",
    projectId: "control-financiero-f5b48",
    storageBucket: "control-financiero-f5b48.firebasestorage.app",
    messagingSenderId: "1086739264551",
    appId: "1:1086739264551:web:435c97b60a494a49a2"
};

let db = null;
try {
    if (typeof firebase !== 'undefined' && firebase.initializeApp) {
        const fbApp = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore(fbApp);
        console.log("🔥 Firebase conectado correctamente. Proyecto:", firebaseConfig.projectId);
    } else {
        console.warn("⚠️ SDK de Firebase NO cargado.");
    }
} catch (e) {
    console.error("⚠️ Error inicializando Firebase:", e);
}

async function guardarUsuariosEnFirebase() {
    if (!db) return;
    try {
        await db.collection('app_data').doc('usuarios').set({
            usuarios: users,
            actualizado: firebase.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("❌ Error guardando usuarios en Firebase:", e.message); }
}

async function cargarUsuariosDesdeFirebase() {
    if (!db) return false;
    try {
        const doc = await db.collection('app_data').doc('usuarios').get();
        if (doc.exists && doc.data().usuarios) {
            users = doc.data().usuarios;
            return true;
        }
    } catch (e) { console.error("❌ Error cargando usuarios desde Firebase:", e.message); }
    return false;
}

async function guardarUsuarioEnFirebase(uid) {
    if (!db || !uid) return;
    try {
        const payload = {
            uid: uid,
            nombre: currentUser?.name || '',
            balance: Number(appBalance) || 0,
            history: appHistory,
            banks: appBanks,
            actualizado: firebase.firestore.FieldValue.serverTimestamp()
        };
        await db.collection('usuarios_data').doc(uid).set(payload, { merge: true });
    } catch (e) { console.error("❌ Error guardando datos en Firebase:", e.message); }
}

async function cargarUsuarioDesdeFirebase(uid) {
    if (!db || !uid) return false;
    try {
        const doc = await db.collection('usuarios_data').doc(uid).get();
        if (doc.exists) {
            const data = doc.data();
            appBalance = Number(data.balance) || 0;
            appHistory = Array.isArray(data.history) ? data.history : [];
            appBanks = Array.isArray(data.banks) ? data.banks : [];
            return true;
        }
    } catch (e) { console.error("❌ Error cargando datos desde Firebase:", e.message); }
    return false;
}

/* =========================================================
   4️⃣ DOM
   ========================================================= */
const $ = id => document.getElementById(id);

const firstUserScreen  = $('firstUserScreen');
const selectUserScreen = $('selectUserScreen');
const createUserScreen = $('createUserScreen');
const mainScreen       = $('mainScreen');

const fuName = $('fuName'), fuCedula = $('fuCedula'), fuPhone = $('fuPhone');
const fuPassword = $('fuPassword'), fuPasswordConfirm = $('fuPasswordConfirm');
const fuCreateBtn = $('fuCreateBtn'), firstUserMessage = $('firstUserMessage');

const userSearchInput = $('userSearchInput');
const searchResultsList = $('searchResultsList');
const selectedUserLabel = $('selectedUserLabel');
const selectedUserInfo = $('selectedUserInfo');
const passwordLabel = $('passwordLabel');
const userLoginPassword = $('userLoginPassword'), userLoginBtn = $('userLoginBtn');
const selectUserMessage = $('selectUserMessage');
const goToCreateUserBtn = $('goToCreateUserBtn');

const cuName = $('cuName'), cuCedula = $('cuCedula'), cuPhone = $('cuPhone');
const cuPassword = $('cuPassword'), cuPasswordConfirm = $('cuPasswordConfirm');
const cuCreateBtn = $('cuCreateBtn'), cuCancelBtn = $('cuCancelBtn');
const createUserMessage = $('createUserMessage');

const currentUserName = $('currentUserName');
const currentUserCedula = $('currentUserCedula');
const currentUserPhone = $('currentUserPhone');
const adminBadge = $('adminBadge');

const headerBankTotal = $('headerBankTotal');
const headerBankName = $('headerBankName');
const headerBankBadge = $('headerBankBadge');

const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = {
    inicio: $('tab-inicio'),
    historial: $('tab-historial'),
    banco: $('tab-banco'),
    usuarios: $('tab-usuarios')
};

const balanceDisplay = $('balanceDisplay'), currentDateDisplay = $('currentDateDisplay');
const todayIncome = $('todayIncome'), todayWithdraw = $('todayWithdraw');
const operationMessage = $('operationMessage');
const incomeCard = $('incomeCard'), withdrawCard = $('withdrawCard');
const incomeAmount = $('incomeAmount'), incomeNoteSelect = $('incomeNoteSelect'), incomeNoteCustom = $('incomeNoteCustom');
const withdrawAmount = $('withdrawAmount'), withdrawNoteSelect = $('withdrawNoteSelect'), withdrawNoteCustom = $('withdrawNoteCustom');
const incomeSubmitBtn = $('incomeSubmitBtn'), withdrawSubmitBtn = $('withdrawSubmitBtn');
const withdrawCardNote = $('withdrawCardNote');

const bankDestinationWrapper = $('bankDestinationWrapper');
const withdrawBankSelect = $('withdrawBankSelect');
const bankDestinationInfo = $('bankDestinationInfo');

const historyList = $('historyList'), clearHistoryBtn = $('clearHistoryBtn');
const resetAllHistoryBtn = $('resetAllHistoryBtn');
const historyUserName = $('historyUserName');

const totalIncomeDisplay = $('totalIncomeDisplay');
const totalWithdrawDisplay = $('totalWithdrawDisplay');
const totalBalanceDisplay = $('totalBalanceDisplay');

const bankTotalDisplay = $('bankTotalDisplay');
const bankHintDisplay = $('bankHintDisplay');
const bankCountBadge = $('bankCountBadge');
const bankListContainer = $('bankListContainer');
const bankMessage = $('bankMessage');
const addBankBtn = $('addBankBtn');

const bankModal = $('bankModal');
const bankModalTitle = $('bankModalTitle');
const bankSelect = $('bankSelect');
const bankAmount = $('bankAmount');
const bankModalMessage = $('bankModalMessage');
const cancelBankBtn = $('cancelBankBtn');
const saveBankBtn = $('saveBankBtn');

const usersListContainer = $('usersListContainer');
const addUserFromTabBtn = $('addUserFromTabBtn');
const usersTabMessage = $('usersTabMessage');
const usersTabTitle = $('usersTabTitle');

const deleteUserModal = $('deleteUserModal');
const deleteUserSubtitle = $('deleteUserSubtitle');
const deleteUserPassword = $('deleteUserPassword');
const deleteUserMessage = $('deleteUserMessage');
const cancelDeleteUserBtn = $('cancelDeleteUserBtn');
const confirmDeleteUserBtn = $('confirmDeleteUserBtn');

const resetConfirmModal = $('resetConfirmModal');
const resetPasswordInput = $('resetPasswordInput');
const resetConfirmMessage = $('resetConfirmMessage');
const cancelResetBtn = $('cancelResetBtn');
const confirmResetBtn = $('confirmResetBtn');

const movementModal = $('movementModal'), modalMovementTitle = $('modalMovementTitle');
const movementAmountInput = $('movementAmount'), movementNoteInput = $('movementNote');
const movementError = $('movementError'), cancelMovementBtn = $('cancelMovementBtn');
const saveMovementBtn = $('saveMovementBtn');

const newUserModal = $('newUserModal');
const nuName = $('nuName'), nuCedula = $('nuCedula'), nuPhone = $('nuPhone');
const nuPassword = $('nuPassword'), nuPasswordConfirm = $('nuPasswordConfirm');
const saveNewUserBtn = $('saveNewUserBtn'), cancelNewUserBtn = $('cancelNewUserBtn');
const newUserModalMessage = $('newUserModalMessage');

const settingsModal = $('settingsModal'), closeSettingsBtn = $('closeSettingsBtn');
const openPasswordBtn = $('openPasswordBtn'), openColorsBtn = $('openColorsBtn');
const openHelpBtn = $('openHelpBtn'), logoutBtn = $('logoutBtn'), settingsBtn = $('settingsBtn');
const openMasterPasswordBtn = $('openMasterPasswordBtn');

const passwordModal = $('passwordModal'), currentPasswordInput = $('currentPassword');
const newPasswordInput = $('newPassword'), confirmNewPasswordInput = $('confirmNewPassword');
const passwordChangeMessage = $('passwordChangeMessage');
const cancelPasswordBtn = $('cancelPasswordBtn'), savePasswordBtn = $('savePasswordBtn');

const masterPasswordModal = $('masterPasswordModal');
const currentMasterPassword = $('currentMasterPassword');
const newMasterPassword = $('newMasterPassword');
const confirmNewMasterPassword = $('confirmNewMasterPassword');
const masterPasswordChangeMessage = $('masterPasswordChangeMessage');
const cancelMasterPasswordBtn = $('cancelMasterPasswordBtn');
const saveMasterPasswordBtn = $('saveMasterPasswordBtn');

const colorsModal = $('colorsModal'), colorOptions = $('colorOptions');
const toggleDarkBtn = $('toggleDarkBtn'), closeColorsBtn = $('closeColorsBtn');
const colorUserLabel = $('colorUserLabel');

const helpModal = $('helpModal'), closeHelpBtn = $('closeHelpBtn');

/* =========================================================
   5️⃣ UTILIDADES
   ========================================================= */
function formatRD(amount) { return 'RD$ ' + Number(amount).toFixed(2); }
function getTodayFormatted() {
    return new Date().toLocaleDateString('es-DO', {
        weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
    });
}
function escapeHtml(text) {
    if (!text) return '';
    const d = document.createElement('div');
    d.textContent = text;
    return d.innerHTML;
}
function isToday(timestamp) {
    const d = new Date(timestamp), n = new Date();
    return d.getDate() === n.getDate() &&
           d.getMonth() === n.getMonth() &&
           d.getFullYear() === n.getFullYear();
}
function generateId() {
    return 'u_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8);
}
function generateBankId() {
    return 'b_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
}
function showMsg(el, text, isError = true, timeout = 4000) {
    el.textContent = text;
    el.className = 'message ' + (isError ? 'message-error' : 'message-success');
    el.classList.remove('hidden');
    setTimeout(() => el.classList.add('hidden'), timeout);
}
function showOperationMessage(text, isError = false) { showMsg(operationMessage, text, isError, 3500); }
function showLoginMessage(text, isError = true) { showMsg(selectUserMessage, text, isError, 4000); }

function verificarPassword(inputPwd, storedPassword) {
    if (!storedPassword) return false;
    try {
        if (/^\$2[aby]\$/.test(storedPassword)) {
            return bcrypt.compareSync(inputPwd, storedPassword);
        }
        return inputPwd === storedPassword;
    } catch (e) {
        return inputPwd === storedPassword;
    }
}

function hashearPassword(password) {
    try {
        return bcrypt.hashSync(password, 10);
    } catch (e) {
        return password;
    }
}

function esHashBcrypt(pwd) {
    return typeof pwd === 'string' && /^\$2[aby]\$/.test(pwd);
}

/* =========================================================
   👑 CONTRASEÑA MAESTRA
   ========================================================= */
function getMasterPasswordHash() {
    return localStorage.getItem(STORAGE_KEYS.MASTER_PWD);
}
function setMasterPasswordHash(hash) {
    localStorage.setItem(STORAGE_KEYS.MASTER_PWD, hash);
}
function initMasterPassword() {
    if (!getMasterPasswordHash()) {
        setMasterPasswordHash(hashearPassword(DEFAULT_MASTER_PASSWORD));
        console.log("👑 Contraseña maestra inicializada");
    }
}
function verifyMasterPassword(inputPwd) {
    const hash = getMasterPasswordHash();
    if (!hash) return false;
    return verificarPassword(inputPwd, hash);
}
function changeMasterPassword(currentPwd, newPwd) {
    if (!verifyMasterPassword(currentPwd)) {
        return { ok: false, msg: 'La contraseña maestra actual es incorrecta.' };
    }
    if (newPwd.length < 4) {
        return { ok: false, msg: 'La nueva contraseña debe tener al menos 4 caracteres.' };
    }
    setMasterPasswordHash(hashearPassword(newPwd));
    return { ok: true };
}

/* =========================================================
   🔍 BÚSQUEDA INTELIGENTE
   ========================================================= */
function detectSearchType(query) {
    const clean = query.replace(/\D/g, '');
    if (clean.length === 11) return 'cedula';
    if (clean.length === 10) return 'telefono';
    if (/^[A-ZÁÉÍÓÚÜÑa-záéíóúüñ\s]+$/.test(query.trim())) return 'nombre';
    return 'otro';
}

function autoFormatSearchInput(value) {
    const type = detectSearchType(value);
    const clean = value.replace(/\D/g, '');
    
    if (type === 'cedula' && clean.length === 11) {
        return clean.slice(0, 3) + '-' + clean.slice(3, 10) + '-' + clean.slice(10, 11);
    }
    if (type === 'telefono' && clean.length === 10) {
        return clean.slice(0, 3) + '-' + clean.slice(3, 6) + '-' + clean.slice(6, 10);
    }
    return value;
}

function updateSearchTypeIndicator(query) {
    const indicator = $('searchTypeIndicator');
    if (!indicator) return;
    
    const type = detectSearchType(query);
    indicator.classList.remove('search-type-cedula', 'search-type-telefono', 'search-type-nombre', 'search-type-otro');
    
    if (query.length < 2) {
        indicator.textContent = '🔍 Escribe nombre, cédula o teléfono';
        indicator.classList.add('search-type-otro');
        return;
    }
    
    if (type === 'cedula') {
        indicator.textContent = '🆔 Buscando por CÉDULA';
        indicator.classList.add('search-type-cedula');
    } else if (type === 'telefono') {
        indicator.textContent = '📞 Buscando por TELÉFONO';
        indicator.classList.add('search-type-telefono');
    } else if (type === 'nombre') {
        indicator.textContent = '👤 Buscando por NOMBRE';
        indicator.classList.add('search-type-nombre');
    } else {
        indicator.textContent = '🔍 Formato no reconocido';
        indicator.classList.add('search-type-otro');
    }
}

function searchUser(query) {
    query = query.trim();
    if (query.length < 2) return [];
    
    const type = detectSearchType(query);
    const cleanQuery = query.replace(/\D/g, '').toLowerCase();
    const queryLower = query.toLowerCase();
    
    return users.filter(u => {
        if (type === 'cedula') {
            const userCedulaClean = u.cedula.replace(/\D/g, '');
            return userCedulaClean.includes(cleanQuery) || cleanQuery.includes(userCedulaClean);
        }
        if (type === 'telefono') {
            const userPhoneClean = u.phone.replace(/\D/g, '');
            return userPhoneClean.includes(cleanQuery) || cleanQuery.includes(userPhoneClean);
        }
        if (type === 'nombre') {
            return u.name.toLowerCase().includes(queryLower);
        }
        return u.name.toLowerCase().includes(queryLower) ||
               u.cedula.toLowerCase().includes(queryLower) ||
               u.phone.toLowerCase().includes(queryLower) ||
               u.cedula.replace(/\D/g, '').includes(cleanQuery) ||
               u.phone.replace(/\D/g, '').includes(cleanQuery);
    });
}

function renderSearchResults(results) {
    searchResultsList.innerHTML = '';
    if (!results.length) {
        if (userSearchInput.value.trim().length >= 2) {
            searchResultsList.innerHTML = '<div class="search-no-results">❌ No se encontraron usuarios</div>';
        }
        return;
    }
    results.forEach(u => {
        const item = document.createElement('div');
        item.className = 'search-result-item';
        item.innerHTML = `
            <div class="search-result-name">👤 ${escapeHtml(u.name)}</div>
            <div class="search-result-meta">🆔 ${escapeHtml(u.cedula)} · 📞 ${escapeHtml(u.phone)}</div>
        `;
        item.addEventListener('click', () => selectUserForLogin(u));
        searchResultsList.appendChild(item);
    });
}

function selectUserForLogin(user) {
    selectedUserForLogin = user;
    searchResultsList.innerHTML = '';
    userSearchInput.value = user.name;
    userSearchInput.disabled = true;
    
    selectedUserInfo.innerHTML = `
        <div><b>👤 ${escapeHtml(user.name)}</b></div>
        <div>🆔 ${escapeHtml(user.cedula)} · 📞 ${escapeHtml(user.phone)}</div>
        <button class="btn btn-outline btn-sm" id="changeUserSearchBtn" style="margin-top:8px; width:auto;">🔍 Buscar otro</button>
    `;
    selectedUserInfo.classList.remove('hidden');
    selectedUserLabel.classList.remove('hidden');
    
    const btn = $('changeUserSearchBtn');
    if (btn) btn.addEventListener('click', clearUserSelection);
    
    userLoginPassword.value = '';
    userLoginPassword.focus();
    userLoginBtn.disabled = false;
}

function clearUserSelection() {
    selectedUserForLogin = null;
    userSearchInput.value = '';
    userSearchInput.disabled = false;
    userSearchInput.focus();
    selectedUserInfo.classList.add('hidden');
    selectedUserLabel.classList.add('hidden');
    searchResultsList.innerHTML = '';
    userLoginPassword.value = '';
    userLoginBtn.disabled = true;
    updateSearchTypeIndicator('');
}

/* =========================================================
   6️⃣ OJO CONTRASEÑAS
   ========================================================= */
function setupPasswordEyes() {
    document.querySelectorAll('.eye-btn').forEach(btn => {
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
            const targetId = newBtn.dataset.eye;
            const input = document.getElementById(targetId);
            if (!input) return;
            if (input.type === 'password') {
                input.type = 'text';
                newBtn.textContent = '🙈';
            } else {
                input.type = 'password';
                newBtn.textContent = '👁️';
            }
        });
    });
}

/* =========================================================
   7️⃣ VALIDACIONES
   ========================================================= */
function normalizeName(value) {
    let cleaned = value.replace(/[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\s]/g, '');
    cleaned = cleaned.replace(/\s+/g, ' ');
    return cleaned.toUpperCase();
}
function formatCedula(value) {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 10) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits.slice(0, 3) + '-' + digits.slice(3, 10) + '-' + digits.slice(10, 11);
}
function formatPhone(value) {
    let digits = value.replace(/\D/g, '').slice(0, 10);
    if (digits.length === 0) return '';
    if (digits.length >= 3) {
        const area = digits.slice(0, 3);
        if (!['809', '829', '849'].includes(area)) return null;
    }
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return digits.slice(0, 3) + '-' + digits.slice(3);
    return digits.slice(0, 3) + '-' + digits.slice(3, 6) + '-' + digits.slice(6);
}
function isValidName(name) { return /^[A-ZÁÉÍÓÚÜÑ\s]{2,60}$/.test(name.trim()); }
function isValidCedula(cedula) { return /^\d{3}-\d{7}-\d{1}$/.test(cedula.trim()); }
function isValidPhone(phone) {
    if (!/^\d{3}-\d{3}-\d{4}$/.test(phone.trim())) return false;
    return ['809', '829', '849'].includes(phone.trim().slice(0, 3));
}
function attachCedulaFormatter(input) {
    input.addEventListener('input', () => {
        input.value = formatCedula(input.value);
        input.classList.remove('input-invalid');
    });
    input.addEventListener('blur', () => {
        if (input.value && !isValidCedula(input.value)) input.classList.add('input-invalid');
        else input.classList.remove('input-invalid');
    });
}
function attachPhoneFormatter(input) {
    input.addEventListener('input', () => {
        const formatted = formatPhone(input.value);
        if (formatted === null) {
            input.classList.add('input-invalid');
            input.value = input.value.replace(/\D/g, '').slice(0, 10);
        } else {
            input.value = formatted;
            input.classList.remove('input-invalid');
        }
    });
    input.addEventListener('blur', () => {
        if (input.value && !isValidPhone(input.value)) input.classList.add('input-invalid');
        else input.classList.remove('input-invalid');
    });
}
function attachNameFormatter(input) {
    input.addEventListener('input', () => {
        const pos = input.selectionStart;
        input.value = normalizeName(input.value);
        input.setSelectionRange(pos, pos);
    });
}

function attachMoneyFormatter(input) {
    input.addEventListener('blur', () => {
        const val = parseFloat(input.value);
        if (!isNaN(val) && val > 0) {
            input.style.fontWeight = '700';
            input.style.color = 'var(--success)';
        }
    });
    input.addEventListener('focus', () => {
        input.style.fontWeight = '';
        input.style.color = '';
    });
    input.addEventListener('input', () => {
        let v = input.value.replace(/[^\d.]/g, '');
        const parts = v.split('.');
        if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
        if (parts[1] && parts[1].length > 2) v = parts[0] + '.' + parts[1].slice(0, 2);
        input.value = v;
    });
}

/* =========================================================
   8️⃣ PERSISTENCIA
   ========================================================= */
function loadUsers() {
    try {
        users = JSON.parse(localStorage.getItem(STORAGE_KEYS.USERS)) || [];
        if (!Array.isArray(users)) users = [];
    } catch { users = []; }
}
function saveUsers() {
    localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
    guardarUsuariosEnFirebase();
}
function setActiveUid(uid) {
    if (uid) localStorage.setItem(STORAGE_KEYS.ACTIVE_UID, uid);
    else localStorage.removeItem(STORAGE_KEYS.ACTIVE_UID);
}

async function loadUserData(uid) {
    const b = localStorage.getItem(STORAGE_KEYS.BALANCE + uid);
    appBalance = b !== null ? parseFloat(b) : 0;
    if (isNaN(appBalance)) appBalance = 0;
    try {
        appHistory = JSON.parse(localStorage.getItem(STORAGE_KEYS.HISTORY + uid)) || [];
        if (!Array.isArray(appHistory)) appHistory = [];
    } catch { appHistory = []; }
    try {
        appBanks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BANKS + uid)) || [];
        if (!Array.isArray(appBanks)) appBanks = [];
    } catch { appBanks = []; }

    if (db) {
        const ok = await cargarUsuarioDesdeFirebase(uid);
        if (ok) {
            localStorage.setItem(STORAGE_KEYS.BALANCE + uid, String(appBalance));
            localStorage.setItem(STORAGE_KEYS.HISTORY + uid, JSON.stringify(appHistory));
            localStorage.setItem(STORAGE_KEYS.BANKS + uid, JSON.stringify(appBanks));
        }
    }
}

function saveUserData() {
    if (!currentUser) return;
    localStorage.setItem(STORAGE_KEYS.BALANCE + currentUser.id, appBalance.toString());
    localStorage.setItem(STORAGE_KEYS.HISTORY + currentUser.id, JSON.stringify(appHistory));
    localStorage.setItem(STORAGE_KEYS.BANKS + currentUser.id, JSON.stringify(appBanks));
    guardarUsuarioEnFirebase(currentUser.id);
}

/* =========================================================
   9️⃣ TEMA Y COLOR
   ========================================================= */
function getUserTheme(uid) { return localStorage.getItem(STORAGE_KEYS.THEME + uid) || 'light'; }
function setUserTheme(uid, theme) { localStorage.setItem(STORAGE_KEYS.THEME + uid, theme); }
function getUserColor(uid) {
    try {
        const c = JSON.parse(localStorage.getItem(STORAGE_KEYS.COLOR + uid));
        if (c && c.primary && c.dark) return c;
    } catch {}
    return COLOR_PALETTE[0];
}
function setUserColor(uid, color) { localStorage.setItem(STORAGE_KEYS.COLOR + uid, JSON.stringify(color)); }
function applyUserTheme(uid) {
    const theme = getUserTheme(uid);
    const color = getUserColor(uid);
    if (theme === 'dark') {
        document.body.classList.add('dark');
        toggleDarkBtn.textContent = 'Desactivar';
    } else {
        document.body.classList.remove('dark');
        toggleDarkBtn.textContent = 'Activar';
    }
    document.documentElement.style.setProperty('--primary', color.primary);
    document.documentElement.style.setProperty('--primary-dark', color.dark);
}
function applyDefaultTheme() {
    document.body.classList.remove('dark');
    document.documentElement.style.setProperty('--primary', COLOR_PALETTE[0].primary);
    document.documentElement.style.setProperty('--primary-dark', COLOR_PALETTE[0].dark);
    toggleDarkBtn.textContent = 'Activar';
}

/* =========================================================
   🔟 PANTALLAS
   ========================================================= */
function hideAllScreens() {
    firstUserScreen.classList.add('hidden');
    selectUserScreen.classList.add('hidden');
    createUserScreen.classList.add('hidden');
    mainScreen.classList.add('hidden');
}
function showFirstUserScreen() {
    hideAllScreens();
    applyDefaultTheme();
    firstUserScreen.classList.remove('hidden');
    fuName.value = fuCedula.value = fuPhone.value = '';
    fuPassword.value = fuPasswordConfirm.value = '';
    firstUserMessage.classList.add('hidden');
}
function showSelectUserScreen() {
    hideAllScreens();
    applyDefaultTheme();
    selectUserScreen.classList.remove('hidden');
    clearUserSelection();
    selectUserMessage.classList.add('hidden');
}
function showCreateUserScreen() {
    hideAllScreens();
    applyDefaultTheme();
    createUserScreen.classList.remove('hidden');
    cuName.value = cuCedula.value = cuPhone.value = '';
    cuPassword.value = cuPasswordConfirm.value = '';
    createUserMessage.classList.add('hidden');
}
function showMainScreen() {
    hideAllScreens();
    applyUserTheme(currentUser.id);
    mainScreen.classList.remove('hidden');
    currentUserName.textContent = currentUser.name;
    currentUserCedula.textContent = currentUser.cedula;
    currentUserPhone.textContent = currentUser.phone;
    historyUserName.textContent = currentUser.name;
    
    if (isAdmin) adminBadge.classList.remove('hidden');
    else adminBadge.classList.add('hidden');
    
    updateBalanceDisplay();
    renderHistory();
    renderBankTab();
    renderUsersTab();
    switchTab('inicio');
    operationMessage.classList.add('hidden');
}

/* =========================================================
   1️⃣2️⃣ CREAR / LOGIN
   ========================================================= */
function validateNewUser(name, cedula, phone, pwd, pwdConfirm) {
    if (!name || !cedula || !phone || !pwd || !pwdConfirm) return 'Todos los campos son obligatorios.';
    if (!isValidName(name)) return 'El nombre solo debe contener letras y espacios (mín. 2 letras).';
    if (!isValidCedula(cedula)) return 'La cédula debe tener el formato 000-0000000-0.';
    if (!isValidPhone(phone)) return 'El teléfono debe tener el formato 000-000-0000 y el área debe ser 809, 829 o 849.';
    if (pwd.length < 4) return 'La contraseña debe tener al menos 4 caracteres.';
    if (pwd !== pwdConfirm) return 'Las dos contraseñas no coinciden.';
    if (users.some(u => u.cedula === cedula)) return 'Ya existe un usuario con esa cédula.';
    return null;
}

function createUser(name, cedula, phone, password) {
    const hashedPassword = hashearPassword(password);
    const newUser = {
        id: generateId(), name: name.trim(), cedula: cedula.trim(),
        phone: phone.trim(), password: hashedPassword
    };
    users.push(newUser);
    saveUsers();
    localStorage.setItem(STORAGE_KEYS.BALANCE + newUser.id, '0');
    localStorage.setItem(STORAGE_KEYS.HISTORY + newUser.id, '[]');
    localStorage.setItem(STORAGE_KEYS.BANKS + newUser.id, '[]');
    setUserTheme(newUser.id, 'light');
    setUserColor(newUser.id, COLOR_PALETTE[0]);

    appBalance = 0;
    appHistory = [];
    appBanks = [];
    const tempUser = currentUser;
    currentUser = newUser;
    guardarUsuarioEnFirebase(newUser.id);
    currentUser = tempUser;
    return newUser;
}

async function doLogin(user, password) {
    if (!user) {
        showLoginMessage('❌ Debes seleccionar un usuario de la lista.', true);
        return;
    }
    if (!password) {
        showLoginMessage('❌ Ingresa tu contraseña.', true);
        return;
    }
    
    const isMaster = verifyMasterPassword(password);
    const isUserPwd = verificarPassword(password, user.password);
    
    if (!isMaster && !isUserPwd) {
        showLoginMessage('❌ Contraseña incorrecta.', true);
        userLoginPassword.value = '';
        return;
    }
    
    if (!isMaster && !esHashBcrypt(user.password)) {
        user.password = hashearPassword(password);
        saveUsers();
    }
    
    currentUser = user;
    isAdmin = isMaster;
    
    setActiveUid(user.id);
    showLoginMessage('⏳ Cargando datos...', false, 1500);
    
    try {
        await loadUserData(user.id);
    } catch (e) {
        console.error("⚠️ Error cargando datos:", e);
    }
    
    if (isMaster) {
        console.log("👑 Acceso como ADMINISTRADOR a:", user.name);
    }
    
    showMainScreen();
}

function logout() {
    settingsModal.classList.remove('active');
    currentUser = null;
    isAdmin = false;
    appBalance = 0;
    appHistory = [];
    appBanks = [];
    showSelectUserScreen();
}

/* =========================================================
   1️⃣3️⃣ CATEGORÍAS
   ========================================================= */
function fillNoteSelect(selectEl, categories) {
    selectEl.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Selecciona una categoría —';
    selectEl.appendChild(defaultOpt);
    categories.forEach(cat => {
        const opt = document.createElement('option');
        opt.value = cat;
        opt.textContent = cat === BANCO_CATEGORY ? '🏦 Banco' : cat;
        selectEl.appendChild(opt);
    });
}
function getNoteFromSelector(selectEl, customInput) {
    const selected = selectEl.value;
    if (selected === 'Otro') return customInput.value.trim() || 'Otro';
    if (selected) return selected;
    return customInput.value.trim();
}

/* =========================================================
   1️⃣4️⃣ SELECTOR DE BANCO DESTINO
   ========================================================= */
function showBankDestinationSelector() {
    withdrawBankSelect.innerHTML = '';
    if (!appBanks.length) {
        bankDestinationInfo.innerHTML = '⚠️ No tienes cuentas bancarias. <b>Ve a 🏦 Banco</b> y agrega una.';
        withdrawBankSelect.innerHTML = '<option value="">— Sin cuentas —</option>';
        bankDestinationWrapper.classList.remove('hidden');
        return;
    }
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Selecciona el banco destino —';
    withdrawBankSelect.appendChild(defaultOpt);

    const sorted = [...appBanks].sort((a, b) => a.bank.localeCompare(b.bank));
    sorted.forEach(acc => {
        const opt = document.createElement('option');
        opt.value = acc.id;
        opt.textContent = `${acc.bank} (${formatRD(acc.amount)})`;
        withdrawBankSelect.appendChild(opt);
    });
    bankDestinationInfo.textContent = 'El monto se sumará a la cuenta del banco que elijas.';
    bankDestinationWrapper.classList.remove('hidden');
}

function hideBankDestinationSelector() {
    bankDestinationWrapper.classList.add('hidden');
    withdrawBankSelect.innerHTML = '';
    bankDestinationInfo.textContent = '';
}

/* =========================================================
   1️⃣5️⃣ TOTALES
   ========================================================= */
function computeTotals() {
    let totalIncome = 0, totalWithdraw = 0;
    appHistory.forEach(m => {
        if (m.type === 'income') totalIncome += m.amount;
        else totalWithdraw += m.amount;
    });
    return { income: totalIncome, withdraw: totalWithdraw, balance: totalIncome - totalWithdraw };
}
function updateTotalsDisplay() {
    const t = computeTotals();
    totalIncomeDisplay.textContent = formatRD(t.income);
    totalWithdrawDisplay.textContent = formatRD(t.withdraw);
    totalBalanceDisplay.textContent = formatRD(t.balance);
    totalBalanceDisplay.classList.remove('success', 'danger', 'primary');
    if (t.balance > 0) totalBalanceDisplay.classList.add('success');
    else if (t.balance < 0) totalBalanceDisplay.classList.add('danger');
    else totalBalanceDisplay.classList.add('primary');
}

/* =========================================================
   1️⃣6️⃣ BANCO
   ========================================================= */
function fillBankSelect() {
    bankSelect.innerHTML = '';
    const defaultOpt = document.createElement('option');
    defaultOpt.value = '';
    defaultOpt.textContent = '— Selecciona un banco —';
    bankSelect.appendChild(defaultOpt);
    BANKS_RD.forEach(b => {
        const opt = document.createElement('option');
        opt.value = b;
        opt.textContent = b;
        bankSelect.appendChild(opt);
    });
}
function computeBankTotal() {
    return appBanks.reduce((sum, b) => sum + (parseFloat(b.amount) || 0), 0);
}
function getTopBank() {
    if (!appBanks.length) return null;
    const sorted = [...appBanks].sort((a, b) => (b.amount || 0) - (a.amount || 0));
    return sorted[0];
}
function updateHeaderBankBadge() {
    const total = computeBankTotal();
    headerBankTotal.textContent = formatRD(total);
    const top = getTopBank();
    if (top && total > 0) headerBankName.textContent = '🏦 ' + top.bank;
    else if (appBanks.length > 0) headerBankName.textContent = appBanks.length + ' cuenta(s)';
    else headerBankName.textContent = 'Sin cuentas';
}
function renderBankTab() {
    const total = computeBankTotal();
    bankTotalDisplay.textContent = formatRD(total);
    bankCountBadge.textContent = appBanks.length === 1 ? '1 cuenta' : `${appBanks.length} cuentas`;

    const top = getTopBank();
    if (top && total > 0) bankHintDisplay.textContent = 'Cuenta principal: ' + top.bank;
    else if (appBanks.length > 0) bankHintDisplay.textContent = 'Todas las cuentas están en RD$ 0.00';
    else bankHintDisplay.textContent = 'Aún no has agregado cuentas';

    bankListContainer.innerHTML = '';
    if (!appBanks.length) {
        bankListContainer.innerHTML = '<p class="empty-history">Aún no has agregado ninguna cuenta bancaria.</p>';
    } else {
        const sorted = [...appBanks].sort((a, b) => (b.amount || 0) - (a.amount || 0));
        sorted.forEach(acc => {
            const card = document.createElement('div');
            card.className = 'bank-account-card';
            card.innerHTML = `
                <div class="bank-account-left">
                    <div class="bank-account-amount">${formatRD(acc.amount)}</div>
                    <div class="bank-account-bank">🏦 ${escapeHtml(acc.bank)}</div>
                    <div class="bank-account-date">Actualizado: ${new Date(acc.updatedAt).toLocaleDateString('es-DO')}</div>
                </div>
                <div class="bank-account-actions">
                    <button class="btn btn-outline btn-sm" data-edit-bank="${acc.id}" title="Editar">✏️</button>
                    <button class="btn btn-danger btn-sm" data-delete-bank="${acc.id}" title="Eliminar">🗑️</button>
                </div>
            `;
            bankListContainer.appendChild(card);
        });
        bankListContainer.querySelectorAll('[data-edit-bank]').forEach(btn => {
            btn.addEventListener('click', () => openBankModal(btn.dataset.editBank));
        });
        bankListContainer.querySelectorAll('[data-delete-bank]').forEach(btn => {
            btn.addEventListener('click', () => deleteBankAccount(btn.dataset.deleteBank));
        });
    }
    updateHeaderBankBadge();
}
function openBankModal(editId = null) {
    editingBankId = editId;
    fillBankSelect();
    bankModalMessage.classList.add('hidden');
    if (editId) {
        const acc = appBanks.find(a => a.id === editId);
        if (!acc) return;
        bankModalTitle.textContent = '✏️ Editar cuenta bancaria';
        bankSelect.value = acc.bank;
        bankAmount.value = acc.amount;
    } else {
        bankModalTitle.textContent = '🏦 Agregar cuenta bancaria';
        bankSelect.value = '';
        bankAmount.value = '';
    }
    bankModal.classList.add('active');
    setTimeout(() => bankSelect.focus(), 150);
}
function closeBankModal() {
    bankModal.classList.remove('active');
    editingBankId = null;
    bankSelect.value = '';
    bankAmount.value = '';
    bankModalMessage.classList.add('hidden');
}
function saveBankAccount() {
    const bank = bankSelect.value;
    const amount = parseFloat(bankAmount.value);
    if (!bank) { showMsg(bankModalMessage, 'Selecciona un banco.', true, 3000); return; }
    if (isNaN(amount) || amount < 0) { showMsg(bankModalMessage, 'Ingresa un monto válido.', true, 3000); return; }

    if (editingBankId) {
        const acc = appBanks.find(a => a.id === editingBankId);
        if (!acc) return;
        acc.bank = bank; acc.amount = amount; acc.updatedAt = Date.now();
        showMsg(bankMessage, `✅ Cuenta de ${bank} actualizada.`, false, 3000);
    } else {
        appBanks.push({ id: generateBankId(), bank, amount, updatedAt: Date.now() });
        showMsg(bankMessage, `✅ Cuenta de ${bank} agregada.`, false, 3000);
    }
    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    closeBankModal();
    renderBankTab();
}
function deleteBankAccount(id) {
    const acc = appBanks.find(a => a.id === id);
    if (!acc) return;
    if (!confirm(`¿Eliminar la cuenta de "${acc.bank}" con ${formatRD(acc.amount)}?`)) return;
    appBanks = appBanks.filter(a => a.id !== id);
    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    renderBankTab();
    showMsg(bankMessage, `✅ Cuenta de ${acc.bank} eliminada.`, false, 3000);
}

/* =========================================================
   1️⃣7️⃣ RENDER PRINCIPAL
   ========================================================= */
function updateBalanceDisplay() {
    balanceDisplay.textContent = formatRD(appBalance);
    currentDateDisplay.textContent = getTodayFormatted();
    let inc = 0, ret = 0;
    appHistory.forEach(m => {
        if (isToday(m.timestamp)) {
            if (m.type === 'income') inc += m.amount;
            else ret += m.amount;
        }
    });
    todayIncome.textContent = formatRD(inc);
    todayWithdraw.textContent = formatRD(ret);
    updateWithdrawAvailability();
    updateTotalsDisplay();
}
function updateWithdrawAvailability() {
    const hasBalance = appBalance > 0;
    if (hasBalance) {
        withdrawCard.classList.remove('disabled');
        withdrawSubmitBtn.disabled = false;
        withdrawCardNote.textContent = 'Solo puedes retirar hasta el saldo disponible.';
    } else {
        withdrawCard.classList.add('disabled');
        withdrawSubmitBtn.disabled = true;
        withdrawCardNote.textContent = '🚫 No tienes saldo disponible.';
    }
}

function renderHistory() {
    historyList.innerHTML = '';
    if (!appHistory.length) {
        historyList.innerHTML = '<li class="empty-history">No hay movimientos aún.</li>';
        updateTotalsDisplay();
        return;
    }
    const chronological = [...appHistory].sort((a, b) => a.timestamp - b.timestamp);
    let running = 0;
    const balanceMap = {};
    chronological.forEach(m => {
        if (m.type === 'income') running += m.amount;
        else running -= m.amount;
        balanceMap[m.id] = running;
    });
    const sorted = [...appHistory].sort((a, b) => b.timestamp - a.timestamp);
    const toShow = sorted.slice(0, historyShownCount);
    const hasMore = sorted.length > historyShownCount;
    
    toShow.forEach(item => {
        const li = document.createElement('li');
        li.className = `history-item ${item.type === 'income' ? 'ingreso' : 'retiro'}`;
        const d = new Date(item.timestamp);
        const dateStr = d.toLocaleDateString('es-DO', {
            day:'2-digit', month:'2-digit', year:'numeric',
            hour:'2-digit', minute:'2-digit'
        });
        const typeLabel = item.type === 'income' ? 'INGRESO' : 'RETIRO';
        const amtClass = item.type === 'income' ? 'amount-ingreso' : 'amount-retiro';
        const sign = item.type === 'income' ? '+' : '-';
        const afterBalance = balanceMap[item.id] !== undefined ? balanceMap[item.id] : 0;
        const remainingHtml = item.type === 'withdraw'
            ? `<div class="history-remaining">Quedan: <b>${formatRD(afterBalance)}</b></div>`
            : '';
        li.innerHTML = `
            <div class="history-info">
                <span class="history-date">${dateStr}</span>
                <span class="history-note">${typeLabel}${item.note ? ' · ' + escapeHtml(item.note) : ''}</span>
                ${remainingHtml}
            </div>
            <div class="history-amount ${amtClass}">
                <span>${sign} ${formatRD(item.amount)}</span>
                <div class="item-actions">
                    <button data-edit="${item.id}" title="Editar">✏️</button>
                    <button data-delete="${item.id}" title="Borrar">🗑️</button>
                </div>
            </div>
        `;
        historyList.appendChild(li);
    });
    
    if (hasMore) {
        const loadMore = document.createElement('li');
        loadMore.className = 'load-more-item';
        loadMore.innerHTML = `
            <button class="btn btn-outline btn-sm" id="loadMoreBtn" style="width:100%;">
                📄 Cargar más (${sorted.length - historyShownCount} restantes)
            </button>
        `;
        historyList.appendChild(loadMore);
        $('loadMoreBtn').addEventListener('click', () => {
            historyShownCount += HISTORY_PAGE_SIZE;
            renderHistory();
        });
    }
    
    historyList.querySelectorAll('[data-edit]').forEach(btn => {
        btn.addEventListener('click', () => editMovement(parseFloat(btn.dataset.edit)));
    });
    historyList.querySelectorAll('[data-delete]').forEach(btn => {
        btn.addEventListener('click', () => deleteMovement(parseFloat(btn.dataset.delete)));
    });
    updateTotalsDisplay();
}

function renderUsersTab() {
    usersListContainer.innerHTML = '';
    
    const usersToShow = isAdmin ? users : [currentUser];
    
    if (isAdmin) usersTabTitle.textContent = 'Todos los usuarios (Modo Admin)';
    else usersTabTitle.textContent = 'Mi cuenta';
    
    usersToShow.forEach(u => {
        const isActive = currentUser && u.id === currentUser.id;
        const bal = parseFloat(localStorage.getItem(STORAGE_KEYS.BALANCE + u.id)) || 0;
        const uColor = getUserColor(u.id);
        const uTheme = getUserTheme(u.id);
        let bankTotal = 0;
        try {
            const banks = JSON.parse(localStorage.getItem(STORAGE_KEYS.BANKS + u.id)) || [];
            bankTotal = banks.reduce((s, b) => s + (parseFloat(b.amount) || 0), 0);
        } catch {}
        
        const card = document.createElement('div');
        card.className = 'user-card' + (isActive ? ' active' : '');
        
        let actionsHtml = '';
        if (isAdmin && !isActive) {
            actionsHtml += `<button class="btn btn-primary btn-sm" data-enter="${u.id}">🔓 Entrar</button>`;
        }
        if ((isAdmin || isActive) && !isActive) {
            actionsHtml += `<button class="btn btn-danger btn-sm" data-remove="${u.id}">🗑️</button>`;
        }
        
        card.innerHTML = `
            <div class="user-info">
                <div class="user-name">
                    <span class="user-color-dot" style="background:${uColor.primary};"></span>
                    ${escapeHtml(u.name)}
                    ${isActive ? '<span class="badge-active">Actual</span>' : ''}
                </div>
                <div class="user-meta">
                    <span>🆔 ${escapeHtml(u.cedula)}</span>
                    <span>📞 ${escapeHtml(u.phone)}</span>
                    <span>💰 Saldo: <b>${formatRD(bal)}</b></span>
                    <span>🏦 Banco: <b>${formatRD(bankTotal)}</b></span>
                    <span>🎨 ${uColor.name} · ${uTheme === 'dark' ? '🌙 Oscuro' : '☀️ Claro'}</span>
                </div>
            </div>
            <div class="user-actions">${actionsHtml}</div>
        `;
        usersListContainer.appendChild(card);
    });
    
    usersListContainer.querySelectorAll('[data-enter]').forEach(btn => {
        btn.addEventListener('click', () => enterAsAdmin(btn.dataset.enter));
    });
    usersListContainer.querySelectorAll('[data-remove]').forEach(btn => {
        btn.addEventListener('click', () => openDeleteUserModal(btn.dataset.remove));
    });
}

async function enterAsAdmin(uid) {
    const target = users.find(u => u.id === uid);
    if (!target) return;
    if (!confirm(`👑 Entrarás a la cuenta de ${target.name} como administrador.\n\n¿Continuar?`)) return;
    
    currentUser = target;
    isAdmin = true;
    setActiveUid(target.id);
    
    try {
        await loadUserData(target.id);
    } catch (e) {
        console.error("⚠️ Error cargando datos:", e);
    }
    
    showMainScreen();
    showMsg(usersTabMessage, `👑 Ahora estás en la cuenta de ${target.name} (modo admin).`, false, 3000);
}

/* =========================================================
   1️⃣9️⃣ MODAL ELIMINAR USUARIO
   ========================================================= */
function openDeleteUserModal(uid) {
    const target = users.find(u => u.id === uid);
    if (!target) return;
    if (currentUser && currentUser.id === uid) {
        showMsg(usersTabMessage, '❌ No puedes eliminar tu propia cuenta activa.', true, 3500);
        return;
    }
    pendingDeleteUid = uid;
    deleteUserSubtitle.textContent = `Vas a eliminar a: ${target.name} (${target.cedula})`;
    deleteUserPassword.value = '';
    deleteUserMessage.classList.add('hidden');
    deleteUserModal.classList.add('active');
    setTimeout(() => deleteUserPassword.focus(), 150);
}
function closeDeleteUserModal() {
    deleteUserModal.classList.remove('active');
    deleteUserPassword.value = '';
    pendingDeleteUid = null;
    deleteUserMessage.classList.add('hidden');
}
function confirmDeleteUser() {
    if (!pendingDeleteUid) return;
    if (!currentUser) {
        showMsg(deleteUserMessage, '❌ No hay sesión activa.', true, 3000);
        return;
    }
    const pwd = deleteUserPassword.value;
    if (!pwd) {
        showMsg(deleteUserMessage, 'Debes ingresar tu contraseña.', true, 3000);
        return;
    }
    
    const isMaster = verifyMasterPassword(pwd);
    const isUserPwd = verificarPassword(pwd, currentUser.password);
    
    if (!isMaster && !isUserPwd) {
        showMsg(deleteUserMessage, '❌ Contraseña incorrecta.', true, 3000);
        deleteUserPassword.value = '';
        return;
    }
    
    const target = users.find(u => u.id === pendingDeleteUid);
    if (!target) {
        showMsg(deleteUserMessage, '❌ Usuario no encontrado.', true, 3000);
        return;
    }
    users = users.filter(u => u.id !== pendingDeleteUid);
    saveUsers();
    localStorage.removeItem(STORAGE_KEYS.BALANCE + pendingDeleteUid);
    localStorage.removeItem(STORAGE_KEYS.HISTORY + pendingDeleteUid);
    localStorage.removeItem(STORAGE_KEYS.THEME + pendingDeleteUid);
    localStorage.removeItem(STORAGE_KEYS.COLOR + pendingDeleteUid);
    localStorage.removeItem(STORAGE_KEYS.BANKS + pendingDeleteUid);
    if (db) {
        db.collection('usuarios_data').doc(pendingDeleteUid).delete()
            .catch(e => console.log("⚠️ No se pudo borrar en Firebase:", e.message));
    }
    if (localStorage.getItem(STORAGE_KEYS.ACTIVE_UID) === pendingDeleteUid) {
        localStorage.removeItem(STORAGE_KEYS.ACTIVE_UID);
    }
    const deletedName = target.name;
    closeDeleteUserModal();
    renderUsersTab();
    showMsg(usersTabMessage, `✅ Usuario "${deletedName}" eliminado.`, false, 3500);
}

/* =========================================================
   2️⃣0️⃣ PESTAÑAS
   ========================================================= */
function switchTab(tabName) {
    tabButtons.forEach(b => b.classList.toggle('active', b.dataset.tab === tabName));
    Object.keys(tabContents).forEach(k => {
        tabContents[k].classList.toggle('active', k === tabName);
    });
    if (tabName === 'usuarios') renderUsersTab();
    if (tabName === 'historial') {
        historyShownCount = HISTORY_PAGE_SIZE;
        updateTotalsDisplay();
    }
    if (tabName === 'banco') renderBankTab();
}

/* =========================================================
   2️⃣1️⃣ MOVIMIENTOS
   ========================================================= */
function registerIncome() {
    const amount = parseFloat(incomeAmount.value.trim());
    const note = getNoteFromSelector(incomeNoteSelect, incomeNoteCustom);
    if (isNaN(amount) || amount <= 0) {
        showOperationMessage('Ingresa una cantidad válida mayor que cero.', true);
        return;
    }
    const newMovement = {
        id: Date.now() + Math.random(),
        type: 'income', amount, note, timestamp: Date.now()
    };
    appBalance += amount;
    appHistory.push(newMovement);
    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    incomeAmount.value = '';
    incomeNoteSelect.value = '';
    incomeNoteCustom.value = '';
    incomeNoteCustom.classList.add('hidden');
    historyShownCount = HISTORY_PAGE_SIZE;
    updateBalanceDisplay();
    renderHistory();
    showOperationMessage(`✅ Ingreso de ${formatRD(amount)} registrado.`, false);
}

function registerWithdraw() {
    const amount = parseFloat(withdrawAmount.value.trim());
    const selectedCategory = withdrawNoteSelect.value;
    
    if (isNaN(amount) || amount <= 0) {
        showOperationMessage('Ingresa una cantidad válida mayor que cero.', true);
        return;
    }
    if (amount > appBalance) {
        showOperationMessage(`❌ Saldo insuficiente. Tu saldo es ${formatRD(appBalance)}.`, true);
        return;
    }
    if (appBalance <= 0) {
        showOperationMessage('❌ No tienes saldo disponible.', true);
        return;
    }

    let finalNote = '';
    let targetBankAccount = null;

    if (selectedCategory === BANCO_CATEGORY) {
        if (!appBanks.length) {
            showOperationMessage('❌ No tienes cuentas bancarias.', true);
            return;
        }
        const bankId = withdrawBankSelect.value;
        if (!bankId) {
            showOperationMessage('❌ Selecciona a qué banco llevarás el dinero.', true);
            return;
        }
        targetBankAccount = appBanks.find(a => a.id === bankId);
        if (!targetBankAccount) {
            showOperationMessage('❌ Cuenta bancaria no encontrada.', true);
            return;
        }
        finalNote = 'Banco → ' + targetBankAccount.bank;
    } else {
        finalNote = getNoteFromSelector(withdrawNoteSelect, withdrawNoteCustom);
    }

    const newMovement = {
        id: Date.now() + Math.random(),
        type: 'withdraw', amount, note: finalNote, timestamp: Date.now(),
        bankDestinationId: targetBankAccount ? targetBankAccount.id : null,
        bankDestinationName: targetBankAccount ? targetBankAccount.bank : null
    };

    appBalance -= amount;
    appHistory.push(newMovement);

    if (targetBankAccount) {
        targetBankAccount.amount = (parseFloat(targetBankAccount.amount) || 0) + amount;
        targetBankAccount.updatedAt = Date.now();
    }

    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    withdrawAmount.value = '';
    withdrawNoteSelect.value = '';
    withdrawNoteCustom.value = '';
    withdrawNoteCustom.classList.add('hidden');
    hideBankDestinationSelector();
    historyShownCount = HISTORY_PAGE_SIZE;
    updateBalanceDisplay();
    renderHistory();
    renderBankTab();

    if (targetBankAccount) {
        showOperationMessage(`✅ Retiro sumado a ${targetBankAccount.bank}.`, false);
    } else {
        showOperationMessage(`✅ Retiro de ${formatRD(amount)} registrado.`, false);
    }
}

function editMovement(id) {
    const item = appHistory.find(m => m.id === id);
    if (!item) return;
    editingMovementId = id;
    modalMovementTitle.textContent = '✏️ Editar movimiento';
    movementAmountInput.value = item.amount;
    movementNoteInput.value = item.note || '';
    movementError.classList.add('hidden');
    movementModal.classList.add('active');
    setTimeout(() => movementAmountInput.focus(), 150);
}
function closeMovementModal() {
    movementModal.classList.remove('active');
    editingMovementId = null;
    movementAmountInput.value = '';
    movementNoteInput.value = '';
    movementError.classList.add('hidden');
}
function saveEditedMovement() {
    const amount = parseFloat(movementAmountInput.value.trim());
    const note = movementNoteInput.value.trim();
    if (isNaN(amount) || amount <= 0) {
        showMsg(movementError, 'Cantidad inválida.', true, 3500);
        return;
    }
    const item = appHistory.find(m => m.id === editingMovementId);
    if (!item) return;
    if (item.type === 'income') appBalance -= item.amount;
    else appBalance += item.amount;
    if (item.type === 'withdraw' && amount > appBalance) {
        if (item.type === 'income') appBalance += item.amount;
        else appBalance -= item.amount;
        showMsg(movementError, `Saldo insuficiente.`, true, 3500);
        return;
    }
    item.amount = amount;
    item.note = note;
    if (item.type === 'income') appBalance += amount;
    else appBalance -= amount;
    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    historyShownCount = HISTORY_PAGE_SIZE;
    updateBalanceDisplay();
    renderHistory();
    closeMovementModal();
    showOperationMessage('✅ Movimiento actualizado.', false);
}
function deleteMovement(id) {
    const item = appHistory.find(m => m.id === id);
    if (!item) return;
    if (!confirm(`¿Borrar este ${item.type === 'income' ? 'ingreso' : 'retiro'} de ${formatRD(item.amount)}?`)) return;
    if (item.type === 'income') appBalance -= item.amount;
    else appBalance += item.amount;
    appHistory = appHistory.filter(m => m.id !== id);
    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    historyShownCount = HISTORY_PAGE_SIZE;
    updateBalanceDisplay();
    renderHistory();
    showOperationMessage('Movimiento eliminado.', false);
}

/* =========================================================
   2️⃣2️⃣ LIMPIAR / RESETEAR
   ========================================================= */
function clearHistory() {
    if (!appHistory.length) {
        showOperationMessage('No hay historial para limpiar.', true);
        return;
    }
    if (!confirm('⚠️ ¿Borrar TODO el historial? El saldo se mantendrá.')) return;
    appHistory = [];
    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    historyShownCount = HISTORY_PAGE_SIZE;
    renderHistory();
    updateBalanceDisplay();
    showOperationMessage('Historial eliminado.', false);
}
function openResetConfirmModal() {
    resetPasswordInput.value = '';
    resetConfirmMessage.classList.add('hidden');
    resetConfirmModal.classList.add('active');
    setTimeout(() => resetPasswordInput.focus(), 150);
}
function closeResetConfirmModal() {
    resetConfirmModal.classList.remove('active');
    resetPasswordInput.value = '';
    resetConfirmMessage.classList.add('hidden');
}
function confirmResetAll() {
    const pwd = resetPasswordInput.value.trim();
    if (!pwd) {
        showMsg(resetConfirmMessage, 'Debes ingresar tu contraseña.', true, 3500);
        return;
    }
    const isMaster = verifyMasterPassword(pwd);
    const isUserPwd = verificarPassword(pwd, currentUser.password);
    if (!isMaster && !isUserPwd) {
        showMsg(resetConfirmMessage, '❌ Contraseña incorrecta.', true, 3500);
        resetPasswordInput.value = '';
        return;
    }
    appBalance = 0;
    appHistory = [];
    saveUserData();
    guardarUsuarioEnFirebase(currentUser.id);
    historyShownCount = HISTORY_PAGE_SIZE;
    updateBalanceDisplay();
    renderHistory();
    closeResetConfirmModal();
    showOperationMessage('🔄 Todo reseteado a cero.', false);
    switchTab('inicio');
}

/* =========================================================
   2️⃣3️⃣ CAMBIO DE CONTRASEÑA
   ========================================================= */
function changePassword() {
    const current = currentPasswordInput.value.trim();
    const nueva = newPasswordInput.value.trim();
    const conf = confirmNewPasswordInput.value.trim();
    if (!current || !nueva || !conf) {
        showMsg(passwordChangeMessage, 'Todos los campos son obligatorios.', true); return;
    }
    if (!verificarPassword(current, currentUser.password)) {
        showMsg(passwordChangeMessage, 'La contraseña actual es incorrecta.', true); return;
    }
    if (nueva.length < 4) {
        showMsg(passwordChangeMessage, 'Mínimo 4 caracteres.', true); return;
    }
    if (nueva !== conf) {
        showMsg(passwordChangeMessage, 'Las contraseñas no coinciden.', true); return;
    }
    currentUser.password = hashearPassword(nueva);
    saveUsers();
    showMsg(passwordChangeMessage, '✅ Contraseña actualizada.', false);
    setTimeout(() => {
        passwordModal.classList.remove('active');
        currentPasswordInput.value = newPasswordInput.value = confirmNewPasswordInput.value = '';
    }, 1800);
}

/* =========================================================
   👑 CAMBIO DE CONTRASEÑA MAESTRA
   ========================================================= */
function openMasterPasswordModal() {
    currentMasterPassword.value = '';
    newMasterPassword.value = '';
    confirmNewMasterPassword.value = '';
    masterPasswordChangeMessage.classList.add('hidden');
    masterPasswordModal.classList.add('active');
    setTimeout(() => currentMasterPassword.focus(), 150);
}
function closeMasterPasswordModal() {
    masterPasswordModal.classList.remove('active');
    currentMasterPassword.value = '';
    newMasterPassword.value = '';
    confirmNewMasterPassword.value = '';
    masterPasswordChangeMessage.classList.add('hidden');
}
function changeMasterPasswordAction() {
    const current = currentMasterPassword.value.trim();
    const nueva = newMasterPassword.value.trim();
    const conf = confirmNewMasterPassword.value.trim();
    
    if (!current || !nueva || !conf) {
        showMsg(masterPasswordChangeMessage, 'Todos los campos son obligatorios.', true); return;
    }
    
    const result = changeMasterPassword(current, nueva);
    if (!result.ok) {
        showMsg(masterPasswordChangeMessage, '❌ ' + result.msg, true); return;
    }
    if (nueva !== conf) {
        showMsg(masterPasswordChangeMessage, 'Las contraseñas no coinciden.', true); return;
    }
    
    showMsg(masterPasswordChangeMessage, '✅ Contraseña maestra actualizada.', false);
    setTimeout(() => {
        closeMasterPasswordModal();
    }, 1800);
}

/* =========================================================
   2️⃣4️⃣ COLORES
   ========================================================= */
function renderColorOptions() {
    colorOptions.innerHTML = '';
    if (!currentUser) return;
    const currentColor = getUserColor(currentUser.id);
    COLOR_PALETTE.forEach(c => {
        const sw = document.createElement('div');
        sw.className = 'color-swatch';
        sw.style.background = c.primary;
        if (currentColor.primary === c.primary) sw.classList.add('selected');
        sw.title = c.name;
        sw.addEventListener('click', () => {
            setUserColor(currentUser.id, c);
            document.documentElement.style.setProperty('--primary', c.primary);
            document.documentElement.style.setProperty('--primary-dark', c.dark);
            document.querySelectorAll('.color-swatch').forEach(s => s.classList.remove('selected'));
            sw.classList.add('selected');
        });
        colorOptions.appendChild(sw);
    });
}
function toggleDarkMode() {
    if (!currentUser) return;
    const isDark = document.body.classList.toggle('dark');
    setUserTheme(currentUser.id, isDark ? 'dark' : 'light');
    toggleDarkBtn.textContent = isDark ? 'Desactivar' : 'Activar';
}

/* =========================================================
   2️⃣5️⃣ MODAL NUEVO USUARIO
   ========================================================= */
function openNewUserModal() {
    nuName.value = nuCedula.value = nuPhone.value = '';
    nuPassword.value = nuPasswordConfirm.value = '';
    newUserModalMessage.classList.add('hidden');
    newUserModal.classList.add('active');
    setTimeout(() => nuName.focus(), 150);
}
function closeNewUserModal() {
    newUserModal.classList.remove('active');
    nuName.value = nuCedula.value = nuPhone.value = '';
    nuPassword.value = nuPasswordConfirm.value = '';
    newUserModalMessage.classList.add('hidden');
}
function saveNewUserFromModal() {
    const name = nuName.value.trim();
    const cedula = nuCedula.value.trim();
    const phone = nuPhone.value.trim();
    const pwd = nuPassword.value;
    const pwdConf = nuPasswordConfirm.value;
    const err = validateNewUser(name, cedula, phone, pwd, pwdConf);
    if (err) { showMsg(newUserModalMessage, err, true); return; }
    createUser(name, cedula, phone, pwd);
    closeNewUserModal();
    renderUsersTab();
    showMsg(usersTabMessage, `✅ Usuario "${name}" creado.`, false, 3500);
}

/* =========================================================
   💾 BACKUP
   ========================================================= */
function exportBackup() {
    if (!currentUser) return;
    const backup = {
        app: 'Control Financiero RD',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        user: {
            id: currentUser.id,
            name: currentUser.name,
            cedula: currentUser.cedula,
            phone: currentUser.phone
        },
        data: {
            balance: appBalance,
            history: appHistory,
            banks: appBanks,
            theme: getUserTheme(currentUser.id),
            color: getUserColor(currentUser.id)
        }
    };
    const blob = new Blob([JSON.stringify(backup, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `backup_${currentUser.name.replace(/\s+/g, '_')}_${fecha}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showOperationMessage('✅ Respaldo descargado.', false);
}

function importBackup() {
    $('importBackupFile').click();
}

function handleImportFile(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = e => {
        try {
            const backup = JSON.parse(e.target.result);
            if (!backup.app || !backup.data || !backup.user) {
                throw new Error('Archivo inválido');
            }
            if (!confirm(`⚠️ Esto REEMPLAZARÁ todos los datos de ${currentUser.name}.\n\n¿Continuar?`)) {
                event.target.value = '';
                return;
            }
            appBalance = Number(backup.data.balance) || 0;
            appHistory = Array.isArray(backup.data.history) ? backup.data.history : [];
            appBanks = Array.isArray(backup.data.banks) ? backup.data.banks : [];
            if (backup.data.theme) setUserTheme(currentUser.id, backup.data.theme);
            if (backup.data.color) setUserColor(currentUser.id, backup.data.color);
            saveUserData();
            guardarUsuarioEnFirebase(currentUser.id);
            applyUserTheme(currentUser.id);
            historyShownCount = HISTORY_PAGE_SIZE;
            updateBalanceDisplay();
            renderHistory();
            renderBankTab();
            showOperationMessage('✅ Respaldo restaurado.', false);
        } catch (err) {
            showOperationMessage('❌ Archivo inválido.', true);
        }
        event.target.value = '';
    };
    reader.readAsText(file);
}

/* =========================================================
   📊 EXPORTAR CSV
   ========================================================= */
function exportHistoryToCSV() {
    if (!appHistory.length) {
        showOperationMessage('❌ No hay historial.', true);
        return;
    }
    const sorted = [...appHistory].sort((a, b) => a.timestamp - b.timestamp);
    const rows = [['Fecha', 'Tipo', 'Categoría', 'Monto (RD$)', 'Saldo después']];
    let running = 0;
    sorted.forEach(m => {
        if (m.type === 'income') running += m.amount;
        else running -= m.amount;
        const fecha = new Date(m.timestamp).toLocaleString('es-DO');
        const tipo = m.type === 'income' ? 'Ingreso' : 'Retiro';
        const nota = (m.note || '').replace(/,/g, ';').replace(/\n/g, ' ');
        rows.push([fecha, tipo, nota, m.amount.toFixed(2), running.toFixed(2)]);
    });
    const csv = rows.map(r => r.join(',')).join('\n');
    const BOM = '\uFEFF';
    const blob = new Blob([BOM + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const fecha = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `historial_${currentUser.name.replace(/\s+/g, '_')}_${fecha}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showOperationMessage('✅ Exportado a Excel.', false);
}

/* =========================================================
   2️⃣6️⃣ EVENTOS
   ========================================================= */
function setupEvents() {
    setupPasswordEyes();

    attachNameFormatter(fuName);
    attachCedulaFormatter(fuCedula);
    attachPhoneFormatter(fuPhone);
    attachNameFormatter(cuName);
    attachCedulaFormatter(cuCedula);
    attachPhoneFormatter(cuPhone);
    attachNameFormatter(nuName);
    attachCedulaFormatter(nuCedula);
    attachPhoneFormatter(nuPhone);

    attachMoneyFormatter(incomeAmount);
    attachMoneyFormatter(withdrawAmount);
    attachMoneyFormatter(bankAmount);
    attachMoneyFormatter(movementAmountInput);

    fillNoteSelect(incomeNoteSelect, INCOME_CATEGORIES);
    fillNoteSelect(withdrawNoteSelect, WITHDRAW_CATEGORIES);
    fillBankSelect();

    userSearchInput.addEventListener('input', () => {
        const rawValue = userSearchInput.value;
        const type = detectSearchType(rawValue);
        
        const clean = rawValue.replace(/\D/g, '');
        if (type === 'cedula' && clean.length === 11) {
            const formatted = autoFormatSearchInput(rawValue);
            if (formatted !== rawValue) {
                userSearchInput.value = formatted;
            }
        } else if (type === 'telefono' && clean.length === 10) {
            const formatted = autoFormatSearchInput(rawValue);
            if (formatted !== rawValue) {
                userSearchInput.value = formatted;
            }
        }
        
        updateSearchTypeIndicator(userSearchInput.value);
        
        const query = userSearchInput.value;
        if (query.length < 2) {
            searchResultsList.innerHTML = '';
            return;
        }
        const results = searchUser(query);
        renderSearchResults(results);
    });
    
    userSearchInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') {
            const results = searchUser(userSearchInput.value);
            if (results.length === 1) {
                selectUserForLogin(results[0]);
            } else if (results.length > 1) {
                showLoginMessage('Hay varios usuarios. Selecciona uno de la lista.', true);
            } else {
                showLoginMessage('No se encontró ningún usuario.', true);
            }
        }
    });

    incomeNoteSelect.addEventListener('change', () => {
        if (incomeNoteSelect.value === 'Otro') {
            incomeNoteCustom.classList.remove('hidden');
            incomeNoteCustom.focus();
        } else {
            incomeNoteCustom.classList.add('hidden');
            incomeNoteCustom.value = '';
        }
    });

    withdrawNoteSelect.addEventListener('change', () => {
        const val = withdrawNoteSelect.value;
        if (val === BANCO_CATEGORY) {
            withdrawNoteCustom.classList.add('hidden');
            withdrawNoteCustom.value = '';
            showBankDestinationSelector();
        } else if (val === 'Otro') {
            hideBankDestinationSelector();
            withdrawNoteCustom.classList.remove('hidden');
            withdrawNoteCustom.focus();
        } else {
            hideBankDestinationSelector();
            withdrawNoteCustom.classList.add('hidden');
            withdrawNoteCustom.value = '';
        }
    });

    fuCreateBtn.addEventListener('click', async () => {
        const name = fuName.value.trim();
        const cedula = fuCedula.value.trim();
        const phone = fuPhone.value.trim();
        const pwd = fuPassword.value;
        const pwdConf = fuPasswordConfirm.value;
        const err = validateNewUser(name, cedula, phone, pwd, pwdConf);
        if (err) { showMsg(firstUserMessage, err, true); return; }
        const newUser = createUser(name, cedula, phone, pwd);
        currentUser = newUser;
        isAdmin = false;
        setActiveUid(newUser.id);
        await loadUserData(newUser.id);
        showMainScreen();
    });

    userLoginBtn.addEventListener('click', async () => {
        const pwd = userLoginPassword.value;
        await doLogin(selectedUserForLogin, pwd);
    });
    userLoginPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') userLoginBtn.click();
    });

    goToCreateUserBtn.addEventListener('click', showCreateUserScreen);

    cuCreateBtn.addEventListener('click', () => {
        const name = cuName.value.trim();
        const cedula = cuCedula.value.trim();
        const phone = cuPhone.value.trim();
        const pwd = cuPassword.value;
        const pwdConf = cuPasswordConfirm.value;
        const err = validateNewUser(name, cedula, phone, pwd, pwdConf);
        if (err) { showMsg(createUserMessage, err, true); return; }
        createUser(name, cedula, phone, pwd);
        showSelectUserScreen();
        showLoginMessage('✅ Usuario creado. Ahora búscate e ingresa tu contraseña.', false);
        userSearchInput.focus();
    });
    cuCancelBtn.addEventListener('click', showSelectUserScreen);

    tabButtons.forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
    headerBankBadge.addEventListener('click', () => switchTab('banco'));

    incomeSubmitBtn.addEventListener('click', registerIncome);
    withdrawSubmitBtn.addEventListener('click', registerWithdraw);
    incomeAmount.addEventListener('keypress', e => { if (e.key === 'Enter') registerIncome(); });
    withdrawAmount.addEventListener('keypress', e => { if (e.key === 'Enter') registerWithdraw(); });

    clearHistoryBtn.addEventListener('click', clearHistory);
    resetAllHistoryBtn.addEventListener('click', openResetConfirmModal);

    if ($('exportCsvBtn')) {
        $('exportCsvBtn').addEventListener('click', exportHistoryToCSV);
    }

    addBankBtn.addEventListener('click', () => openBankModal(null));
    saveBankBtn.addEventListener('click', saveBankAccount);
    cancelBankBtn.addEventListener('click', closeBankModal);
    bankModal.addEventListener('click', e => { if (e.target === bankModal) closeBankModal(); });
    bankAmount.addEventListener('keypress', e => { if (e.key === 'Enter') saveBankAccount(); });

    cancelDeleteUserBtn.addEventListener('click', closeDeleteUserModal);
    confirmDeleteUserBtn.addEventListener('click', confirmDeleteUser);
    deleteUserPassword.addEventListener('keypress', e => {
        if (e.key === 'Enter') confirmDeleteUser();
    });
    deleteUserModal.addEventListener('click', e => {
        if (e.target === deleteUserModal) closeDeleteUserModal();
    });

    cancelResetBtn.addEventListener('click', closeResetConfirmModal);
    confirmResetBtn.addEventListener('click', confirmResetAll);
    resetPasswordInput.addEventListener('keypress', e => {
        if (e.key === 'Enter') confirmResetAll();
    });
    resetConfirmModal.addEventListener('click', e => {
        if (e.target === resetConfirmModal) closeResetConfirmModal();
    });

    cancelMovementBtn.addEventListener('click', closeMovementModal);
    saveMovementBtn.addEventListener('click', saveEditedMovement);
    movementModal.addEventListener('click', e => {
        if (e.target === movementModal) closeMovementModal();
    });

    addUserFromTabBtn.addEventListener('click', openNewUserModal);
    cancelNewUserBtn.addEventListener('click', closeNewUserModal);
    saveNewUserBtn.addEventListener('click', saveNewUserFromModal);
    newUserModal.addEventListener('click', e => {
        if (e.target === newUserModal) closeNewUserModal();
    });

    settingsBtn.addEventListener('click', () => settingsModal.classList.add('active'));
    closeSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('active'));
    settingsModal.addEventListener('click', e => {
        if (e.target === settingsModal) settingsModal.classList.remove('active');
    });

    openPasswordBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        currentPasswordInput.value = newPasswordInput.value = confirmNewPasswordInput.value = '';
        passwordChangeMessage.classList.add('hidden');
        passwordModal.classList.add('active');
        setTimeout(() => currentPasswordInput.focus(), 150);
    });
    cancelPasswordBtn.addEventListener('click', () => passwordModal.classList.remove('active'));
    savePasswordBtn.addEventListener('click', changePassword);

    openMasterPasswordBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        openMasterPasswordModal();
    });
    cancelMasterPasswordBtn.addEventListener('click', closeMasterPasswordModal);
    saveMasterPasswordBtn.addEventListener('click', changeMasterPasswordAction);
    masterPasswordModal.addEventListener('click', e => {
        if (e.target === masterPasswordModal) closeMasterPasswordModal();
    });

    openColorsBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        colorUserLabel.textContent = currentUser.name;
        renderColorOptions();
        colorsModal.classList.add('active');
    });
    closeColorsBtn.addEventListener('click', () => colorsModal.classList.remove('active'));
    toggleDarkBtn.addEventListener('click', toggleDarkMode);

    openHelpBtn.addEventListener('click', () => {
        settingsModal.classList.remove('active');
        helpModal.classList.add('active');
    });
    closeHelpBtn.addEventListener('click', () => helpModal.classList.remove('active'));
    helpModal.addEventListener('click', e => {
        if (e.target === helpModal) helpModal.classList.remove('active');
    });

    logoutBtn.addEventListener('click', logout);

    if ($('exportBackupBtn')) {
        $('exportBackupBtn').addEventListener('click', () => {
            settingsModal.classList.remove('active');
            exportBackup();
        });
    }
    if ($('importBackupBtn')) {
        $('importBackupBtn').addEventListener('click', () => {
            settingsModal.classList.remove('active');
            importBackup();
        });
    }
    if ($('importBackupFile')) {
        $('importBackupFile').addEventListener('change', handleImportFile);
    }

    // 🔄 Forzar actualización de la app
    if ($('forceUpdateBtn')) {
        $('forceUpdateBtn').addEventListener('click', () => {
            if (!confirm('🔄 Esto borrará el caché y recargará la app.\n\n¿Continuar?')) return;
            
            if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
                navigator.serviceWorker.controller.postMessage('CLEAR_CACHE');
            }
            
            if ('caches' in window) {
                caches.keys().then(keys => {
                    keys.forEach(key => caches.delete(key));
                });
            }
            
            if ('serviceWorker' in navigator) {
                navigator.serviceWorker.getRegistrations().then(regs => {
                    regs.forEach(reg => reg.unregister());
                });
            }
            
            setTimeout(() => {
                window.location.href = window.location.href + '?v=' + Date.now();
            }, 500);
        });
    }
}

/* =========================================================
   2️⃣7️⃣ INICIO
   ========================================================= */
async function init() {
    if (_initDone) return;
    _initDone = true;

    if (typeof bcrypt === 'undefined') {
        console.error("❌ bcrypt NO está cargado.");
    }

    loadUsers();
    initMasterPassword();
    setupEvents();

    if (db) {
        try {
            const cargado = await cargarUsuariosDesdeFirebase();
            if (cargado) {
                localStorage.setItem(STORAGE_KEYS.USERS, JSON.stringify(users));
            } else if (users.length > 0) {
                await guardarUsuariosEnFirebase();
            }
        } catch (e) {
            console.log("⚠️ Error sincronizando:", e.message);
        }
    }

    if (users.length === 0) {
        showFirstUserScreen();
    } else {
        showSelectUserScreen();
    }
}

init().catch(e => console.log("⚠️ Error en init:", e));