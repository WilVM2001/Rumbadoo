import { db, ensureSchema, json, error } from '../../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'DELETE') return error(res, 'Método no permitido', 405);

  try {
    await ensureSchema();
    const { id } = req.query;
    const p = await db.execute("SELECT role FROM profiles WHERE id=?", [id]);
    if (p.rows.length === 0 || p.rows[0].role === 'admin') return error(res, 'No se puede eliminar.', 400);

    await db.execute("DELETE FROM interactions WHERE fromId=? OR toId=?", [id, id]);
    await db.execute("DELETE FROM matches WHERE user1Id=? OR user2Id=?", [id, id]);
    await db.execute("DELETE FROM profiles WHERE id=?", [id]);
    json(res, { ok: true });
  } catch (err) {
    error(res, err.message, 500);
  }
}
