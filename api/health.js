import { ensureSchema, json, dbError } from '../lib/db.js';
export default async function handler(req, res) {
  const ok = await ensureSchema();
  if (!ok) return dbError(res);
  json(res, { status: 'ok' });
}
