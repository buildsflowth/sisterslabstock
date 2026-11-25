/* =========================================================
   SistersLabStock — หน้าเว็บ (ไม่ใช้ framework)
   ========================================================= */
'use strict';

// ---------------------------------------------------------------- utils
const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = v => (v === null || v === undefined ? '' : String(v)).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(v); return Number.isFinite(n) ? n : 0; };
const fmt = n => (Math.round(num(n) * 100) / 100).toLocaleString('th-TH', { maximumFractionDigits: 2 });
const pad = n => String(n).padStart(2, '0');
const isoDate = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const addDays = (s, n) => { const d = new Date(s + 'T00:00:00'); d.setDate(d.getDate() + n); return isoDate(d); };
const fmtDate = s => { if (!s) return '-'; const d = new Date(String(s).slice(0, 10) + 'T00:00:00'); return isNaN(d) ? s : d.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: '2-digit' }); };
const fmtDateLong = (d = new Date()) => d.toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
const fmtTs = s => { if (!s) return '-'; const [d, t] = String(s).split(' '); return `${fmtDate(d)} ${t ? t.slice(0, 5) : ''}`; };
const debounce = (fn, ms = 250) => { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; };
const store = {
  get(k, def = null) { try { const v = localStorage.getItem(k); return v === null ? def : JSON.parse(v); } catch (e) { return def; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  del(k) { try { localStorage.removeItem(k); } catch (e) {} },
};
const STATUS = {
  'Normal': { th: 'ปกติ', cls: 'st-Normal', color: 'var(--ok)', desc: '> 180 วัน' },
  'Warning': { th: 'เฝ้าระวัง', cls: 'st-Warning', color: 'var(--warn)', desc: '91–180 วัน' },
  'Near Expiry': { th: 'ใกล้หมดอายุ', cls: 'st-NearExpiry', color: 'var(--near)', desc: '31–90 วัน' },
  'Critical': { th: 'วิกฤต', cls: 'st-Critical', color: 'var(--crit)', desc: '≤ 30 วัน' },
  'Expired': { th: 'หมดอายุ', cls: 'st-Expired', color: 'var(--exp)', desc: 'เลยวันหมดอายุ' },
};
const STATUS_KEYS = Object.keys(STATUS);
const badge = s => `<span class="badge ${STATUS[s] ? STATUS[s].cls : ''}">${esc(STATUS[s] ? STATUS[s].th : s)}</span>`;
const typeBadge = t => `<span class="badge plain t-${t}">${t === 'IN' ? '<i class="bi bi-arrow-down"></i> รับเข้า' : '<i class="bi bi-arrow-up"></i> เบิกออก'}</span>`;
const daysText = d => d === null || d === undefined || d > 90000 ? '-' : d < 0 ? `<span class="days-neg">เลย ${fmt(-d)} วัน</span>` : `${fmt(d)} วัน`;
// ป้ายนับถอยหลังวันหมดอายุ เช่น "อีก 170 วัน" / "หมดวันนี้" / "เลย 5 วัน" (สีตามสถานะ)
const cdText = d => d < 0 ? `เลย ${fmt(-d)} วัน` : d === 0 ? 'หมดวันนี้' : `อีก ${fmt(d)} วัน`;
const countdown = (d, status) => d === null || d === undefined || d > 90000 ? ''
  : `<span class="cd ${STATUS[status || statusOf(d)].cls}"><i class="bi bi-hourglass-split"></i>${cdText(d)}</span>`;
const empty = (text, icon = 'inbox') => `<div class="empty"><i class="bi bi-${icon}"></i>${esc(text)}</div>`;
const statusOf = days => days < 0 ? 'Expired' : days <= 30 ? 'Critical' : days <= 90 ? 'Near Expiry' : days <= 180 ? 'Warning' : 'Normal';

// ---------------------------------------------------------------- API
const CLIENT_ID = Math.random().toString(36).slice(2) + Date.now().toString(36);
const API_BASE = (() => { const b = ((window.STOCK_CONFIG || {}).apiBase || '').replace(/\/+$/, ''); return b ? b + '/' : 'api/'; })();
let sessionExpiredShown = false;

async function api(fn, ...args) {
  const token = (S.session || {}).token || '';
  let res, body;
  try {
    res = await fetch(API_BASE + fn, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Session-Token': token, 'X-Client-Id': CLIENT_ID },
      body: JSON.stringify(args),
    });
  } catch (e) {
    throw new Error('เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — ตรวจสอบอินเทอร์เน็ต');
  }
  try { body = await res.json(); } catch (e) { body = { error: `เซิร์ฟเวอร์ตอบกลับไม่ถูกต้อง (${res.status})` }; }
  if (res.status === 401 && token && !sessionExpiredShown) {
    sessionExpiredShown = true;
    store.del('stock_session');
    Swal.fire({ icon: 'warning', title: 'เซสชันหมดอายุ', text: 'กรุณาเข้าสู่ระบบใหม่อีกครั้ง' }).then(() => location.reload());
  }
  if (!res.ok) throw new Error(body.error || res.statusText);
  return body.result;
}

const toast = (title, icon = 'success') => Swal.fire({ toast: true, position: 'top-end', icon, title, showConfirmButton: false, timer: 2200, timerProgressBar: true });
const fail = e => Swal.fire({ icon: 'error', title: 'เกิดข้อผิดพลาด', text: e.message || String(e) });
const loading = title => Swal.fire({ title, allowOutsideClick: false, showConfirmButton: false, didOpen: () => Swal.showLoading() });

// ---------------------------------------------------------------- state
const S = {
  session: store.get('stock_session') || (() => {           // ย้ายเซสชันจากเวอร์ชันก่อน
    const old = store.get('sistersLab_session');
    if (old && old.token) { store.set('stock_session', old); store.del('sistersLab_session'); return old; }
    return null;
  })(),
  inventory: [], trends: null, txs: [], reorderPoints: [], stats: {},
  warehouses: [], categories: [], products: [],
  docs: [], lastLoad: 0, loaded: false,
};
const RANK = { Viewer: 1, Staff: 2, Admin: 3 };
const can = role => S.session && RANK[S.session.role] >= RANK[role];

async function loadAll(silent = true) {
  const btn = $('#btn-refresh i');
  btn && btn.classList.add('spin');
  try {
    const [dash, lookups, products, docs] = await Promise.all([
      api('getFullDashboardData'), api('getWarehousesAndCategories'), api('getAllProducts'), api('getDocuments', { limit: 8 }),
    ]);
    S.inventory = dash.inventory; S.trends = dash.trends; S.txs = dash.rawTransactions; S.stats = dash.stats;
    S.reorderPoints = dash.reorderPoints || [];
    S.warehouses = lookups.warehouses; S.categories = lookups.categories; S.products = products; S.docs = docs;
    S.lastLoad = Date.now(); S.loaded = true;
    updateBadges();
    renderPage(true);
  } catch (e) {
    if (!silent) fail(e); else console.warn(e);
  } finally {
    btn && btn.classList.remove('spin');
  }
}

// ---------------------------------------------------------------- derived data
const pendingAlerts = () => S.inventory.filter(i => i.days <= 180 && !i.managedType);
function productTotals() {
  const map = new Map();
  for (const i of S.inventory) {
    let p = map.get(i.barcode);
    if (!p) { p = { barcode: i.barcode, name: i.name, category: i.category, qty: 0, lots: 0, warehouses: new Set(), nearestExp: null, nearestDays: null, status: 'Normal', reorderPoint: i.reorderPoint || 0 }; map.set(i.barcode, p); }
    p.qty += i.qty; p.lots++; p.warehouses.add(i.warehouse);
    if (i.exp && (p.nearestDays === null || i.days < p.nearestDays)) { p.nearestDays = i.days; p.nearestExp = i.exp; p.status = i.status; }
  }
  return [...map.values()].map(p => ({ ...p, qty: Math.round(p.qty * 100) / 100, warehouses: [...p.warehouses] }));
}
function reorderList() {
  const totals = new Map();
  for (const i of S.inventory) totals.set(i.name, (totals.get(i.name) || 0) + i.qty);
  const barcodeOf = new Map(S.products.map(p => [p.name, p.barcode]));
  return S.reorderPoints
    .map(r => ({ ...r, barcode: barcodeOf.get(r.name) || '', qty: Math.round((totals.get(r.name) || 0) * 100) / 100 }))
    .filter(r => r.qty <= r.reorderPoint)
    .map(r => ({ ...r, shortage: Math.round((r.reorderPoint - r.qty) * 100) / 100 }))
    .sort((a, b) => (a.qty / a.reorderPoint) - (b.qty / b.reorderPoint));
}
function stockOf(barcode) { return S.inventory.filter(i => i.barcode === barcode).reduce((s, i) => s + i.qty, 0); }

function updateBadges() {
  const n = pendingAlerts().length, r = reorderList().length;
  const set = (id, v) => { const el = $(id); if (!el) return; el.textContent = v; el.classList.toggle('hidden', !v); };
  set('#sb-alert-count', n); set('#tb-bell-count', n); set('#bn-alert-count', n); set('#sb-reorder-count', r);
}

// ---------------------------------------------------------------- router
const PAGES = {
  dashboard: { title: 'ภาพรวม', sub: 'สรุปสถานะสต็อกล่าสุด', render: renderDashboard },
  move: { title: 'รับเข้า / เบิกออก', sub: 'ทำรายการได้หลายสินค้าในเอกสารเดียว', role: 'Staff', render: renderMove },
  docs: { title: 'ประวัติเอกสาร', sub: 'เอกสารรับเข้า–เบิกออกที่บันทึกแล้ว', render: renderDocs },
  inventory: { title: 'สินค้าคงคลัง', sub: 'ยอดคงเหลือแยกตาม Lot และคลัง', render: renderInventory },
  alerts: { title: 'แจ้งเตือนอายุสินค้า', sub: 'สินค้าที่ใกล้หมดอายุและต้องดำเนินการ', render: renderAlerts },
  reorder: { title: 'สินค้าที่ต้องสั่งซื้อ', sub: 'ยอดคงเหลือต่ำกว่าจุดสั่งซื้อ (Reorder Point)', render: renderReorder },
  report: { title: 'รายงานความเคลื่อนไหว', sub: 'รับเข้า–เบิกออกตามช่วงเวลา', render: renderReport },
  settings: { title: 'ตั้งค่า Stock', sub: 'อัตราการใช้, จุดสั่งซื้อ, คลังและหมวดหมู่', role: 'Admin', render: renderSettings },
  users: { title: 'ผู้ใช้งาน', sub: 'บัญชีผู้ใช้และประวัติการใช้งาน', role: 'Admin', render: renderUsers },
};
let currentPage = null;
function parseHash() {
  const h = location.hash.replace(/^#\/?/, '');
  const [name, query] = h.split('?');
  return { name: PAGES[name] ? name : 'dashboard', params: new URLSearchParams(query || '') };
}
function renderPage(fromData = false) {
  if (!S.session) return;
  let { name, params } = parseHash();
  if (PAGES[name].role && !can(PAGES[name].role)) { location.hash = '#/dashboard'; return; }
  const changed = currentPage !== name;
  currentPage = name;
  $$('.page').forEach(p => p.classList.toggle('active', p.id === 'page-' + name));
  $$('[data-page]').forEach(a => a.classList.toggle('active', a.dataset.page === name));
  $('#page-title').textContent = PAGES[name].title;
  $('#page-sub').textContent = PAGES[name].sub;
  if (changed) window.scrollTo(0, 0);
  PAGES[name].render({ params, fromData, changed });
}
window.addEventListener('hashchange', () => { closeDrawer(); renderPage(); });

// ---------------------------------------------------------------- auth / shell
// รูปโปรไฟล์: ถ้ามีรูปใช้รูป ไม่มีใช้อักษรตัวแรกของชื่อ
const avatarInner = (name, avatar) => avatar
  ? `<img src="${esc(avatar)}" alt="">`
  : esc(String(name || '?').trim().charAt(0).toUpperCase() || '?');
const avatarHtml = (name, avatar, size) =>
  `<span class="avatar"${size ? ` style="width:${size}px;height:${size}px;font-size:${(size / 40).toFixed(2)}rem"` : ''}>${avatarInner(name, avatar)}</span>`;

function renderUserChip() {
  const s = S.session;
  $('#sb-name').textContent = s.displayName || s.username;
  $('#sb-role').textContent = `${s.email || s.username} · ${s.role}`;
  $('#sb-avatar').innerHTML = avatarInner(s.displayName || s.username, s.avatar);
}
function saveSession(patch) {
  S.session = { ...S.session, ...patch };
  store.set('stock_session', S.session);
  renderUserChip();
}
async function refreshMe() {
  try {
    const me = await api('getMe');
    const roleChanged = me.role !== S.session.role;
    saveSession(me);
    if (roleChanged) { $$('[data-role]').forEach(el => el.classList.toggle('hidden', !can(el.dataset.role))); renderPage(); }
  } catch (e) {}
}

function showApp() {
  $('#login-view').classList.add('hidden');
  $('#app-view').classList.remove('hidden');
  renderUserChip();
  $$('[data-role]').forEach(el => el.classList.toggle('hidden', !can(el.dataset.role)));
  renderPage();
  loadAll(false);
  startAutoRefresh();
  refreshMe();
  // บันทึกที่อยู่เว็บจริง ให้ลิงก์ในอีเมลตั้งรหัสผ่านใหม่ชี้กลับมาที่นี่ (เฉพาะ https)
  if (S.session.role === 'Admin' && location.protocol === 'https:') api('setAppUrl', location.origin + location.pathname).catch(() => {});
}
function showLogin() {
  $('#app-view').classList.add('hidden');
  $('#login-view').classList.remove('hidden');
  setTimeout(() => $('#login-user').focus(), 50);
}

$('#login-form').addEventListener('submit', async e => {
  e.preventDefault();
  const u = $('#login-user').value.trim(), p = $('#login-pass').value;
  const btn = $('#login-submit'), err = $('#login-error');
  err.textContent = '';
  if (!u || !p) { err.textContent = 'กรุณากรอกอีเมลและรหัสผ่าน'; return; }
  btn.disabled = true; btn.textContent = 'กำลังตรวจสอบ...';
  try {
    const r = await api('checkLogin', u, p);
    if (!r.success) { err.textContent = r.message; return; }
    S.session = { token: r.token, username: r.username, displayName: r.displayName, role: r.role, email: r.email || '', avatar: r.avatar || '' };
    store.set('stock_session', S.session);
    $('#login-pass').value = '';
    showApp();
  } catch (e2) { err.textContent = e2.message; }
  finally { btn.disabled = false; btn.textContent = 'เข้าสู่ระบบ'; }
});
$('#login-toggle-pass').addEventListener('click', () => {
  const i = $('#login-pass'); i.type = i.type === 'password' ? 'text' : 'password';
  $('#login-toggle-pass i').className = i.type === 'password' ? 'bi bi-eye' : 'bi bi-eye-slash';
});

// ลืมรหัสผ่าน → ส่งลิงก์ตั้งรหัสผ่านใหม่ไปที่อีเมล
const looksEmail = s => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(s);
$('#login-forgot').addEventListener('click', async () => {
  const typed = $('#login-user').value.trim();
  const r = await Swal.fire({
    title: 'ลืมรหัสผ่าน',
    text: 'กรอกอีเมลของบัญชี ระบบจะส่งลิงก์สำหรับตั้งรหัสผ่านใหม่ไปให้ (ลิงก์ใช้ได้ 30 นาที)',
    input: 'email', inputValue: looksEmail(typed) ? typed : '', inputPlaceholder: 'name@example.com',
    inputAttributes: { autocapitalize: 'none', autocomplete: 'email' },
    showCancelButton: true, confirmButtonText: 'ส่งลิงก์', cancelButtonText: 'ยกเลิก', showLoaderOnConfirm: true,
    validationMessage: 'รูปแบบอีเมลไม่ถูกต้อง',
    preConfirm: async email => {
      try {
        const res = await api('requestPasswordReset', email);
        if (!res.success) return Swal.showValidationMessage(res.message);
        return res;
      } catch (e) { return Swal.showValidationMessage(e.message); }
    },
    allowOutsideClick: () => !Swal.isLoading(),
  });
  if (r.isConfirmed && r.value) Swal.fire({ icon: 'success', title: 'ส่งคำขอแล้ว', text: r.value.message });
});

// เปิดจากลิงก์ในอีเมล: #/reset?token=...
async function handleResetLink() {
  const m = /^#\/reset\?token=([0-9a-f]{64})$/.exec(location.hash);
  if (!m) return false;
  history.replaceState(null, '', location.pathname + location.search);   // ลบโทเคนออกจากแถบที่อยู่
  showLogin();
  const r = await Swal.fire({
    title: 'ตั้งรหัสผ่านใหม่',
    html: `<div class="form-grid swal-left">
      <label class="field"><span>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</span><input type="password" id="rp-pass" class="input" autocomplete="new-password"></label>
      <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input type="password" id="rp-pass2" class="input" autocomplete="new-password"></label></div>`,
    showCancelButton: true, confirmButtonText: 'บันทึกรหัสผ่านใหม่', cancelButtonText: 'ยกเลิก', focusConfirm: false, showLoaderOnConfirm: true,
    didOpen: () => $('#rp-pass').focus(),
    preConfirm: async () => {
      const p = $('#rp-pass').value;
      if (p.length < 6) return Swal.showValidationMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      if (p !== $('#rp-pass2').value) return Swal.showValidationMessage('รหัสผ่านไม่ตรงกัน');
      try {
        const res = await api('resetPassword', m[1], p);
        if (!res.success) return Swal.showValidationMessage(res.message);
        return res;
      } catch (e) { return Swal.showValidationMessage(e.message); }
    },
    allowOutsideClick: () => !Swal.isLoading(),
  });
  if (r.isConfirmed && r.value) {
    S.session = null; store.del('stock_session');
    if (r.value.email) $('#login-user').value = r.value.email;
    await Swal.fire({ icon: 'success', title: 'สำเร็จ', text: r.value.message });
    $('#login-pass').focus();
  }
  if (S.session && S.session.token) showApp();
  return true;
}

async function logout() {
  try { await api('logout'); } catch (e) {}
  stopRealtime();
  clearInterval(autoTimer);
  S.session = null; store.del('stock_session');
  location.hash = '';
  showLogin();
}

function openAccountMenu() {
  const s = S.session;
  Swal.fire({
    html: `<div class="swal-left" style="display:flex;gap:14px;align-items:center;margin-bottom:16px">
        <label class="avatar-edit" title="เปลี่ยนรูปโปรไฟล์">${avatarHtml(s.displayName || s.username, s.avatar, 64)}
          <span class="avatar-cam"><i class="bi bi-camera-fill"></i></span>
          <input type="file" id="am-file" accept="image/png,image/jpeg,image/webp" hidden></label>
        <div><strong>${esc(s.displayName || s.username)}</strong><div class="muted small">${esc(s.username)} · ${esc(s.role)}</div>
          ${s.email ? `<div class="muted small">${esc(s.email)}</div>` : ''}</div></div>
      <div style="display:grid;gap:8px">
        <button class="btn btn-ghost btn-block" id="am-photo"><i class="bi bi-person-bounding-box"></i> ${s.avatar ? 'เปลี่ยนรูปโปรไฟล์' : 'เพิ่มรูปโปรไฟล์'}</button>
        ${s.avatar ? '<button class="btn btn-ghost btn-block" id="am-photo-del"><i class="bi bi-trash3"></i> ลบรูปโปรไฟล์</button>' : ''}
        <button class="btn btn-ghost btn-block" id="am-pass"><i class="bi bi-key"></i> เปลี่ยนรหัสผ่าน</button>
        <button class="btn btn-danger-ghost btn-block" id="am-logout"><i class="bi bi-box-arrow-right"></i> ออกจากระบบ</button>
      </div>`,
    showConfirmButton: false, showCloseButton: true, width: 360,
    didOpen: () => {
      $('#am-photo').onclick = () => $('#am-file').click();
      $('#am-file').onchange = e => { const f = e.target.files[0]; if (f) { Swal.close(); uploadAvatar(f); } };
      if ($('#am-photo-del')) $('#am-photo-del').onclick = () => { Swal.close(); saveAvatar('', 'ลบรูปโปรไฟล์แล้ว'); };
      $('#am-pass').onclick = () => { Swal.close(); changePassword(); };
      $('#am-logout').onclick = () => { Swal.close(); logout(); };
    },
  });
}

// ย่อรูปเป็นสี่เหลี่ยมจัตุรัส 256px (ครอปตรงกลาง) แล้วเก็บเป็น JPEG
function resizeImage(file, size = 256) {
  return new Promise((resolve, reject) => {
    if (!/^image\/(png|jpeg|webp)$/.test(file.type)) return reject(new Error('รองรับเฉพาะไฟล์ JPG, PNG หรือ WEBP'));
    if (file.size > 15 * 1024 * 1024) return reject(new Error('ไฟล์ใหญ่เกิน 15 MB'));
    const url = URL.createObjectURL(file), img = new Image();
    img.onload = () => {
      const side = Math.min(img.naturalWidth, img.naturalHeight);
      const c = document.createElement('canvas'); c.width = c.height = size;
      const ctx = c.getContext('2d');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, size, size);
      ctx.drawImage(img, (img.naturalWidth - side) / 2, (img.naturalHeight - side) / 2, side, side, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/jpeg', 0.85));
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('เปิดไฟล์รูปไม่ได้')); };
    img.src = url;
  });
}
async function saveAvatar(avatar, msg) {
  try {
    const r = await api('updateMyProfile', { avatar });
    if (!r.success) return Swal.fire({ icon: 'error', title: r.message });
    saveSession({ avatar: r.profile.avatar });
    toast(msg);
    if (currentPage === 'users') renderUsers();
  } catch (e) { fail(e); }
}
async function uploadAvatar(file) {
  let data;
  try { data = await resizeImage(file); } catch (e) { return Swal.fire({ icon: 'error', title: e.message }); }
  const r = await Swal.fire({
    title: 'ใช้รูปนี้เป็นรูปโปรไฟล์?',
    html: `<div style="display:flex;justify-content:center">${avatarHtml('', data, 128)}</div>`,
    showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก',
  });
  if (r.isConfirmed) saveAvatar(data, 'อัปเดตรูปโปรไฟล์แล้ว');
}
$('#sb-user').addEventListener('click', openAccountMenu);
$('#btn-mobile-user').addEventListener('click', openAccountMenu);

async function changePassword() {
  const r = await Swal.fire({
    title: 'เปลี่ยนรหัสผ่าน',
    html: `<div class="form-grid swal-left">
      <label class="field"><span>รหัสผ่านเดิม</span><input type="password" id="cp-old" class="input" autocomplete="current-password"></label>
      <label class="field"><span>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</span><input type="password" id="cp-new" class="input" autocomplete="new-password"></label>
      <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input type="password" id="cp-new2" class="input" autocomplete="new-password"></label></div>`,
    showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', focusConfirm: false,
    preConfirm: () => {
      const o = $('#cp-old').value, n = $('#cp-new').value;
      if (!o || !n) return Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบ');
      if (n.length < 6) return Swal.showValidationMessage('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      if (n !== $('#cp-new2').value) return Swal.showValidationMessage('รหัสผ่านใหม่ไม่ตรงกัน');
      return { o, n };
    },
  });
  if (!r.isConfirmed) return;
  try {
    const res = await api('changePassword', r.value.o, r.value.n);
    Swal.fire({ icon: res.success ? 'success' : 'error', title: res.message });
  } catch (e) { fail(e); }
}

$('#bn-more').addEventListener('click', () => {
  const items = [
    ['docs', 'journal-text', 'ประวัติเอกสาร'], ['reorder', 'cart3', 'สินค้าที่ต้องสั่งซื้อ'], ['report', 'bar-chart-line', 'รายงานความเคลื่อนไหว'],
    ['settings', 'sliders', 'ตั้งค่า Stock', 'Admin'], ['users', 'people', 'ผู้ใช้งาน', 'Admin'],
  ].filter(i => !i[3] || can(i[3]));
  Swal.fire({
    title: 'เมนู',
    html: `<div style="display:grid;gap:8px">${items.map(i => `<a class="btn btn-ghost btn-block" style="justify-content:flex-start" href="#/${i[0]}" onclick="Swal.close()"><i class="bi bi-${i[1]}"></i> ${i[2]}</a>`).join('')}
      <button class="btn btn-ghost btn-block" style="justify-content:flex-start" onclick="Swal.close();changePassword()"><i class="bi bi-key"></i> เปลี่ยนรหัสผ่าน</button>
      <button class="btn btn-danger-ghost btn-block" style="justify-content:flex-start" onclick="Swal.close();logout()"><i class="bi bi-box-arrow-right"></i> ออกจากระบบ</button></div>`,
    showConfirmButton: false, showCloseButton: true, width: 380,
  });
});

// theme
function applyTheme(t) {
  document.documentElement.dataset.theme = t;
  try { localStorage.setItem('stock_theme', t); } catch (e) {}
  $('#btn-theme i').className = t === 'dark' ? 'bi bi-sun' : 'bi bi-moon';
  if (currentPage === 'dashboard') renderChart();
}
$('#btn-theme').addEventListener('click', () => applyTheme(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'));
$('#btn-refresh').addEventListener('click', () => loadAll(false));

// auto refresh (สำรอง ถ้าเรียลไทม์ใช้ไม่ได้)
let autoTimer = null;
function startAutoRefresh() {
  clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    if (document.visibilityState !== 'visible') return;
    if (RT.connected && Date.now() - S.lastLoad < 300000) return;
    loadAll(true);
  }, 30000);
  startRealtime();
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.session && Date.now() - S.lastLoad > 30000) loadAll(true);
});

