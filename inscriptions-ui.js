const INSCRIPTION_COURSES = [
  ['🇬🇧', 'Anglais technique', false],
  ['🧰', 'Microsoft Office (Word, Excel, PowerPoint)', false],
  ['📄', 'Word seulement', false],
  ['📈', 'Excel seulement', false],
  ['💻', 'Développement web (HTML, CSS, JS)', false],
  ['🌍', 'WordPress', false],
  ['🧾', 'Comptabilité générale', false],
  ['🗣️', 'Français et communication', false],
  ['🛠️', 'Maintenance informatique', false],
  ['🛒', 'E-commerce', false],
  ['🤖', "Outils de l'intelligence artificielle et fonctionnement", false],
  ['🎯', 'Orientation et coaching', true],
];

const WA_NUMBER = '212660837285';
const STATIC_DB_KEY = 'itc_inscriptions_db_v1';
const STATIC_AUTH_KEY = 'itc_inscriptions_admin_v1';

// Runtime mode: 'server' (Node.js API) or 'static' (GitHub Pages browser-only Web Crypto + ExcelJS)
let backendMode = 'server';

// Auth & crypto state kept strictly in memory (never in localStorage or sessionStorage)
let adminToken = null;
let adminEmail = null;
let staticPrivateKey = null; // CryptoKey (RSA-OAEP private key decrypted in memory)
let currentEncryptedState = true;
let rawPreviewVisible = false;

// Public registration form elements
const elInscForm = document.getElementById('inscForm');
const elInscNom = document.getElementById('inNom');
const elInscWa = document.getElementById('inWa');
const elInscMail = document.getElementById('inMail');
const elInscFopts = document.getElementById('inscFopts');
const elInscPersSub = document.getElementById('inscPersSub');
const elInscPersInfo = document.getElementById('inscPersInfo');
const elInscPopts = document.getElementById('inscPopts');
const elInscPrec = document.getElementById('inPrec');
const elInscRes = document.getElementById('inscRes');

// Admin panel elements
const elDbLoginBox = document.getElementById('dbLoginBox');
const elDbAuthHint = document.getElementById('dbAuthHint');
const elDbClaimWrap = document.getElementById('dbClaimWrap');
const elDbLoginWrap = document.getElementById('dbLoginWrap');
const elDbClaimForm = document.getElementById('dbClaimForm');
const elDbClaimPass = document.getElementById('dbClaimPass');
const elDbClaimConfirm = document.getElementById('dbClaimConfirm');
const elDbLoginForm = document.getElementById('dbLoginForm');
const elDbLoginPass = document.getElementById('dbLoginPass');

const elDbDashboard = document.getElementById('dbDashboard');
const elDbAdminEmail = document.getElementById('dbAdminEmail');
const elDbLogoutBtn = document.getElementById('dbLogoutBtn');
const elDbEncBadge = document.getElementById('dbEncBadge');
const elDbToggleEncBtn = document.getElementById('dbToggleEncBtn');
const elDbEnvHint = document.getElementById('dbEnvHint');
const elDbRefreshBtn = document.getElementById('dbRefreshBtn');
const elDbRawBtn = document.getElementById('dbRawBtn');
const elDbExcelBtn = document.getElementById('dbExcelBtn');
const elDbJsonDecBtn = document.getElementById('dbJsonDecBtn');
const elDbJsonRawBtn = document.getElementById('dbJsonRawBtn');
const elDbStatus = document.getElementById('dbStatus');
const elDbRawPre = document.getElementById('dbRawPre');
const elDbTableWrap = document.getElementById('dbTableWrap');
const elDbCount = document.getElementById('dbCount');

// Shared confirmation dialog
const elConfirmDialog = document.getElementById('gfConfirmDialog');
const elConfirmTitle = document.getElementById('gfConfirmTitle');
const elConfirmMsg = document.getElementById('gfConfirmMsg');
const elConfirmOk = document.getElementById('gfConfirmOk');
const elConfirmCancel = document.getElementById('gfConfirmCancel');

