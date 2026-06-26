import { db, ensureSchema, json, error } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'GET') return error(res, 'Método no permitido', 405);

  try {
    await ensureSchema();
    const rows = await db.execute("SELECT * FROM interactions WHERE fromId=? ORDER BY createdAt DESC", [req.query.userId]);
    json(res, rows.rows);
  } catch (err) {
    error(res, err.message, 500);
  }
}