// ---------------------------------------------------------------- global search
(() => {
  const input = $('#global-search'), box = $('#global-search-results');
  const run = () => {
    const q = input.value.trim().toLowerCase();
    if (!q) { box.classList.add('hidden'); return; }
    const prods = productTotals();
    const seen = new Set();
    const hits = [];
    for (const p of S.products) {
      if (hits.length >= 8) break;
      if (p.name.toLowerCase().includes(q) || String(p.barcode).toLowerCase().includes(q)) { hits.push(p); seen.add(p.barcode); }
    }
    for (const i of S.inventory) {
      if (hits.length >= 8) break;
      if (!seen.has(i.barcode) && String(i.lot).toLowerCase().includes(q)) { hits.push({ barcode: i.barcode, name: i.name, lot: i.lot }); seen.add(i.barcode); }
    }
    box.innerHTML = hits.length ? hits.map(h => {
      const t = prods.find(p => p.barcode === h.barcode);
      return `<div class="dd-item" data-bc="${esc(h.barcode)}"><div class="dd-main"><strong>${esc(h.name)}</strong><small class="mono">${esc(h.barcode)}${h.lot ? ' · Lot ' + esc(h.lot) : ''}</small></div><span class="dd-qty">${t ? fmt(t.qty) : '<span class="muted">หมด</span>'}</span></div>`;
    }).join('') : '<div class="dd-empty">ไม่พบสินค้า</div>';
    box.classList.remove('hidden');
  };
  input.addEventListener('input', debounce(run, 120));
  input.addEventListener('focus', run);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') { const f = $('.dd-item', box); if (f) f.click(); }
    if (e.key === 'Escape') { box.classList.add('hidden'); input.blur(); }
  });
  box.addEventListener('mousedown', e => {
    const it = e.target.closest('.dd-item');
    if (!it) return;
    e.preventDefault();
    box.classList.add('hidden'); input.value = '';
    openStockCard(it.dataset.bc);
  });
  document.addEventListener('click', e => { if (!e.target.closest('.tb-search')) box.classList.add('hidden'); });
})();

// ---------------------------------------------------------------- drawer
function openDrawer(title, sub, html) {
  $('#drawer-title').textContent = title;
  $('#drawer-sub').innerHTML = sub || '';
  $('#drawer-body').innerHTML = html;
  $('#drawer').classList.add('open');
  $('#drawer').setAttribute('aria-hidden', 'false');
  $('#drawer-backdrop').classList.remove('hidden');
  $('#drawer-body').scrollTop = 0;
}
function closeDrawer() {
  $('#drawer').classList.remove('open');
  $('#drawer').setAttribute('aria-hidden', 'true');
  $('#drawer-backdrop').classList.add('hidden');
}
$('#drawer-close').addEventListener('click', closeDrawer);
$('#drawer-backdrop').addEventListener('click', closeDrawer);
document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('#drawer').classList.contains('open') && !Swal.isVisible()) closeDrawer(); });

async function openStockCard(barcode) {
  openDrawer('กำลังโหลด...', '', '<div class="empty"><i class="bi bi-hourglass"></i>กำลังโหลดข้อมูล</div>');
  try {
    const c = await api('getStockCard', barcode);
    if (!c) { openDrawer('ไม่พบข้อมูล', '', empty('ยังไม่มีการเคลื่อนไหวของสินค้านี้')); return; }
    const active = c.lots.filter(l => l.qty > 0).sort((a, b) => String(a.exp).localeCompare(String(b.exp)));
    const ropState = c.reorderPoint > 0 ? (c.total <= c.reorderPoint ? `<b style="color:var(--crit)">${fmt(c.reorderPoint)}</b> <small class="muted">(ต่ำกว่าแล้ว)</small>` : `<b>${fmt(c.reorderPoint)}</b>`) : '<b class="muted">-</b>';
    openDrawer(c.name, `<span class="mono">${esc(c.barcode)}</span> · ${esc(c.category || '-')}`, `
      <div class="dl">
        <div><span>คงเหลือรวม</span><b>${fmt(c.total)}</b></div>
        <div><span>Lot ที่มีของ</span><b>${active.length}</b></div>
        <div><span>จุดสั่งซื้อ</span>${ropState}</div>
      </div>
      <div class="card" style="display:flex;justify-content:space-between;align-items:center;gap:12px;flex-wrap:wrap">
        <svg id="sc-barcode"></svg>
        <div class="row-gap">
          <button class="btn btn-ghost btn-sm" id="sc-dl"><i class="bi bi-download"></i> บาร์โค้ด</button>
          ${can('Staff') ? `<a class="btn btn-primary btn-sm" href="#/move?mode=IN&bc=${encodeURIComponent(c.barcode)}">รับเข้า</a>
          <a class="btn btn-out btn-sm" href="#/move?mode=OUT&bc=${encodeURIComponent(c.barcode)}">เบิกออก</a>` : ''}
        </div>
      </div>
      <div class="card p0"><div class="card-head pad"><h3>Lot คงเหลือ</h3></div>
        <div class="table-wrap">${active.length ? `<table class="tbl"><thead><tr><th>Lot</th><th>วันหมดอายุ</th><th>คลัง</th><th>สถานะ</th><th class="num">คงเหลือ</th></tr></thead><tbody>
          ${active.map(l => `<tr><td class="mono">${esc(l.lot)}</td><td class="nowrap">${fmtDate(l.exp)}${countdown(l.days, l.status)}</td><td><span class="tag-wh">${esc(l.warehouse || '-')}</span></td><td>${badge(l.status)}</td><td class="num qty-strong">${fmt(l.qty)}</td></tr>`).join('')}
        </tbody></table>` : empty('ไม่มีของคงเหลือ')}</div></div>
      <div class="card p0"><div class="card-head pad"><h3>ประวัติการเคลื่อนไหว (บัตรคุมสินค้า)</h3></div>
        <div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>ประเภท</th><th>Lot</th><th>วันหมดอายุ</th><th>คลัง</th><th class="num">จำนวน</th><th class="num">คงเหลือ</th><th>ผู้ทำ</th></tr></thead><tbody>
          ${c.moves.slice(0, 200).map(m => `<tr><td class="nowrap">${fmtDate(m.date)}${m.docNo ? `<div class="small"><a href="#" data-doc="${esc(m.docNo)}">${esc(m.docNo)}</a></div>` : ''}</td><td>${typeBadge(m.type)}</td>
            <td class="mono">${esc(m.lot)}</td><td class="nowrap">${fmtDate(m.exp)}</td><td><span class="tag-wh">${esc(m.warehouse || '-')}</span></td>
            <td class="num qty-strong" style="color:${m.type === 'IN' ? 'var(--blue)' : 'var(--out)'}">${m.type === 'IN' ? '+' : '−'}${fmt(m.qty)}</td><td class="num">${fmt(m.balance)}</td>
            <td class="small">${esc(m.user)}${m.note ? `<div class="muted">${esc(m.note)}</div>` : ''}</td></tr>`).join('')}
        </tbody></table></div></div>`);
    try { JsBarcode('#sc-barcode', c.barcode, { format: 'CODE128', height: 46, fontSize: 13, margin: 0, background: 'transparent', lineColor: getComputedStyle(document.body).color }); } catch (e) { $('#sc-barcode').remove(); }
    $('#sc-dl').onclick = () => downloadBarcode(c.barcode);
    $$('#drawer-body [data-doc]').forEach(a => a.onclick = ev => { ev.preventDefault(); openDocument(a.dataset.doc); });
    $$('#drawer-body a[href^="#/move"]').forEach(a => a.addEventListener('click', closeDrawer));
  } catch (e) { closeDrawer(); fail(e); }
}

function downloadBarcode(bc) {
  try {
    const canvas = document.createElement('canvas');
    JsBarcode(canvas, bc, { format: 'CODE128', displayValue: true, fontSize: 18, margin: 12 });
    const a = document.createElement('a');
    a.href = canvas.toDataURL('image/png'); a.download = `barcode_${bc}.png`; a.click();
  } catch (e) { fail(new Error('สร้างบาร์โค้ดไม่ได้: ' + e.message)); }
}

async function openDocument(docNo) {
  try {
    const d = await api('getDocument', docNo);
    if (!d) return fail(new Error('ไม่พบเอกสาร'));
    const total = d.items.reduce((s, i) => s + i.qty, 0);
    openDrawer(d.docNo, `${typeBadge(d.type)} &nbsp;${fmtDate(d.date)} · โดย ${esc(d.user)}`, `
      <div class="dl">
        <div><span>ประเภท</span><b>${d.type === 'IN' ? 'รับเข้า' : 'เบิกออก'}</b></div>
        <div><span>จำนวนรายการ</span><b>${d.items.length}</b></div>
        <div><span>รวมจำนวน</span><b>${fmt(total)}</b></div>
      </div>
      ${d.items[0].note ? `<div class="card"><span class="muted small">หมายเหตุ</span><div>${esc(d.items[0].note)}</div></div>` : ''}
      <div class="card p0"><div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>สินค้า</th><th>Lot</th><th>วันหมดอายุ</th><th>คลัง</th><th class="num">จำนวน</th></tr></thead><tbody>
        ${d.items.map((i, n) => `<tr><td class="muted">${n + 1}</td><td class="prod-cell"><strong>${esc(i.name)}</strong><small class="mono">${esc(i.barcode)}</small></td>
          <td class="mono">${esc(i.lot)}</td><td class="nowrap">${fmtDate(i.exp)}</td><td><span class="tag-wh">${esc(i.warehouse || '-')}</span></td><td class="num qty-strong">${fmt(i.qty)}</td></tr>`).join('')}
      </tbody></table></div></div>
      <button class="btn btn-dark btn-block" id="doc-print"><i class="bi bi-printer"></i> พิมพ์ใบ${d.type === 'IN' ? 'รับ' : 'เบิก'}สินค้า (PDF)</button>`);
    $('#doc-print').onclick = () => printDocSlip(d);
  } catch (e) { fail(e); }
}