function askConfirmation({ title, message, confirmText = 'Confirmer' }) {
  return new Promise((resolve) => {
    if (!elConfirmDialog) {
      resolve(false);
      return;
    }
    elConfirmTitle.textContent = title;
    elConfirmMsg.textContent = message;
    elConfirmOk.textContent = confirmText;

    const cleanup = () => {
      elConfirmOk.removeEventListener('click', onOk);
      elConfirmCancel.removeEventListener('click', onCancel);
      elConfirmDialog.removeEventListener('cancel', onCancel);
    };
    const onOk = () => {
      cleanup();
      elConfirmDialog.close();
      resolve(true);
    };
    const onCancel = () => {
      cleanup();
      if (elConfirmDialog.open) elConfirmDialog.close();
      resolve(false);
    };
    elConfirmOk.addEventListener('click', onOk);
    elConfirmCancel.addEventListener('click', onCancel);
    elConfirmDialog.addEventListener('cancel', onCancel);
    elConfirmDialog.showModal();
  });
}

function setDbStatus(msg, isError = false) {
  if (!elDbStatus) return;
  elDbStatus.textContent = msg;
  elDbStatus.className = 'gf-status' + (isError ? ' err' : '');
  elDbStatus.hidden = !msg;
}

function setPublicResult(msg, isError = false, waHref = null) {
  if (!elInscRes) return;
  elInscRes.replaceChildren();
  elInscRes.className = 'gf-status' + (isError ? ' err' : '');
  if (!msg) {
    elInscRes.hidden = true;
    return;
  }
  const p = document.createElement('div');
  p.textContent = msg;
  elInscRes.appendChild(p);
  if (waHref) {
    const row = document.createElement('div');
    row.style.marginTop = '10px';
    const a = document.createElement('a');
    a.className = 'btn';
    a.style.cssText = 'background:#25d366;border-color:#25d366;color:#04200e';
    a.href = waHref;
    a.target = '_blank';
    a.rel = 'noopener';
    a.textContent = 'Confirmer aussi sur WhatsApp';
    row.appendChild(a);
    elInscRes.appendChild(row);
  }
  elInscRes.hidden = false;
}

function isValidWhatsApp(val) {
  const cleaned = val.replace(/[\s().-]/g, '');
  return /^\+?\d{9,15}$/.test(cleaned);
}

function sanitizeExcelCell(value) {
  const str = String(value ?? '');
  if (/^[=@\t\r]/.test(str) || (/^[+-]/.test(str) && !/^\+\d[\d\s().-]{6,}$/.test(str))) {
    return "'" + str;
  }
  return str;
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ===== Web Crypto helpers for GitHub Pages static mode (AES-256-GCM + RSA-OAEP + PBKDF2) =====
function bytesToB64(bytes) {
  let bin = '';
  const arr = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
  for (let i = 0; i < arr.length; i++) bin += String.fromCharCode(arr[i]);
  return btoa(bin);
}

function b64ToBytes(b64) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return arr;
}

async function deriveWrappingKey(password, saltBytes) {
  const enc = new TextEncoder();
  const baseKey = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, [
    'deriveKey',
  ]);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 150000, hash: 'SHA-256' },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

function readStaticAuth() {
  try {
    const raw = localStorage.getItem(STATIC_AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readStaticDb() {
  try {
    const raw = localStorage.getItem(STATIC_DB_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        version: 1,
        encrypted: Boolean(parsed.encrypted),
        updatedAt: parsed.updatedAt || new Date().toISOString(),
        records: Array.isArray(parsed.records) ? parsed.records : [],
      };
    }
  } catch {
    // fallback below
  }
  const initial = {
    version: 1,
    encrypted: true,
    updatedAt: new Date().toISOString(),
    records: [],
  };
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(initial));
  return initial;
}

function writeStaticDb(db) {
  db.updatedAt = new Date().toISOString();
  localStorage.setItem(STATIC_DB_KEY, JSON.stringify(db));
}

async function staticHybridEncrypt(payload, publicJwk) {
  const pubKey = await crypto.subtle.importKey(
    'jwk',
    publicJwk,
    { name: 'RSA-OAEP', hash: 'SHA-256' },
    false,
    ['encrypt']
  );
  const aesKey = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, [
    'encrypt',
  ]);
  const rawAes = new Uint8Array(await crypto.subtle.exportKey('raw', aesKey));
  const wrappedKey = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'RSA-OAEP' }, pubKey, rawAes)
  );
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const plainBytes = new TextEncoder().encode(JSON.stringify(payload));
  const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, aesKey, plainBytes);
  return {
    alg: 'rsa-oaep+aes-256-gcm',
    wrappedKey: bytesToB64(wrappedKey),
    iv: bytesToB64(iv),
    ciphertext: bytesToB64(new Uint8Array(cipherBuf)),
  };
}

