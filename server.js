const express = require('express');
const session = require('express-session');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_FILE = path.join(__dirname, 'data', 'docs.json');

// Credentials — change these after first login if desired
const CREDENTIALS = { username: 'admin', password: 'Sms@2025' };

// Ensure data directory and file exist
const dataDir = path.join(__dirname, 'data');
if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, JSON.stringify({ pages: [] }, null, 2));
}

function readData() {
  return JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
}

function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

function slugify(str) {
  return str.toLowerCase().trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'sms-session-secret-xk9z7p2025',
  resave: false,
  saveUninitialized: false,
  cookie: { maxAge: 8 * 60 * 60 * 1000 } // 8 hours
}));

// Serve brand assets from parent directory
app.use('/brand_assets', express.static(path.join(__dirname, '..', 'brand_assets')));

// Serve all static files from the website directory
app.use(express.static(__dirname));

function requireAuth(req, res, next) {
  if (req.session.loggedIn) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// ── AUTH ──────────────────────────────────────────────

app.post('/api/login', (req, res) => {
  const { username, password } = req.body;
  if (username === CREDENTIALS.username && password === CREDENTIALS.password) {
    req.session.loggedIn = true;
    res.json({ ok: true });
  } else {
    res.status(401).json({ error: 'Invalid username or password' });
  }
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/me', (req, res) => {
  res.json({ authenticated: !!req.session.loggedIn });
});

// ── DOCS API ──────────────────────────────────────────

// List all pages (without full content) — public
app.get('/api/docs', (req, res) => {
  const { pages } = readData();
  const list = pages
    .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title))
    .map(({ id, title, subtitle, category, slug, order, updatedAt }) =>
      ({ id, title, subtitle, category, slug, order, updatedAt })
    );
  res.json(list);
});

// Get single page by slug or id — public
app.get('/api/docs/:slug', (req, res) => {
  const { pages } = readData();
  const page = pages.find(p => p.slug === req.params.slug || p.id === req.params.slug);
  if (!page) return res.status(404).json({ error: 'Page not found' });
  res.json(page);
});

// Create page — requires auth
app.post('/api/docs', requireAuth, (req, res) => {
  const { title, subtitle = '', category = 'General', content = '', order } = req.body;
  if (!title?.trim()) return res.status(400).json({ error: 'Title is required' });

  const data = readData();

  let slug = slugify(title) || 'page';
  let counter = 2;
  while (data.pages.find(p => p.slug === slug)) {
    slug = `${slugify(title)}-${counter++}`;
  }

  const page = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    title: title.trim(),
    subtitle: subtitle.trim(),
    category: category.trim() || 'General',
    content,
    slug,
    order: order != null ? Number(order) : data.pages.length,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  data.pages.push(page);
  writeData(data);
  res.status(201).json(page);
});

// Update page — requires auth
app.put('/api/docs/:id', requireAuth, (req, res) => {
  const data = readData();
  const i = data.pages.findIndex(p => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Page not found' });

  const { title, subtitle, category, content, order } = req.body;
  const p = data.pages[i];

  data.pages[i] = {
    ...p,
    ...(title != null && { title: title.trim() }),
    ...(subtitle != null && { subtitle: subtitle.trim() }),
    ...(category != null && { category: category.trim() || 'General' }),
    ...(content != null && { content }),
    ...(order != null && { order: Number(order) }),
    updatedAt: new Date().toISOString()
  };

  writeData(data);
  res.json(data.pages[i]);
});

// Delete page — requires auth
app.delete('/api/docs/:id', requireAuth, (req, res) => {
  const data = readData();
  const i = data.pages.findIndex(p => p.id === req.params.id);
  if (i === -1) return res.status(404).json({ error: 'Page not found' });
  data.pages.splice(i, 1);
  writeData(data);
  res.json({ ok: true });
});

// ── START ──────────────────────────────────────────────

app.listen(PORT, () => {
  console.log('\n  ┌─────────────────────────────────────────┐');
  console.log('  │   Security Management System – Docs     │');
  console.log('  ├─────────────────────────────────────────┤');
  console.log(`  │   Site:  http://localhost:${PORT}           │`);
  console.log(`  │   Docs:  http://localhost:${PORT}/docs/     │`);
  console.log(`  │   Admin: http://localhost:${PORT}/admin/    │`);
  console.log('  └─────────────────────────────────────────┘\n');
  console.log('  Login credentials:');
  console.log(`    Username: ${CREDENTIALS.username}`);
  console.log(`    Password: ${CREDENTIALS.password}\n`);
});