// ---------------------------------------------------------------- DASHBOARD
let dashUrgentTab = 'expiry';
let chartInstance = null;
function renderDashboard() {
  const s = S.session;
  $('#dash-greet').textContent = `สวัสดี, ${s.displayName || s.username}`;
  $('#dash-date').textContent = fmtDateLong();
  if (!S.loaded) { $('#dash-kpis').innerHTML = '<div class="kpi"><span class="muted">กำลังโหลดข้อมูล...</span></div>'; return; }

  const prods = productTotals();
  const lots = S.inventory.length;
  const totalQty = S.inventory.reduce((a, i) => a + i.qty, 0);
  const counts = Object.fromEntries(STATUS_KEYS.map(k => [k, 0]));
  S.inventory.forEach(i => { if (counts[i.status] !== undefined) counts[i.status]++; });
  const nearCrit = counts['Near Expiry'] + counts['Critical'];
  const unmanagedNear = S.inventory.filter(i => i.days <= 90 && i.days >= 0 && !i.managedType).length;
  const ro = reorderList();

  $('#dash-kpis').innerHTML = `
    <a class="kpi k-blue" href="#/inventory"><span class="kpi-label"><i class="bi bi-box-seam"></i> สินค้าคงคลัง</span>
      <span class="kpi-value">${fmt(prods.length)}<small>รายการ</small></span><span class="kpi-foot">${fmt(lots)} Lot · รวม ${fmt(totalQty)} ชิ้น</span></a>
    <a class="kpi k-warn" href="#/alerts"><span class="kpi-label"><i class="bi bi-hourglass-split"></i> ใกล้หมดอายุ (≤ 90 วัน)</span>
      <span class="kpi-value">${fmt(nearCrit)}<small>Lot</small></span><span class="kpi-foot">${unmanagedNear ? `ยังไม่ได้จัดการ ${unmanagedNear} Lot` : 'จัดการครบแล้ว'}</span></a>
    <a class="kpi k-crit" href="#/inventory?status=Expired"><span class="kpi-label"><i class="bi bi-x-octagon"></i> หมดอายุแล้ว</span>
      <span class="kpi-value">${fmt(counts['Expired'])}<small>Lot</small></span><span class="kpi-foot">${counts['Expired'] ? 'ควรนำออกจากคลัง' : 'ไม่มีสินค้าหมดอายุ'}</span></a>
    <a class="kpi k-beige" href="#/reorder"><span class="kpi-label"><i class="bi bi-cart3"></i> ต้องสั่งซื้อ</span>
      <span class="kpi-value">${fmt(ro.length)}<small>รายการ</small></span><span class="kpi-foot">ต่ำกว่าจุดสั่งซื้อ</span></a>`;

  // status distribution
  const period = $('#dash-trend-period').value;
  const past = (S.trends && S.trends[period]) || {};
  const word = { daily: 'เมื่อวาน', weekly: 'สัปดาห์ก่อน', monthly: 'เดือนก่อน' }[period];
  $('#dash-status-bar').innerHTML = lots ? STATUS_KEYS.map(k => counts[k] ? `<span title="${STATUS[k].th} ${counts[k]}" style="width:${counts[k] / lots * 100}%;background:${STATUS[k].color}"></span>` : '').join('') : '';
  $('#dash-status-legend').innerHTML = STATUS_KEYS.map(k => {
    const d = counts[k] - (past[k] || 0);
    const good = k === 'Normal' ? d > 0 : d < 0;
    const cls = d === 0 ? '' : (d > 0 ? (good ? 'up-good' : 'up-bad') : (good ? 'down-good' : 'down-bad'));
    return `<div class="legend-item" data-status="${k}">
      <span class="lg-top"><span class="lg-dot" style="background:${STATUS[k].color}"></span>${STATUS[k].th} <span class="muted small">${STATUS[k].desc}</span></span>
      <span class="lg-num">${counts[k]}</span>
      <span class="lg-delta ${cls}">${d === 0 ? 'ไม่เปลี่ยนแปลง' : `${d > 0 ? '▲ +' : '▼ '}${d} จาก${word}`}</span></div>`;
  }).join('');
  $$('#dash-status-legend .legend-item').forEach(el => el.onclick = () => { location.hash = `#/inventory?status=${encodeURIComponent(el.dataset.status)}`; });

  renderDashUrgent();
  // chart product list
  const sel = $('#dash-chart-product'), cur = sel.value;
  const names = [...new Set(S.txs.map(t => t.name))].sort((a, b) => a.localeCompare(b, 'th'));
  sel.innerHTML = '<option value="ALL">ทุกสินค้า</option>' + names.map(n => `<option>${esc(n)}</option>`).join('');
  if (names.includes(cur)) sel.value = cur;
  renderChart();

  $('#dash-docs').innerHTML = S.docs.length ? `<div class="mini-list">${S.docs.slice(0, 6).map(d => `
    <div class="mini-row" data-doc="${esc(d.docNo)}">${typeBadge(d.type)}
      <div class="mr-main"><strong class="mono">${esc(d.docNo)}</strong><small>${d.items} รายการ · ${fmt(d.totalQty)} ชิ้น${d.note ? ' · ' + esc(d.note) : ''}</small></div>
      <div class="mr-side"><div>${esc(d.user)}</div><small class="muted">${fmtTs(d.ts)}</small></div></div>`).join('')}</div>`
    : empty('ยังไม่มีเอกสาร — เอกสารจะแสดงที่นี่หลังบันทึกรับเข้า/เบิกออก', 'journal');
  $$('#dash-docs [data-doc]').forEach(el => el.onclick = () => openDocument(el.dataset.doc));
}
function renderDashUrgent() {
  $$('#dash-urgent-tabs button').forEach(b => b.classList.toggle('active', b.dataset.v === dashUrgentTab));
  const box = $('#dash-urgent');
  if (dashUrgentTab === 'expiry') {
    const list = S.inventory.filter(i => i.days <= 180 && !i.managedType).sort((a, b) => a.days - b.days).slice(0, 6);
    box.innerHTML = list.length ? `<div class="mini-list">${list.map(i => `
      <div class="mini-row" data-bc="${esc(i.barcode)}"><div class="mr-main"><strong>${esc(i.name)}</strong><small>Lot ${esc(i.lot)} · Exp ${fmtDate(i.exp)} · ${esc(i.warehouse)} · คงเหลือ ${fmt(i.qty)}</small></div>
        <div class="mr-side">${badge(i.status)}<div>${countdown(i.days, i.status).replace('class="cd ', 'class="cd cd-block ')}</div></div></div>`).join('')}</div>
      <a class="link" href="#/alerts" style="display:block;margin-top:12px">ดูทั้งหมด (${pendingAlerts().length}) <i class="bi bi-arrow-right"></i></a>`
      : empty('ไม่มีสินค้าที่ต้องดำเนินการ', 'check2-circle');
  } else {
    const list = reorderList().slice(0, 6);
    box.innerHTML = list.length ? `<div class="mini-list">${list.map(r => `
      <div class="mini-row" data-bc="${esc(r.barcode)}"><div class="mr-main"><strong>${esc(r.name)}</strong><small>จุดสั่งซื้อ ${fmt(r.reorderPoint)}</small></div>
        <div class="mr-side"><b style="color:var(--crit)">${fmt(r.qty)}</b><div class="small muted">ขาด ${fmt(r.shortage)}</div></div></div>`).join('')}</div>
      <a class="link" href="#/reorder" style="display:block;margin-top:12px">ดูทั้งหมด (${reorderList().length}) <i class="bi bi-arrow-right"></i></a>`
      : empty(S.reorderPoints.length ? 'สต็อกเพียงพอทุกรายการ' : 'ยังไม่ได้ตั้งค่าจุดสั่งซื้อ (เมนู ตั้งค่า Stock)', 'check2-circle');
  }
  $$('#dash-urgent [data-bc]').forEach(el => el.onclick = () => el.dataset.bc && openStockCard(el.dataset.bc));
}
$('#dash-urgent-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { dashUrgentTab = b.dataset.v; renderDashUrgent(); } });
$('#dash-trend-period').addEventListener('change', () => renderDashboard());
$('#dash-chart-product').addEventListener('change', () => renderChart());
$('#dash-chart-range').addEventListener('change', () => renderChart());

function renderChart() {
  if (!window.Chart || !$('#dash-chart')) return;
  const prod = $('#dash-chart-product').value, range = $('#dash-chart-range').value;
  const TH_M = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
  const g = new Map();
  for (const t of S.txs) {
    if (prod !== 'ALL' && t.name !== prod) continue;
    const d = new Date(t.date + 'T00:00:00');
    let key, label;
    if (range === 'daily') { key = t.date; label = `${d.getDate()} ${TH_M[d.getMonth()]}`; }
    else if (range === 'weekly') { const m = new Date(d); m.setDate(d.getDate() - ((d.getDay() + 6) % 7)); key = isoDate(m); label = `สัปดาห์ ${m.getDate()} ${TH_M[m.getMonth()]}`; }
    else if (range === 'monthly') { key = t.date.slice(0, 7); label = `${TH_M[d.getMonth()]} ${String(d.getFullYear() + 543).slice(-2)}`; }
    else { key = t.date.slice(0, 4); label = String(d.getFullYear() + 543); }
    if (!g.has(key)) g.set(key, { label, IN: 0, OUT: 0 });
    g.get(key)[t.type] += t.qty;
  }
  const keys = [...g.keys()].sort().slice(-14);
  const css = getComputedStyle(document.documentElement);
  const c = v => css.getPropertyValue(v).trim();
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart($('#dash-chart'), {
    type: 'bar',
    data: {
      labels: keys.length ? keys.map(k => g.get(k).label) : ['ไม่มีข้อมูล'],
      datasets: [
        { label: 'รับเข้า', data: keys.map(k => g.get(k).IN), backgroundColor: c('--blue'), borderRadius: 4, maxBarThickness: 22 },
        { label: 'เบิกออก', data: keys.map(k => g.get(k).OUT), backgroundColor: c('--out'), borderRadius: 4, maxBarThickness: 22 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { position: 'top', align: 'end', labels: { color: c('--ink-2'), boxWidth: 10, boxHeight: 10, font: { family: c('--font') } } },
        tooltip: { mode: 'index', intersect: false } },
      scales: {
        x: { grid: { display: false }, ticks: { color: c('--muted'), font: { family: c('--font') } } },
        y: { beginAtZero: true, grid: { color: c('--line') }, ticks: { color: c('--muted'), font: { family: c('--font') } } },
      },
    },
  });
}

// ---------------------------------------------------------------- MOVE (IN / OUT)
const MV = Object.assign({ mode: 'IN', carts: { IN: [], OUT: [] }, warehouse: { IN: '', OUT: '' }, note: { IN: '', OUT: '' } }, store.get('stock_move_draft_v2') || {});
MV.picked = null; MV.searchIdx = 0;
const saveDraft = () => store.set('stock_move_draft_v2', { mode: MV.mode, carts: MV.carts, warehouse: MV.warehouse, note: MV.note });
const cart = () => MV.carts[MV.mode];
const lineKey = l => `${l.barcode}\u0000${l.lotNo}\u0000${l.warehouse}`;
const inCartQty = (barcode, lot, wh, exceptIdx = -1) => cart().reduce((s, l, i) => i !== exceptIdx && l.barcode === barcode && l.lotNo === lot && l.warehouse === wh ? s + num(l.qty) : s, 0);
const lotStock = (barcode, lot, wh) => { const it = S.inventory.find(i => i.barcode === barcode && i.lot === lot && i.warehouse === wh); return it ? it.qty : 0; };

function renderMove({ params, changed, fromData }) {
  // ข้อมูลรีเฟรชเบื้องหลัง (เช่น เรียลไทม์): อย่าวาดฟอร์มใหม่ เพื่อไม่ให้สิ่งที่ผู้ใช้กำลังพิมพ์หาย
  if (fromData && !changed) {
    const whSel = $('#mv-warehouse');
    if (document.activeElement !== whSel) {
      const v = MV.warehouse[MV.mode] || whSel.value;
      whSel.innerHTML = `<option value="">— เลือกคลัง —</option>` + S.warehouses.map(w => `<option ${w === v ? 'selected' : ''}>${esc(w)}</option>`).join('');
    }
    if (cart().length) renderCartTotalsOnly();
    return;
  }
  if (changed) {
    const m = params.get('mode');
    if (m === 'IN' || m === 'OUT') MV.mode = m;
    if (!$('#mv-date').value) $('#mv-date').value = isoDate();
  }
  $('#page-move').classList.toggle('mode-OUT', MV.mode === 'OUT');
  $$('#mode-switch button').forEach(b => {
    b.classList.toggle('active', b.dataset.mode === MV.mode);
    const n = MV.carts[b.dataset.mode].length, em = $('.mode-count', b);
    em.textContent = n ? `${n} รายการค้าง` : ''; em.classList.toggle('hidden', !n || b.dataset.mode === MV.mode);
  });
  // warehouses
  const whSel = $('#mv-warehouse'), whVal = MV.warehouse[MV.mode] || whSel.value;
  whSel.innerHTML = `<option value="">— เลือกคลัง —</option>` + S.warehouses.map(w => `<option ${w === whVal ? 'selected' : ''}>${esc(w)}</option>`).join('');
  $('#mv-note').value = MV.note[MV.mode] || '';
  $('#mv-search').placeholder = MV.mode === 'IN' ? 'สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้าที่จะรับเข้า แล้วกด Enter' : 'สแกนบาร์โค้ด หรือพิมพ์ชื่อสินค้าที่จะเบิก แล้วกด Enter';
  const bc = changed && params.get('bc');
  if (bc) { const p = S.products.find(x => x.barcode === bc); if (p) pickProduct(p); history.replaceState(null, '', `#/move?mode=${MV.mode}`); }
  else if (MV.picked && MV.picked.mode !== MV.mode) closePicker();
  else if (MV.picked) renderPicker();
  renderCart();
  if (changed && !bc && window.innerWidth > 991) setTimeout(() => $('#mv-search').focus(), 60);
}

$('#mode-switch').addEventListener('click', e => {
  const b = e.target.closest('button'); if (!b || b.dataset.mode === MV.mode) return;
  MV.mode = b.dataset.mode; saveDraft(); closePicker();
  history.replaceState(null, '', `#/move?mode=${MV.mode}`);
  renderMove({ params: new URLSearchParams(), changed: false });
  $('#mv-search').focus();
});
$('#mv-warehouse').addEventListener('change', e => { MV.warehouse[MV.mode] = e.target.value; saveDraft(); if (MV.picked) renderPicker(); });
$('#mv-note').addEventListener('input', e => { MV.note[MV.mode] = e.target.value; saveDraft(); });

// --- product search
function searchProducts(q) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const totals = new Map();
  S.inventory.forEach(i => totals.set(i.barcode, (totals.get(i.barcode) || 0) + i.qty));
  const res = S.products.map(p => {
    const bc = String(p.barcode).toLowerCase(), name = p.name.toLowerCase();
    let score = bc === q ? 100 : bc.startsWith(q) ? 60 : name.startsWith(q) ? 50 : name.includes(q) ? 30 : bc.includes(q) ? 20 : 0;
    return { ...p, score, stock: totals.get(p.barcode) || 0 };
  }).filter(p => p.score > 0);
  res.sort((a, b) => b.score - a.score || (b.stock > 0) - (a.stock > 0) || a.name.localeCompare(b.name, 'th'));
  return res.slice(0, 8);
}
function renderSearchResults() {
  const q = $('#mv-search').value, box = $('#mv-search-results');
  if (!q.trim()) { box.classList.add('hidden'); return; }
  const list = searchProducts(q);
  MV.results = list;
  MV.searchIdx = Math.min(MV.searchIdx, Math.max(list.length - 1, 0));
  let html = list.map((p, i) => {
    const out = MV.mode === 'OUT' && p.stock <= 0;
    return `<div class="dd-item ${i === MV.searchIdx ? 'active' : ''}" data-i="${i}" ${out ? 'style="opacity:.5"' : ''}>
      <div class="dd-main"><strong>${esc(p.name)}</strong><small class="mono">${esc(p.barcode)}</small></div>
      <span class="dd-qty">${p.stock > 0 ? `คงเหลือ ${fmt(p.stock)}` : '<span class="muted">ไม่มีในคลัง</span>'}</span></div>`;
  }).join('');
  if (!list.length) html = `<div class="dd-empty">ไม่พบสินค้า "${esc(q)}"</div>`;
  if (MV.mode === 'IN') html += `<div class="dd-item dd-new" data-new="1"><i class="bi bi-plus-circle"></i> เพิ่มเป็นสินค้าใหม่ "${esc(q.trim())}"</div>`;
  box.innerHTML = html;
  box.classList.remove('hidden');
}
$('#mv-search').addEventListener('input', () => { MV.searchIdx = 0; renderSearchResults(); });
$('#mv-search').addEventListener('keydown', e => {
  const box = $('#mv-search-results');
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
    e.preventDefault();
    const n = (MV.results || []).length; if (!n) return;
    MV.searchIdx = (MV.searchIdx + (e.key === 'ArrowDown' ? 1 : -1) + n) % n;
    renderSearchResults();
  } else if (e.key === 'Enter') {
    e.preventDefault();
    const q = $('#mv-search').value.trim(); if (!q) return;
    const list = searchProducts(q);
    const exact = list.find(p => String(p.barcode).toLowerCase() === q.toLowerCase());
    const p = exact || list[MV.searchIdx] || null;
    if (p) pickProduct(p);
    else if (MV.mode === 'IN') pickNewProduct(q);
    else { box.innerHTML = `<div class="dd-empty">ไม่พบสินค้า "${esc(q)}" ในระบบ</div>`; box.classList.remove('hidden'); }
  } else if (e.key === 'Escape') { box.classList.add('hidden'); }
});
$('#mv-search-results').addEventListener('mousedown', e => {
  const it = e.target.closest('.dd-item'); if (!it) return;
  e.preventDefault();
  if (it.dataset.new) pickNewProduct($('#mv-search').value.trim());
  else pickProduct(MV.results[+it.dataset.i]);
});
$('#mv-search').addEventListener('blur', () => setTimeout(() => $('#mv-search-results').classList.add('hidden'), 150));

function closePicker() { MV.picked = null; $('#mv-picker').classList.add('hidden'); $('#mv-picker').innerHTML = ''; $('#mv-hint').classList.remove('hidden'); }

async function pickProduct(p) {
  $('#mv-search-results').classList.add('hidden');
  $('#mv-search').value = '';
  MV.picked = { mode: MV.mode, barcode: p.barcode, name: p.name, isNew: false, lots: null, sel: null, qty: 1, lot: '', exp: '', category: '', warehouse: MV.warehouse[MV.mode] || '' };
  if (MV.mode === 'OUT') {
    const lots = S.inventory.filter(i => i.barcode === p.barcode && i.qty > 0).sort((a, b) => String(a.exp).localeCompare(String(b.exp)));
    MV.picked.lots = lots;
    const avail = l => l.qty - inCartQty(l.barcode, l.lot, l.warehouse);
    const docWh = MV.warehouse.OUT;
    const first = lots.find(l => avail(l) > 0 && (!docWh || l.warehouse === docWh)) || lots.find(l => avail(l) > 0);
    MV.picked.sel = first ? lots.indexOf(first) : null;
    renderPicker();
  } else {
    renderPicker(true);
    try {
      const d = await api('getProductDetails', p.barcode);
      if (!MV.picked || MV.picked.barcode !== p.barcode) return;
      MV.picked.lots = d.lots || [];
      MV.picked.category = MV.picked.category || d.category || '';
      if (!MV.picked.warehouse) MV.picked.warehouse = d.warehouse || '';
      renderPicker();
    } catch (e) { MV.picked.lots = []; renderPicker(); }
  }
}
function pickNewProduct(q) {
  $('#mv-search-results').classList.add('hidden');
  $('#mv-search').value = '';
  const looksBarcode = /^[0-9A-Za-z-]{4,}$/.test(q) && !/\s/.test(q) && /\d/.test(q);
  MV.picked = { mode: 'IN', isNew: true, barcode: looksBarcode ? q : '', name: looksBarcode ? '' : q, lots: [], qty: 1, lot: '', exp: '', category: '', warehouse: MV.warehouse.IN || '' };
  renderPicker();
}

