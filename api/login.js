import { db, ensureSchema, hashPass, json, error } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  if (req.method !== 'POST') return error(res, 'Método no permitido', 405);

  try {
    await ensureSchema();
    const { name, password } = req.body;
    if (!name || !password) return error(res, 'Faltan campos.');

    if (name.toLowerCase() === 'admin') {
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
