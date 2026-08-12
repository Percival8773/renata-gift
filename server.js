const path = require('path');
const fs = require('fs');
const express = require('express');
const { DatabaseSync } = require('node:sqlite');

const ROOT = __dirname;
const CONTENT_PATH = process.env.CONTENT_PATH || path.join(ROOT, 'content', 'content.json');
const DATA_DIR = process.env.DATA_DIR || path.join(ROOT, 'data');
const DB_PATH = path.join(DATA_DIR, 'gift.db');
const PORT = process.env.PORT || 3000;

function loadContent() {
  const raw = fs.readFileSync(CONTENT_PATH, 'utf8').replace(/^\uFEFF/, '');
  return JSON.parse(raw);
}
let content = loadContent();

fs.mkdirSync(DATA_DIR, { recursive: true });
const db = new DatabaseSync(DB_PATH);
db.exec(`
CREATE TABLE IF NOT EXISTS opens (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  opened_at TEXT NOT NULL,
  via TEXT DEFAULT 'web'
);
CREATE TABLE IF NOT EXISTS progress (
  device TEXT PRIMARY KEY,
  layer INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL
);
`);

const app = express();
app.use(express.json());
app.use(express.static(path.join(ROOT, 'public')));

const VIDEO_SOURCE = process.env.VIDEO_SOURCE || 'https://drive.usercontent.google.com/download?id=1mXCU0WWTAMDKQFyvWdD_X9fReJiJq1MF&export=download&confirm=t';

app.get('/api/video', async (req, res) => {
  const source = VIDEO_SOURCE;
  if (!source || !/^https:\/\/drive\.usercontent\.google\.com\//.test(source)) {
    return res.status(404).end();
  }
  try {
    const headers = {};
    if (req.headers.range) headers.Range = req.headers.range;
    const upstream = await fetch(source, { headers });
    if (!upstream.ok && upstream.status !== 206) return res.status(upstream.status).end();
    res.status(upstream.status === 206 ? 206 : 200);
    res.setHeader('Content-Type', 'video/mp4');
    res.setHeader('Accept-Ranges', 'bytes');
    const length = upstream.headers.get('content-length');
    const range = upstream.headers.get('content-range');
    if (length) res.setHeader('Content-Length', length);
    if (range) res.setHeader('Content-Range', range);
    if (upstream.body) {
      for await (const chunk of upstream.body) res.write(chunk);
    }
    res.end();
  } catch (error) {
    if (!res.headersSent) res.status(502).json({ error: 'video no disponible' });
    else res.end();
  }
});

const nowISO = () => new Date().toISOString();
const PREVIEW_UNTIL = process.env.PREVIEW_UNTIL ? new Date(process.env.PREVIEW_UNTIL).getTime() : 0;
const isUnlocked = () => (PREVIEW_UNTIL && Date.now() < PREVIEW_UNTIL) || Date.now() >= new Date(content.unlockAt).getTime();

app.get('/api/status', (req, res) => {
  res.json({
    unlocked: isUnlocked(),
    unlockAt: content.unlockAt,
    novia: { nombre: content.novia.nombre, edad: content.novia.edad }
  });
});

app.post('/api/open', (req, res) => {
  const via = (req.body && req.body.via) || 'web';
  db.prepare('INSERT INTO opens (opened_at, via) VALUES (?, ?)').run(nowISO(), via);
  const total = db.prepare('SELECT COUNT(*) AS c FROM opens').get().c;
  res.json({ ok: true, total });
});

app.get('/api/progress', (req, res) => {
  const device = req.query.device;
  if (!device) return res.status(400).json({ error: 'device requerido' });
  const row = db.prepare('SELECT layer FROM progress WHERE device = ?').get(String(device));
  res.json({ layer: row ? row.layer : 0 });
});

const SECRETO_KEY = process.env.SECRETO_KEY || '4426';

app.post('/api/secreto', (req, res) => {
  const clave = String((req.body && req.body.clave) || '').replace(/\D/g, '');
  if (clave === SECRETO_KEY.replace(/\D/g, '')) {
    return res.json({ ok: true });
  }
  res.json({ ok: false });
});

app.post('/api/progress', (req, res) => {
  const device = req.body.device;
  const layer = Number(req.body.layer);
  if (!device || !Number.isInteger(layer) || layer < 0) {
    return res.status(400).json({ error: 'body inválido' });
  }
  const ts = nowISO();
  db.prepare(
    'INSERT INTO progress (device, layer, updated_at) VALUES (?, ?, ?) ' +
    'ON CONFLICT(device) DO UPDATE SET layer = excluded.layer, updated_at = excluded.updated_at'
  ).run(String(device), layer, ts);
  res.json({ ok: true, layer });
});

app.get('/api/content', (req, res) => {
  const safe = { ...content };
  delete safe.adminKey;
  res.json(safe);
});

app.get('/api/admin/stats', (req, res) => {
  if (req.query.key !== content.adminKey) return res.status(403).json({ error: 'no autorizado' });
  const total = db.prepare('SELECT COUNT(*) AS c FROM opens').get().c;
  const opens = db.prepare('SELECT opened_at, via FROM opens ORDER BY id DESC LIMIT 100').all();
  const progress = db.prepare('SELECT device, layer, updated_at FROM progress ORDER BY updated_at DESC LIMIT 20').all();
  res.json({ total, opens, progress });
});

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  res.sendFile(path.join(ROOT, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`renata-gift en http://localhost:${PORT}`);
});