function stepperHtml(id, val, cls = '') {
  return `<div class="stepper ${cls}"><button type="button" data-step="-1" tabindex="-1">−</button><input id="${id}" type="number" inputmode="decimal" min="0" step="any" value="${esc(val)}"><button type="button" data-step="1" tabindex="-1">+</button></div>`;
}
function bindStepper(root, onChange) {
  $$('.stepper', root).forEach(st => {
    const inp = $('input', st);
    $$('button', st).forEach(b => b.onclick = () => { inp.value = Math.max(0, num(inp.value) + +b.dataset.step); inp.dispatchEvent(new Event('input')); inp.focus(); });
    inp.addEventListener('input', () => onChange && onChange(inp));
  });
}

function renderPicker(loadingLots = false) {
  const P = MV.picked, box = $('#mv-picker');
  if (!P) return closePicker();
  $('#mv-hint').classList.add('hidden');
  box.classList.remove('hidden');
  const head = `<div class="picker-head"><div>${P.isNew ? '<strong>สินค้าใหม่</strong><small>กรอกบาร์โค้ดและชื่อสินค้า</small>' : `<strong>${esc(P.name)}</strong><small class="mono">${esc(P.barcode)}</small>`}</div>
    <button class="btn btn-ghost btn-sm btn-icon" id="pk-close" title="ยกเลิก"><i class="bi bi-x-lg"></i></button></div>`;
  let body = '';
  if (MV.mode === 'OUT') {
    const lots = P.lots || [];
    if (!lots.length) body = `<div class="picker-error">สินค้านี้ไม่มียอดคงเหลือในคลัง</div>`;
    else {
      const docWh = MV.warehouse.OUT;
      body = `<div class="picker-section-label"><span>เลือก Lot ที่จะเบิก</span><span class="muted">เรียงตามวันหมดอายุ (ควรเบิก Lot ที่หมดก่อน)</span></div>
        <div class="lot-options">${lots.map((l, i) => {
          const avail = Math.round((l.qty - inCartQty(l.barcode, l.lot, l.warehouse)) * 100) / 100;
          const other = docWh && l.warehouse !== docWh;
          return `<label class="lot-opt ${P.sel === i ? 'selected' : ''} ${avail <= 0 ? 'disabled' : ''}">
            <input type="radio" name="pk-lot" value="${i}" ${P.sel === i ? 'checked' : ''} ${avail <= 0 ? 'disabled' : ''}>
            <div class="lo-main"><strong class="mono">${esc(l.lot)}</strong>${i === 0 ? '<span class="fefo-tag">หมดอายุก่อน</span>' : ''}
              <small>หมดอายุ ${fmtDate(l.exp)} · ${daysText(l.days)} · <span class="tag-wh" ${other ? 'style="border-color:var(--warn)"' : ''}>${esc(l.warehouse)}</span></small></div>
            ${badge(l.status)}
            <div class="lo-qty"><b>${fmt(avail)}</b>${avail !== l.qty ? `<small class="muted">จาก ${fmt(l.qty)}</small>` : '<small class="muted">คงเหลือ</small>'}</div></label>`;
        }).join('')}</div>
        <div class="qty-row"><label class="field"><span>จำนวนที่เบิก</span>${stepperHtml('pk-qty', P.qty)}</label>
          <button class="btn btn-primary btn-lg" id="pk-add"><i class="bi bi-plus-lg"></i> เพิ่มลงรายการ</button></div>`;
    }
  } else {
    const lotOptions = (P.lots || []).map(l => `<option value="${esc(l.lot)}">${l.exp ? 'Exp ' + esc(l.exp) : ''}${l.qty ? ' · คงเหลือ ' + fmt(l.qty) : ''}</option>`).join('');
    body = `${P.isNew ? `<div class="form-grid g2">
        <label class="field"><span>บาร์โค้ด <em class="req">*</em></span><input class="input mono" id="pk-barcode" value="${esc(P.barcode)}"></label>
        <label class="field"><span>ชื่อสินค้า <em class="req">*</em></span><input class="input" id="pk-name" value="${esc(P.name)}"></label></div>` : ''}
      <div class="form-grid g2">
        <label class="field"><span>Lot No. <em class="req">*</em> ${loadingLots ? '<small class="muted">กำลังโหลด Lot เดิม...</small>' : (P.lots && P.lots.length ? `<small class="muted">มี ${P.lots.length} Lot เดิม</small>` : '')}</span>
          <input class="input mono" id="pk-lot" list="pk-lots" value="${esc(P.lot)}" placeholder="พิมพ์หรือเลือก Lot" autocomplete="off"><datalist id="pk-lots">${lotOptions}</datalist></label>
        <label class="field"><span>วันหมดอายุ <em class="req">*</em></span><input class="input" type="date" id="pk-exp" value="${esc(P.exp)}"></label>
        <label class="field"><span>คลังที่จัดเก็บ <em class="req">*</em></span><select class="select" id="pk-wh"><option value="">— เลือกคลัง —</option>${S.warehouses.map(w => `<option ${w === P.warehouse ? 'selected' : ''}>${esc(w)}</option>`).join('')}</select></label>
        <label class="field"><span>หมวดหมู่ <em class="req">*</em></span><select class="select" id="pk-cat"><option value="">— เลือกหมวด —</option>${S.categories.map(c => `<option ${c === P.category ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></label>
      </div>
      <div class="qty-row"><label class="field"><span>จำนวนที่รับเข้า</span>${stepperHtml('pk-qty', P.qty)}</label>
        <button class="btn btn-primary btn-lg" id="pk-add"><i class="bi bi-plus-lg"></i> เพิ่มลงรายการ</button></div>`;
  }
  box.innerHTML = head + body + '<div class="picker-error" id="pk-error"></div>';
  $('#pk-close').onclick = () => { closePicker(); $('#mv-search').focus(); };
  bindStepper(box, inp => { P.qty = inp.value; });
  $$('input[name="pk-lot"]', box).forEach(r => r.onchange = () => { P.sel = +r.value; renderPicker(); $('#pk-qty').focus(); });
  const bindVal = (id, key, ev = 'input') => { const el = $('#' + id); if (el) el.addEventListener(ev, () => { P[key] = el.value; }); };
  bindVal('pk-barcode', 'barcode'); bindVal('pk-name', 'name'); bindVal('pk-wh', 'warehouse', 'change'); bindVal('pk-cat', 'category', 'change'); bindVal('pk-exp', 'exp', 'change');
  const lotEl = $('#pk-lot');
  if (lotEl) lotEl.addEventListener('input', () => {
    P.lot = lotEl.value;
    const ex = (P.lots || []).find(l => l.lot.toLowerCase() === lotEl.value.trim().toLowerCase());
    if (ex && ex.exp) { P.exp = ex.exp; $('#pk-exp').value = ex.exp; }
  });
  $('#pk-add') && ($('#pk-add').onclick = addPicked);
  $$('input', box).forEach(i => i.addEventListener('keydown', e => { if (e.key === 'Enter' && i.id !== 'pk-lot') { e.preventDefault(); addPicked(); } }));
  if (lotEl && !P.lot) setTimeout(() => {
    const t = P.isNew ? ($('#pk-barcode') && $('#pk-barcode').value ? $('#pk-name') : $('#pk-barcode')) : $('#pk-lot');
    if (t) t.focus();
  }, 30);
  else if (MV.mode === 'OUT') setTimeout(() => { const q = $('#pk-qty'); if (q) { q.focus(); q.select(); } }, 30);
}

function addPicked() {
  const P = MV.picked; if (!P) return;
  const err = m => { const el = $('#pk-error'); el.textContent = m; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return false; };
  const qty = num($('#pk-qty') ? $('#pk-qty').value : P.qty);
  if (!(qty > 0)) return err('กรุณาใส่จำนวนมากกว่า 0');
  let line;
  if (MV.mode === 'OUT') {
    if (P.sel === null || !P.lots[P.sel]) return err('กรุณาเลือก Lot');
    const l = P.lots[P.sel];
    const avail = l.qty - inCartQty(l.barcode, l.lot, l.warehouse);
    if (qty > avail + 1e-9) return err(`จำนวนเกินยอดคงเหลือของ Lot นี้ (เหลือ ${fmt(avail)})`);
    line = { barcode: l.barcode, productName: l.name, lotNo: l.lot, expDate: l.exp, warehouse: l.warehouse, category: l.category, qty };
  } else {
    const barcode = (P.isNew ? $('#pk-barcode').value : P.barcode).trim();
    const name = (P.isNew ? $('#pk-name').value : P.name).trim();
    const lot = $('#pk-lot').value.trim(), exp = $('#pk-exp').value, wh = $('#pk-wh').value, cat = $('#pk-cat').value;
    if (!barcode || !name) return err('กรุณากรอกบาร์โค้ดและชื่อสินค้า');
    if (P.isNew) { const dup = S.products.find(p => p.barcode === barcode); if (dup) return err(`บาร์โค้ดนี้เป็นของ "${dup.name}" อยู่แล้ว — ค้นหาสินค้านั้นแทน`); }
    if (!lot) return err('กรุณาระบุ Lot No.');
    if (!exp) return err('กรุณาระบุวันหมดอายุ');
    if (!wh) return err('กรุณาเลือกคลังที่จัดเก็บ');
    if (!cat) return err('กรุณาเลือกหมวดหมู่');
    const ex = (P.lots || []).find(l => l.lot === lot);
    if (ex && ex.exp && ex.exp !== exp && !confirm(`Lot ${lot} เดิมมีวันหมดอายุ ${ex.exp}\nแต่คุณกรอก ${exp}\n\nยืนยันใช้วันที่ใหม่?`)) return false;
    line = { barcode, productName: name, lotNo: lot, expDate: exp, warehouse: wh, category: cat, qty, isNew: P.isNew };
    MV.warehouse.IN = MV.warehouse.IN || wh;
  }
  const idx = cart().findIndex(l => lineKey(l) === lineKey(line));
  if (idx >= 0) cart()[idx].qty = Math.round((num(cart()[idx].qty) + qty) * 100) / 100;
  else cart().push(line);
  MV.flash = lineKey(line);
  saveDraft(); closePicker(); renderCart(); renderMoveCounts();
  toast(`เพิ่ม ${line.productName} × ${fmt(qty)}`);
  $('#mv-search').focus();
}
function renderMoveCounts() { renderMove({ params: new URLSearchParams(), changed: false }); }

function renderCart() {
  const list = cart(), box = $('#mv-cart');
  const total = list.reduce((s, l) => s + num(l.qty), 0);
  $('#mv-cart-count').textContent = `${list.length} รายการ`;
  const word = MV.mode === 'IN' ? 'รับเข้า' : 'เบิกออก';
  $('#mv-bar-type').textContent = word;
  $('#mv-bar-summary').innerHTML = list.length ? `<b>${list.length}</b> รายการ · รวม <b>${fmt(total)}</b> ชิ้น` : 'ยังไม่มีรายการ';
  $('#mv-save span').textContent = list.length ? `บันทึก${word} ${list.length} รายการ` : `บันทึก${word}`;
  $('#mv-save').disabled = !list.length;
  if (!list.length) {
    box.innerHTML = `<div class="cart-empty"><i class="bi bi-${MV.mode === 'IN' ? 'box-arrow-in-down' : 'box-arrow-up'}"></i>
      <strong>ยังไม่มีสินค้าในเอกสาร${word}</strong><div class="small">สแกนบาร์โค้ดหรือค้นหาสินค้าในช่องที่ 2 เพื่อเริ่ม</div></div>`;
    return;
  }
  box.innerHTML = `<div class="cart-list">${list.map((l, i) => {
    const cur = lotStock(l.barcode, l.lotNo, l.warehouse);
    const after = MV.mode === 'IN' ? cur + num(l.qty) : cur - inCartQty(l.barcode, l.lotNo, l.warehouse);
    const st = l.expDate ? statusOf(Math.round((new Date(l.expDate + 'T00:00:00') - new Date(isoDate() + 'T00:00:00')) / 864e5)) : null;
    return `<div class="cart-item ${MV.flash === lineKey(l) ? 'flash' : ''}" data-i="${i}">
      <span class="ci-no">${i + 1}</span>
      <div class="ci-main"><strong>${esc(l.productName)}${l.isNew ? ' <span class="pill">ใหม่</span>' : ''}</strong>
        <div class="ci-meta"><span>Lot <b class="mono">${esc(l.lotNo)}</b></span><span>Exp <b>${fmtDate(l.expDate)}</b></span><span class="tag-wh">${esc(l.warehouse)}</span>${st && st !== 'Normal' ? badge(st) : ''}</div></div>
      <div class="ci-qty">${stepperHtml('ci-q-' + i, l.qty, 'sm')}<div class="ci-after ${after < 0 ? 'warn' : ''}">คงเหลือหลังบันทึก <b>${fmt(after)}</b></div></div>
      <button class="btn btn-ghost btn-sm btn-icon" data-del="${i}" title="ลบรายการนี้"><i class="bi bi-trash3"></i></button></div>`;
  }).join('')}</div>
  <div class="cart-total"><span>${list.length} รายการ</span><span>รวมทั้งหมด <b>${fmt(total)}</b> ชิ้น</span></div>`;
  MV.flash = null;
  $$('.cart-item', box).forEach(row => {
    const i = +row.dataset.i;
    bindStepper(row, inp => {
      const l = list[i]; let v = num(inp.value);
      if (MV.mode === 'OUT') { const max = lotStock(l.barcode, l.lotNo, l.warehouse) - inCartQty(l.barcode, l.lotNo, l.warehouse, i); if (v > max) { v = max; inp.value = max; toast(`เบิกได้สูงสุด ${fmt(max)}`, 'warning'); } }
      l.qty = v; saveDraft(); renderCartTotalsOnly();
    });
  });
  $$('[data-del]', box).forEach(b => b.onclick = () => { list.splice(+b.dataset.del, 1); saveDraft(); renderCart(); renderMoveCounts(); });
}
function renderCartTotalsOnly() {
  const list = cart(), total = list.reduce((s, l) => s + num(l.qty), 0);
  $('#mv-bar-summary').innerHTML = `<b>${list.length}</b> รายการ · รวม <b>${fmt(total)}</b> ชิ้น`;
  const t = $('.cart-total span:last-child'); if (t) t.innerHTML = `รวมทั้งหมด <b>${fmt(total)}</b> ชิ้น`;
  $$('.cart-item').forEach(row => {
    const l = list[+row.dataset.i]; if (!l) return;
    const cur = lotStock(l.barcode, l.lotNo, l.warehouse);
    const after = MV.mode === 'IN' ? cur + num(l.qty) : cur - inCartQty(l.barcode, l.lotNo, l.warehouse);
    const el = $('.ci-after', row); el.classList.toggle('warn', after < 0); $('b', el).textContent = fmt(after);
  });
}

$('#mv-clear').addEventListener('click', async () => {
  if (!cart().length) return;
  const r = await Swal.fire({ icon: 'warning', title: 'ล้างรายการทั้งหมด?', text: `รายการ${MV.mode === 'IN' ? 'รับเข้า' : 'เบิกออก'} ${cart().length} รายการที่ยังไม่บันทึกจะถูกลบ`, showCancelButton: true, confirmButtonText: 'ล้างรายการ', cancelButtonText: 'ยกเลิก' });
  if (!r.isConfirmed) return;
  MV.carts[MV.mode] = []; saveDraft(); renderCart(); renderMoveCounts();
});

$('#mv-save').addEventListener('click', async () => {
  const list = cart().filter(l => num(l.qty) > 0);
  if (!list.length) return toast('ยังไม่มีรายการ', 'warning');
  const date = $('#mv-date').value || isoDate();
  const word = MV.mode === 'IN' ? 'รับเข้า' : 'เบิกออก';
  const total = list.reduce((s, l) => s + num(l.qty), 0);
  const r = await Swal.fire({
    title: `ยืนยันบันทึก${word}`,
    html: `<p class="swal-left" style="margin-bottom:10px">วันที่ <b>${fmtDate(date)}</b> · <b>${list.length}</b> รายการ · รวม <b>${fmt(total)}</b> ชิ้น${MV.note[MV.mode] ? `<br>หมายเหตุ: ${esc(MV.note[MV.mode])}` : ''}</p>
      <div class="swal-summary"><table class="tbl"><thead><tr><th>สินค้า</th><th>Lot</th><th>วันหมดอายุ</th><th>คลัง</th><th class="num">จำนวน</th></tr></thead><tbody>
      ${list.map(l => `<tr><td>${esc(l.productName)}</td><td class="mono">${esc(l.lotNo)}</td><td class="nowrap">${fmtDate(l.expDate)}</td><td>${esc(l.warehouse)}</td><td class="num"><b>${fmt(l.qty)}</b></td></tr>`).join('')}</tbody></table></div>`,
    width: 640, showCancelButton: true, confirmButtonText: `<i class="bi bi-check2"></i> ยืนยันบันทึก`, cancelButtonText: 'กลับไปแก้ไข',
    confirmButtonColor: getComputedStyle(document.documentElement).getPropertyValue(MV.mode === 'IN' ? '--blue' : '--out'),
  });
  if (!r.isConfirmed) return;
  loading('กำลังบันทึก...');
  try {
    const res = await api('saveBatch', { type: MV.mode, date, note: MV.note[MV.mode], items: list.map(l => ({ barcode: l.barcode, productName: l.productName, lotNo: l.lotNo, expDate: l.expDate, qty: num(l.qty), warehouse: l.warehouse, category: l.category })) });
    if (!res.success) { Swal.fire({ icon: 'error', title: 'บันทึกไม่สำเร็จ', text: res.message }); return; }
    const mode = MV.mode;
    MV.carts[mode] = []; MV.note[mode] = ''; saveDraft();
    closePicker();
    renderMove({ params: new URLSearchParams(), changed: false });
    await loadAll(true);
    const done = await Swal.fire({
      icon: 'success', title: 'บันทึกเรียบร้อย',
      html: `เลขที่เอกสาร <b class="mono">${esc(res.docNo)}</b><br><span class="muted">${res.count} รายการ</span>`,
      showDenyButton: true, confirmButtonText: 'ทำรายการต่อ', denyButtonText: '<i class="bi bi-printer"></i> พิมพ์เอกสาร',
      customClass: { denyButton: 'swal-deny-dark' },
    });
    if (done.isDenied) { const d = await api('getDocument', res.docNo); if (d) printDocSlip(d); }
    $('#mv-search').focus();
  } catch (e) { fail(e); }
});

// --- Excel import / template
$('#mv-template-btn').addEventListener('click', () => {
  const ws = XLSX.utils.aoa_to_sheet([
    ['วันที่', 'ประเภท', 'บาร์โค้ด', 'ชื่อสินค้า', 'Lot. No.', 'Exp. Date', 'จำนวน', 'คงเหลือ', 'ผู้ทำรายการ', 'คลังสินค้า', 'หมวดหมู่'],
    [isoDate(), 'IN', '8858939600462', 'needle 22G', '23D22', '2028-03-31', 100, '', '', S.warehouses[0] || 'คลังสินค้าหลัก', S.categories[0] || 'เวชภัณฑ์'],
  ]);
  ws['!cols'] = [12, 8, 16, 28, 14, 12, 8, 8, 12, 16, 14].map(w => ({ wch: w }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, ws, 'รายการ');
  XLSX.writeFile(wb, 'แบบฟอร์มนำเข้า_รับเข้า-เบิกออก.xlsx');
});
$('#mv-import-btn').addEventListener('click', () => $('#mv-import-file').click());
$('#mv-import-file').addEventListener('change', e => {
  const file = e.target.files[0]; e.target.value = '';
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async ev => {
    let rows = [];
    try {
      const wb = XLSX.read(new Uint8Array(ev.target.result), { type: 'array' });
      const toDate = v => { if (typeof v === 'number') { const d = XLSX.SSF.parse_date_code(v); return `${d.y}-${pad(d.m)}-${pad(d.d)}`; } return v ? String(v).trim().slice(0, 10) : ''; };
      // หาคอลัมน์จากหัวตาราง (รองรับทั้งแบบฟอร์มใหม่ และไฟล์ Excel จากระบบเดิม)
      const KEYS = { date: ['วันที่', 'date'], type: ['ประเภท', 'type'], barcode: ['บาร์โค้ด', 'barcode'], name: ['ชื่อสินค้า', 'productname', 'สินค้า'],
        lot: ['lotno', 'lot'], exp: ['expdate', 'exp', 'วันหมดอายุ'], qty: ['จำนวน', 'qty'], user: ['ผู้ทำรายการ', 'user'],
        warehouse: ['คลังสินค้า', 'คลัง', 'warehouse'], category: ['หมวดหมู่', 'category'] };
      const OLD = { date: 0, type: 1, barcode: 2, name: 3, lot: 4, qty: 5, user: 7, warehouse: 8, category: 9, exp: 10 };
      const norm = v => String(v || '').toLowerCase().replace(/[\s.]/g, '');
      wb.SheetNames.forEach(n => {
        const all = XLSX.utils.sheet_to_json(wb.Sheets[n], { header: 1 });
        const head = (all[0] || []).map(norm);
        const C = {};
        for (const k in KEYS) { const i = head.findIndex(h => KEYS[k].includes(h)); C[k] = i >= 0 ? i : OLD[k]; }
        all.slice(1).forEach(r => {
          if (!r || !r[C.barcode] || !r[C.name]) return;
          rows.push({ date: toDate(r[C.date]) || isoDate(), type: String(r[C.type] || 'IN').trim().toUpperCase() === 'OUT' ? 'OUT' : 'IN',
            barcode: String(r[C.barcode]).trim(), productName: String(r[C.name]).trim(), lotNo: String(r[C.lot] || 'DEFAULT').trim(), qty: num(r[C.qty]) || 1,
            user: r[C.user] ? String(r[C.user]) : '', warehouse: String(r[C.warehouse] || MV.warehouse[MV.mode] || S.warehouses[0] || '').trim(),
            category: String(r[C.category] || '').trim(), expDate: toDate(r[C.exp]) });
        });
      });
    } catch (err) { return fail(new Error('อ่านไฟล์ไม่ได้: ' + err.message)); }
    if (!rows.length) return Swal.fire({ icon: 'warning', title: 'ไม่พบข้อมูล', text: 'ตรวจสอบว่าคอลัมน์ตรงกับแบบฟอร์ม (ดาวน์โหลดได้จากปุ่ม "แบบฟอร์ม")' });
    const nIn = rows.filter(r => r.type === 'IN').length, nOut = rows.length - nIn;
    const r = await Swal.fire({
      title: `พบ ${rows.length} รายการ`, icon: 'question',
      html: `<p class="swal-left">รับเข้า ${nIn} · เบิกออก ${nOut}</p>
        <div class="swal-left" style="display:grid;gap:10px;margin-top:12px">
        <div class="card" style="padding:12px"><b>เพิ่มลงรายการเพื่อตรวจสอบก่อนบันทึก</b><div class="small muted">ใช้วันที่ของเอกสารปัจจุบัน แยกเข้าตะกร้ารับเข้า/เบิกออก</div></div>
        ${can('Admin') ? '<div class="card" style="padding:12px"><b>นำเข้าเป็นประวัติตามวันที่ในไฟล์</b><div class="small muted">สำหรับย้ายข้อมูลจากระบบเดิม — บันทึกทันที (Admin)</div></div>' : ''}</div>`,
      showCancelButton: true, showDenyButton: can('Admin'), confirmButtonText: 'เพิ่มลงรายการ', denyButtonText: 'นำเข้าประวัติ', cancelButtonText: 'ยกเลิก', width: 560,
      customClass: { denyButton: 'swal-deny-dark' },
    });
    if (r.isConfirmed) {
      rows.forEach(x => {
        const line = { barcode: x.barcode, productName: x.productName, lotNo: x.lotNo, expDate: x.expDate, warehouse: x.warehouse, category: x.category, qty: x.qty };
        const c = MV.carts[x.type], i = c.findIndex(l => lineKey(l) === lineKey(line));
        if (i >= 0) c[i].qty = num(c[i].qty) + x.qty; else c.push(line);
      });
      MV.mode = nIn >= nOut ? 'IN' : 'OUT';
      saveDraft(); renderMove({ params: new URLSearchParams(), changed: false });
      toast(`เพิ่ม ${rows.length} รายการลงตะกร้าแล้ว — ตรวจสอบแล้วกดบันทึก`);
    } else if (r.isDenied) {
      loading('กำลังนำเข้าข้อมูล...');
      try {
        const res = await api('saveBulkTransactions', rows);
        if (!res.success) return Swal.fire({ icon: 'error', title: 'นำเข้าไม่สำเร็จ', text: res.message });
        await loadAll(true);
        Swal.fire({ icon: 'success', title: `นำเข้า ${rows.length} รายการเรียบร้อย` });
      } catch (err) { fail(err); }
    }
  };
  reader.readAsArrayBuffer(file);
});

// ---------------------------------------------------------------- DOCUMENTS
let docsCache = null;
async function renderDocs({ changed }) {
  if (changed) {
    if (!$('#doc-start').value) { $('#doc-start').value = addDays(isoDate(), -30); $('#doc-end').value = isoDate(); }
    docsCache = null;
  }
  if (!docsCache) {
    $('#doc-table').innerHTML = empty('กำลังโหลด...', 'hourglass');
    try { docsCache = await api('getDocuments', { start: $('#doc-start').value, end: $('#doc-end').value, limit: 1000 }); }
    catch (e) { $('#doc-table').innerHTML = empty(e.message, 'exclamation-circle'); return; }
  }
  const type = $('#doc-type').value, q = $('#doc-q').value.trim().toLowerCase();
  const list = docsCache.filter(d => (!type || d.type === type) && (!q || [d.docNo, d.user, d.note].join(' ').toLowerCase().includes(q)));
  $('#doc-table').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>เลขที่เอกสาร</th><th>วันที่</th><th>ประเภท</th><th class="num">รายการ</th><th class="num">รวมจำนวน</th><th>ผู้ทำรายการ</th><th>หมายเหตุ</th><th></th></tr></thead><tbody>
    ${list.map(d => `<tr class="clickable" data-doc="${esc(d.docNo)}"><td class="mono strong">${esc(d.docNo)}</td><td class="nowrap">${fmtDate(d.date)}<div class="small muted">${fmtTs(d.ts).split(' ').pop()}</div></td>
      <td>${typeBadge(d.type)}</td><td class="num">${d.items}</td><td class="num qty-strong">${fmt(d.totalQty)}</td><td>${esc(d.user)}</td><td class="muted small">${esc(d.note || '')}</td>
      <td class="num"><i class="bi bi-chevron-right muted"></i></td></tr>`).join('')}</tbody></table></div>`
    : empty('ไม่พบเอกสารในช่วงเวลานี้', 'journal');
  $$('#doc-table [data-doc]').forEach(r => r.onclick = () => openDocument(r.dataset.doc));
}
['#doc-start', '#doc-end'].forEach(id => $(id).addEventListener('change', () => { docsCache = null; renderDocs({}); }));
$('#doc-type').addEventListener('change', () => renderDocs({}));
$('#doc-q').addEventListener('input', debounce(() => renderDocs({}), 150));

// ---------------------------------------------------------------- INVENTORY
const INV = { view: 'lot', status: '', sort: { key: 'days', asc: true } };
function fillSelect(sel, list, allText) {
  const v = sel.value;
  sel.innerHTML = `<option value="">${allText}</option>` + list.map(x => `<option>${esc(x)}</option>`).join('');
  if (list.includes(v)) sel.value = v;
}
function inventoryRows() {
  const wh = $('#inv-wh').value, cat = $('#inv-cat').value, q = $('#inv-q').value.trim().toLowerCase();
  let rows = S.inventory.filter(i => (!wh || i.warehouse === wh) && (!cat || i.category === cat)
    && (!q || [i.name, i.barcode, i.lot].join(' ').toLowerCase().includes(q)));
  const base = rows;
  if (INV.status) rows = rows.filter(i => i.status === INV.status);
  if (INV.view === 'product') {
    const map = new Map();
    for (const i of rows) {
      let p = map.get(i.barcode);
      if (!p) { p = { barcode: i.barcode, name: i.name, category: i.category, qty: 0, lots: 0, wh: new Set(), exp: null, days: null, status: 'Normal', reorderPoint: i.reorderPoint }; map.set(i.barcode, p); }
      p.qty += i.qty; p.lots++; p.wh.add(i.warehouse);
      if (i.exp && (p.days === null || i.days < p.days)) { p.days = i.days; p.exp = i.exp; p.status = i.status; }
    }
    rows = [...map.values()].map(p => ({ ...p, qty: Math.round(p.qty * 100) / 100, warehouse: [...p.wh].join(', ') }));
  }
  const { key, asc } = INV.sort, dir = asc ? 1 : -1;
  rows.sort((a, b) => key === 'name' ? dir * a.name.localeCompare(b.name, 'th') : key === 'qty' ? dir * (a.qty - b.qty) : dir * ((a.days ?? 1e9) - (b.days ?? 1e9)));
  return { rows, base };
}
function renderInventory({ params, changed }) {
  if (changed) { INV.status = params.get('status') || ''; if (params.get('q')) $('#inv-q').value = params.get('q'); }
  fillSelect($('#inv-wh'), S.warehouses, 'ทุกคลัง');
  fillSelect($('#inv-cat'), S.categories, 'ทุกหมวด');
  $$('#inv-view button').forEach(b => b.classList.toggle('active', b.dataset.v === INV.view));
  const { rows, base } = inventoryRows();
  const counts = Object.fromEntries(STATUS_KEYS.map(k => [k, base.filter(i => i.status === k).length]));
  $('#inv-status-chips').innerHTML = `<button class="chip ${!INV.status ? 'active' : ''}" data-s="">ทั้งหมด <b>${base.length}</b></button>` +
    STATUS_KEYS.map(k => `<button class="chip ${INV.status === k ? 'active' : ''}" data-s="${k}"><span class="lg-dot" style="width:8px;height:8px;border-radius:50%;background:${STATUS[k].color}"></span>${STATUS[k].th} <b>${counts[k]}</b></button>`).join('');
  $$('#inv-status-chips .chip').forEach(c => c.onclick = () => { INV.status = c.dataset.s; renderInventory({ params: new URLSearchParams() }); });
  const totalQty = rows.reduce((s, r) => s + r.qty, 0);
  $('#inv-summary').textContent = `${rows.length} ${INV.view === 'lot' ? 'Lot' : 'รายการสินค้า'} · รวม ${fmt(totalQty)} ชิ้น`;
  const sortTh = (k, label, cls = '') => `<th class="sortable ${cls} ${INV.sort.key === k ? 'sorted' : ''}" data-sort="${k}">${label}<i class="bi bi-${INV.sort.key === k ? (INV.sort.asc ? 'sort-down-alt' : 'sort-down') : 'arrow-down-up'}"></i></th>`;
  const admin = can('Admin');
  if (!rows.length) { $('#inv-table').innerHTML = empty(S.loaded ? 'ไม่พบสินค้าตามเงื่อนไข' : 'กำลังโหลด...', 'search'); return; }
  if (INV.view === 'lot') {
    $('#inv-table').innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr>${sortTh('name', 'สินค้า')}<th>Lot</th>${sortTh('days', 'วันหมดอายุ')}<th>คลัง</th><th>สถานะ</th>${sortTh('qty', 'คงเหลือ', 'num')}${admin ? '<th></th>' : ''}</tr></thead><tbody>
      ${rows.map((i, n) => `<tr class="clickable" data-bc="${esc(i.barcode)}"><td class="prod-cell"><strong>${esc(i.name)}</strong><small class="mono">${esc(i.barcode)} · ${esc(i.category || '-')}</small></td>
        <td class="mono">${esc(i.lot)}</td>
        <td class="nowrap">${fmtDate(i.exp)}<div class="small muted">${daysText(i.days)}</div></td><td><span class="tag-wh">${esc(i.warehouse || '-')}</span></td>
        <td>${badge(i.status)}${i.managedType ? `<div class="small muted"><i class="bi bi-check2"></i> ${esc(i.managedType)}</div>` : ''}</td>
        <td class="num qty-strong">${fmt(i.qty)}</td>
        ${admin ? `<td><div class="actions"><button class="btn btn-ghost btn-sm btn-icon" data-edit="${n}" title="แก้ไข"><i class="bi bi-pencil"></i></button><button class="btn btn-danger-ghost btn-sm btn-icon" data-delete="${n}" title="ลบ"><i class="bi bi-trash3"></i></button></div></td>` : ''}</tr>`).join('')}
      </tbody></table></div>`;
  } else {
    $('#inv-table').innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr>${sortTh('name', 'สินค้า')}<th>หมวดหมู่</th><th>คลัง</th><th class="num">จำนวน Lot</th>${sortTh('days', 'หมดอายุเร็วสุด')}${sortTh('qty', 'คงเหลือรวม', 'num')}<th class="num">จุดสั่งซื้อ</th></tr></thead><tbody>
      ${rows.map(p => `<tr class="clickable" data-bc="${esc(p.barcode)}"><td class="prod-cell"><strong>${esc(p.name)}</strong><small class="mono">${esc(p.barcode)}</small></td>
        <td>${esc(p.category || '-')}</td><td class="small">${esc(p.warehouse)}</td><td class="num">${p.lots}</td>
        <td class="nowrap">${fmtDate(p.exp)} ${badge(p.status)}<div class="small muted">${daysText(p.days)}</div></td>
        <td class="num qty-strong" ${p.reorderPoint && p.qty <= p.reorderPoint ? 'style="color:var(--crit)"' : ''}>${fmt(p.qty)}</td>
        <td class="num muted">${p.reorderPoint ? fmt(p.reorderPoint) : '-'}</td></tr>`).join('')}
      </tbody></table></div>`;
  }
  $$('#inv-table th[data-sort]').forEach(th => th.onclick = () => { const k = th.dataset.sort; INV.sort = { key: k, asc: INV.sort.key === k ? !INV.sort.asc : true }; renderInventory({ params: new URLSearchParams() }); });
  $$('#inv-table tr[data-bc]').forEach(tr => tr.onclick = e => { if (!e.target.closest('button')) openStockCard(tr.dataset.bc); });
  $$('#inv-table [data-edit]').forEach(b => b.onclick = () => editInventoryItem(rows[+b.dataset.edit]));
  $$('#inv-table [data-delete]').forEach(b => b.onclick = () => deleteInventoryItem(rows[+b.dataset.delete]));
}
['#inv-wh', '#inv-cat'].forEach(id => $(id).addEventListener('change', () => renderInventory({ params: new URLSearchParams() })));
$('#inv-q').addEventListener('input', debounce(() => renderInventory({ params: new URLSearchParams() }), 120));
$('#inv-view').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { INV.view = b.dataset.v; renderInventory({ params: new URLSearchParams() }); } });

