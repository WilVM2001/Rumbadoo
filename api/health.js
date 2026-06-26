import { ensureSchema, json, setCors } from '../lib/db.js';

export default async function handler(req, res) {
  if (req.method === 'OPTIONS') { setCors(res); return res.status(204).end(); }
  try {
    await ensureSchema();
    json(res, { status: 'ok', uptime: process.uptime() });
  } catch (err) {
    json(res, { status: 'error', message: err.message }, 500);
  }
}
