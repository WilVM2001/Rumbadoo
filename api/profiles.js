import { ensureSchema, getDb, json, error, dbError } from '../lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'GET') { error(res, 'Método no permitido', 405); return; }
  const ok = await ensureSchema(); if (!ok) return dbError(res);
  try {
    const { exclude } = req.query;
    const d = await getDb();
    let sql = "SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE role != 'admin'";
    const params = [];
    if (exclude) { sql += " AND id != ?"; params.push(exclude); }
    json(res, (await d.execute(sql, params)).rows);
  } catch (err) { error(res, err.message, 500); }
}
