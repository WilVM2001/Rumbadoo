import { ensureSchema, hashPass, getDb, json, error, dbError } from '../lib/db.js';
export default async function handler(req, res) {
  if (req.method !== 'POST') { error(res, 'Método no permitido', 405); return; }
  const ok = await ensureSchema(); if (!ok) return dbError(res);
  try {
    const { name, password } = req.body;
    if (!name || !password) return error(res, 'Faltan campos.');
    const d = await getDb();
    if (name === 'admin') {
      const a = await d.execute("SELECT * FROM profiles WHERE name = '__admin__'");
      if (a.rows.length > 0 && a.rows[0].password === hashPass(password)) { const p = { ...a.rows[0] }; delete p.password; return json(res, { ok: true, profile: p }); }
      return error(res, 'Credenciales inválidas.', 401);
    }
    const profile = await d.execute("SELECT * FROM profiles WHERE name = ?", [name]);
    if (profile.rows.length === 0) return error(res, 'Ese usuario no existe.', 404);
    if (profile.rows[0].password !== hashPass(password)) return error(res, 'Contraseña incorrecta.', 401);
    const p = { ...profile.rows[0] }; delete p.password;
    json(res, { ok: true, profile: p });
  } catch (err) { error(res, err.message, 500); }
}
