import { ensureSchema, getDb, json, error, dbError, setCors } from '../../../lib/db.js';
export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  if (req.method !== 'DELETE') { error(res, 'Método no permitido', 405); return; }
  const ok = await ensureSchema(); if (!ok) return dbError(res);
  try {
    const d = await getDb();
    const adminId = req.headers['x-user-id'];
    const admin = await d.execute("SELECT id, role FROM profiles WHERE id = ?", [adminId]);
    if (!admin.rows.length || admin.rows[0].role !== 'admin') return error(res, 'No autorizado.', 403);

    const { id } = req.query;
    const p = await d.execute("SELECT id, name, role FROM profiles WHERE id=?", [id]);
    if (p.rows.length === 0) return error(res, 'Perfil no encontrado.', 404);
    if (p.rows[0].role === 'admin') return error(res, 'No se puede eliminar un admin.', 400);

    await d.execute("DELETE FROM interactions WHERE fromId=? OR toId=?", [id, id]);
    await d.execute("DELETE FROM matches WHERE user1Id=? OR user2Id=?", [id, id]);
    await d.execute("DELETE FROM profiles WHERE id=?", [id]);
    json(res, { ok: true });
  } catch (err) { error(res, err.message, 500); }
}
