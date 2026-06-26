import { db, ensureSchema, json, error, setCors } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  if (req.method !== 'GET') { setCors(res); return res.status(405).json({ error: 'Método no permitido' }); }

  try {
    await ensureSchema();
    const rows = await db.execute("SELECT * FROM interactions WHERE fromId=? AND type='like' ORDER BY createdAt DESC", [req.query.userId]);
    json(res, rows.rows);
  } catch (err) {
    error(res, err.message, 500);
  }
}
