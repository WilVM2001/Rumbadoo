import { db, ensureSchema, json, error, setCors } from '../../../lib/db.js';
import { requireAdmin, auditLog } from '../../../lib/middleware.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  if (req.method !== 'DELETE') { setCors(res); return res.status(405).json({ error: 'Método no permitido' }); }

  try {
    await ensureSchema();
    const { id } = req.query;

    // Validar que quien elimina es admin
    const adminId = req.headers['x-user-id'];
    const admin = await requireAdmin(adminId);
    if (!admin) return error(res, 'No autorizado.', 403);

    const p = await db.execute("SELECT id, name, role FROM profiles WHERE id=?", [id]);
    if (p.rows.length === 0) return error(res, 'Perfil no encontrado.', 404);
    if (p.rows[0].role === 'admin') return error(res, 'No se puede eliminar un admin.', 400);

    await db.execute("DELETE FROM interactions WHERE fromId=? OR toId=?", [id, id]);
    await db.execute("DELETE FROM matches WHERE user1Id=? OR user2Id=?", [id, id]);
    await db.execute("DELETE FROM profiles WHERE id=?", [id]);

    await auditLog(adminId, 'delete_profile', id, { deletedName: p.rows[0].name });
    json(res, { ok: true });
  } catch (err) {
    error(res, err.message, 500);
  }
}
