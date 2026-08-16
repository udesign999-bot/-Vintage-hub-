/* =================================================================
   Vintage Hub — catalog + custom t-shirt designer + local dashboard.
   Everything here runs client-side only (localStorage). See the
   dashboard note in the page for why cross-visitor tracking needs a
   real backend.
================================================================== */

const CATEGORIES = [
  { key: 'typography', label: 'Typography', count: 20, cls: 'cat-typography',
    varName: 'TYPOGRAPHY_PHOTOS', path: 'data/typography.js',
    icon: 'M4 4h16v3h-6v13h-4V7H4z' },
  { key: 'retro', label: 'Retro Graphics', count: 20, cls: 'cat-retro',
    varName: 'RETRO_PHOTOS', path: 'data/retro-graphics.js',
    icon: 'M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2v-2H2v2zm18 0h2v-2h-2v2zm-8-8h2V2h-2v3zm0 18h2v-3h-2v3zM5.99 4.58L4.58 5.99l1.79 1.79 1.41-1.41-1.79-1.79zm12.02 12.02l1.41 1.41 1.79-1.79-1.41-1.41-1.79 1.79zM17.24 5.98l1.79-1.79-1.41-1.41-1.79 1.79 1.41 1.41zM4.58 18.01l1.41 1.41 1.79-1.79-1.41-1.41-1.79 1.79z' },
  { key: 'popculture', label: 'Pop Culture & Fandom', count: 20, cls: 'cat-popculture',
    varName: 'POPCULTURE_PHOTOS', path: 'data/pop-culture.js',
    icon: 'M12 2l3.09 6.26L22 9.27l-5 4.87L18.18 22 12 18.27 5.82 22 7 14.14 2 9.27l6.91-1.01L12 2z' },
  { key: 'nature', label: 'Nature', count: 20, cls: 'cat-nature',
    varName: 'NATURE_PHOTOS', path: 'data/nature.js',
    icon: 'M17 8C8 10 5.9 16.17 3.82 21.34l1.89.66.95-2.3c.48.17.98.3 1.34.3C19 20 22 3 22 3c-1 2-8 2.25-13 3.25S2 11.5 2 13.5c0 1.06.29 2.03.8 2.87C4.29 12.65 8 8 17 8z' },
  { key: 'humor', label: 'Humor', count: 20, cls: 'cat-humor',
    varName: 'HUMOR_PHOTOS', path: 'data/humor.js',
    icon: 'M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z' },
];

// Two-step admin login, checked as SHA-256 hashes (real values aren't
// stored in this file). To change either one, run in any console:
//   crypto.subtle.digest('SHA-256', new TextEncoder().encode('new-value'))
//     .then(b => console.log(Array.from(new Uint8Array(b)).map(x => x.toString(16).padStart(2,'0')).join('')))
const ADMIN_PASSWORD_HASH = '3133386077078a7f8a06d14cc0c86564734b7fd776674439b4f4ec144a0383ad'; // step 1: "7466"
const ADMIN_ANSWER_HASH   = 'ad458de0822bcc83c6dbc2915b35c2605fb0c624b3faffa5437fa08cb03f6e36'; // step 2: "SANKA"

// Sub-admin: a lighter role that can only add/crop/replace catalog photos —
// no dashboard, no orders, no designer. Password + code, same hashing approach.
const SUBADMIN_PASSWORD_HASH = 'd3cc63cac32fa68659dea32bbb8e503355a46b9e45a3246883270f35535c5a04'; // password: "IrfanVH"
const SUBADMIN_CODE_HASH     = '17ffed2060072c95583b3844da54540f3b8649ee9b42497abe8f4aaa3a14078c'; // code: "4459"

const TILE_WIDTH = 500, TILE_HEIGHT = 400;   // catalog photo export size
const DESIGN_LAYER_MAX_W = 260;              // custom-design upload export width (kept small/low-quality by design)
const MAX_IMAGE_LAYERS = 3;

const SESSION_KEY = 'vintageHubAdminUnlocked';
const SUBADMIN_SESSION_KEY = 'vintageHubSubAdminUnlocked';
const STORAGE_ANALYTICS = 'vintageHubAnalytics';
const STORAGE_ORDERS = 'vintageHubOrders';
const STORAGE_DESIGNS = 'vintageHubConfirmedDesigns';
const MAX_EVENTS = 3000;

const WHATSAPP_NUMBER = '971544904459';
function buildWaLink(message) {
  return `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(message)}`;
}

let PHOTOS = {};
let dirtyKeys = new Set(); // category keys with unpublished (undownloaded) edits
let adminMode = false;
let subAdminMode = false;
function canEditCatalog() { return adminMode || subAdminMode; }
let cropper = null;
let activeCropTarget = null;   // {mode:'catalog', key, index} | {mode:'designLayer'}
let currentCategory = null;
let logoClickCount = 0, logoClickTimer = null;

// ---- storage helpers -----------------------------------------------------
// Published photos live in data/*.js (one small file per category), loaded
// as plain globals before this script runs. Edits made here are kept as a
// "draft" in localStorage so you don't lose work on reload — but they only
// really go live once you download the changed file(s) and upload them to
// your GitHub repo, replacing just that category's file.

const DRAFT_KEY = 'vintageHubPhotosDraft';

function loadDraft() {
  const raw = localStorage.getItem(DRAFT_KEY);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return {};
}
function saveDraft(draft) { localStorage.setItem(DRAFT_KEY, JSON.stringify(draft)); }

