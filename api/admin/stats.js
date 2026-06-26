import { ensureSchema, getDb, json, error, dbError } from '../../lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { error(res, 'Método no permitido', 405); return; }
  const ok = await ensureSchema(); if (!ok) return dbError(res);
  try {
    const d = await getDb();
    const users = await d.execute("SELECT COUNT(*) as count FROM profiles WHERE role != 'admin'");
    const matches = await d.execute("SELECT COUNT(*) as count FROM matches");
    const interactions = await d.execute("SELECT COUNT(*) as count FROM interactions");
    json(res, { users: users.rows[0].count, matches: matches.rows[0].count, interactions: interactions.rows[0].count });
  } catch (err) { error(res, err.message, 500); }
}
