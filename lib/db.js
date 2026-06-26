/* ==============================================================
   Rumbadoo — Conexión a Turso (libSQL) base de datos en la nube
   ============================================================== */

import { createClient } from '@libsql/client';

const url = process.env.TURSO_DATABASE_URL;
const token = process.env.TURSO_AUTH_TOKEN;

if (!url || !token) {
  throw new Error('Faltan variables de entorno: TURSO_DATABASE_URL y TURSO_AUTH_TOKEN');
}

export const db = createClient({ url, authToken: token });

// ─── Inicializar esquema ─────────────────────────────────────
let schemaReady = false;

export async function ensureSchema() {
  if (schemaReady) return;
  await db.execute(`
    CREATE TABLE IF NOT EXISTS profiles (
      id TEXT PRIMARY KEY,
      name TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      age INTEGER NOT NULL,
      gender TEXT DEFAULT '',
      bio TEXT DEFAULT '',
      photo TEXT DEFAULT '',
      role TEXT DEFAULT 'user',
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS interactions (
      id TEXT PRIMARY KEY,
      fromId TEXT NOT NULL,
      toId TEXT NOT NULL,
      type TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);
  await db.execute(`
    CREATE TABLE IF NOT EXISTS matches (
      id TEXT PRIMARY KEY,
      user1Id TEXT NOT NULL,
      user2Id TEXT NOT NULL,
      createdAt TEXT DEFAULT (datetime('now'))
    )
  `);

  const admin = await db.execute("SELECT id FROM profiles WHERE name = '__admin__'");
  if (admin.rows.length === 0) {
    await db.execute(
      "INSERT INTO profiles (id, name, password, age, gender, bio, photo, role) VALUES (?, '__admin__', ?, 0, '', '', '', 'admin')",
      [genId(), hashPass('admin123')]
    );
  }
  schemaReady = true;
}

// ─── Helpers ──────────────────────────────────────────────────
export function hashPass(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
  return 'h' + Math.abs(h).toString(36);
}

export function genId() {
  return crypto.randomUUID();
}

// ─── CORS & Response helpers ──────────────────────────────────
export function setCors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

export function json(res, data, status = 200) {
  setCors(res);
  res.status(status).json(data);
}

export function error(res, msg, status = 400) {
  setCors(res);
  res.status(status).json({ error: msg });
}
