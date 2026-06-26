import { ensureSchema, getDb, json, error, dbError, setCors } from '../../lib/db.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  const ok = await ensureSchema(); if (!ok) return dbError(res);
  const { id } = req.query;
  const d = await getDb();

  if (req.method === 'GET') {
    try {
      const p = await d.execute("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [id]);
      if (p.rows.length === 0) return error(res, 'Perfil no encontrado.', 404);
      json(res, p.rows[0]);
    } catch (err) { error(res, err.message, 500); }
    return;
  }

  if (req.method === 'PUT') {
    try {
      const existing = await d.execute("SELECT * FROM profiles WHERE id = ?", [id]);
      if (existing.rows.length === 0) return error(res, 'Perfil no encontrado.', 404);
      const { name, age, gender, bio, photo } = req.body;
      const cur = existing.rows[0];
      if (name && name !== cur.name) {
        const dup = await d.execute("SELECT id FROM profiles WHERE name = ? AND id != ?", [name, id]);
        if (dup.rows.length > 0) return error(res, 'Ese nombre ya está en uso.', 409);
      }
      await d.execute("UPDATE profiles SET name=?, age=?, gender=?, bio=?, photo=? WHERE id=?", [name || cur.name, age || cur.age, gender ?? cur.gender, bio ?? cur.bio, photo || cur.photo, id]);
      const updated = await d.execute("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [id]);
      json(res, { ok: true, profile: updated.rows[0] });
    } catch (err) { error(res, err.message, 500); }
    return;
  }
  error(res, 'Método no permitido', 405);
}
