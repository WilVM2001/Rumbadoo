import { ensureSchema, genId, getDb, json, error, dbError } from '../lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') { error(res, 'Método no permitido', 405); return; }
  const ok = await ensureSchema(); if (!ok) return dbError(res);
  try {
    const { fromId, toId, type } = req.body;
    if (!fromId || !toId || !type) return error(res, 'Faltan campos.');
    const d = await getDb();
    const [from, to] = await Promise.all([
      d.execute("SELECT id FROM profiles WHERE id = ?", [fromId]),
      d.execute("SELECT id FROM profiles WHERE id = ?", [toId])
    ]);
    if (from.rows.length === 0) return error(res, 'Usuario origen no existe.', 404);
    if (to.rows.length === 0) return error(res, 'Usuario destino no existe.', 404);

    const id = genId();
    await d.execute("INSERT INTO interactions (id, fromId, toId, type, createdAt) VALUES (?, ?, ?, ?, datetime('now'))", [id, fromId, toId, type]);

    let match = null;
    if (type === 'like') {
      const reciprocal = await d.execute("SELECT id FROM interactions WHERE fromId=? AND toId=? AND type='like'", [toId, fromId]);
      if (reciprocal.rows.length > 0) {
        const existing = await d.execute("SELECT id FROM matches WHERE (user1Id=? AND user2Id=?) OR (user1Id=? AND user2Id=?)", [fromId, toId, toId, fromId]);
        if (existing.rows.length === 0) {
          const matchId = genId();
          await d.execute("INSERT INTO matches (id, user1Id, user2Id, createdAt) VALUES (?, ?, ?, datetime('now'))", [matchId, fromId, toId]);
          match = { id: matchId, user1Id: fromId, user2Id: toId };
        }
      }
    }
    json(res, { ok: true, interactionId: id, match });
  } catch (err) { error(res, err.message, 500); }
}
