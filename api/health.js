import { ensureSchema, json } from '../lib/db.js';
export default async function handler(req, res) { await ensureSchema(); json(res, { status: 'ok' }); }