async function editInventoryItem(item) {
  const opts = (list, v) => [...new Set([v, ...list].filter(Boolean))].map(x => `<option ${x === v ? 'selected' : ''}>${esc(x)}</option>`).join('');
  const r = await Swal.fire({
    title: 'แก้ไขรายการ', width: 640, focusConfirm: false,
    html: `<div class="form-grid g2 swal-left">
      <label class="field"><span>บาร์โค้ด</span><input class="input mono" id="ed-bc" value="${esc(item.barcode)}"></label>
      <label class="field"><span>ชื่อสินค้า</span><input class="input" id="ed-name" value="${esc(item.name)}"></label>
      <label class="field"><span>Lot No.</span><input class="input mono" id="ed-lot" value="${esc(item.lot)}"></label>
      <label class="field"><span>วันหมดอายุ</span><input class="input" type="date" id="ed-exp" value="${esc(item.exp)}"></label>
      <label class="field"><span>คลังสินค้า</span><select class="select" id="ed-wh">${opts(S.warehouses, item.warehouse)}</select></label>
      <label class="field"><span>หมวดหมู่</span><select class="select" id="ed-cat">${opts(S.categories, item.category)}</select></label>
      <label class="field"><span>คงเหลือจริง</span><input class="input" type="number" min="0" step="any" id="ed-qty" value="${item.qty}"></label></div>
      <p class="hint swal-left" style="margin-top:14px"><i class="bi bi-info-circle"></i> แก้ไขทุกรายการเคลื่อนไหวของ บาร์โค้ด + Lot + คลัง นี้ · ถ้าเปลี่ยนยอดคงเหลือ ระบบจะบันทึกรายการ "ปรับยอด" ให้อัตโนมัติ</p>`,
    showCancelButton: true, confirmButtonText: 'บันทึกการแก้ไข', cancelButtonText: 'ยกเลิก',
    preConfirm: () => {
      const v = { warehouse: $('#ed-wh').value, category: $('#ed-cat').value, barcode: $('#ed-bc').value.trim(), name: $('#ed-name').value.trim(), lot: $('#ed-lot').value.trim(), exp: $('#ed-exp').value, qty: $('#ed-qty').value };
      if (!v.warehouse || !v.category || !v.barcode || !v.name || !v.lot || !v.exp || v.qty === '') return Swal.showValidationMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
      if (num(v.qty) < 0) return Swal.showValidationMessage('จำนวนต้องไม่ติดลบ');
      return v;
    },
  });
  if (!r.isConfirmed) return;
  loading('กำลังบันทึก...');
  try {
    const res = await api('updateInventoryItem', { barcode: item.barcode, lot: item.lot, warehouse: item.warehouse }, r.value);
    if (!res.success) return Swal.fire({ icon: 'error', title: res.message });
    await loadAll(true); Swal.fire({ icon: 'success', title: res.message, timer: 1600, showConfirmButton: false });
  } catch (e) { fail(e); }
}
async function deleteInventoryItem(item) {
  const r = await Swal.fire({
    icon: 'warning', title: 'ลบรายการนี้?', focusCancel: true,
    html: `<div class="swal-left card" style="padding:12px"><b>${esc(item.name)}</b><div class="small muted">Lot ${esc(item.lot)} · Exp ${fmtDate(item.exp)} · ${esc(item.warehouse)} · คงเหลือ ${fmt(item.qty)}</div></div>
      <p class="swal-left" style="margin-top:12px;color:var(--crit)">ลบประวัติรับเข้า/เบิกออกทั้งหมดของ Lot นี้ในคลังนี้ — ย้อนกลับไม่ได้</p>`,
    showCancelButton: true, confirmButtonText: 'ลบรายการ', cancelButtonText: 'ยกเลิก', confirmButtonColor: getComputedStyle(document.documentElement).getPropertyValue('--crit'),
  });
  if (!r.isConfirmed) return;
  loading('กำลังลบ...');
  try {
    const res = await api('deleteInventoryItem', { barcode: item.barcode, lot: item.lot, warehouse: item.warehouse });
    if (!res.success) return Swal.fire({ icon: 'error', title: res.message });
    await loadAll(true); Swal.fire({ icon: 'success', title: res.message, timer: 1600, showConfirmButton: false });
  } catch (e) { fail(e); }
}
$('#inv-excel').addEventListener('click', () => {
  const { rows } = inventoryRows();
  const data = INV.view === 'lot'
    ? rows.map(i => ({ 'บาร์โค้ด': i.barcode, 'ชื่อสินค้า': i.name, 'Lot': i.lot, 'วันหมดอายุ': i.exp, 'เหลือ (วัน)': i.days, 'สถานะ': STATUS[i.status].th, 'หมวดหมู่': i.category, 'คลัง': i.warehouse, 'คงเหลือ': i.qty }))
    : rows.map(p => ({ 'บาร์โค้ด': p.barcode, 'ชื่อสินค้า': p.name, 'หมวดหมู่': p.category, 'คลัง': p.warehouse, 'จำนวน Lot': p.lots, 'หมดอายุเร็วสุด': p.exp, 'คงเหลือรวม': p.qty, 'จุดสั่งซื้อ': p.reorderPoint || '' }));
  const wb = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(data), 'สินค้าคงคลัง');
  XLSX.writeFile(wb, `สินค้าคงคลัง_${isoDate()}.xlsx`);
});
$('#inv-pdf').addEventListener('click', () => {
  const { rows } = inventoryRows();
  const filters = [$('#inv-wh').value && `คลัง: ${$('#inv-wh').value}`, $('#inv-cat').value && `หมวด: ${$('#inv-cat').value}`, INV.status && `สถานะ: ${STATUS[INV.status].th}`, $('#inv-q').value && `ค้นหา: "${$('#inv-q').value}"`].filter(Boolean);
  if (INV.view === 'lot') {
    printReport({ title: 'รายงานสินค้าคงคลัง', subtitle: filters.join(' · ') || 'สินค้าทั้งหมด', file: 'Inventory_Report',
      kpis: [['จำนวน Lot', rows.length], ['รวมคงเหลือ', fmt(rows.reduce((s, r) => s + r.qty, 0)) + ' ชิ้น'], ['ใกล้หมดอายุ ≤ 90 วัน', rows.filter(r => r.days <= 90 && r.days >= 0).length], ['หมดอายุแล้ว', rows.filter(r => r.days < 0).length]],
      cols: ['#', 'บาร์โค้ด', 'ชื่อสินค้า', 'Lot', 'วันหมดอายุ', 'เหลือ', 'สถานะ', 'หมวด', 'คลัง', 'คงเหลือ'],
      rows: rows.map((i, n) => [n + 1, i.barcode, `<b>${esc(i.name)}</b>`, esc(i.lot), fmtDate(i.exp), daysText(i.days), pdfBadge(i.status), esc(i.category), esc(i.warehouse), `<b>${fmt(i.qty)}</b>`]),
      align: { 0: 'c', 5: 'r', 9: 'r' } });
  } else {
    printReport({ title: 'รายงานสินค้าคงคลัง (รวมตามสินค้า)', subtitle: filters.join(' · ') || 'สินค้าทั้งหมด', file: 'Inventory_By_Product',
      kpis: [['จำนวนสินค้า', rows.length], ['รวมคงเหลือ', fmt(rows.reduce((s, r) => s + r.qty, 0)) + ' ชิ้น']],
      cols: ['#', 'บาร์โค้ด', 'ชื่อสินค้า', 'หมวด', 'คลัง', 'Lot', 'หมดอายุเร็วสุด', 'คงเหลือรวม', 'จุดสั่งซื้อ'],
      rows: rows.map((p, n) => [n + 1, p.barcode, `<b>${esc(p.name)}</b>`, esc(p.category), esc(p.warehouse), p.lots, fmtDate(p.exp), `<b>${fmt(p.qty)}</b>`, p.reorderPoint ? fmt(p.reorderPoint) : '-']),
      align: { 0: 'c', 5: 'r', 7: 'r', 8: 'r' } });
  }
});