function loadPhotos() {
  const draft = loadDraft();
  CATEGORIES.forEach(cat => {
    const baseline = Array.isArray(window[cat.varName]) && window[cat.varName].length === cat.count
      ? window[cat.varName] : new Array(cat.count).fill(null);
    if (Array.isArray(draft[cat.key]) && draft[cat.key].length === cat.count) {
      PHOTOS[cat.key] = draft[cat.key];
      dirtyKeys.add(cat.key);
    } else {
      PHOTOS[cat.key] = baseline.slice();
    }
  });
  updateSaveStatus();
}
function markDirty(key) {
  dirtyKeys.add(key);
  const draft = loadDraft();
  draft[key] = PHOTOS[key];
  saveDraft(draft);
  updateSaveStatus();
}
function filledCount(key) { return PHOTOS[key].filter(Boolean).length; }

function buildCategoryFileContents(key) {
  const cat = CATEGORIES.find(c => c.key === key);
  const lines = PHOTOS[key].map(slot => {
    if (!slot) return '  null,';
    return `  {src:${JSON.stringify(slot.src)}, number:${JSON.stringify(slot.number || null)}, updated:${JSON.stringify(slot.updated)}},`;
  });
  return `// ${cat.varName}: ${cat.label} category, ${cat.count} photo slots. Each slot is null (empty) or {src, number, updated} once filled.\n` +
    `const ${cat.varName} = [\n${lines.join('\n')}\n];\n`;
}

async function downloadChangedFiles() {
  const keys = dirtyKeys.size > 0 ? Array.from(dirtyKeys) : [];
  if (!keys.length) return;
  const zip = new JSZip();
  const folder = zip.folder('data');
  keys.forEach(key => {
    const cat = CATEGORIES.find(c => c.key === key);
    folder.file(cat.path.replace('data/', ''), buildCategoryFileContents(key));
  });
  const blob = await zip.generateAsync({ type: 'blob' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'vintagehub-catalog-update.zip';
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  // Treat as published: clear the draft/dirty state for what we just exported.
  const draft = loadDraft();
  keys.forEach(key => { delete draft[key]; dirtyKeys.delete(key); });
  saveDraft(draft);
  updateSaveStatus();
  document.getElementById('saveStatus').textContent = 'Downloaded — upload the file(s) in data/ to GitHub to publish.';
}
document.getElementById('downloadChangedBtn').addEventListener('click', downloadChangedFiles);

function loadAnalytics() {
  const raw = localStorage.getItem(STORAGE_ANALYTICS);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return { events: [] };
}
function saveAnalytics(a) {
  if (a.events.length > MAX_EVENTS) a.events = a.events.slice(-MAX_EVENTS);
  localStorage.setItem(STORAGE_ANALYTICS, JSON.stringify(a));
}
function logEvent(type, extra) {
  const a = loadAnalytics();
  a.events.push(Object.assign({ t: Date.now(), type }, extra || {}));
  saveAnalytics(a);
}

function loadOrders() {
  const raw = localStorage.getItem(STORAGE_ORDERS);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return [];
}
function saveOrder(order) {
  const list = loadOrders();
  list.unshift(order);
  localStorage.setItem(STORAGE_ORDERS, JSON.stringify(list.slice(0, 200)));
}

function loadDesigns() {
  const raw = localStorage.getItem(STORAGE_DESIGNS);
  if (raw) { try { return JSON.parse(raw); } catch (e) {} }
  return [];
}
function saveDesign(rec) {
  const list = loadDesigns();
  list.unshift(rec);
  localStorage.setItem(STORAGE_DESIGNS, JSON.stringify(list.slice(0, 200)));
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ---- screen management -----------------------------------------------

const SCREENS = ['homeScreen', 'catScreen', 'designerChooseScreen', 'designerCanvasScreen', 'orderSummaryScreen', 'adminDashboardScreen'];
function showScreen(id) {
  SCREENS.forEach(s => document.getElementById(s).classList.toggle('hidden', s !== id));
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}
document.querySelectorAll('[data-back]').forEach(btn => {
  btn.addEventListener('click', () => {
    const target = btn.getAttribute('data-back');
    if (target === 'home') goHome();
    else if (target === 'designerChoose') { renderDesignerChoose(); showScreen('designerChooseScreen'); }
  });
});

function goHome() {
  currentCategory = null;
  renderHome();
  showScreen('homeScreen');
}

// ---- home / catalog rendering ------------------------------------------

function renderHome() {
  const list = document.getElementById('catList');
  list.innerHTML = '';
  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = `cat-btn ${cat.cls}`;
    btn.innerHTML = `
      <span class="icon"><svg viewBox="0 0 24 24"><path d="${cat.icon}"/></svg></span>
      ${cat.label}
      <span class="count">${filledCount(cat.key)}/${cat.count}</span>
      <span class="go">›</span>`;
    btn.addEventListener('click', () => openCategory(cat.key));
    list.appendChild(btn);
  });
}

function openCategory(key) {
  currentCategory = key;
  logEvent('categoryView', { cat: key });
  const cat = CATEGORIES.find(c => c.key === key);
  const titleBox = document.getElementById('catTitle');
  titleBox.className = `cat-title ${cat.cls}`;
  titleBox.querySelector('h2').textContent = cat.label;
  titleBox.querySelector('span').textContent = `${cat.count} designs`;
  renderGrid();
  showScreen('catScreen');
}

function photoNumberLabel(cat, index, slot) {
  if (slot && slot.number) return slot.number;
  return `${cat.key.slice(0, 2).toUpperCase()}-${String(index + 1).padStart(2, '0')}`;
}

function renderGrid() {
  const grid = document.getElementById('grid');
  grid.innerHTML = '';
  const arr = PHOTOS[currentCategory];
  const cat = CATEGORIES.find(c => c.key === currentCategory);

  arr.forEach((slot, index) => {
    const tile = document.createElement('div');
    tile.className = 'tile' + (!slot ? ' tile--empty' : '') + (canEditCatalog() ? ' tile--editable' : '');

    if (slot) {
      const img = document.createElement('img');
      img.src = slot.src;
      img.loading = 'lazy';
      img.alt = `${cat.label} design ${index + 1}`;
      tile.appendChild(img);

      const num = document.createElement('span');
      num.className = 'tile__num';
      num.textContent = photoNumberLabel(cat, index, slot);
      tile.appendChild(num);
    }

    if (canEditCatalog()) {
      const tag = document.createElement('span');
      tag.className = 'tile__edit-tag';
      tag.textContent = slot ? 'Edit' : 'Add photo';
      tile.appendChild(tag);
      tile.addEventListener('click', () => openCropModal({ mode: 'catalog', key: currentCategory, index }));
    } else if (slot) {
      tile.addEventListener('click', () => openLightbox(slot.src, cat, index, slot));
    }

    grid.appendChild(tile);
  });
}

function openLightbox(src, cat, index, slot) {
  const number = photoNumberLabel(cat, index, slot);
  logEvent('photoClick', { cat: cat.key, index, number });
  document.getElementById('lightboxImg').src = src;
  document.getElementById('lightboxNum').textContent = `Design ${number}`;
  const orderBtn = document.getElementById('lightboxOrderBtn');
  orderBtn.href = buildWaLink(`Hi Vintage Hub, I'd like to order ${cat.label} design ${number}.`);
  document.getElementById('lightbox').classList.remove('hidden');
}
document.getElementById('lightboxImg').addEventListener('click', () => document.getElementById('lightbox').classList.add('hidden'));
document.getElementById('lightboxCloseBtn').addEventListener('click', () => document.getElementById('lightbox').classList.add('hidden'));

// ---- catalog photo crop modal (admin) -----------------------------------

function openCropModal(target) {
  activeCropTarget = target;
  document.getElementById('cropTitle').textContent = target.mode === 'catalog' ? 'Edit photo' : 'Add design image';
  document.getElementById('cropModal').classList.remove('hidden');
  document.getElementById('cropFileInput').value = '';
  const img = document.getElementById('cropImage');
  img.removeAttribute('src');
  if (cropper) { cropper.destroy(); cropper = null; }
  document.getElementById('clearFrameBtn').classList.toggle('hidden', target.mode !== 'catalog');

  if (target.mode === 'catalog') {
    const existing = PHOTOS[target.key][target.index];
    if (existing) { img.src = existing.src; initCropper(); }
  }
}

document.getElementById('cropFileInput').addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  if (activeCropTarget && activeCropTarget.mode === 'catalog') {
    const m = file.name.match(/(\d+)/);
    activeCropTarget.parsedNumber = m ? m[1] : null;
  }
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = document.getElementById('cropImage');
    if (cropper) { cropper.destroy(); cropper = null; }
    img.src = ev.target.result;
    initCropper();
  };
  reader.readAsDataURL(file);
});

