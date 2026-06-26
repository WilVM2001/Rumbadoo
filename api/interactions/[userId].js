import { ensureSchema, getDb, json, error, dbError } from '../../lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { error(res, 'Método no permitido', 405); return; }
  const ok = await ensureSchema(); if (!ok) return dbError(res);
  try { const d = await getDb(); json(res, (await d.execute("SELECT * FROM interactions WHERE fromId=? ORDER BY createdAt DESC", [req.query.userId])).rows); }
  catch (err) { error(res, err.message, 500); }
}
