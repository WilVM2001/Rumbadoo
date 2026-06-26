import { db, ensureSchema, hashPass, genId, json, error, setCors } from '../lib/db.js';
import { rateLimit } from '../lib/middleware.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  if (req.method !== 'POST') { setCors(res); return res.status(405).json({ error: 'Método no permitido' }); }

  // Rate limiting por IP
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!rateLimit('register:' + ip, 3, 60000)) {
    return error(res, 'Demasiados intentos. Espera un minuto.', 429);
  }

  try {
    await ensureSchema();
    const { name, password, age, gender, bio, photo } = req.body;
    if (!name || !password || !age) return error(res, 'Faltan campos requeridos.');
    if (password.length < 4) return error(res, 'La contraseña debe tener al menos 4 caracteres.');

    const existing = await db.execute("SELECT id FROM profiles WHERE name = ?", [name]);
    if (existing.rows.length > 0) return error(res, 'Ese nombre ya está en uso.', 409);

    const id = genId();
    await db.execute(
      "INSERT INTO profiles (id, name, password, age, gender, bio, photo) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [id, name, hashPass(password), age, gender || '', bio || '', photo || '']
    );

    const p = await db.execute("SELECT id, name, age, gender, bio, photo, role, createdAt FROM profiles WHERE id = ?", [id]);
    json(res, { ok: true, profile: p.rows[0] });
  } catch (err) {
    error(res, err.message, 500);
  }
}
