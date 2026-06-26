import { db, ensureSchema, genId, json, error } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'POST') return error(res, 'Método no permitido', 405);

  try {
    await ensureSchema();
    const { fromId, toId, type } = req.body;
    if (!fromId || !toId || !type) return error(res, 'Faltan campos.');

    const id = genId();
    await db.execute("INSERT INTO interactions (id, fromId, toId, type, createdAt) VALUES (?, ?, ?, ?, datetime('now'))", [id, fromId, toId, type]);

    let match = null;
    if (type === 'like') {
      const reciprocal = await db.execute("SELECT id FROM interactions WHERE fromId=? AND toId=? AND type='like'", [toId, fromId]);
      if (reciprocal.rows.length > 0) {
        const existing = await db.execute(
          "SELECT id FROM matches WHERE (user1Id=? AND user2Id=?) OR (user1Id=? AND user2Id=?)",
          [fromId, toId, toId, fromId]
        );
        if (existing.rows.length === 0) {
          const matchId = genId();
          await db.execute("INSERT INTO matches (id, user1Id, user2Id, createdAt) VALUES (?, ?, ?, datetime('now'))", [matchId, fromId, toId]);
          match = { id: matchId, user1Id: fromId, user2Id: toId };
        }
      }
    }

    json(res, { ok: true, interactionId: id, match });
  } catch (err) {
    error(res, err.message, 500);
  }
}