function initCropper() {
  const img = document.getElementById('cropImage');
  const isCatalog = activeCropTarget && activeCropTarget.mode === 'catalog';
  cropper = new Cropper(img, {
    aspectRatio: isCatalog ? 5 / 4 : NaN,
    viewMode: 1, background: false, autoCropArea: 0.95, dragMode: 'move', zoomOnWheel: true,
  });
  document.getElementById('zoomRange').value = 0;
}
document.getElementById('zoomRange').addEventListener('input', (e) => {
  if (!cropper) return;
  cropper.zoomTo(0.2 + (Number(e.target.value) / 100) * 2.8);
});
document.getElementById('cropCancel').addEventListener('click', closeCropModal);
function closeCropModal() {
  if (cropper) { cropper.destroy(); cropper = null; }
  document.getElementById('cropModal').classList.add('hidden');
  activeCropTarget = null;
}
document.getElementById('clearFrameBtn').addEventListener('click', () => {
  if (!activeCropTarget || activeCropTarget.mode !== 'catalog') return;
  PHOTOS[activeCropTarget.key][activeCropTarget.index] = null;
  markDirty(activeCropTarget.key);
  closeCropModal();
  renderGrid();
});
document.getElementById('cropConfirm').addEventListener('click', () => {
  if (!cropper || !activeCropTarget) return;
  if (activeCropTarget.mode === 'catalog') {
    const canvas = cropper.getCroppedCanvas({ width: TILE_WIDTH, height: TILE_HEIGHT, imageSmoothingQuality: 'high' });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    const number = activeCropTarget.parsedNumber || photoNumberLabel(
      CATEGORIES.find(c => c.key === activeCropTarget.key), activeCropTarget.index, null);
    PHOTOS[activeCropTarget.key][activeCropTarget.index] = { src: dataUrl, number, updated: new Date().toISOString() };
    markDirty(activeCropTarget.key);
    closeCropModal();
    renderGrid();
  } else {
    // design-layer upload: keep it small & lower quality on purpose (per instructions)
    const natW = cropper.getData().width, natH = cropper.getData().height;
    const outW = Math.min(DESIGN_LAYER_MAX_W, natW);
    const outH = Math.round(outW * (natH / natW));
    const canvas = cropper.getCroppedCanvas({ width: outW, height: outH, imageSmoothingQuality: 'medium' });
    const dataUrl = canvas.toDataURL('image/jpeg', 0.55);
    addImageLayer(dataUrl, outW, outH);
    closeCropModal();
  }
});

