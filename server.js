const express = require('express');
const cookieParser = require('cookie-parser');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const DATA_FILE = path.join(__dirname, 'data', 'docs.json');

const CREDENTIALS = { username: 'admin', password: 'Sms@2025' };
const JWT_SECRET = process.env.JWT_SECRET || 'sms-local-dev-secret-change-in-prod';
const IS_VERCEL = process.env.VERCEL === '1';
const HAS_KV = !!(process.env.KV_REST_API_URL);

// Local dev: ensure data file exists
if (!IS_VERCEL) {
  const dataDir = path.join(__dirname, 'data');
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify({ pages: [] }, null, 2));
  }
}

// ── STORAGE ───────────────────────────────────────────────────────────────────

async function readData() {
  if (HAS_KV) {
    const { kv } = require('@vercel/kv');
    const pages = await kv.get('sms_pages') ?? [];
    return { pages };
  }
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
  } catch {
    return { pages: [] };
  }
}

async function writeData(data) {
  if (HAS_KV) {
    const { kv } = require('@vercel/kv');
    await kv.set('sms_pages', data.pages);
    return;
  }
  if (!IS_VERCEL) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
  }
}

function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// ── MIDDLEWARE ────────────────────────────────────────────────────────────────

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// Brand assets and static files are now inside the repo
app.use(express.static(__dirname));

function requireAuth(req, res, next) {
  try {
    jwt.verify(req.cookies?.sms_token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ error: 'Unauthorized' });
  }
}

// ── AUTH ──────────────────────────────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
    const token = jwt.sign({ admin: true }, JWT_SECRET, { expiresIn: '8h' });
    res.cookie('sms_token', token, {
      httpOnly: true,
      secure: IS_VERCEL,
      sameSite: 'lax',
      maxAge: 8 * 60 * 60 * 1000
    });
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

app.post('/api/logout', (req, res) => {
  res.clearCookie('sms_token');
  res.json({ ok: true });
});

app.get('/api/me', (req, res) => {
  try {
    jwt.verify(req.cookies?.sms_token, JWT_SECRET);
    res.json({ authenticated: true });
  } catch {
    res.json({ authenticated: false });
  }
});

// ── DOCS API ──────────────────────────────────────────────────────────────────

app.get('/api/docs', async (req, res) => {
  try {
    const { pages } = await readData();
    const list = pages
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title))
      .map(({ id, title, subtitle, category, slug, order, updatedAt }) =>
        ({ id, title, subtitle, category, slug, order, updatedAt }));
    res.json(list);
  } catch {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.get('/api/docs/:slug', async (req, res) => {
  try {
    const { pages } = await readData();
    const page = pages.find(p => p.slug === req.params.slug || p.id === req.params.slug);
    if (!page) return res.status(404).json({ error: 'Page not found' });
    res.json(page);
  } catch {
    res.status(500).json({ error: 'Failed to read data' });
  }
});

app.post('/api/docs', requireAuth, async (req, res) => {
  try {
    const { title, subtitle = '', category = 'Allmänt', content = '', order } = req.body;
    if (!title?.trim()) return res.status(400).json({ error: 'Titel krävs' });

    const data = await readData();
    let slug = slugify(title) || 'sida';
    let counter = 2;
    while (data.pages.find(p => p.slug === slug)) slug = `${slugify(title)}-${counter++}`;

    const page = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title: title.trim(),
      subtitle: subtitle.trim(),
      category: category.trim() || 'Allmänt',
      content,
      slug,
      order: order != null ? Number(order) : data.pages.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    data.pages.push(page);
    await writeData(data);
    res.status(201).json(page);
  } catch {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.put('/api/docs/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const i = data.pages.findIndex(p => p.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Page not found' });

    const { title, subtitle, category, content, order } = req.body;
    const p = data.pages[i];
    data.pages[i] = {
      ...p,
      ...(title != null && { title: title.trim() }),
      ...(subtitle != null && { subtitle: subtitle.trim() }),
      ...(category != null && { category: category.trim() || 'Allmänt' }),
      ...(content != null && { content }),
      ...(order != null && { order: Number(order) }),
      updatedAt: new Date().toISOString()
    };

    await writeData(data);
    res.json(data.pages[i]);
  } catch {
    res.status(500).json({ error: 'Failed to save data' });
  }
});

app.delete('/api/docs/:id', requireAuth, async (req, res) => {
  try {
    const data = await readData();
    const i = data.pages.findIndex(p => p.id === req.params.id);
    if (i === -1) return res.status(404).json({ error: 'Page not found' });
    data.pages.splice(i, 1);
    await writeData(data);
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: 'Failed to delete' });
  }
});

// ── START ─────────────────────────────────────────────────────────────────────

if (!IS_VERCEL) {
  app.listen(PORT, () => {
    console.log('\n  ┌─────────────────────────────────────────┐');
    console.log('  │   Security Management System – Docs     │');
    console.log('  ├─────────────────────────────────────────┤');
    console.log(`  │   Site:  http://localhost:${PORT}           │`);
    console.log(`  │   Docs:  http://localhost:${PORT}/docs/     │`);
    console.log(`  │   Admin: http://localhost:${PORT}/admin/    │`);
    console.log('  └─────────────────────────────────────────┘\n');
    console.log(`  Inloggning: admin / Sms@2025\n`);
  });
}

module.exports = app;