async function staticHybridDecrypt(rec, privateKey) {
  const rawAes = await crypto.subtle.decrypt(
    { name: 'RSA-OAEP' },
    privateKey,
    b64ToBytes(rec.wrappedKey)
  );
  const aesKey = await crypto.subtle.importKey('raw', rawAes, { name: 'AES-GCM' }, false, [
    'decrypt',
  ]);
  const plainBuf = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(rec.iv) },
    aesKey,
    b64ToBytes(rec.ciphertext)
  );
  return JSON.parse(new TextDecoder().decode(plainBuf));
}

async function staticClaimPassword(password) {
  const keyPair = await crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true,
    ['encrypt', 'decrypt']
  );
  const publicJwk = await crypto.subtle.exportKey('jwk', keyPair.publicKey);
  const pkcs8 = new Uint8Array(await crypto.subtle.exportKey('pkcs8', keyPair.privateKey));

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const wrapKey = await deriveWrappingKey(password, salt);
  const encPrivate = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, wrapKey, pkcs8)
  );

  localStorage.setItem(
    STATIC_AUTH_KEY,
    JSON.stringify({
      email: 'cherkaoui.imaad@gmail.com',
      salt: bytesToB64(salt),
      iv: bytesToB64(iv),
      encPrivateKey: bytesToB64(encPrivate),
      publicJwk,
      claimedAt: new Date().toISOString(),
    })
  );

  staticPrivateKey = keyPair.privateKey;
  adminToken = 'static_mem_' + bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
  adminEmail = 'cherkaoui.imaad@gmail.com';
}

async function staticLoginPassword(password) {
  const auth = readStaticAuth();
  if (!auth) throw new Error('Aucun mot de passe administrateur configuré.');
  try {
    const wrapKey = await deriveWrappingKey(password, b64ToBytes(auth.salt));
    const pkcs8 = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: b64ToBytes(auth.iv) },
      wrapKey,
      b64ToBytes(auth.encPrivateKey)
    );
    staticPrivateKey = await crypto.subtle.importKey(
      'pkcs8',
      pkcs8,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false,
      ['decrypt']
    );
    adminToken = 'static_mem_' + bytesToB64(crypto.getRandomValues(new Uint8Array(16)));
    adminEmail = auth.email || 'cherkaoui.imaad@gmail.com';
  } catch {
    throw new Error('Mot de passe administrateur incorrect.');
  }
}

async function staticAddInscription(data) {
  const db = readStaticDb();
  const auth = readStaticAuth();
  const now = new Date();
  const rand = Math.floor(1000 + Math.random() * 9000);
  const id = 'INS-' + now.toISOString().slice(2, 10).replace(/-/g, '') + '-' + rand;
  const createdAt = now.toISOString();

  let entry;
  if (db.encrypted && auth?.publicJwk) {
    const enc = await staticHybridEncrypt(data, auth.publicJwk);
    entry = { id, createdAt, encrypted: true, ...enc };
  } else {
    entry = { id, createdAt, encrypted: false, data };
  }

  db.records.unshift(entry);
  writeStaticDb(db);
  return { id, createdAt, encrypted: entry.encrypted };
}

async function staticListDecrypted() {
  const db = readStaticDb();
  const records = [];
  for (const rec of db.records) {
    if (!rec.encrypted) {
      records.push({
        id: rec.id,
        createdAt: rec.createdAt,
        encrypted: false,
        data: rec.data || {},
      });
    } else if (staticPrivateKey) {
      try {
        const data = await staticHybridDecrypt(rec, staticPrivateKey);
        records.push({ id: rec.id, createdAt: rec.createdAt, encrypted: true, data });
      } catch {
        records.push({
          id: rec.id,
          createdAt: rec.createdAt,
          encrypted: true,
          data: { nom: '[Chiffré]', whatsapp: '', email: '', formations: [], type: '', mode: '', precisions: '' },
        });
      }
    }
  }
  return {
    encrypted: db.encrypted,
    envKeyConfigured: true,
    updatedAt: db.updatedAt,
    count: records.length,
    records,
  };
}

async function staticSetEncryption(enabled) {
  const auth = readStaticAuth();
  if (!auth?.publicJwk || !staticPrivateKey) {
    throw new Error('Reconnectez-vous pour modifier le chiffrement.');
  }
  const db = readStaticDb();
  const nextRecords = [];
  for (const rec of db.records) {
    if (rec.encrypted === enabled) {
      nextRecords.push(rec);
    } else if (enabled) {
      const enc = await staticHybridEncrypt(rec.data || {}, auth.publicJwk);
      nextRecords.push({ id: rec.id, createdAt: rec.createdAt, encrypted: true, ...enc });
    } else {
      const data = await staticHybridDecrypt(rec, staticPrivateKey);
      nextRecords.push({ id: rec.id, createdAt: rec.createdAt, encrypted: false, data });
    }
  }
  db.encrypted = Boolean(enabled);
  db.records = nextRecords;
  writeStaticDb(db);
}