// ---------------------------------------------------------------- ALERTS
let alTab = 'pending';
function alertRows() {
  const q = $('#al-q').value.trim().toLowerCase();
  const list = alTab === 'pending' ? pendingAlerts() : S.inventory.filter(i => i.managedType);
  return list.filter(i => !q || [i.name, i.barcode, i.lot, i.warehouse].join(' ').toLowerCase().includes(q)).sort((a, b) => a.days - b.days);
}
function renderAlerts() {
  $$('#al-tabs button').forEach(b => b.classList.toggle('active', b.dataset.v === alTab));
  $('#al-count-pending').textContent = pendingAlerts().length;
  $('#al-count-history').textContent = S.inventory.filter(i => i.managedType).length;
  const rows = alertRows(), staff = can('Staff');
  $('#al-table').innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>สินค้า</th><th>Lot</th><th>วันหมดอายุ</th><th>คลัง</th><th>สถานะ</th><th class="num">คงเหลือ</th><th>${alTab === 'pending' ? '' : 'การจัดการ'}</th></tr></thead><tbody>
    ${rows.map((i, n) => `<tr class="clickable" data-bc="${esc(i.barcode)}"><td class="prod-cell"><strong>${esc(i.name)}</strong><small class="mono">${esc(i.barcode)}</small></td>
      <td class="mono">${esc(i.lot)}</td><td class="nowrap">${fmtDate(i.exp)}${countdown(i.days, i.status)}</td><td><span class="tag-wh">${esc(i.warehouse)}</span></td>
      <td>${badge(i.status)}</td><td class="num qty-strong">${fmt(i.qty)}</td>
      <td>${alTab === 'pending'
        ? (staff ? `<div class="actions"><button class="btn btn-ghost btn-sm" data-ack="${n}"><i class="bi bi-check2"></i> รับทราบ</button><button class="btn btn-dark btn-sm" data-manage="${n}">จัดการ</button></div>` : '<span class="muted small">รอดำเนินการ</span>')
        : `<b>${esc(i.managedType)}</b>${i.managedNote && i.managedNote !== '-' ? `<div class="small muted">${esc(i.managedNote)}</div>` : ''}`}</td></tr>`).join('')}
    </tbody></table></div>`
    : empty(alTab === 'pending' ? 'ไม่มีรายการรอดำเนินการ — จัดการครบแล้ว' : 'ยังไม่มีประวัติการจัดการ', alTab === 'pending' ? 'check2-circle' : 'clock-history');
  $$('#al-table tr[data-bc]').forEach(tr => tr.onclick = e => { if (!e.target.closest('button')) openStockCard(tr.dataset.bc); });
  $$('#al-table [data-ack]').forEach(b => b.onclick = () => saveAlertAction(rows[+b.dataset.ack], 'รับทราบ', '-'));
  $$('#al-table [data-manage]').forEach(b => b.onclick = () => manageAlert(rows[+b.dataset.manage]));
}
$('#al-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { alTab = b.dataset.v; renderAlerts(); } });
$('#al-q').addEventListener('input', debounce(renderAlerts, 120));
async function manageAlert(i) {
  const reasons = ['นำไปใช้ก่อน', 'ย้ายไปคลังอื่น', 'ส่งคืนบริษัท', 'ทำลายทิ้ง', 'บริจาค'];
  const r = await Swal.fire({
    title: 'จัดการสินค้าใกล้หมดอายุ',
    html: `<div class="swal-left card" style="padding:12px;margin-bottom:12px"><b>${esc(i.name)}</b><div class="small muted">Lot ${esc(i.lot)} · หมดอายุ ${fmtDate(i.exp)} · ${esc(i.warehouse)} · คงเหลือ ${fmt(i.qty)}</div></div>
      <div class="reason-chips">${reasons.map(x => `<button type="button" class="chip" data-r="${x}">${x}</button>`).join('')}</div>
      <textarea id="mg-note" class="input" rows="3" placeholder="รายละเอียดการจัดการ"></textarea>`,
    showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', focusConfirm: false,
    didOpen: () => $$('.reason-chips .chip').forEach(c => c.onclick = () => { $$('.reason-chips .chip').forEach(x => x.classList.toggle('active', x === c)); $('#mg-note').value = c.dataset.r + ($('#mg-note').value.includes(':') ? '' : ': '); $('#mg-note').focus(); }),
    preConfirm: () => $('#mg-note').value.trim() || Swal.showValidationMessage('กรุณาระบุรายละเอียด'),
  });
  if (r.isConfirmed) saveAlertAction(i, 'จัดการ', r.value);
}
async function saveAlertAction(i, type, note) {
  try {
    await api('saveExpiryAction', { barcode: i.barcode, productName: i.name, lotNo: i.lot, expDate: i.exp, status: i.status, actionType: type, note });
    toast(type === 'รับทราบ' ? 'บันทึกรับทราบแล้ว' : 'บันทึกการจัดการแล้ว');
    await loadAll(true);
  } catch (e) { fail(e); }
}
$('#al-pdf').addEventListener('click', () => {
  const rows = alertRows();
  printReport({ title: 'รายงานสินค้าใกล้หมดอายุ', subtitle: alTab === 'pending' ? 'รายการที่ต้องดำเนินการ (เหลืออายุ ≤ 180 วัน)' : 'ประวัติการจัดการ', file: 'Expiry_Alert_Report',
    kpis: [['ทั้งหมด', rows.length], ['วิกฤต ≤ 30 วัน', rows.filter(r => r.status === 'Critical').length], ['ใกล้หมดอายุ 31–90', rows.filter(r => r.status === 'Near Expiry').length], ['เฝ้าระวัง 91–180', rows.filter(r => r.status === 'Warning').length]],
    cols: ['#', 'บาร์โค้ด', 'ชื่อสินค้า', 'Lot', 'วันหมดอายุ', 'คลัง', 'สถานะ', 'คงเหลือ', 'การจัดการ', 'ลายเซ็น'],
    rows: rows.map((i, n) => [n + 1, i.barcode, `<b>${esc(i.name)}</b>`, esc(i.lot), `${fmtDate(i.exp)}<br>${pdfCountdown(i.days, i.status)}`, esc(i.warehouse), pdfBadge(i.status), `<b>${fmt(i.qty)}</b>`, i.managedType ? esc(i.managedType + (i.managedNote && i.managedNote !== '-' ? ': ' + i.managedNote : '')) : '', '']),
    align: { 0: 'c', 7: 'r' }, widths: { 9: '90px' } });
});

// ---------------------------------------------------------------- REORDER
function renderReorder() {
  const list = reorderList();
  $('#ro-summary').textContent = S.reorderPoints.length ? `${list.length} รายการต่ำกว่าจุดสั่งซื้อ (จากที่ตั้งค่าไว้ ${S.reorderPoints.length} รายการ)` : '';
  if (!S.reorderPoints.length) {
    $('#ro-table').innerHTML = `<div class="empty"><i class="bi bi-sliders"></i>ยังไม่ได้ตั้งค่าจุดสั่งซื้อ${can('Admin') ? '<div style="margin-top:12px"><a class="btn btn-primary btn-sm" href="#/settings">ไปที่ตั้งค่า Stock</a></div>' : ''}</div>`;
    return;
  }
  $('#ro-table').innerHTML = list.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>สินค้า</th><th class="num">คงเหลือรวม</th><th class="num">จุดสั่งซื้อ</th><th style="width:28%">ระดับสต็อก</th><th class="num">ขาดจากจุดสั่งซื้อ</th></tr></thead><tbody>
    ${list.map(r => { const pct = Math.min(100, r.qty / r.reorderPoint * 100); return `<tr class="clickable" data-bc="${esc(r.barcode)}"><td class="prod-cell"><strong>${esc(r.name)}</strong><small class="mono">${esc(r.barcode)}</small></td>
      <td class="num qty-strong" style="color:${r.qty <= 0 ? 'var(--crit)' : 'inherit'}">${fmt(r.qty)}</td><td class="num">${fmt(r.reorderPoint)}</td>
      <td><div class="status-bar" style="height:8px"><span style="width:${pct}%;background:${pct < 34 ? 'var(--crit)' : pct < 67 ? 'var(--near)' : 'var(--warn)'}"></span></div><small class="muted">${Math.round(pct)}% ของจุดสั่งซื้อ</small></td>
      <td class="num strong">${fmt(r.shortage)}</td></tr>`; }).join('')}</tbody></table></div>`
    : empty('สต็อกเพียงพอทุกรายการ', 'check2-circle');
  $$('#ro-table tr[data-bc]').forEach(tr => tr.onclick = () => tr.dataset.bc && openStockCard(tr.dataset.bc));
}
$('#ro-pdf').addEventListener('click', () => {
  const list = reorderList();
  printReport({ title: 'รายการสินค้าที่ต้องสั่งซื้อ', subtitle: 'ยอดคงเหลือต่ำกว่าหรือเท่ากับจุดสั่งซื้อ', file: 'Reorder_List', orientation: 'portrait',
    kpis: [['จำนวนรายการ', list.length]],
    cols: ['#', 'บาร์โค้ด', 'ชื่อสินค้า', 'คงเหลือ', 'จุดสั่งซื้อ', 'ขาด', 'จำนวนที่สั่ง'],
    rows: list.map((r, n) => [n + 1, r.barcode, `<b>${esc(r.name)}</b>`, fmt(r.qty), fmt(r.reorderPoint), `<b>${fmt(r.shortage)}</b>`, '']),
    align: { 0: 'c', 3: 'r', 4: 'r', 5: 'r' }, widths: { 6: '90px' } });
});

