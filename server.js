import express from 'express';
import ExcelJS from 'exceljs';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  addInscription,
  claimFirstRunAdminPassword,
  createAdminSession,
  deleteInscriptionById,
  getAdminPasswordStatus,
  listDecryptedInscriptions,
  readRawDatabase,
  revokeAdminSessionToken,
  setEncryptionEnabled,
  verifyAdminPassword,
  verifyAdminSessionToken,
} from './inscriptions-store.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = '0.0.0.0';
const ADMIN_EMAIL = (process.env.ADMIN_EMAIL || 'cherkaoui.imaad@gmail.com').trim().toLowerCase();

app.use(express.json({ limit: '64kb' }));

// Simple in-memory rate limiter for public POST & login routes
const rateBuckets = new Map();
function checkRateLimit(key, maxHits, windowMs) {
  const now = Date.now();
  const bucket = rateBuckets.get(key) || [];
  const fresh = bucket.filter((ts) => now - ts < windowMs);
  if (fresh.length >= maxHits) {
    rateBuckets.set(key, fresh);
    return false;
  }
  fresh.push(now);
  rateBuckets.set(key, fresh);
  return true;
}

function verifyAdminAuth(authHeader) {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return null;
  const token = authHeader.slice(7).trim();
  if (!token || !token.startsWith('adm_')) return null;
  const session = verifyAdminSessionToken(token);
  return session ? { email: session.email, method: 'password' } : null;
}

function requireAdmin(req, res, next) {
  const admin = verifyAdminAuth(req.headers.authorization);
  if (!admin) {
    return res.status(401).json({
      error: "Accès réservé à l'administrateur.",
    });
  }
  req.admin = admin;
  next();
}

function sanitizeExcelCell(value) {
  const str = String(value ?? '');
  if (/^[=@\t\r]/.test(str) || (/^[+-]/.test(str) && !/^\+\d[\d\s().-]{6,}$/.test(str))) {
    return "'" + str;
  }
  return str;
}

// ===== Admin password authentication endpoints =====
app.get('/api/admin/auth-status', (req, res) => {
  const status = getAdminPasswordStatus();
  res.json({
    ...status,
    adminEmail: ADMIN_EMAIL,
  });
});

app.post('/api/admin/claim-password', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`claim:${ip}`, 10, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez plus tard.' });
  }
  const { password = '' } = req.body || {};
  const result = claimFirstRunAdminPassword(password);
  if (!result.ok) {
    return res.status(400).json({ error: result.error });
  }
  const token = createAdminSession(ADMIN_EMAIL);
  return res.json({ ok: true, token, email: ADMIN_EMAIL });
});

app.post('/api/admin/login', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`login:${ip}`, 15, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Trop de tentatives. Réessayez dans quelques minutes.' });
  }
  const { password = '' } = req.body || {};
  if (!verifyAdminPassword(password)) {
    return res.status(401).json({ error: 'Mot de passe administrateur incorrect.' });
  }
  const token = createAdminSession(ADMIN_EMAIL);
  return res.json({ ok: true, token, email: ADMIN_EMAIL });
});

app.post('/api/admin/logout', (req, res) => {
  const authHeader = req.headers.authorization || '';
  if (authHeader.startsWith('Bearer ')) {
    revokeAdminSessionToken(authHeader.slice(7).trim());
  }
  return res.json({ ok: true });
});

// ===== Public Registration Submission -> JSON Database (AES-256-GCM when enabled) =====
const VALID_TYPES = new Set(['En groupe', 'Individuelle', 'Personnalisée']);
const VALID_MODES = new Set(['À distance', 'Présentiel', 'Hybride']);

