import { ensureSchema, json } from '../../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') return json(res, {});
  try {
    await ensureSchema();
    json(res, { status: 'ok', uptime: process.uptime() });
  } catch (err) {
    json(res, { status: 'error', message: err.message }, 500);
  }
}