// ---------------------------------------------------------------- REPORT
let rpData = null;
function setPreset(v) {
  const t = new Date(), y = t.getFullYear(), m = t.getMonth();
  const map = { thisMonth: [new Date(y, m, 1), t], lastMonth: [new Date(y, m - 1, 1), new Date(y, m, 0)], '3m': [new Date(y, m - 2, 1), t], year: [new Date(y, 0, 1), t] };
  const [a, b] = map[v];
  $('#rp-start').value = isoDate(a); $('#rp-end').value = isoDate(b);
  $$('#rp-presets button').forEach(x => x.classList.toggle('active', x.dataset.v === v));
}
async function renderReport({ changed }) {
  if (changed && !$('#rp-start').value) setPreset('thisMonth');
  if (changed || !rpData) await loadReport();
  else drawReport();
}
async function loadReport() {
  $('#rp-table').innerHTML = empty('กำลังโหลด...', 'hourglass');
  try { rpData = await api('getTransactionsByDate', $('#rp-start').value, $('#rp-end').value); drawReport(); }
  catch (e) { $('#rp-table').innerHTML = empty(e.message, 'exclamation-circle'); }
}
function reportRows() {
  const q = $('#rp-q').value.trim().toLowerCase(), type = $('#rp-type').value;
  return (rpData || []).filter(r => (!type || r.type === type) && (!q || [r.name, r.barcode, r.lot].join(' ').toLowerCase().includes(q)));
}
function drawReport() {
  const rows = reportRows();
  const tin = rows.filter(r => r.type === 'IN').reduce((s, r) => s + r.qty, 0), tout = rows.filter(r => r.type === 'OUT').reduce((s, r) => s + r.qty, 0);
  $('#rp-kpis').innerHTML = `
    <div class="kpi k-blue"><span class="kpi-label"><i class="bi bi-box-arrow-in-down"></i> รับเข้ารวม</span><span class="kpi-value">${fmt(tin)}</span></div>
    <div class="kpi k-warn"><span class="kpi-label"><i class="bi bi-box-arrow-up"></i> เบิกออกรวม</span><span class="kpi-value">${fmt(tout)}</span></div>
    <div class="kpi k-beige"><span class="kpi-label"><i class="bi bi-plus-slash-minus"></i> สุทธิ</span><span class="kpi-value">${tin - tout >= 0 ? '+' : ''}${fmt(tin - tout)}</span></div>
    <div class="kpi"><span class="kpi-label"><i class="bi bi-list-ul"></i> จำนวนรายการ</span><span class="kpi-value">${fmt(rows.length)}</span></div>`;
  $('#rp-summary').textContent = `${fmtDate($('#rp-start').value)} – ${fmtDate($('#rp-end').value)}`;
  $('#rp-table').innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>วันที่</th><th>ประเภท</th><th>สินค้า</th><th>Lot</th><th>วันหมดอายุ</th><th>คลัง</th><th class="num">จำนวน</th><th class="num">คงเหลือ</th><th>ผู้ทำรายการ</th></tr></thead><tbody>
    ${rows.map(r => `<tr><td class="nowrap">${fmtDate(r.date)}${r.docNo ? `<div class="small"><a href="#" data-doc="${esc(r.docNo)}">${esc(r.docNo)}</a></div>` : ''}</td><td>${typeBadge(r.type)}</td>
      <td class="prod-cell"><strong>${esc(r.name)}</strong><small class="mono">${esc(r.barcode)}</small></td><td class="mono">${esc(r.lot)}</td><td class="nowrap">${fmtDate(r.exp)}</td><td><span class="tag-wh">${esc(r.warehouse || '-')}</span></td>
      <td class="num qty-strong" style="color:${r.type === 'IN' ? 'var(--blue)' : 'var(--out)'}">${r.type === 'IN' ? '+' : '−'}${fmt(r.qty)}</td><td class="num">${fmt(r.balance)}</td><td>${esc(r.user)}${r.note ? `<div class="small muted">${esc(r.note)}</div>` : ''}</td></tr>`).join('')}
    </tbody></table></div>` : empty('ไม่มีรายการในช่วงเวลานี้', 'calendar-x');
  $$('#rp-table [data-doc]').forEach(a => a.onclick = e => { e.preventDefault(); openDocument(a.dataset.doc); });
}
$('#rp-presets').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { setPreset(b.dataset.v); loadReport(); } });
['#rp-start', '#rp-end'].forEach(id => $(id).addEventListener('change', () => { $$('#rp-presets button').forEach(x => x.classList.remove('active')); loadReport(); }));
$('#rp-type').addEventListener('change', drawReport);
$('#rp-q').addEventListener('input', debounce(drawReport, 150));
$('#rp-excel').addEventListener('click', () => {
  const rows = reportRows().slice().sort((a, b) => a.date.localeCompare(b.date));
  if (!rows.length) return toast('ไม่มีข้อมูล', 'info');
  const wb = XLSX.utils.book_new(), groups = new Map();
  rows.forEach(r => { const k = r.name || 'ไม่ระบุ'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(r); });
  for (const [name, items] of groups) {
    const ws = XLSX.utils.aoa_to_sheet([['วันที่', 'ประเภท', 'บาร์โค้ด', 'ชื่อสินค้า', 'Lot. No.', 'Exp. Date', 'จำนวน', 'คงเหลือ', 'ผู้ทำรายการ', 'คลังสินค้า', 'หมวดหมู่', 'เลขที่เอกสาร'],
      ...items.map(i => [i.date, i.type, i.barcode, i.name, i.lot, i.exp || '', i.qty, i.balance, i.user, i.warehouse, i.category, i.docNo || ''])]);
    let sn = name.replace(/[\\/?*[\]:]/g, '_').slice(0, 30), c = 1;
    while (wb.SheetNames.includes(sn)) sn = name.replace(/[\\/?*[\]:]/g, '_').slice(0, 26) + '_' + c++;
    XLSX.utils.book_append_sheet(wb, ws, sn);
  }
  XLSX.writeFile(wb, `รายงานความเคลื่อนไหว_${$('#rp-start').value}_${$('#rp-end').value}.xlsx`);
});
$('#rp-pdf').addEventListener('click', () => {
  const rows = reportRows();
  if (!rows.length) return toast('ไม่มีข้อมูล', 'info');
  const tin = rows.filter(r => r.type === 'IN').reduce((s, r) => s + r.qty, 0), tout = rows.filter(r => r.type === 'OUT').reduce((s, r) => s + r.qty, 0);
  printReport({ title: 'รายงานความเคลื่อนไหวสต็อก', subtitle: `${fmtDate($('#rp-start').value)} – ${fmtDate($('#rp-end').value)}${$('#rp-q').value ? ` · ค้นหา "${$('#rp-q').value}"` : ''}`, file: 'Stock_Movement_Report',
    kpis: [['รายการ', rows.length], ['รับเข้ารวม', fmt(tin)], ['เบิกออกรวม', fmt(tout)], ['สุทธิ', fmt(tin - tout)]],
    cols: ['#', 'วันที่', 'ประเภท', 'บาร์โค้ด', 'ชื่อสินค้า', 'Lot', 'วันหมดอายุ', 'คลัง', 'จำนวน', 'คงเหลือ', 'ผู้ทำรายการ'],
    rows: rows.map((r, n) => [n + 1, fmtDate(r.date), r.type === 'IN' ? 'รับเข้า' : 'เบิกออก', r.barcode, `<b>${esc(r.name)}</b>`, esc(r.lot), fmtDate(r.exp), esc(r.warehouse), `<b>${r.type === 'IN' ? '+' : '−'}${fmt(r.qty)}</b>`, fmt(r.balance), esc(r.user)]),
    align: { 0: 'c', 8: 'r', 9: 'r' } });
});

// ---------------------------------------------------------------- SETTINGS
const ST = { tab: 'usage', raw: null, list: [], sortAsc: true };
async function renderSettings({ changed }) {
  $$('#st-tabs button').forEach(b => b.classList.toggle('active', b.dataset.v === ST.tab));
  ['usage', 'rop', 'master'].forEach(t => $('#st-' + t).classList.toggle('hidden', t !== ST.tab));
  $('#st-wh-list').innerHTML = S.warehouses.map(w => `<span>${esc(w)}</span>`).join('') || '<span class="muted">ยังไม่มี</span>';
  $('#st-cat-list').innerHTML = S.categories.map(c => `<span>${esc(c)}</span>`).join('') || '<span class="muted">ยังไม่มี</span>';
  if (changed || !ST.raw) {
    $('#st-usage-table').innerHTML = empty('กำลังโหลด...', 'hourglass');
    try { ST.raw = await api('getSettingsData'); computeSettings(); } catch (e) { fail(e); }
  }
}
function computeSettings() {
  const days = +$('#st-period').value, cutoff = addDays(isoDate(), -days);
  const usage = new Map();
  for (const t of ST.raw.transData) {
    if (t.date < cutoff) continue;
    const u = usage.get(t.name) || { total: 0, days: new Set() };
    u.total += t.qty; u.days.add(t.date); usage.set(t.name, u);
  }
  const prev = new Map(ST.list.map(s => [s.productName, s]));
  ST.list = ST.raw.productNames.map(name => {
    const u = usage.get(name) || { total: 0, days: new Set() };
    const avg = Math.round(u.total / (u.days.size || 1) * 100) / 100;
    const saved = ST.raw.settingsMap[name] || {}, p = prev.get(name);
    const it = { productName: name, totalOut: u.total, activeDays: u.days.size, avgDailyUsage: avg,
      leadTime: p ? p.leadTime : (saved.leadTime || 7), maxDailyUsage: p ? p.maxDailyUsage : (saved.maxDailyUsage || avg) };
    return recalc(it);
  });
  drawSettings();
}
function recalc(it) {
  it.minStock = Math.round(num(it.maxDailyUsage) * num(it.leadTime) * 100) / 100;
  it.safetyStock = Math.round(it.minStock * 2 * 100) / 100;
  it.reorderPoint = Math.round((it.minStock + it.safetyStock) * 100) / 100;
  return it;
}
function drawSettings() {
  const L = ST.list;
  $('#st-usage-table').innerHTML = L.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th>#</th><th>สินค้า</th><th class="num">ยอดเบิกรวม</th><th class="num">วันที่มีการเบิก</th><th class="num">เฉลี่ย/วัน</th><th class="num" style="width:170px">ใช้ต่อวัน (ที่ใช้คำนวณ)</th></tr></thead><tbody>
    ${L.map((s, i) => `<tr><td class="muted">${i + 1}</td><td class="strong">${esc(s.productName)}</td><td class="num">${fmt(s.totalOut)}</td><td class="num">${s.activeDays}</td><td class="num" style="color:var(--blue);font-weight:600">${fmt(s.avgDailyUsage)}</td>
      <td class="num"><input class="input input-sm right" type="number" min="0" step="any" data-k="maxDailyUsage" data-i="${i}" value="${s.maxDailyUsage}"></td></tr>`).join('')}</tbody></table></div>` : empty('ยังไม่มีสินค้า');
  const f = $('#st-filter').value;
  const rows = L.map((s, i) => ({ s, i })).filter(({ s }) => f === 'ALL' || (f === 'HAS' ? s.minStock > 0 : !(s.minStock > 0)));
  $('#st-rop-table').innerHTML = rows.length ? `<div class="table-wrap"><table class="tbl"><thead><tr><th class="sortable" id="st-sort">สินค้า <i class="bi bi-arrow-down-up"></i></th><th class="num" style="width:120px">Lead Time (วัน)</th><th class="num" style="width:140px">ใช้ต่อวัน</th><th class="num">Minimum</th><th class="num">Safety</th><th class="num">Reorder Point</th></tr></thead><tbody>
    ${rows.map(({ s, i }) => `<tr><td class="strong">${esc(s.productName)}</td>
      <td><input class="input input-sm right" type="number" min="0" step="any" data-k="leadTime" data-i="${i}" value="${s.leadTime}"></td>
      <td><input class="input input-sm right" type="number" min="0" step="any" data-k="maxDailyUsage" data-i="${i}" value="${s.maxDailyUsage}"></td>
      <td class="num" data-c="min" data-i="${i}">${fmt(s.minStock)}</td><td class="num" data-c="safety" data-i="${i}">${fmt(s.safetyStock)}</td><td class="num strong" style="color:var(--blue)" data-c="rop" data-i="${i}">${fmt(s.reorderPoint)}</td></tr>`).join('')}</tbody></table></div>` : empty('ไม่มีรายการตามตัวกรอง');
  $$('#st-usage-table input, #st-rop-table input').forEach(inp => inp.addEventListener('input', () => {
    const it = ST.list[+inp.dataset.i]; it[inp.dataset.k] = num(inp.value); recalc(it);
    $$(`[data-i="${inp.dataset.i}"]`).forEach(el => {
      if (el !== inp && el.dataset.k === inp.dataset.k) el.value = inp.value;
      if (el.dataset.c) el.textContent = fmt({ min: it.minStock, safety: it.safetyStock, rop: it.reorderPoint }[el.dataset.c]);
    });
  }));
  const so = $('#st-sort'); if (so) so.onclick = () => { ST.sortAsc = !ST.sortAsc; ST.list.sort((a, b) => (ST.sortAsc ? 1 : -1) * a.productName.localeCompare(b.productName, 'th')); drawSettings(); };
}
$('#st-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { ST.tab = b.dataset.v; renderSettings({}); } });
$('#st-period').addEventListener('change', () => { ST.list.forEach(s => { s.maxDailyUsage = undefined; }); ST.list = []; computeSettings(); });
$('#st-filter').addEventListener('change', drawSettings);
$('#st-save').addEventListener('click', async () => {
  loading('กำลังบันทึก...');
  try {
    const res = await api('saveSettings', ST.list.map(s => ({ productName: s.productName, leadTime: s.leadTime, avgDailyUsage: s.avgDailyUsage, maxDailyUsage: s.maxDailyUsage, minStock: s.minStock, safetyStock: s.safetyStock, reorderPoint: s.reorderPoint })));
    if (!res.success) return Swal.fire({ icon: 'error', title: res.message });
    ST.raw = null; await loadAll(true);
    Swal.fire({ icon: 'success', title: 'บันทึกการตั้งค่าเรียบร้อย', timer: 1500, showConfirmButton: false });
  } catch (e) { fail(e); }
});
const addMaster = (fn, input) => async e => {
  e.preventDefault();
  const v = $(input).value.trim(); if (!v) return;
  try {
    const res = await api(fn, v);
    if (!res.success) return Swal.fire({ icon: 'warning', title: res.message });
    $(input).value = ''; toast(res.message); await loadAll(true);
  } catch (err) { fail(err); }
};
$('#st-wh-form').addEventListener('submit', addMaster('addWarehouse', '#st-wh-name'));
$('#st-cat-form').addEventListener('submit', addMaster('addCategory', '#st-cat-name'));

// ---------------------------------------------------------------- USERS
let usLogTab = 'login';
const AUDIT_TH = { add_warehouses: 'เพิ่มคลัง', add_categories: 'เพิ่มหมวดหมู่', add_product: 'เพิ่มสินค้า', bulk_import: 'นำเข้า Excel', create_user: 'สร้างผู้ใช้',
  save_settings: 'บันทึกตั้งค่า Stock', update_item: 'แก้ไขรายการ', delete_item: 'ลบรายการ', update_user: 'แก้ไขผู้ใช้',
  request_reset: 'ขอลิงก์ตั้งรหัสผ่านใหม่', reset_password: 'ตั้งรหัสผ่านใหม่ทางอีเมล', reset_mail_failed: 'ส่งอีเมลไม่สำเร็จ' };
let usList = [];
async function renderMailStatus() {
  const box = $('#us-mail');
  try {
    const m = await api('getMailStatus');
    box.innerHTML = `<div class="card-head"><h3><i class="bi bi-envelope"></i> อีเมลรีเซ็ตรหัสผ่าน</h3>
        ${m.configured ? '<button class="btn btn-ghost btn-sm" id="us-mail-test"><i class="bi bi-send"></i> ส่งอีเมลทดสอบถึงฉัน</button>' : ''}</div>
      <div style="display:grid;gap:6px" class="small">
        <div>${m.configured ? `<span class="badge st-Normal">พร้อมใช้งาน</span> ส่งผ่าน ${esc(m.provider)} · ผู้ส่ง ${esc(m.from)}`
          : '<span class="badge st-Critical">ยังไม่ได้ตั้งค่า</span> ต้องเพิ่ม Secret <code>BREVO_API_KEY</code> (หรือ <code>RESEND_API_KEY</code>) และ <code>MAIL_FROM</code> ใน Supabase'}</div>
        <div class="muted">ลิงก์ในอีเมลจะเปิดที่: ${m.appUrl ? esc(m.appUrl) : 'ยังไม่ได้บันทึก — ให้ Admin เข้าสู่ระบบจากลิงก์ออนไลน์ (https) หนึ่งครั้ง'}</div>
        ${S.session.email ? '' : '<div style="color:var(--danger,#a53c33)"><i class="bi bi-exclamation-triangle"></i> บัญชีของคุณยังไม่มีอีเมล — กด แก้ไข ที่บัญชีของคุณด้านล่างเพื่อใส่อีเมล</div>'}
      </div>`;
  } catch (e) { box.innerHTML = empty(e.message); }
}
$('#us-mail').addEventListener('click', async e => {
  const b = e.target.closest('#us-mail-test');
  if (!b) return;
  b.disabled = true;
  try {
    const res = await api('sendTestEmail');
    Swal.fire({ icon: res.success ? 'success' : 'error', title: res.success ? 'ส่งแล้ว' : 'ส่งไม่สำเร็จ', text: res.message });
  } catch (e2) { fail(e2); }
  finally { b.disabled = false; }
});
async function renderUsers() {
  renderMailStatus();
  try {
    const users = usList = await api('getUsersList');
    $('#us-table').innerHTML = `<div class="table-wrap"><table class="tbl"><thead><tr><th>ผู้ใช้</th><th>บทบาท</th><th>แจ้งเตือน</th><th></th></tr></thead><tbody>
      ${users.map((u, i) => `<tr><td><div style="display:flex;gap:10px;align-items:center">${avatarHtml(u.displayName, u.avatar, 30)}<div><strong>${esc(u.displayName)}</strong><div class="small muted">${u.email ? esc(u.email) : '<span style="color:#a53c33">ยังไม่มีอีเมล</span>'}</div></div></div></td>
        <td><span class="badge plain r-${esc(u.role)}">${esc(u.role)}</span></td><td>${u.emailAlert === 'Yes' ? '<i class="bi bi-bell-fill" style="color:var(--ok)"></i>' : '<i class="bi bi-bell-slash muted"></i>'}</td>
        <td class="right"><button class="btn btn-ghost btn-sm" data-edit-user="${i}" title="แก้ไขผู้ใช้"><i class="bi bi-pencil-square"></i> แก้ไข</button></td></tr>`).join('')}</tbody></table></div>`;
  } catch (e) { $('#us-table').innerHTML = empty(e.message); }
  renderUserLog();
}
$('#us-table').addEventListener('click', e => {
  const b = e.target.closest('[data-edit-user]');
  if (b && usList[b.dataset.editUser]) editUser(usList[b.dataset.editUser]);
});
async function editUser(u) {
  const isMe = u.username === S.session.username;
  const r = await Swal.fire({
    title: 'แก้ไขผู้ใช้',
    html: `<div class="form-grid swal-left">
      <div style="display:flex;gap:12px;align-items:center">${avatarHtml(u.displayName, u.avatar, 44)}<div class="small muted">${isMe ? 'บัญชีของคุณ' : 'รูปโปรไฟล์ผู้ใช้ตั้งเองได้จากเมนูบัญชี'}</div></div>
      <label class="field"><span>อีเมล (ใช้เข้าสู่ระบบ) *</span><input id="eu-email" type="email" class="input" value="${esc(u.email || '')}" autocomplete="off"></label>
      <label class="field"><span>ชื่อที่แสดง *</span><input id="eu-display" class="input" value="${esc(u.displayName)}"></label>
      <label class="field"><span>บทบาท</span><select id="eu-role" class="select">
        ${['Admin', 'Staff', 'Viewer'].map(x => `<option value="${x}"${x === u.role ? ' selected' : ''}>${x}</option>`).join('')}</select></label>
      <label style="display:flex;gap:8px;align-items:center"><input type="checkbox" id="eu-alert"${u.emailAlert === 'Yes' ? ' checked' : ''}> ส่งอีเมลแจ้งเตือนสต็อก</label>
      <div class="small muted" style="margin-top:6px">ตั้งรหัสผ่านใหม่ (เว้นว่างถ้าไม่เปลี่ยน)</div>
      <label class="field"><span>รหัสผ่านใหม่ (อย่างน้อย 6 ตัว)</span><input type="password" id="eu-pass" class="input" autocomplete="new-password"></label>
      <label class="field"><span>ยืนยันรหัสผ่านใหม่</span><input type="password" id="eu-pass2" class="input" autocomplete="new-password"></label></div>`,
    showCancelButton: true, confirmButtonText: 'บันทึก', cancelButtonText: 'ยกเลิก', focusConfirm: false,
    preConfirm: () => {
      const d = { displayName: $('#eu-display').value.trim(), role: $('#eu-role').value,
        email: $('#eu-email').value.trim().toLowerCase(), enableAlert: $('#eu-alert').checked, password: $('#eu-pass').value };
      if (!d.email || !d.displayName) return Swal.showValidationMessage('กรุณากรอกอีเมลและชื่อที่แสดง');
      if (!looksEmail(d.email)) return Swal.showValidationMessage('รูปแบบอีเมลไม่ถูกต้อง');
      if (d.password && d.password.length < 6) return Swal.showValidationMessage('รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร');
      if (d.password !== $('#eu-pass2').value) return Swal.showValidationMessage('รหัสผ่านใหม่ไม่ตรงกัน');
      return d;
    },
  });
  if (!r.isConfirmed) return;
  try {
    const res = await api('updateUser', u.username, r.value);
    if (!res.success) return Swal.fire({ icon: 'error', title: res.message });
    if (isMe) {
      saveSession(res.profile);
      if (res.profile.role !== 'Admin') { $$('[data-role]').forEach(el => el.classList.toggle('hidden', !can(el.dataset.role))); renderPage(); return; }
    }
    toast(r.value.password ? `บันทึกแล้ว · ตั้งรหัสผ่านใหม่ให้ ${res.profile.email || res.profile.username} แล้ว` : 'บันทึกข้อมูลผู้ใช้แล้ว');
    renderUsers();
  } catch (e) { fail(e); }
}
async function renderUserLog() {
  $$('#us-log-tabs button').forEach(b => b.classList.toggle('active', b.dataset.v === usLogTab));
  try {
    if (usLogTab === 'login') {
      const h = await api('getLoginHistory');
      $('#us-log').innerHTML = h.length ? `<table class="tbl"><thead><tr><th>วัน/เวลา</th><th>ผู้ใช้</th><th>ผล</th></tr></thead><tbody>
        ${h.map(x => `<tr><td class="nowrap">${fmtTs(x[0])}</td><td>${esc(x[1])}</td><td><span class="badge ${x[2] === 'สำเร็จ' ? 'st-Normal' : 'st-Critical'}">${esc(x[2])}</span></td></tr>`).join('')}</tbody></table>` : empty('ยังไม่มีประวัติ');
    } else {
      const a = await api('getAuditLog');
      $('#us-log').innerHTML = a.length ? `<table class="tbl"><thead><tr><th>วัน/เวลา</th><th>ผู้ใช้</th><th>กิจกรรม</th><th>รายละเอียด</th></tr></thead><tbody>
        ${a.map(x => { let d = ''; try { const o = JSON.parse(x.detail); d = o.name || o.username || (o.count ? `${o.count} รายการ` : '') || (o.orig ? `${o.orig.name || o.orig.barcode} / Lot ${o.orig.lot}` : ''); } catch (e) {}
          return `<tr><td class="nowrap">${fmtTs(x.ts)}</td><td>${esc(x.user)}</td><td>${esc(AUDIT_TH[x.action] || x.action)}</td><td class="small muted">${esc(d)}</td></tr>`; }).join('')}</tbody></table>` : empty('ยังไม่มีกิจกรรม');
    }
  } catch (e) { $('#us-log').innerHTML = empty(e.message); }
}
$('#us-log-tabs').addEventListener('click', e => { const b = e.target.closest('button'); if (b) { usLogTab = b.dataset.v; renderUserLog(); } });
$('#us-form').addEventListener('submit', async e => {
  e.preventDefault();
  const d = { password: $('#us-password').value, displayName: $('#us-display').value.trim(), email: $('#us-email').value.trim().toLowerCase(),
    role: ($('#us-role input:checked') || {}).value || 'Staff', enableAlert: $('#us-alert').checked };
  const err = $('#us-error'); err.textContent = '';
  if (!d.email || !d.password || !d.displayName) { err.textContent = 'กรุณากรอกช่องที่มี * ให้ครบ'; return; }
  if (!looksEmail(d.email)) { err.textContent = 'รูปแบบอีเมลไม่ถูกต้อง'; return; }
  if (d.password.length < 6) { err.textContent = 'รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; return; }
  try {
    const res = await api('createUser', d);
    if (!res.success) { err.textContent = res.message; return; }
    $('#us-form').reset(); toast(`สร้างบัญชี ${d.email} แล้ว`); renderUsers();
  } catch (e2) { err.textContent = e2.message; }
});

// ---------------------------------------------------------------- PDF
const PDF_STATUS = { 'Normal': ['#e7efe9', '#4a7a62'], 'Warning': ['#f5eedb', '#9a7319'], 'Near Expiry': ['#f6e7dc', '#b05f2a'], 'Critical': ['#f5e2df', '#a53c33'], 'Expired': ['#1a1c20', '#ffffff'] };
const pdfBadge = s => `<span style="background:${PDF_STATUS[s][0]};color:${PDF_STATUS[s][1]};padding:2px 8px;border-radius:10px;font-size:9px;font-weight:600;white-space:nowrap">${STATUS[s].th}</span>`;
const pdfCountdown = (d, s) => d === null || d === undefined || d > 90000 ? ''
  : `<span style="display:inline-block;margin-top:2px;border:1px solid ${s === 'Expired' ? '#a53c33' : PDF_STATUS[s][1]};color:${s === 'Expired' ? '#a53c33' : PDF_STATUS[s][1]};padding:0 6px;border-radius:10px;font-size:8.5px;font-weight:600;white-space:nowrap">${cdText(d)}</span>`;
function pdfHeader(title, subtitle) {
  const now = new Date();
  return `<div style="display:flex;justify-content:space-between;align-items:flex-end;border-bottom:2px solid #1a1c20;padding-bottom:12px;margin-bottom:14px">
    <div style="display:flex;gap:12px;align-items:center"><img src="https://i.postimg.cc/ZnZBK2JR/logo.png" crossorigin="anonymous" style="width:52px;height:52px;object-fit:contain">
      <div><div style="font-size:20px;font-weight:700;color:#1a1c20">SistersLabStock</div><div style="font-size:10px;color:#6f604a">คลินิกเทคนิคการแพทย์ซิสเตอร์ ศูนย์ระยอง</div></div></div>
    <div style="text-align:right"><div style="font-size:17px;font-weight:700;color:#2b5486">${esc(title)}</div><div style="font-size:11px;color:#464b53">${esc(subtitle || '')}</div>
      <div style="font-size:10px;color:#858a92">พิมพ์ ${now.toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })} ${now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })} น. · โดย ${esc(S.session.displayName || S.session.username)}</div></div></div>`;
}
async function renderPdf(html, file, orientation) {
  const root = $('#pdf-root');
  root.style.width = orientation === 'portrait' ? '760px' : '1100px';
  root.innerHTML = `<div style="font-family:'IBM Plex Sans Thai',sans-serif;color:#1a1c20;padding:8px;background:#fff">${html}</div>`;
  loading('กำลังสร้าง PDF...');
  try {
    await html2pdf().set({ margin: [0.35, 0.35, 0.45, 0.35], filename: file + '.pdf', image: { type: 'jpeg', quality: 0.96 },
      html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' }, jsPDF: { unit: 'in', format: 'a4', orientation }, pagebreak: { mode: ['css', 'legacy'], avoid: 'tr' } })
      .from(root.firstChild).toPdf().get('pdf').then(pdf => {
        const n = pdf.internal.getNumberOfPages(), w = pdf.internal.pageSize.getWidth(), h = pdf.internal.pageSize.getHeight();
        for (let i = 1; i <= n; i++) { pdf.setPage(i); pdf.setFontSize(8); pdf.setTextColor(140); pdf.text(`Page ${i} / ${n}`, w - 0.35, h - 0.2, { align: 'right' }); }
      }).save();
    Swal.close();
  } catch (e) { fail(e); }
  finally { root.innerHTML = ''; }
}
function printReport({ title, subtitle, file, kpis = [], cols, rows, align = {}, widths = {}, orientation = 'landscape' }) {
  const per = orientation === 'landscape' ? [16, 22] : [26, 32];
  const th = cols.map((c, i) => `<th style="background:#ece4d6;color:#1a1c20;font-size:10px;padding:6px 7px;border:1px solid #d3cbbd;text-align:${align[i] === 'r' ? 'right' : align[i] === 'c' ? 'center' : 'left'};${widths[i] ? 'width:' + widths[i] : ''}">${c}</th>`).join('');
  const td = (v, i, z) => `<td style="font-size:10px;padding:5px 7px;border:1px solid #e6e0d5;background:${z ? '#faf8f4' : '#fff'};text-align:${align[i] === 'r' ? 'right' : align[i] === 'c' ? 'center' : 'left'};vertical-align:middle">${v}</td>`;
  const chunks = []; let i = 0, first = true;
  while (i < rows.length || first) { const n = first ? per[0] : per[1]; chunks.push(rows.slice(i, i + n)); i += n; first = false; if (!rows.length) break; }
  const kpiHtml = kpis.length ? `<div style="display:flex;gap:8px;margin-bottom:12px">${kpis.map(([l, v]) => `<div style="flex:1;border:1px solid #e6e0d5;background:#faf8f4;border-radius:6px;padding:8px 10px"><div style="font-size:9px;color:#858a92">${l}</div><div style="font-size:16px;font-weight:700">${v}</div></div>`).join('')}</div>` : '';
  const body = chunks.map((ch, ci) => `<div ${ci ? 'class="html2pdf__page-break"' : ''}></div><table style="width:100%;border-collapse:collapse"><thead><tr>${th}</tr></thead><tbody>
    ${ch.length ? ch.map((r, ri) => `<tr>${r.map((v, k) => td(v, k, ri % 2)).join('')}</tr>`).join('') : `<tr><td colspan="${cols.length}" style="text-align:center;padding:20px;color:#858a92;font-size:11px">ไม่มีข้อมูล</td></tr>`}</tbody></table>`).join('');
  renderPdf(pdfHeader(title, subtitle) + kpiHtml + body + `<div style="margin-top:14px;font-size:9px;color:#858a92">Sisters Foundation · ${esc(title)}</div>`, `${file}_${isoDate()}`, orientation);
}
function printDocSlip(d) {
  const word = d.type === 'IN' ? 'ใบรับสินค้าเข้าคลัง' : 'ใบเบิกสินค้าออกจากคลัง';
  const total = d.items.reduce((s, i) => s + i.qty, 0);
  const cell = 'font-size:11px;padding:6px 8px;border:1px solid #e6e0d5';
  const html = pdfHeader(word, `เลขที่ ${d.docNo}`) + `
    <div style="display:flex;gap:24px;font-size:11px;margin-bottom:12px"><div><b>เลขที่เอกสาร:</b> ${esc(d.docNo)}</div><div><b>วันที่:</b> ${fmtDate(d.date)}</div><div><b>ผู้ทำรายการ:</b> ${esc(d.user)}</div></div>
    ${d.items[0].note ? `<div style="font-size:11px;margin-bottom:12px"><b>หมายเหตุ:</b> ${esc(d.items[0].note)}</div>` : ''}
    <table style="width:100%;border-collapse:collapse"><thead><tr>${['#', 'บาร์โค้ด', 'ชื่อสินค้า', 'Lot', 'วันหมดอายุ', 'คลัง', 'จำนวน'].map((c, i) => `<th style="${cell};background:#ece4d6;text-align:${i === 6 ? 'right' : 'left'}">${c}</th>`).join('')}</tr></thead><tbody>
      ${d.items.map((it, n) => `<tr><td style="${cell}">${n + 1}</td><td style="${cell}">${esc(it.barcode)}</td><td style="${cell}"><b>${esc(it.name)}</b></td><td style="${cell}">${esc(it.lot)}</td><td style="${cell}">${fmtDate(it.exp)}</td><td style="${cell}">${esc(it.warehouse)}</td><td style="${cell};text-align:right"><b>${fmt(it.qty)}</b></td></tr>`).join('')}
      <tr><td colspan="6" style="${cell};text-align:right;background:#faf8f4"><b>รวม ${d.items.length} รายการ</b></td><td style="${cell};text-align:right;background:#faf8f4"><b>${fmt(total)}</b></td></tr></tbody></table>
    <div style="display:flex;justify-content:space-around;margin-top:60px;font-size:11px;text-align:center">
      ${[d.type === 'IN' ? 'ผู้รับสินค้า' : 'ผู้เบิก', d.type === 'IN' ? 'ผู้ตรวจรับ' : 'ผู้จ่ายสินค้า', 'ผู้อนุมัติ'].map(x => `<div><div style="border-bottom:1px dotted #464b53;width:170px;height:28px"></div><div style="margin-top:6px">${x}</div><div style="color:#858a92;margin-top:2px">วันที่ ____/____/______</div></div>`).join('')}</div>`;
  renderPdf(html, d.docNo, 'portrait');
}

// ---------------------------------------------------------------- REALTIME
const RT = { started: false, close: null, connected: false, wasOn: false, timer: null };
function setRt(state) {
  const el = $('#rt-status'); if (!el) return;
  const on = state === 'on';
  if (on && RT.wasOn === 'lost') loadAll(true);
  RT.wasOn = on ? true : (RT.wasOn ? 'lost' : false);
  RT.connected = on;
  el.classList.toggle('hidden', state === 'off');
  el.classList.toggle('on', on);
  $('#rt-status-text').textContent = on ? 'เรียลไทม์' : 'กำลังเชื่อมต่อ';
  el.title = on ? 'เชื่อมต่อเรียลไทม์แล้ว — ข้อมูลจากเครื่องอื่นอัปเดตทันที' : 'กำลังเชื่อมต่อเรียลไทม์ (ระหว่างนี้รีเฟรชทุก 30 วินาที)';
}
function liveNotice(text) {
  const n = $('#live-notice'); n.innerHTML = `<i class="bi bi-arrow-repeat"></i> ${esc(text)}`; n.classList.add('show');
  clearTimeout(n._t); n._t = setTimeout(() => n.classList.remove('show'), 2600);
}
function onRemoteChange(p) {
  if (p && p.clientId === CLIENT_ID) return;
  clearTimeout(RT.timer);
  RT.timer = setTimeout(async () => {
    if (!S.session) return;
    docsCache = null; rpData = currentPage === 'report' ? rpData : null;
    await loadAll(true);
    if (currentPage === 'docs') renderDocs({});
    if (currentPage === 'report') loadReport();
    liveNotice('ข้อมูลอัปเดตจากเครื่องอื่นแล้ว');
  }, 500);
}
const loadScript = src => new Promise((ok, no) => { if (document.querySelector(`script[src="${src}"]`)) return ok(); const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error('load failed')); document.head.appendChild(s); });
async function startRealtime() {
  if (RT.started) return; RT.started = true;
  let cfg = null;
  try { cfg = await api('getRealtimeConfig'); } catch (e) {}
  if (!RT.started) return;
  if (!cfg) return setRt('off');
  setRt('connecting');
  try {
    if (cfg.type === 'sse') {
      const es = new EventSource(API_BASE.replace(/api\/$/, '') + cfg.path);
      es.onopen = () => setRt('on'); es.onerror = () => setRt('connecting');
      es.addEventListener(cfg.event, e => { try { onRemoteChange(JSON.parse(e.data)); } catch (x) {} });
      RT.close = () => es.close();
    } else if (cfg.type === 'supabase') {
      await loadScript('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/dist/umd/supabase.min.js');
      const client = window.supabase.createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } });
      const ch = client.channel(cfg.channel).on('broadcast', { event: cfg.event }, m => onRemoteChange(m.payload))
        .subscribe(st => setRt(st === 'SUBSCRIBED' ? 'on' : 'connecting'));
      RT.close = () => client.removeChannel(ch);
    }
  } catch (e) { console.warn('realtime unavailable', e); setRt('connecting'); }
}
function stopRealtime() { if (RT.close) try { RT.close(); } catch (e) {} RT.close = null; RT.started = false; RT.wasOn = false; setRt('off'); }

