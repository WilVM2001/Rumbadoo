/* ==============================================================
   Rumbadoo — Conexión a Turso (libSQL)
   No lanza error si faltan variables de entorno
   ============================================================== */

let db = null;
let schemaReady = false;

export async function getDb() {
  if (db) return db;

  const url = process.env.TURSO_DATABASE_URL;
  const token = process.env.TURSO_AUTH_TOKEN;

  if (!url || !token) return null;

  try {
    const { createClient } = await import('@libsql/client');
    db = createClient({ url, authToken: token });
    return db;
  } catch (e) {
    console.error('Error al conectar Turso:', e.message);
    return null;
  }
}

export async function ensureSchema() {
  if (schemaReady) return true;
  const d = await getDb();
  if (!d) return false;

  try {
    await d.execute(`CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, name TEXT UNIQUE NOT NULL, password TEXT NOT NULL, age INTEGER NOT NULL, gender TEXT DEFAULT '', bio TEXT DEFAULT '', photo TEXT DEFAULT '', role TEXT DEFAULT 'user', createdAt TEXT DEFAULT (datetime('now')))`);
    await d.execute(`CREATE TABLE IF NOT EXISTS interactions (id TEXT PRIMARY KEY, fromId TEXT NOT NULL, toId TEXT NOT NULL, type TEXT NOT NULL, createdAt TEXT DEFAULT (datetime('now')))`);
    await d.execute(`CREATE TABLE IF NOT EXISTS matches (id TEXT PRIMARY KEY, user1Id TEXT NOT NULL, user2Id TEXT NOT NULL, createdAt TEXT DEFAULT (datetime('now')))`);

    const admin = await d.execute("SELECT id FROM profiles WHERE name = '__admin__'");
    if (admin.rows.length === 0) {
      await d.execute("INSERT INTO profiles (id, name, password, age, gender, bio, photo, role) VALUES (?, '__admin__', ?, 0, '', '', '', 'admin')",
        [genId(), hashPass('admin123')]);
    }
    schemaReady = true;
    return true;
  } catch (e) {
    console.error('Error en schema:', e.message);
    return false;
  }
}

export function hashPass(pw) {
  let h = 0;
  for (let i = 0; i < pw.length; i++) { h = ((h << 5) - h) + pw.charCodeAt(i); h |= 0; }
  return 'h' + Math.abs(h).toString(36);
}

export function genId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

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

export function dbError(res) {
  error(res, 'Base de datos no disponible. Configura TURSO_DATABASE_URL y TURSO_AUTH_TOKEN en Vercel.', 503);
}