// ---- sub-admin unlock: click the top (Vintage Hub) logo 5 times -----------

document.getElementById('avatarWrap').addEventListener('click', () => {
  if (subAdminMode || adminMode) return; // already unlocked, nothing more to do here
  logoClickCount++;
  clearTimeout(logoClickTimer);
  logoClickTimer = setTimeout(() => { logoClickCount = 0; }, 1800);

  if (logoClickCount >= 5) {
    logoClickCount = 0;
    resetSubAdminModal();
    document.getElementById('subAdminModal').classList.remove('hidden');
  }
});

// ---- admin unlock: click the "Powered by AAKRITI" footer logo 10 times ----

let poweredByClickCount = 0, poweredByClickTimer = null;
document.getElementById('poweredByWrap').addEventListener('click', () => {
  if (adminMode) return;
  poweredByClickCount++;
  clearTimeout(poweredByClickTimer);
  poweredByClickTimer = setTimeout(() => { poweredByClickCount = 0; }, 1800);

  if (poweredByClickCount >= 10) {
    poweredByClickCount = 0;
    document.getElementById('subAdminModal').classList.add('hidden');
    resetLoginModal();
    document.getElementById('loginModal').classList.remove('hidden');
  }
});

function resetLoginModal() {
  document.getElementById('loginStep1').classList.remove('hidden');
  document.getElementById('loginStep2').classList.add('hidden');
  document.getElementById('loginError1').classList.add('hidden');
  document.getElementById('loginError2').classList.add('hidden');
  document.getElementById('loginPassword').value = '';
  document.getElementById('loginAnswer').value = '';
}
document.getElementById('loginCancel').addEventListener('click', () => {
  document.getElementById('loginModal').classList.add('hidden');
  resetLoginModal();
});
document.getElementById('loginBack').addEventListener('click', () => {
  document.getElementById('loginStep2').classList.add('hidden');
  document.getElementById('loginStep1').classList.remove('hidden');
  document.getElementById('loginError2').classList.add('hidden');
  document.getElementById('loginAnswer').value = '';
});
document.getElementById('loginSubmit').addEventListener('click', attemptStep1);
document.getElementById('loginPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptStep1(); });
document.getElementById('loginSubmit2').addEventListener('click', attemptStep2);
document.getElementById('loginAnswer').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptStep2(); });

async function attemptStep1() {
  const password = document.getElementById('loginPassword').value;
  const errBox = document.getElementById('loginError1');
  errBox.classList.add('hidden');
  if (!password) { errBox.textContent = 'Enter the admin password.'; errBox.classList.remove('hidden'); return; }
  const hash = await sha256Hex(password);
  if (hash !== ADMIN_PASSWORD_HASH) { errBox.textContent = 'Incorrect password.'; errBox.classList.remove('hidden'); return; }
  document.getElementById('loginStep1').classList.add('hidden');
  document.getElementById('loginStep2').classList.remove('hidden');
  document.getElementById('loginAnswer').focus();
}
async function attemptStep2() {
  const answer = document.getElementById('loginAnswer').value.trim().toLowerCase();
  const errBox = document.getElementById('loginError2');
  errBox.classList.add('hidden');
  if (!answer) { errBox.textContent = 'Enter an answer.'; errBox.classList.remove('hidden'); return; }
  const hash = await sha256Hex(answer);
  if (hash !== ADMIN_ANSWER_HASH) { errBox.textContent = 'Incorrect answer.'; errBox.classList.remove('hidden'); return; }

  subAdminMode = false;
  sessionStorage.removeItem(SUBADMIN_SESSION_KEY);
  adminMode = true;
  sessionStorage.setItem(SESSION_KEY, '1');
  document.getElementById('loginModal').classList.add('hidden');
  resetLoginModal();
  enterAdminBar('admin');
  renderDashboard();
  showScreen('adminDashboardScreen');
}

// ---- sub-admin login (password + code, photo-editing only) ---------------

function resetSubAdminModal() {
  document.getElementById('subAdminStep1').classList.remove('hidden');
  document.getElementById('subAdminStep2').classList.add('hidden');
  document.getElementById('subAdminError1').classList.add('hidden');
  document.getElementById('subAdminError2').classList.add('hidden');
  document.getElementById('subAdminPassword').value = '';
  document.getElementById('subAdminCode').value = '';
}
document.getElementById('subAdminCancel').addEventListener('click', () => {
  document.getElementById('subAdminModal').classList.add('hidden');
  resetSubAdminModal();
});
document.getElementById('subAdminBack').addEventListener('click', () => {
  document.getElementById('subAdminStep2').classList.add('hidden');
  document.getElementById('subAdminStep1').classList.remove('hidden');
  document.getElementById('subAdminError2').classList.add('hidden');
  document.getElementById('subAdminCode').value = '';
});
document.getElementById('subAdminSubmit').addEventListener('click', attemptSubAdminStep1);
document.getElementById('subAdminPassword').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptSubAdminStep1(); });
document.getElementById('subAdminSubmit2').addEventListener('click', attemptSubAdminStep2);
document.getElementById('subAdminCode').addEventListener('keydown', (e) => { if (e.key === 'Enter') attemptSubAdminStep2(); });

