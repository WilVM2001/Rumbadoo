import { db, ensureSchema, hashPass, json, error, setCors } from '../lib/db.js';
import { rateLimit } from '../lib/middleware.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  if (req.method !== 'POST') { setCors(res); return res.status(405).json({ error: 'Método no permitido' }); }

  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress || 'unknown';
  if (!rateLimit('login:' + ip, 10, 60000)) {
    return error(res, 'Demasiados intentos. Espera un minuto.', 429);
  }

  try {
    await ensureSchema();
    const { name, password } = req.body;
    if (!name || !password) return error(res, 'Faltan campos.');

    if (name === 'admin') {
      const a = await db.execute("SELECT * FROM profiles WHERE name = '__admin__'");
      if (a.rows.length > 0 && a.rows[0].password === hashPass(password)) {
        const p = { ...a.rows[0] };
        delete p.password;
        return json(res, { ok: true, profile: p });
      }
      return error(res, 'Credenciales inválidas.', 401);
    }

    const profile = await db.execute("SELECT * FROM profiles WHERE name = ?", [name]);
    if (profile.rows.length === 0) return error(res, 'Ese usuario no existe.', 404);

    if (profile.rows[0].password !== hashPass(password)) return error(res, 'Contraseña incorrecta.', 401);

    const p = { ...profile.rows[0] };
    delete p.password;
    json(res, { ok: true, profile: p });
  } catch (err) {
    error(res, err.message, 500);
  }
}