app.post('/api/inscriptions', (req, res) => {
  const ip = req.ip || 'unknown';
  if (!checkRateLimit(`insc:${ip}`, 25, 15 * 60 * 1000)) {
    return res.status(429).json({ error: 'Trop d\'inscriptions envoyées. Veuillez patienter.' });
  }

  const body = req.body || {};
  const nom = String(body.nom || '').trim();
  const whatsapp = String(body.whatsapp || '').trim();
  const email = String(body.email || '').trim();
  const type = String(body.type || '').trim();
  const mode = String(body.mode || '').trim();
  const precisions = String(body.precisions || '').trim().slice(0, 1000);
  const rawFormations = Array.isArray(body.formations) ? body.formations : [];
  const formations = rawFormations
    .map((f) => String(f || '').trim().slice(0, 140))
    .filter(Boolean)
    .slice(0, 15);

  if (nom.length < 2 || nom.length > 120) {
    return res.status(400).json({ error: 'Veuillez renseigner votre nom et prénom (2 à 120 caractères).' });
  }

  const cleanedPhone = whatsapp.replace(/[\s().-]/g, '');
  if (!/^\+?\d{9,15}$/.test(cleanedPhone)) {
    return res.status(400).json({
      error: 'Veuillez saisir un numéro de téléphone WhatsApp valide (ex. 0660 83 72 85).',
    });
  }

  if (email && (email.length > 160 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) {
    return res.status(400).json({ error: 'Adresse e-mail invalide.' });
  }

  if (!formations.length) {
    return res.status(400).json({ error: 'Veuillez sélectionner au moins une formation.' });
  }

  if (!VALID_TYPES.has(type)) {
    return res.status(400).json({ error: 'Type de formation invalide.' });
  }

  if (type === 'Personnalisée') {
    const paidCount = formations.filter((f) => !f.startsWith('Orientation')).length;
    if (paidCount < 2 || paidCount > 3) {
      return res.status(400).json({
        error: 'Formation personnalisée : veuillez sélectionner 2 ou 3 modules.',
      });
    }
  }

  if (!VALID_MODES.has(mode)) {
    return res.status(400).json({ error: 'Mode d\'apprentissage invalide.' });
  }

  try {
    const saved = addInscription({
      nom,
      whatsapp,
      email,
      formations,
      type,
      mode,
      precisions,
    });
    return res.status(201).json({ ok: true, ...saved });
  } catch {
    return res.status(500).json({ error: 'Erreur lors de l\'enregistrement de l\'inscription.' });
  }
});

// ===== Admin-only JSON Database Management & Excel Export =====
app.get('/api/inscriptions', requireAdmin, (req, res) => {
  try {
    return res.json(listDecryptedInscriptions());
  } catch {
    return res.status(500).json({ error: 'Impossible de lire la base de données JSON.' });
  }
});

app.get('/api/inscriptions/raw', requireAdmin, (req, res) => {
  try {
    const rawDb = readRawDatabase();
    return res.json({
      version: rawDb.version,
      encrypted: rawDb.encrypted,
      updatedAt: rawDb.updatedAt,
      count: rawDb.records.length,
      records: rawDb.records,
    });
  } catch {
    return res.status(500).json({ error: 'Impossible de lire le fichier JSON brut.' });
  }
});

app.post('/api/inscriptions/encryption', requireAdmin, (req, res) => {
  const { encrypted } = req.body || {};
  if (typeof encrypted !== 'boolean') {
    return res.status(400).json({ error: 'Le paramètre "encrypted" doit être un booléen.' });
  }
  try {
    const result = setEncryptionEnabled(encrypted);
    return res.json({ ok: true, ...result });
  } catch {
    return res.status(500).json({ error: 'Impossible de modifier le chiffrement de la base JSON.' });
  }
});

app.delete('/api/inscriptions/:id', requireAdmin, (req, res) => {
  const id = String(req.params.id || '').trim();
  if (!/^INS-\d{6}-\d{4}$/.test(id)) {
    return res.status(400).json({ error: 'Identifiant d\'inscription invalide.' });
  }
  try {
    const deleted = deleteInscriptionById(id);
    if (!deleted) {
      return res.status(404).json({ error: 'Inscription introuvable.' });
    }
    return res.json({ ok: true, id });
  } catch {
    return res.status(500).json({ error: 'Erreur lors de la suppression.' });
  }
});

app.get('/api/inscriptions/export.json', requireAdmin, (req, res) => {
  const mode = req.query.mode === 'raw' ? 'raw' : 'decrypted';
  const dateStamp = new Date().toISOString().slice(0, 10);
  try {
    const payload =
      mode === 'raw'
        ? (() => {
            const rawDb = readRawDatabase();
            return {
              version: rawDb.version,
              encrypted: rawDb.encrypted,
              updatedAt: rawDb.updatedAt,
              records: rawDb.records,
            };
          })()
        : listDecryptedInscriptions();
    const filename =
      mode === 'raw'
        ? `Inscriptions-ITCACADEMY-chiffre-${dateStamp}.json`
        : `Inscriptions-ITCACADEMY-${dateStamp}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    return res.send(JSON.stringify(payload, null, 2));
  } catch {
    return res.status(500).json({ error: 'Erreur lors de l\'export JSON.' });
  }
});

app.get('/api/inscriptions/export.xlsx', requireAdmin, async (req, res) => {
  try {
    const { records } = listDecryptedInscriptions();
    const wb = new ExcelJS.Workbook();
    wb.creator = 'ITCACADEMY';
    wb.created = new Date();

    const ws = wb.addWorksheet('Inscriptions ITCACADEMY', {
      views: [{ state: 'frozen', ySplit: 1 }],
    });

    ws.columns = [
      { header: 'Référence', key: 'id', width: 18 },
      { header: 'Date d\'inscription', key: 'date', width: 20 },
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
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF0A1330' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 24;

    records.forEach((rec, idx) => {
      const d = rec.data || {};
      const formattedDate = rec.createdAt
        ? new Date(rec.createdAt).toLocaleString('fr-FR')
        : '';
      const row = ws.addRow({
        id: sanitizeExcelCell(rec.id),
        date: sanitizeExcelCell(formattedDate),
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
        row.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFF4F7FF' },
        };
      }
    });

    ws.autoFilter = {
      from: 'A1',
      to: 'J1',
    };

    const buffer = await wb.xlsx.writeBuffer();
    const dateStamp = new Date().toISOString().slice(0, 10);
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="Inscriptions-ITCACADEMY-${dateStamp}.xlsx"`
    );
    return res.send(Buffer.from(buffer));
  } catch {
    return res.status(500).json({ error: 'Erreur lors de la génération du fichier Excel.' });
  }
});

// ===== Static file serving with strict denylist =====
app.use((req, res, next) => {
  const p = req.path.toLowerCase();
  const blockedExact = [
    '/server.js',
    '/inscriptions-store.js',
    '/package.json',
    '/package-lock.json',
    '/bun.lock',
    '/firebase-applet-config.json',
    '/form-config.json',
    '/.env',
    '/.env.example',
  ];
  if (
    blockedExact.includes(p) ||
    p.startsWith('/node_modules') ||
    p.startsWith('/data') ||
    p.startsWith('/.aistudio') ||
    p.startsWith('/.env')
  ) {
    return res.status(404).end();
  }
  next();
});

app.get('/inscription', (req, res) => {
  res.sendFile(path.join(__dirname, 'inscription.html'));
});

app.use(express.static(__dirname));

app.use((req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

app.listen(PORT, HOST, () => {
  console.log(`Server listening on http://${HOST}:${PORT}`);
});
