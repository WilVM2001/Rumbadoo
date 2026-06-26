import { db, ensureSchema, json, error, setCors } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  if (req.method !== 'GET') { setCors(res); return res.status(405).json({ error: 'Método no permitido' }); }

  try {
    await ensureSchema();
    const { exclude } = req.query;
    let sql = "SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE role != 'admin'";
    const params = [];
    if (exclude) { sql += " AND id != ?"; params.push(exclude); }
    const rows = await db.execute(sql, params);
    json(res, rows.rows);
  } catch (err) {
    error(res, err.message, 500);
  }
}