// ---------------------------------------------------------------- PWA
let installPrompt = null;
const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
const standalone = () => matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const showInstall = v => $$('.install-app-btn').forEach(b => b.classList.toggle('hidden', !v));
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installPrompt = e; showInstall(true); });
window.addEventListener('appinstalled', () => { installPrompt = null; showInstall(false); toast('ติดตั้งแอปเรียบร้อย'); });
$$('.install-app-btn').forEach(b => b.addEventListener('click', () => {
  if (installPrompt) { installPrompt.prompt(); installPrompt.userChoice.finally(() => { installPrompt = null; showInstall(false); }); return; }
  Swal.fire({ title: 'ติดตั้งบน iPhone / iPad', icon: 'info', html: `<div class="swal-left">1. เปิดหน้านี้ด้วย <b>Safari</b><br>2. แตะปุ่ม <b>แชร์</b> <i class="bi bi-box-arrow-up"></i><br>3. เลือก <b>เพิ่มไปยังหน้าจอโฮม</b><br>4. แตะ <b>เพิ่ม</b></div>` });
}));
if (isIOS() && !standalone()) showInstall(true);
if ('serviceWorker' in navigator && window.isSecureContext) window.addEventListener('load', () => navigator.serviceWorker.register('sw.js').catch(() => {}));

// ---------------------------------------------------------------- start
applyTheme(document.documentElement.dataset.theme || 'light');
handleResetLink().then(handled => { if (!handled) { if (S.session && S.session.token) showApp(); else showLogin(); } });
