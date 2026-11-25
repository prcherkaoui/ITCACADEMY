import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'inscriptions.json');
const ADMIN_AUTH_PATH = path.join(DATA_DIR, 'admin-auth.json');

const RUNTIME_FALLBACK_KEY = crypto.randomBytes(32);

function ensureDataDir() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true, mode: 0o700 });
  }
}

function getEncryptionKey(saltHex) {
  const envSecret = (process.env.DATA_ENCRYPTION_KEY || '').trim();
  if (envSecret) {
    return crypto.scryptSync(envSecret, saltHex || 'itcacademy-json-db-v1', 32);
  }
  return RUNTIME_FALLBACK_KEY;
}

export function isEnvEncryptionKeyConfigured() {
  return Boolean((process.env.DATA_ENCRYPTION_KEY || '').trim());
}

function encryptPayload(payload, saltHex) {
  const key = getEncryptionKey(saltHex);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const plaintext = JSON.stringify(payload);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    alg: 'aes-256-gcm',
    iv: iv.toString('base64'),
    tag: tag.toString('base64'),
    ciphertext: ciphertext.toString('base64'),
  };
}

function decryptPayload(record, saltHex) {
  const key = getEncryptionKey(saltHex);
  const iv = Buffer.from(record.iv, 'base64');
  const tag = Buffer.from(record.tag, 'base64');
  const ciphertext = Buffer.from(record.ciphertext, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(tag);
  const plain = Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
  return JSON.parse(plain);
}

function writeJsonAtomic(filePath, obj) {
  ensureDataDir();
  const tmpPath = `${filePath}.${crypto.randomBytes(6).toString('hex')}.tmp`;
  fs.writeFileSync(tmpPath, JSON.stringify(obj, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tmpPath, filePath);
}

export function readRawDatabase() {
  ensureDataDir();
  if (!fs.existsSync(DB_PATH)) {
    const initial = {
      version: 1,
      encrypted: true,
      salt: crypto.randomBytes(16).toString('hex'),
      updatedAt: new Date().toISOString(),
      records: [],
    };
    writeJsonAtomic(DB_PATH, initial);
    return initial;
  }
  const raw = fs.readFileSync(DB_PATH, 'utf8');
  const parsed = JSON.parse(raw);
  return {
    version: parsed.version || 1,
    encrypted: Boolean(parsed.encrypted),
    salt: parsed.salt || crypto.randomBytes(16).toString('hex'),
    updatedAt: parsed.updatedAt || new Date().toISOString(),
    records: Array.isArray(parsed.records) ? parsed.records : [],
  };
}

export function addInscription(data) {
  const db = readRawDatabase();
  const now = new Date();
  const id =
    'INS-' +
    now.toISOString().slice(2, 10).replace(/-/g, '') +
    '-' +
    crypto.randomInt(1000, 10000);
  const createdAt = now.toISOString();

  let entry;
  if (db.encrypted) {
    const enc = encryptPayload(data, db.salt);
    entry = {
      id,
      createdAt,
      encrypted: true,
      ...enc,
    };
  } else {
    entry = {
      id,
      createdAt,
      encrypted: false,
      data,
    };
  }

  db.records.unshift(entry);
  db.updatedAt = createdAt;
  writeJsonAtomic(DB_PATH, db);

  return { id, createdAt, encrypted: db.encrypted };
}

export function listDecryptedInscriptions() {
  const db = readRawDatabase();
  const records = db.records.map((rec) => {
    if (!rec.encrypted) {
      return {
        id: rec.id,
        createdAt: rec.createdAt,
        encrypted: false,
        decryptError: false,
        data: rec.data || {},
      };
    }
    try {
      const data = decryptPayload(rec, db.salt);
      return {
        id: rec.id,
        createdAt: rec.createdAt,
        encrypted: true,
        decryptError: false,
        data,
      };
    } catch {
      return {
        id: rec.id,
        createdAt: rec.createdAt,
        encrypted: true,
        decryptError: true,
        data: {
          nom: '[Chiffré — clé différente]',
          whatsapp: '',
          email: '',
          formations: [],
          type: '',
          mode: '',
          precisions: '',
        },
      };
    }
  });

  return {
    encrypted: db.encrypted,
    envKeyConfigured: isEnvEncryptionKeyConfigured(),
    updatedAt: db.updatedAt,
    count: records.length,
    records,
  };
}

export function setEncryptionEnabled(enabled) {
  const target = Boolean(enabled);
  const db = readRawDatabase();
  const nextSalt = db.salt || crypto.randomBytes(16).toString('hex');

  const transformed = db.records.map((rec) => {
    if (rec.encrypted === target) return rec;
    if (target) {
      const enc = encryptPayload(rec.data || {}, nextSalt);
      return {
        id: rec.id,
        createdAt: rec.createdAt,
        encrypted: true,
        ...enc,
      };
    }
    try {
      const data = decryptPayload(rec, nextSalt);
      return {
        id: rec.id,
        createdAt: rec.createdAt,
        encrypted: false,
        data,
      };
    } catch {
      // Keep undecryptable record intact rather than losing data
      return rec;
    }
  });

  const nextDb = {
    version: 1,
    encrypted: target,
    salt: nextSalt,
    updatedAt: new Date().toISOString(),
    records: transformed,
  };
  writeJsonAtomic(DB_PATH, nextDb);
  return {
    encrypted: nextDb.encrypted,
    count: nextDb.records.length,
    updatedAt: nextDb.updatedAt,
  };
}

export function deleteInscriptionById(id) {
  const db = readRawDatabase();
  const before = db.records.length;
  db.records = db.records.filter((r) => r.id !== id);
  if (db.records.length === before) return false;
  db.updatedAt = new Date().toISOString();
  writeJsonAtomic(DB_PATH, db);
  return true;
}

// ===== Admin Password Auth (scrypt + timingSafeEqual + in-memory Bearer sessions) =====
const adminSessions = new Map();
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

function readAdminAuthRecord() {
  ensureDataDir();
  if (!fs.existsSync(ADMIN_AUTH_PATH)) return null;
  try {
    return JSON.parse(fs.readFileSync(ADMIN_AUTH_PATH, 'utf8'));
  } catch {
    return null;
  }
}

export function getAdminPasswordStatus() {
  const envConfigured = Boolean((process.env.ADMIN_PASSWORD || '').trim());
  const stored = readAdminAuthRecord();
  return {
    envConfigured,
    passwordClaimed: Boolean(stored && stored.hash && stored.salt),
  };
}

export function claimFirstRunAdminPassword(password) {
  const { envConfigured, passwordClaimed } = getAdminPasswordStatus();
  if (envConfigured || passwordClaimed) {
    return { ok: false, error: 'Le mot de passe administrateur est déjà configuré.' };
  }
  if (typeof password !== 'string' || password.length < 8 || password.length > 128) {
    return { ok: false, error: 'Le mot de passe doit contenir au moins 8 caractères.' };
  }
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  writeJsonAtomic(ADMIN_AUTH_PATH, {
    salt,
    hash,
    claimedAt: new Date().toISOString(),
  });
  return { ok: true };
}

export function verifyAdminPassword(password) {
  if (typeof password !== 'string' || !password) return false;
  const envPass = (process.env.ADMIN_PASSWORD || '').trim();
  if (envPass) {
    const a = crypto.createHash('sha256').update(password).digest();
    const b = crypto.createHash('sha256').update(envPass).digest();
    return crypto.timingSafeEqual(a, b);
  }
  const stored = readAdminAuthRecord();
  if (!stored || !stored.salt || !stored.hash) return false;
  const derived = crypto.scryptSync(password, stored.salt, 64);
  const expected = Buffer.from(stored.hash, 'hex');
  if (derived.length !== expected.length) return false;
  return crypto.timingSafeEqual(derived, expected);
}

export function createAdminSession(email) {
  const token = 'adm_' + crypto.randomBytes(32).toString('hex');
  adminSessions.set(token, {
    email,
    expiresAt: Date.now() + SESSION_TTL_MS,
  });
  return token;
}

export function verifyAdminSessionToken(token) {
  if (!token || !token.startsWith('adm_')) return null;
  const session = adminSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    adminSessions.delete(token);
    return null;
  }
  return session;
}

export function revokeAdminSessionToken(token) {
  if (token) adminSessions.delete(token);
}
