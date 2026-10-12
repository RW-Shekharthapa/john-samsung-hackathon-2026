const express = require('express');
const crypto = require('crypto');
const mysql = require('mysql2/promise');

const app = express();
app.use(express.json({ limit: '100kb' }));

const pool = mysql.createPool({ uri: process.env.DATABASE_URL, connectionLimit: 5 });
const NEWS_API = 'https://api.spaceflightnewsapi.net/v4/articles/';
const SESSION_DAYS = 7;

// ---------- helpers ----------
const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
const verifyPassword = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return orig.length === test.length && crypto.timingSafeEqual(orig, test);
};
const wrap = (fn) => (req, res) => fn(req, res).catch((e) => {
  console.error(e);
  res.status(500).json({ error: 'Internal server error' });
});
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isUrl = (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };

async function createSession(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  await pool.query(
    'INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL ? DAY))',
    [token, userId, SESSION_DAYS]
  );
  return token;
}

async function auth(req, res, next) {
  try {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    const [rows] = await pool.query(
      `SELECT u.id, u.username FROM sessions s JOIN users u ON u.id = s.user_id
       WHERE s.token = ? AND s.expires_at > NOW()`, [token]);
    if (!rows.length) return res.status(401).json({ error: 'Session expired, please sign in again' });
    req.user = rows[0];
    req.token = token;
    next();
  } catch (e) { console.error(e); res.status(500).json({ error: 'Internal server error' }); }
}