async function attemptSubAdminStep1() {
  const password = document.getElementById('subAdminPassword').value;
  const errBox = document.getElementById('subAdminError1');
  errBox.classList.add('hidden');
  if (!password) { errBox.textContent = 'Enter the sub-admin password.'; errBox.classList.remove('hidden'); return; }
  const hash = await sha256Hex(password);
  if (hash !== SUBADMIN_PASSWORD_HASH) { errBox.textContent = 'Incorrect password.'; errBox.classList.remove('hidden'); return; }
  document.getElementById('subAdminStep1').classList.add('hidden');
  document.getElementById('subAdminStep2').classList.remove('hidden');
  document.getElementById('subAdminCode').focus();
}
async function attemptSubAdminStep2() {
  const code = document.getElementById('subAdminCode').value.trim();
  const errBox = document.getElementById('subAdminError2');
  errBox.classList.add('hidden');
  if (!code) { errBox.textContent = 'Enter the code.'; errBox.classList.remove('hidden'); return; }
  const hash = await sha256Hex(code);
  if (hash !== SUBADMIN_CODE_HASH) { errBox.textContent = 'Incorrect code.'; errBox.classList.remove('hidden'); return; }

  subAdminMode = true;
  sessionStorage.setItem(SUBADMIN_SESSION_KEY, '1');
  document.getElementById('subAdminModal').classList.add('hidden');
  resetSubAdminModal();
  enterAdminBar('subadmin');
  goHome();
}

// ---- shared admin-bar setup -------------------------------------------

function enterAdminBar(role) {
  document.getElementById('adminBar').classList.remove('hidden');
  document.getElementById('dashboardBtn').classList.toggle('hidden', role !== 'admin');
  document.getElementById('adminBarStatus').textContent = role === 'admin' ? 'Admin mode' : 'Sub-admin mode — photo editing only';
  updateSaveStatus();
}

function updateSaveStatus() {
  const el = document.getElementById('saveStatus');
  if (!el) return;
  el.textContent = dirtyKeys.size > 0
    ? `${dirtyKeys.size} category file${dirtyKeys.size > 1 ? 's' : ''} changed — download & upload to GitHub`
    : 'Nothing to publish — GitHub is up to date';
}

function exitAdmin() {
  adminMode = false;
  subAdminMode = false;
  sessionStorage.removeItem(SESSION_KEY);
  sessionStorage.removeItem(SUBADMIN_SESSION_KEY);
  document.getElementById('adminBar').classList.add('hidden');
  goHome();
}
document.getElementById('logoutBtn').addEventListener('click', exitAdmin);
document.getElementById('dashLogoutBtn').addEventListener('click', exitAdmin);
document.getElementById('dashboardBtn').addEventListener('click', () => { renderDashboard(); showScreen('adminDashboardScreen'); });
document.getElementById('manageCatalogBtn').addEventListener('click', goHome);

// ---- WhatsApp CTA on home --------------------------------------------

document.getElementById('waContactBtn').addEventListener('click', () => logEvent('waContact', {}));

// ---- designer: choose side ------------------------------------------

let designerState = {
  back: { layers: [], confirmed: false, screenshot: null },
  front: { layers: [], confirmed: false, screenshot: null },
};
let activeSide = 'back';

document.getElementById('createDesignBtn').addEventListener('click', () => {
  logEvent('createDesignStart', {});
  renderDesignerChoose();
  showScreen('designerChooseScreen');
});
function renderDesignerChoose() {
  document.getElementById('backDoneTag').classList.toggle('hidden', !designerState.back.confirmed);
  document.getElementById('frontDoneTag').classList.toggle('hidden', !designerState.front.confirmed);
  document.getElementById('goToOrderBtn').disabled = !(designerState.back.confirmed || designerState.front.confirmed);
}
document.getElementById('chooseBack').addEventListener('click', () => openDesignerCanvas('back'));
document.getElementById('chooseFront').addEventListener('click', () => openDesignerCanvas('front'));
document.getElementById('goToOrderBtn').addEventListener('click', () => { renderOrderSummary(); showScreen('orderSummaryScreen'); });

function openDesignerCanvas(side) {
  activeSide = side;
  document.getElementById('designerSideTitle').textContent = side === 'back' ? 'Back' : 'Front';
  document.getElementById('tshirtSvgBack').classList.toggle('hidden', side !== 'back');
  document.getElementById('tshirtSvgFront').classList.toggle('hidden', side !== 'front');
  renderDesignerLayers();
  showScreen('designerCanvasScreen');
}

// ---- designer: canvas layers ------------------------------------------

function currentLayers() { return designerState[activeSide].layers; }

function renderDesignerLayers() {
  const stage = document.getElementById('designerStage');
  stage.querySelectorAll('.designer-layer').forEach(el => el.remove());
  currentLayers().forEach(layer => stage.appendChild(buildLayerEl(layer)));
  const imgCount = currentLayers().filter(l => l.type === 'image').length;
  document.getElementById('layerCount').textContent = `Images: ${imgCount}/${MAX_IMAGE_LAYERS}`;
  document.getElementById('addImageBtn').disabled = imgCount >= MAX_IMAGE_LAYERS;
}

