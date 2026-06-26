import { db, ensureSchema, hashPass, genId, json, error } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'POST') return error(res, 'Método no permitido', 405);

  try {
    await ensureSchema();
    const { name, password, age, gender, bio, photo } = req.body;
    if (!name || !password || !age) return error(res, 'Faltan campos requeridos.');

    const existing = await db.execute("SELECT id FROM profiles WHERE name = ?", [name]);
    if (existing.rows.length > 0) return error(res, 'Ese nombre ya está en uso.', 409);

    const id = genId();
    await db.execute(
      "INSERT INTO profiles (id, name, password, age, gender, bio, photo) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, name, hashPass(password), age, gender || '', bio || '', photo || '']
    );

    const p = await db.execute("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [id]);
    json(res, { ok: true, profile: p.rows[0] });
  } catch (err) {
    error(res, err.message, 500);
  }
}