async function staticExportExcel() {
  if (typeof window.ExcelJS === 'undefined') {
    throw new Error('Bibliothèque Excel indisponible. Vérifiez votre connexion Internet.');
  }
  const { records } = await staticListDecrypted();
  const wb = new window.ExcelJS.Workbook();
  wb.creator = 'ITCACADEMY';
  wb.created = new Date();
  const ws = wb.addWorksheet('Inscriptions ITCACADEMY', {
    views: [{ state: 'frozen', ySplit: 1 }],
  });
  ws.columns = [
    { header: 'Référence', key: 'id', width: 18 },
    { header: "Date d'inscription", key: 'date', width: 20 },
    { header: 'Nom et prénom', key: 'nom', width: 26 },
    { header: 'WhatsApp', key: 'whatsapp', width: 20 },
    { header: 'E-mail', key: 'email', width: 28 },
    { header: 'Formations choisies', key: 'formations', width: 42 },
    { header: 'Type de formation', key: 'type', width: 18 },
    { header: 'Mode', key: 'mode', width: 14 },
    { header: 'Précisions', key: 'precisions', width: 36 },
    { header: 'Stockage JSON', key: 'stockage', width: 18 },
  ];
  const headerRow = ws.getRow(1);
  headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
  headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0A1330' } };
  headerRow.height = 24;

  records.forEach((rec, idx) => {
    const d = rec.data || {};
    const row = ws.addRow({
      id: sanitizeExcelCell(rec.id),
      date: sanitizeExcelCell(rec.createdAt ? new Date(rec.createdAt).toLocaleString('fr-FR') : ''),
      nom: sanitizeExcelCell(d.nom || ''),
      whatsapp: sanitizeExcelCell(d.whatsapp || ''),
      email: sanitizeExcelCell(d.email || ''),
      formations: sanitizeExcelCell(Array.isArray(d.formations) ? d.formations.join(', ') : ''),
      type: sanitizeExcelCell(d.type || ''),
      mode: sanitizeExcelCell(d.mode || ''),
      precisions: sanitizeExcelCell(d.precisions || ''),
      stockage: rec.encrypted ? 'Chiffré (AES-256)' : 'JSON standard',
    });
    row.eachCell((cell) => {
      cell.numFmt = '@';
      cell.alignment = { vertical: 'top', wrapText: true };
    });
    if (idx % 2 === 1) {
      row.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF4F7FF' } };
    }
  });
  ws.autoFilter = { from: 'A1', to: 'J1' };
  const buf = await wb.xlsx.writeBuffer();
  const dateStamp = new Date().toISOString().slice(0, 10);
  triggerBlobDownload(
    new Blob([buf], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    }),
    `Inscriptions-ITCACADEMY-${dateStamp}.xlsx`
  );
}

// ===== Populate public registration checkboxes =====
function buildCourseCheckboxes(container, inputName) {
  if (!container) return;
  container.replaceChildren();
  INSCRIPTION_COURSES.forEach(([, name, isFree]) => {
    const label = document.createElement('label');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.name = inputName;
    cb.value = name;
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + name + ' '));
    if (isFree) {
      const badge = document.createElement('span');
      badge.className = 'free';
      badge.textContent = 'gratuit';
      label.appendChild(badge);
    }
    container.appendChild(label);
  });
}

buildCourseCheckboxes(elInscFopts, 'ifm');
buildCourseCheckboxes(elInscPopts, 'ipfm');

function updateInscPersInfo() {
  if (!elInscPersInfo) return;
  const paid = [...document.querySelectorAll('[name="ipfm"]:checked')].filter(
    (i) => !i.value.startsWith('Orientation')
  ).length;
  elInscPersInfo.textContent =
    paid + ' / 3 modules sélectionnés (choisissez 2 à 3 formations pour le parcours personnalisé).';
}