function buildLayerEl(layer) {
  const el = document.createElement('div');
  el.className = 'designer-layer' + (layer.type === 'text' ? ' text-layer' : '');
  el.style.left = layer.x + '%';
  el.style.top = layer.y + '%';
  if (layer.type === 'image') {
    el.style.width = layer.w + '%';
    el.style.height = layer.h + '%';
    const img = document.createElement('img');
    img.src = layer.src;
    el.appendChild(img);
    const resize = document.createElement('div');
    resize.className = 'layer-resize';
    resize.addEventListener('pointerdown', (e) => startResize(e, layer, el));
    el.appendChild(resize);
  } else {
    el.textContent = layer.text;
    el.style.fontSize = layer.fontSize + 'px';
    const ctl = document.createElement('div');
    ctl.className = 'layer-fontctl';
    const minus = document.createElement('button'); minus.textContent = 'A-';
    const plus = document.createElement('button'); plus.textContent = 'A+';
    minus.addEventListener('click', (e) => { e.stopPropagation(); layer.fontSize = Math.max(10, layer.fontSize - 3); el.style.fontSize = layer.fontSize + 'px'; });
    plus.addEventListener('click', (e) => { e.stopPropagation(); layer.fontSize = Math.min(60, layer.fontSize + 3); el.style.fontSize = layer.fontSize + 'px'; });
    ctl.appendChild(minus); ctl.appendChild(plus);
    el.appendChild(ctl);
  }
  const del = document.createElement('button');
  del.className = 'layer-del';
  del.textContent = '×';
  del.addEventListener('click', (e) => {
    e.stopPropagation();
    const idx = currentLayers().indexOf(layer);
    if (idx > -1) currentLayers().splice(idx, 1);
    renderDesignerLayers();
  });
  el.appendChild(del);
  el.addEventListener('pointerdown', (e) => startDrag(e, layer, el));
  return el;
}

