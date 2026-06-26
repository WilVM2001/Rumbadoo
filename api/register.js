import { ensureSchema, hashPass, genId, getDb, json, error, dbError } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method !== 'POST') { error(res, 'Método no permitido', 405); return; }
  const ok = await ensureSchema(); if (!ok) return dbError(res);

  try {
    const { name, password, age, gender, bio, photo } = req.body;
    if (!name || !password || !age) return error(res, 'Faltan campos requeridos.');
    if (password.length < 4) return error(res, 'Contraseña muy corta.');

    const d = await getDb();
    const existing = await d.execute("SELECT id FROM profiles WHERE name = ?", [name]);
    if (existing.rows.length > 0) return error(res, 'Ese nombre ya está en uso.', 409);

    const id = genId();
    await d.execute("INSERT INTO profiles (id, name, password, age, gender, bio, photo) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, name, hashPass(password), age, gender || '', bio || '', photo || '']);

    const p = await d.execute("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [id]);
    json(res, { ok: true, profile: p.rows[0] });
  } catch (err) { error(res, err.message, 500); }
}
