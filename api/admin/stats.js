import { db, ensureSchema, json, error } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'GET') return error(res, 'Método no permitido', 405);

  try {
    await ensureSchema();
    const users = await db.execute("SELECT COUNT(*) as count FROM profiles WHERE role != 'admin'");
    const matches = await db.execute("SELECT COUNT(*) as count FROM matches");
    const interactions = await db.execute("SELECT COUNT(*) as count FROM interactions");
    json(res, {
      users: users.rows[0].count,
      matches: matches.rows[0].count,
      interactions: interactions.rows[0].count
    });
  } catch (err) {
    error(res, err.message, 500);
  }
}