function startDrag(e, layer, el) {
  if (e.target.closest('.layer-del') || e.target.closest('.layer-resize') || e.target.closest('.layer-fontctl')) return;
  e.preventDefault();
  const stage = document.getElementById('designerStage');
  const stageRect = stage.getBoundingClientRect();
  const startX = e.clientX, startY = e.clientY;
  const startLeft = layer.x, startTop = layer.y;
  el.classList.add('dragging');
  function onMove(ev) {
    const dxPct = ((ev.clientX - startX) / stageRect.width) * 100;
    const dyPct = ((ev.clientY - startY) / stageRect.height) * 100;
    layer.x = Math.min(95, Math.max(-5, startLeft + dxPct));
    layer.y = Math.min(95, Math.max(-5, startTop + dyPct));
    el.style.left = layer.x + '%';
    el.style.top = layer.y + '%';
  }
  function onUp() {
    el.classList.remove('dragging');
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function startResize(e, layer, el) {
  e.preventDefault();
  e.stopPropagation();
  const stage = document.getElementById('designerStage');
  const stageRect = stage.getBoundingClientRect();
  const startX = e.clientX, startY = e.clientY;
  const startW = layer.w, startH = layer.h;
  function onMove(ev) {
    const dwPct = ((ev.clientX - startX) / stageRect.width) * 100;
    const dhPct = ((ev.clientY - startY) / stageRect.height) * 100;
    layer.w = Math.max(8, Math.min(90, startW + dwPct));
    layer.h = Math.max(8, Math.min(90, startH + dhPct));
    el.style.width = layer.w + '%';
    el.style.height = layer.h + '%';
  }
  function onUp() {
    document.removeEventListener('pointermove', onMove);
    document.removeEventListener('pointerup', onUp);
  }
  document.addEventListener('pointermove', onMove);
  document.addEventListener('pointerup', onUp);
}

function addImageLayer(src, natW, natH) {
  const aspect = natH / natW;
  const w = 40; // % of stage width
  const h = Math.min(80, w * aspect * (300 / 380)); // rough stage aspect correction
  currentLayers().push({ id: Date.now() + Math.random(), type: 'image', src, x: 30, y: 30, w, h: h || 30 });
  renderDesignerLayers();
}

document.getElementById('addImageBtn').addEventListener('click', () => {
  if (currentLayers().filter(l => l.type === 'image').length >= MAX_IMAGE_LAYERS) return;
  openPickerModal();
});
document.getElementById('addTextBtn').addEventListener('click', () => {
  document.getElementById('textInput').value = '';
  document.getElementById('textModal').classList.remove('hidden');
  document.getElementById('textInput').focus();
});
document.getElementById('textCancel').addEventListener('click', () => document.getElementById('textModal').classList.add('hidden'));
document.getElementById('textConfirm').addEventListener('click', () => {
  const text = document.getElementById('textInput').value.trim();
  if (!text) { document.getElementById('textModal').classList.add('hidden'); return; }
  currentLayers().push({ id: Date.now() + Math.random(), type: 'text', text, x: 25, y: 45, fontSize: 22 });
  document.getElementById('textModal').classList.add('hidden');
  renderDesignerLayers();
});

// ---- picker modal: catalog vs upload ------------------------------------

function openPickerModal() {
  document.getElementById('pickerModal').classList.remove('hidden');
  document.getElementById('pickerCatsView').classList.remove('hidden');
  document.getElementById('pickerGridView').classList.add('hidden');
  const list = document.getElementById('pickerCatList');
  list.innerHTML = '';

  const uploadBtn = document.createElement('button');
  uploadBtn.className = 'picker-cat-btn';
  uploadBtn.innerHTML = '<span>📤 Upload your own photo</span><span>›</span>';
  uploadBtn.addEventListener('click', () => {
    document.getElementById('pickerModal').classList.add('hidden');
    openCropModal({ mode: 'designLayer' });
  });
  list.appendChild(uploadBtn);

  CATEGORIES.forEach(cat => {
    const btn = document.createElement('button');
    btn.className = 'picker-cat-btn';
    btn.innerHTML = `<span>${cat.label}</span><span>›</span>`;
    btn.addEventListener('click', () => openPickerGrid(cat));
    list.appendChild(btn);
  });
}
function openPickerGrid(cat) {
  document.getElementById('pickerCatsView').classList.add('hidden');
  document.getElementById('pickerGridView').classList.remove('hidden');
  const grid = document.getElementById('pickerGrid');
  grid.innerHTML = '';
  PHOTOS[cat.key].forEach((slot, index) => {
    if (!slot) return;
    const tile = document.createElement('div');
    tile.className = 'picker-tile';
    const img = document.createElement('img');
    img.src = slot.src;
    tile.appendChild(img);
    tile.addEventListener('click', () => {
      document.getElementById('pickerModal').classList.add('hidden');
      addImageLayer(slot.src, TILE_WIDTH, TILE_HEIGHT);
    });
    grid.appendChild(tile);
  });
  if (!grid.children.length) {
    grid.innerHTML = '<p class="dash-empty">No photos in this category yet.</p>';
  }
}
document.getElementById('pickerBackToCats').addEventListener('click', () => {
  document.getElementById('pickerCatsView').classList.remove('hidden');
  document.getElementById('pickerGridView').classList.add('hidden');
});
document.getElementById('pickerCancel').addEventListener('click', () => document.getElementById('pickerModal').classList.add('hidden'));

// ---- confirm a side -----------------------------------------------------

document.getElementById('confirmSideBtn').addEventListener('click', async () => {
  const stage = document.getElementById('designerStage');
  let shotUrl = null;
  try {
    const canvas = await html2canvas(stage, { backgroundColor: '#0e1220', scale: 1.5 });
    shotUrl = canvas.toDataURL('image/jpeg', 0.7);
  } catch (e) { /* html2canvas unavailable/failed — continue without a screenshot */ }

  designerState[activeSide].confirmed = true;
  designerState[activeSide].screenshot = shotUrl;

  if (shotUrl) {
    saveDesign({ id: Date.now(), side: activeSide, image: shotUrl, createdAt: new Date().toISOString() });
  }
  logEvent('confirmDesign', { side: activeSide });

  renderDesignerChoose();
  showScreen('designerChooseScreen');
});

// ---- order summary + send ------------------------------------------------

let lastOrder = null;

function makeRef() {
  const d = new Date();
  const ymd = d.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.floor(1000 + Math.random() * 9000);
  return `VH-${ymd}-${rand}`;
}
function collectionWindow() {
  const now = new Date();
  const from = new Date(now.getTime() + 24 * 3600 * 1000);
  const to = new Date(now.getTime() + 48 * 3600 * 1000);
  const fmt = (d) => d.toLocaleString(undefined, { weekday: 'short', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
  return { from, to, text: `${fmt(from)} – ${fmt(to)}` };
}

function renderOrderSummary() {
  const ref = makeRef();
  const win = collectionWindow();
  const sides = [];
  if (designerState.back.confirmed) sides.push('Back');
  if (designerState.front.confirmed) sides.push('Front');

  lastOrder = { ref, collection: win, sides };

  const box = document.getElementById('summaryBox');
  box.innerHTML = `
    <dl>
      <dt>Reference</dt><dd>${ref}</dd>
      <dt>Sides designed</dt><dd>${sides.join(' & ') || '—'}</dd>
      <dt>Collection window</dt><dd>${win.text}</dd>
    </dl>
    <div class="summary-shots" id="summaryShots"></div>`;
  const shots = document.getElementById('summaryShots');
  ['back', 'front'].forEach(side => {
    if (designerState[side].confirmed && designerState[side].screenshot) {
      const img = document.createElement('img');
      img.src = designerState[side].screenshot;
      shots.appendChild(img);
    }
  });
}

document.getElementById('sendOrderBtn').addEventListener('click', async () => {
  if (!lastOrder) renderOrderSummary();
  const { ref, collection, sides } = lastOrder;

  const lines = [
    'Hi Vintage Hub, I\'d like to place a custom design order.',
    `Reference: ${ref}`,
    `Sides: ${sides.join(' & ') || '—'}`,
    `Requested collection: ${collection.text}`,
    '(Design image attached — please check my WhatsApp message for the picture.)',
  ];
  const text = lines.join('\n');

  const images = [];
  for (const side of ['back', 'front']) {
    if (designerState[side].confirmed && designerState[side].screenshot) {
      images.push({ side, dataUrl: designerState[side].screenshot });
    }
  }

  // Save the order locally (this is effectively your order archive on this device)
  saveOrder({
    id: Date.now(), ref, createdAt: new Date().toISOString(),
    collectionFrom: collection.from, collectionTo: collection.to,
    sides, images,
  });
  logEvent('placeOrder', { ref });

  // Always go straight to WhatsApp with this number — a wa.me link can only
  // carry text, not attach a file, so if there's a design image we download
  // it first (instantly, no extra tap) and ask the customer to attach it.
  images.forEach((im) => {
    const a = document.createElement('a');
    a.href = im.dataUrl;
    a.download = `vintagehub-${im.side}-${ref}.jpg`;
    document.body.appendChild(a);
    a.click();
    a.remove();
  });
  const finalText = images.length
    ? text + '\n\n(Attaching my design image(s) that just downloaded.)'
    : text;
  window.location.href = buildWaLink(finalText);
});

// ---- admin dashboard ------------------------------------------------

function renderDashboard() {
  const a = loadAnalytics();
  const now = Date.now();
  const DAY = 86400000;
  const startOfDay = new Date(); startOfDay.setHours(0, 0, 0, 0);
  const startOfWeek = new Date(startOfDay); startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(startOfDay.getFullYear(), startOfDay.getMonth(), 1);

  const total = a.events.length;
  const today = a.events.filter(e => e.t >= startOfDay.getTime()).length;
  const week = a.events.filter(e => e.t >= startOfWeek.getTime()).length;
  const month = a.events.filter(e => e.t >= startOfMonth.getTime()).length;
  const orders = loadOrders();
  const designs = loadDesigns();

  const grid = document.getElementById('dashStatsGrid');
  grid.innerHTML = '';
  [
    ['Total activity', total], ['Today', today], ['This week', week], ['This month', month],
    ['Orders placed', orders.length], ['Designs confirmed', designs.length],
  ].forEach(([lbl, num]) => {
    const card = document.createElement('div');
    card.className = 'dash-card';
    card.innerHTML = `<div class="num">${num}</div><div class="lbl">${lbl}</div>`;
    grid.appendChild(card);
  });

  // most clicked photo
  const photoCounts = {};
  a.events.filter(e => e.type === 'photoClick').forEach(e => {
    const key = `${e.cat}:${e.index}`;
    photoCounts[key] = photoCounts[key] || { count: 0, cat: e.cat, number: e.number };
    photoCounts[key].count++;
  });
  let topPhoto = null;
  Object.values(photoCounts).forEach(p => { if (!topPhoto || p.count > topPhoto.count) topPhoto = p; });
  const catLabel = (k) => (CATEGORIES.find(c => c.key === k) || {}).label || k;
  document.getElementById('dashMostClicked').innerHTML = topPhoto
    ? `Most clicked photo: <b>${catLabel(topPhoto.cat)} — Design ${topPhoto.number}</b> (${topPhoto.count} clicks)`
    : 'Most clicked photo: <b>no photo clicks yet</b>';

  // most viewed category
  const catCounts = {};
  a.events.filter(e => e.type === 'categoryView').forEach(e => { catCounts[e.cat] = (catCounts[e.cat] || 0) + 1; });
  let topCat = null;
  Object.entries(catCounts).forEach(([k, v]) => { if (!topCat || v > topCat.count) topCat = { key: k, count: v }; });
  document.getElementById('dashMostViewed').innerHTML = topCat
    ? `Most viewed category: <b>${catLabel(topCat.key)}</b> (${topCat.count} views)`
    : 'Most viewed category: <b>no views yet</b>';

  // orders bar
  const ordersList = document.getElementById('dashOrdersList');
  ordersList.innerHTML = '';
  if (!orders.length) {
    ordersList.innerHTML = '<p class="dash-empty">No orders placed on this device yet.</p>';
  } else {
    orders.forEach(o => {
      const item = document.createElement('div');
      item.className = 'dash-item';
      const thumb = o.images && o.images[0] ? o.images[0].dataUrl : '';
      item.innerHTML = `
        ${thumb ? `<img src="${thumb}" alt="">` : ''}
        <div class="meta">
          <div class="ref">${o.ref}</div>
          <div class="when">${new Date(o.createdAt).toLocaleString()} · ${(o.sides || []).join(' & ') || 'catalog item'}</div>
        </div>`;
      ordersList.appendChild(item);
    });
  }

  // confirmed designs bar
  const designsList = document.getElementById('dashDesignsList');
  designsList.innerHTML = '';
  if (!designs.length) {
    designsList.innerHTML = '<p class="dash-empty">No confirmed designs on this device yet.</p>';
  } else {
    designs.forEach(d => {
      const item = document.createElement('div');
      item.className = 'dash-item';
      item.innerHTML = `
        <img src="${d.image}" alt="">
        <div class="meta">
          <div class="ref">${d.side === 'back' ? 'Back' : 'Front'} design</div>
          <div class="when">${new Date(d.createdAt).toLocaleString()}</div>
        </div>`;
      designsList.appendChild(item);
    });
  }
}

// ---- boot -------------------------------------------------------------

document.getElementById('mainLogoImg').src = LOGO_DATA_URI;
document.getElementById('aakritiLogoImg').src = AAKRITI_LOGO_URI;

loadPhotos();
logEvent('visit', {});
document.getElementById('waContactBtn').href = buildWaLink('Hi Vintage Hub, I\'d like to know more about your designs.');

if (sessionStorage.getItem(SESSION_KEY) === '1') {
  adminMode = true;
  enterAdminBar('admin');
  renderDashboard();
  showScreen('adminDashboardScreen');
} else if (sessionStorage.getItem(SUBADMIN_SESSION_KEY) === '1') {
  subAdminMode = true;
  enterAdminBar('subadmin');
  renderHome();
  showScreen('homeScreen');
} else {
  renderHome();
  showScreen('homeScreen');
}
