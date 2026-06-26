import { db, ensureSchema, json, error, setCors } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  if (req.method !== 'GET') { setCors(res); return res.status(405).json({ error: 'Método no permitido' }); }

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