// ---------- schema + demo user ----------
async function init() {
  await pool.query(`CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(40) NOT NULL UNIQUE,
    password_hash VARCHAR(300) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS sessions (
    token CHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  await pool.query(`CREATE TABLE IF NOT EXISTS articles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(300) NOT NULL,
    summary TEXT,
    url VARCHAR(1000),
    image_url VARCHAR(1000),
    source VARCHAR(120),
    external_id VARCHAR(40),
    published_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    UNIQUE KEY uq_user_external (user_id, external_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE)`);
  const [u] = await pool.query('SELECT id FROM users WHERE username = ?', ['demo']);
  if (!u.length) await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', ['demo', hashPassword('demo1234')]);
}

// ---------- health ----------
app.get('/api/db', wrap(async (_q, r) => {
  try { await pool.query('select 1'); r.json({ db: 'ok' }); }
  catch (e) { r.status(503).json({ db: 'error', message: e.message }); }
}));

// ---------- auth ----------
app.post('/api/auth/register', wrap(async (req, res) => {
  const username = str(req.body.username, 40);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  if (!/^[A-Za-z0-9_.-]{3,40}$/.test(username))
    return res.status(400).json({ error: 'Username must be 3-40 characters (letters, numbers, . _ -)' });
  if (password.length < 6 || password.length > 100)
    return res.status(400).json({ error: 'Password must be 6-100 characters' });
  try {
    const [r] = await pool.query('INSERT INTO users (username, password_hash) VALUES (?, ?)', [username, hashPassword(password)]);
    res.status(201).json({ token: await createSession(r.insertId), user: { id: r.insertId, username } });
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Username already taken' });
    throw e;
  }
}));

app.post('/api/auth/login', wrap(async (req, res) => {
  const username = str(req.body.username, 40);
  const password = typeof req.body.password === 'string' ? req.body.password : '';
  const [rows] = await pool.query('SELECT * FROM users WHERE username = ?', [username]);
  if (!rows.length || !verifyPassword(password, rows[0].password_hash))
    return res.status(401).json({ error: 'Invalid username or password' });
  res.json({ token: await createSession(rows[0].id), user: { id: rows[0].id, username: rows[0].username } });
}));

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

app.post('/api/auth/logout', auth, wrap(async (req, res) => {
  await pool.query('DELETE FROM sessions WHERE token = ?', [req.token]);
  res.json({ ok: true });
}));

// ---------- live news feed (Spaceflight News API, free, no key) ----------
app.get('/api/feed', auth, wrap(async (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 30);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const params = new URLSearchParams({ limit, offset });
  const search = str(req.query.search, 100);
  if (search) params.set('search', search);
  let data;
  try {
    const r = await fetch(`${NEWS_API}?${params}`, { signal: AbortSignal.timeout(10000) });
    if (!r.ok) throw new Error(`upstream ${r.status}`);
    data = await r.json();
  } catch (e) {
    console.error('feed error', e.message);
    return res.status(502).json({ error: 'Could not load news from the provider. Please try again.' });
  }
  const [saved] = await pool.query('SELECT external_id FROM articles WHERE user_id = ? AND external_id IS NOT NULL', [req.user.id]);
  const savedIds = new Set(saved.map((s) => s.external_id));
  res.json({
    count: data.count,
    results: data.results.map((a) => ({
      externalId: String(a.id),
      title: a.title,
      summary: a.summary,
      url: a.url,
      imageUrl: a.image_url,
      source: a.news_site,
      publishedAt: a.published_at,
      saved: savedIds.has(String(a.id)),
    })),
  });
}));

// ---------- articles CRUD (per-user) ----------
const toDto = (r) => ({
  id: r.id, title: r.title, summary: r.summary, url: r.url, imageUrl: r.image_url,
  source: r.source, externalId: r.external_id, publishedAt: r.published_at,
  createdAt: r.created_at, updatedAt: r.updated_at,
});

function validateArticle(b) {
  const a = {
    title: str(b.title, 300),
    summary: str(b.summary, 5000),
    url: str(b.url, 1000),
    imageUrl: str(b.imageUrl, 1000),
    source: str(b.source, 120),
  };
  if (!a.title) return { error: 'Title is required' };
  if (a.url && !isUrl(a.url)) return { error: 'Link must be a valid http(s) URL' };
  if (a.imageUrl && !isUrl(a.imageUrl)) return { error: 'Image must be a valid http(s) URL' };
  return { value: a };
}

app.get('/api/articles', auth, wrap(async (req, res) => {
  const search = str(req.query.search, 100);
  const [rows] = search
    ? await pool.query('SELECT * FROM articles WHERE user_id = ? AND (title LIKE ? OR summary LIKE ?) ORDER BY created_at DESC, id DESC',
        [req.user.id, `%${search}%`, `%${search}%`])
    : await pool.query('SELECT * FROM articles WHERE user_id = ? ORDER BY created_at DESC, id DESC', [req.user.id]);
  res.json(rows.map(toDto));
}));

app.post('/api/articles', auth, wrap(async (req, res) => {
  const { error, value: a } = validateArticle(req.body);
  if (error) return res.status(400).json({ error });
  const externalId = str(req.body.externalId, 40) || null;
  const published = req.body.publishedAt ? new Date(req.body.publishedAt) : null;
  const publishedAt = published && !isNaN(published) ? published : null;
  try {
    const [r] = await pool.query(
      `INSERT INTO articles (user_id, title, summary, url, image_url, source, external_id, published_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [req.user.id, a.title, a.summary || null, a.url || null, a.imageUrl || null, a.source || null, externalId, publishedAt]);
    const [rows] = await pool.query('SELECT * FROM articles WHERE id = ?', [r.insertId]);
    res.status(201).json(toDto(rows[0]));
  } catch (e) {
    if (e.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'This article is already saved' });
    throw e;
  }
}));

app.put('/api/articles/:id', auth, wrap(async (req, res) => {
  const { error, value: a } = validateArticle(req.body);
  if (error) return res.status(400).json({ error });
  const [r] = await pool.query(
    'UPDATE articles SET title = ?, summary = ?, url = ?, image_url = ?, source = ? WHERE id = ? AND user_id = ?',
    [a.title, a.summary || null, a.url || null, a.imageUrl || null, a.source || null, req.params.id, req.user.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Article not found' });
  const [rows] = await pool.query('SELECT * FROM articles WHERE id = ?', [req.params.id]);
  res.json(toDto(rows[0]));
}));

app.delete('/api/articles/:id', auth, wrap(async (req, res) => {
  const [r] = await pool.query('DELETE FROM articles WHERE id = ? AND user_id = ?', [req.params.id, req.user.id]);
  if (!r.affectedRows) return res.status(404).json({ error: 'Article not found' });
  res.json({ ok: true });
}));

// ---------- start ----------
const port = process.env.PORT || 8080;
init()
  .then(() => app.listen(port, '0.0.0.0', () => console.log('API on :' + port)))
  .catch((e) => { console.error('DB init failed:', e.message); process.exit(1); });