if (elInscPopts) {
  elInscPopts.addEventListener('change', (e) => {
    if (e.target.name !== 'ipfm') return;
    const paidChecked = [...document.querySelectorAll('[name="ipfm"]:checked')].filter(
      (i) => !i.value.startsWith('Orientation')
    );
    if (paidChecked.length > 3 && !e.target.value.startsWith('Orientation')) {
      e.target.checked = false;
      if (elInscPersInfo) {
        elInscPersInfo.textContent = 'Maximum 3 modules autorisés pour une formation personnalisée.';
      }
      return;
    }
    updateInscPersInfo();
  });
}

function syncInscTypeUI() {
  const checked = document.querySelector('[name="ityp"]:checked');
  const isPers = checked && checked.value === 'Personnalisée';
  if (elInscPersSub) {
    elInscPersSub.hidden = !isPers;
    if (isPers) updateInscPersInfo();
  }
}

document.querySelectorAll('[name="ityp"]').forEach((r) => {
  r.addEventListener('change', syncInscTypeUI);
});
syncInscTypeUI();

// ===== Public registration form submit =====
if (elInscForm) {
  elInscForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setPublicResult('');

    const nom = elInscNom.value.trim();
    const whatsapp = elInscWa.value.trim();
    const email = elInscMail.value.trim();
    const type = document.querySelector('[name="ityp"]:checked')?.value || 'En groupe';
    const mode = document.querySelector('[name="imod"]:checked')?.value || 'À distance';
    const precisions = elInscPrec.value.trim();

    if (nom.length < 2) {
      setPublicResult('Veuillez saisir votre nom et prénom.', true);
      elInscNom.focus();
      return;
    }
    if (!whatsapp || !isValidWhatsApp(whatsapp)) {
      setPublicResult(
        'Veuillez saisir un numéro de téléphone WhatsApp valide (ex. 0660 83 72 85 ou +212660837285).',
        true
      );
      elInscWa.focus();
      return;
    }

    const formations =
      type === 'Personnalisée'
        ? [...document.querySelectorAll('[name="ipfm"]:checked')].map((i) => i.value)
        : [...document.querySelectorAll('[name="ifm"]:checked')].map((i) => i.value);

    if (!formations.length) {
      setPublicResult(
        type === 'Personnalisée'
          ? 'Veuillez cocher 2 à 3 formations dans le sous-menu « Formation personnalisée ».'
          : 'Veuillez sélectionner au moins une formation.',
        true
      );
      return;
    }

    if (type === 'Personnalisée') {
      const paid = formations.filter((f) => !f.startsWith('Orientation')).length;
      if (paid < 2 || paid > 3) {
        setPublicResult('Formation personnalisée : choisissez 2 ou 3 modules (maximum 3).', true);
        return;
      }
    }

    const submitBtn = elInscForm.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const payload = { nom, whatsapp, email, formations, type, mode, precisions };
      let data;

      if (backendMode === 'server') {
        const res = await fetch('/api/inscriptions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const ct = res.headers.get('content-type') || '';
        if (res.status === 404 || !ct.includes('application/json')) {
          backendMode = 'static';
          data = await staticAddInscription(payload);
        } else {
          data = await res.json();
          if (!res.ok) throw new Error(data.error || "Erreur lors de l'envoi de l'inscription.");
        }
      } else {
        data = await staticAddInscription(payload);
      }

      const waText =
        '*Nouvelle inscription ITCACADEMY (www.itcacademy.online)*\nRéf : ' +
        data.id +
        '\nClient : ' +
        nom +
        '\nWhatsApp : ' +
        whatsapp +
        (email ? '\nE-mail : ' + email : '') +
        '\nFormations : ' +
        formations.join(', ') +
        '\nType : ' +
        type +
        '\nMode : ' +
        mode +
        (precisions ? '\nPrécisions : ' + precisions : '');
      const waHref = 'https://wa.me/' + WA_NUMBER + '?text=' + encodeURIComponent(waText);

      setPublicResult(
        `Merci ${nom} ! Votre inscription (${data.id}) a bien été enregistrée${
          data.encrypted ? ' et chiffrée de manière sécurisée' : ''
        }. Notre équipe vous contactera sur WhatsApp.`,
        false,
        backendMode === 'static' ? waHref : null
      );
      elInscForm.reset();
      syncInscTypeUI();

      if (adminToken) {
        loadInscriptions();
      }
    } catch (err) {
      setPublicResult(err?.message || "Impossible d'enregistrer votre inscription.", true);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

// ===== Admin Panel Logic =====
function updateAdminView() {
  const isLoggedIn = Boolean(adminToken);
  if (elDbLoginBox) elDbLoginBox.hidden = isLoggedIn;
  if (elDbDashboard) elDbDashboard.hidden = !isLoggedIn;
  if (elDbAdminEmail) {
    elDbAdminEmail.textContent = isLoggedIn ? adminEmail || 'cherkaoui.imaad@gmail.com' : '';
  }
}

async function fetchAuthStatus() {
  try {
    const res = await fetch('/api/admin/auth-status');
    const ct = res.headers.get('content-type') || '';
    if (!res.ok || !ct.includes('application/json')) {
      throw new Error('Static host');
    }
    backendMode = 'server';
    const st = await res.json();
    const needsFirstRunClaim = !st.envConfigured && !st.passwordClaimed;
    if (elDbClaimWrap) elDbClaimWrap.hidden = !needsFirstRunClaim;
    if (elDbLoginWrap) elDbLoginWrap.hidden = needsFirstRunClaim;
    if (elDbAuthHint) {
      elDbAuthHint.textContent = needsFirstRunClaim
        ? `Accès réservé à l'administrateur. Définissez votre mot de passe administrateur pour le premier accès.`
        : `Accès strictement réservé à l'administrateur par mot de passe.`;
    }
  } catch {
    // GitHub Pages static mode
    backendMode = 'static';
    const claimed = Boolean(readStaticAuth());
    if (elDbClaimWrap) elDbClaimWrap.hidden = claimed;
    if (elDbLoginWrap) elDbLoginWrap.hidden = !claimed;
    if (elDbAuthHint) {
      elDbAuthHint.textContent = claimed
        ? `Accès strictement réservé à l'administrateur par mot de passe (chiffrement AES-256-GCM + RSA-OAEP).`
        : `Premier accès administrateur : définissez votre mot de passe (8 caractères minimum) pour activer le chiffrement de la base JSON.`;
    }
  }
}

function renderInscriptionsTable(records) {
  if (!elDbTableWrap) return;
  elDbTableWrap.replaceChildren();

  if (!records.length) {
    const p = document.createElement('p');
    p.className = 'gf-note';
    p.textContent = 'Aucune inscription enregistrée dans la base de données JSON pour le moment.';
    elDbTableWrap.appendChild(p);
    return;
  }

  const table = document.createElement('table');
  table.className = 'db-table';

  const thead = document.createElement('thead');
  const hr = document.createElement('tr');
  ['Réf.', 'Date', 'Nom', 'WhatsApp', 'E-mail', 'Formations', 'Type / Mode', 'Précisions', 'Action'].forEach(
    (col) => {
      const th = document.createElement('th');
      th.textContent = col;
      hr.appendChild(th);
    }
  );
  thead.appendChild(hr);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');
  records.forEach((rec) => {
    const d = rec.data || {};
    const tr = document.createElement('tr');

    const cells = [
      rec.id || '',
      rec.createdAt ? new Date(rec.createdAt).toLocaleString('fr-FR') : '',
      d.nom || '',
      d.whatsapp || '',
      d.email || '—',
      Array.isArray(d.formations) ? d.formations.join(', ') : '',
      [d.type, d.mode].filter(Boolean).join(' · '),
      d.precisions || '—',
    ];

    cells.forEach((val) => {
      const td = document.createElement('td');
      td.textContent = val;
      tr.appendChild(td);
    });

    const tdAction = document.createElement('td');
    const delBtn = document.createElement('button');
    delBtn.type = 'button';
    delBtn.className = 'btn o gf-sm gf-danger';
    delBtn.textContent = 'Supprimer';
    delBtn.addEventListener('click', () => handleDeleteRecord(rec.id, d.nom || rec.id));
    tdAction.appendChild(delBtn);
    tr.appendChild(tdAction);

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  elDbTableWrap.appendChild(table);
}

async function loadInscriptions() {
  if (!adminToken) return;
  setDbStatus('');
  try {
    let data;
    if (backendMode === 'static') {
      data = await staticListDecrypted();
    } else {
      const res = await fetch('/api/inscriptions', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (res.status === 401) {
        adminToken = null;
        adminEmail = null;
        updateAdminView();
        setDbStatus("Accès refusé ou session expirée. Veuillez vous reconnecter.", true);
        return;
      }
      data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Impossible de charger les inscriptions.');
    }

    currentEncryptedState = Boolean(data.encrypted);
    if (elDbCount) elDbCount.textContent = String(data.count || 0);
    if (elDbEncBadge) {
      elDbEncBadge.textContent = currentEncryptedState
        ? 'Base JSON chiffrée (AES-256-GCM)'
        : 'Base JSON non chiffrée';
      elDbEncBadge.className = 'db-badge ' + (currentEncryptedState ? 'enc' : 'plain');
    }
    if (elDbToggleEncBtn) {
      elDbToggleEncBtn.textContent = currentEncryptedState
        ? 'Désactiver le chiffrement'
        : 'Chiffrer la base JSON (AES-256)';
    }
    if (elDbEnvHint) {
      elDbEnvHint.hidden = Boolean(data.envKeyConfigured);
    }

    renderInscriptionsTable(data.records || []);
    if (rawPreviewVisible) {
      await loadRawPreview();
    }
  } catch (err) {
    setDbStatus(err?.message || 'Erreur lors du chargement de la base JSON.', true);
  }
}

async function loadRawPreview() {
  if (!adminToken || !elDbRawPre) return;
  try {
    let raw;
    if (backendMode === 'static') {
      raw = readStaticDb();
    } else {
      const res = await fetch('/api/inscriptions/raw', {
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      if (!res.ok) throw new Error('Impossible de lire le fichier JSON brut.');
      raw = await res.json();
    }
    elDbRawPre.textContent = JSON.stringify(raw, null, 2);
    elDbRawPre.hidden = false;
  } catch (err) {
    setDbStatus(err?.message || 'Erreur lors de la lecture JSON brute.', true);
  }
}

async function handleToggleEncryption() {
  if (!adminToken) return;
  const nextState = !currentEncryptedState;
  const ok = await askConfirmation({
    title: nextState ? 'Chiffrer toute la base JSON ?' : 'Déchiffrer la base JSON ?',
    message: nextState
      ? "Toutes les inscriptions seront chiffrées avec AES-256-GCM. Seul l'administrateur connecté pourra les lire ou les exporter en Excel."
      : "Les inscriptions existantes et futures seront enregistrées en JSON standard (toujours protégées par l'authentification administrateur).",
    confirmText: nextState ? 'Activer le chiffrement' : 'Désactiver le chiffrement',
  });
  if (!ok) return;

  elDbToggleEncBtn.disabled = true;
  try {
    if (backendMode === 'static') {
      await staticSetEncryption(nextState);
    } else {
      const res = await fetch('/api/inscriptions/encryption', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${adminToken}`,
        },
        body: JSON.stringify({ encrypted: nextState }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Échec du changement de chiffrement.');
    }
    setDbStatus(
      nextState
        ? 'Chiffrement AES-256-GCM activé sur toute la base de données JSON.'
        : 'Base de données JSON passée en mode non chiffré.'
    );
    await loadInscriptions();
  } catch (err) {
    setDbStatus(err?.message || 'Impossible de modifier le chiffrement.', true);
  } finally {
    elDbToggleEncBtn.disabled = false;
  }
}

async function handleDeleteRecord(id, label) {
  if (!adminToken) return;
  const ok = await askConfirmation({
    title: 'Supprimer cette inscription ?',
    message: `Voulez-vous supprimer définitivement l'inscription « ${label} » (${id}) de la base JSON ?`,
    confirmText: 'Supprimer',
  });
  if (!ok) return;

  try {
    if (backendMode === 'static') {
      const db = readStaticDb();
      db.records = db.records.filter((r) => r.id !== id);
      writeStaticDb(db);
    } else {
      const res = await fetch(`/api/inscriptions/${encodeURIComponent(id)}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${adminToken}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Suppression impossible.');
    }
    setDbStatus(`Inscription ${id} supprimée.`);
    await loadInscriptions();
  } catch (err) {
    setDbStatus(err?.message || 'Erreur lors de la suppression.', true);
  }
}

async function downloadAdminFile(endpoint, fallbackFilename, staticKind) {
  if (!adminToken) return;
  setDbStatus('');
  try {
    if (backendMode === 'static') {
      const dateStamp = new Date().toISOString().slice(0, 10);
      if (staticKind === 'xlsx') {
        await staticExportExcel();
      } else if (staticKind === 'raw') {
        const blob = new Blob([JSON.stringify(readStaticDb(), null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        triggerBlobDownload(blob, `Inscriptions-ITCACADEMY-chiffre-${dateStamp}.json`);
      } else {
        const dec = await staticListDecrypted();
        const blob = new Blob([JSON.stringify(dec, null, 2)], {
          type: 'application/json;charset=utf-8',
        });
        triggerBlobDownload(blob, `Inscriptions-ITCACADEMY-${dateStamp}.json`);
      }
      return;
    }

    const res = await fetch(endpoint, {
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    if (res.status === 401) {
      throw new Error('Session administrateur expirée. Veuillez vous reconnecter.');
    }
    if (!res.ok) {
      const errJson = await res.json().catch(() => ({}));
      throw new Error(errJson.error || 'Échec du téléchargement.');
    }
    const blob = await res.blob();
    const disp = res.headers.get('Content-Disposition') || '';
    const match = disp.match(/filename="([^"]+)"/);
    triggerBlobDownload(blob, match ? match[1] : fallbackFilename);
  } catch (err) {
    setDbStatus(err?.message || 'Erreur lors du téléchargement.', true);
  }
}

// First-run password claim
if (elDbClaimForm) {
  elDbClaimForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setDbStatus('');
    const p1 = elDbClaimPass.value;
    const p2 = elDbClaimConfirm.value;
    if (p1.length < 8) {
      setDbStatus('Le mot de passe doit contenir au moins 8 caractères.', true);
      return;
    }
    if (p1 !== p2) {
      setDbStatus('Les deux mots de passe ne correspondent pas.', true);
      return;
    }
    try {
      if (backendMode === 'static') {
        await staticClaimPassword(p1);
      } else {
        const res = await fetch('/api/admin/claim-password', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: p1 }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Configuration impossible.');
        adminToken = data.token;
        adminEmail = data.email;
      }
      elDbClaimForm.reset();
      await fetchAuthStatus();
      updateAdminView();
      await loadInscriptions();
      setDbStatus('Mot de passe administrateur enregistré et accès déverrouillé.');
    } catch (err) {
      setDbStatus(err?.message || 'Erreur lors de la configuration du mot de passe.', true);
    }
  });
}

// Password login
if (elDbLoginForm) {
  elDbLoginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    setDbStatus('');
    try {
      if (backendMode === 'static') {
        await staticLoginPassword(elDbLoginPass.value);
      } else {
        const res = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: elDbLoginPass.value }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || 'Mot de passe incorrect.');
        adminToken = data.token;
        adminEmail = data.email;
      }
      elDbLoginForm.reset();
      updateAdminView();
      await loadInscriptions();
    } catch (err) {
      setDbStatus(err?.message || 'Connexion impossible.', true);
    }
  });
}

if (elDbLogoutBtn) {
  elDbLogoutBtn.addEventListener('click', async () => {
    if (backendMode === 'server' && adminToken) {
      await fetch('/api/admin/logout', {
        method: 'POST',
        headers: { Authorization: `Bearer ${adminToken}` },
      }).catch(() => {});
    }
    adminToken = null;
    adminEmail = null;
    staticPrivateKey = null;
    rawPreviewVisible = false;
    if (elDbRawPre) elDbRawPre.hidden = true;
    updateAdminView();
    setDbStatus('Session administrateur fermée.');
  });
}

if (elDbToggleEncBtn) elDbToggleEncBtn.addEventListener('click', handleToggleEncryption);
if (elDbRefreshBtn) elDbRefreshBtn.addEventListener('click', loadInscriptions);
if (elDbRawBtn) {
  elDbRawBtn.addEventListener('click', async () => {
    rawPreviewVisible = !rawPreviewVisible;
    if (rawPreviewVisible) {
      elDbRawBtn.textContent = 'Masquer le JSON brut';
      await loadRawPreview();
    } else {
      elDbRawBtn.textContent = 'Voir le JSON brut';
      if (elDbRawPre) elDbRawPre.hidden = true;
    }
  });
}
if (elDbExcelBtn) {
  elDbExcelBtn.addEventListener('click', () =>
    downloadAdminFile('/api/inscriptions/export.xlsx', 'Inscriptions-ITCACADEMY.xlsx', 'xlsx')
  );
}
if (elDbJsonDecBtn) {
  elDbJsonDecBtn.addEventListener('click', () =>
    downloadAdminFile('/api/inscriptions/export.json', 'Inscriptions-ITCACADEMY.json', 'dec')
  );
}
if (elDbJsonRawBtn) {
  elDbJsonRawBtn.addEventListener('click', () =>
    downloadAdminFile('/api/inscriptions/export.json?mode=raw', 'Inscriptions-ITCACADEMY-chiffre.json', 'raw')
  );
}

fetchAuthStatus();
updateAdminView();
