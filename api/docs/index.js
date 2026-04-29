const { json, error, methodNotAllowed, readData, writeData, slugify, getAuthenticatedUser } = require('../_utils');

module.exports = (req, res) => {
  if (req.method === 'GET') {
    const { pages = [] } = readData();
    const list = pages
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999) || a.title.localeCompare(b.title))
      .map(({ id, title, subtitle, category, slug, order, updatedAt }) => ({ id, title, subtitle, category, slug, order, updatedAt }));
    return json(res, list);
  }

  if (req.method === 'POST') {
    if (!getAuthenticatedUser(req)) return error(res, 401, 'Unauthorized');
    const body = req.body || {};
    const title = String(body.title || '').trim();
    if (!title) return error(res, 400, 'Title is required');

    const data = readData();
    let slug = slugify(title) || 'page';
    let counter = 2;
    while (data.pages.find(p => p.slug === slug)) {
      slug = `${slugify(title)}-${counter++}`;
    }

    const page = {
      id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      title,
      subtitle: String(body.subtitle || '').trim(),
      category: String(body.category || 'General').trim() || 'General',
      content: String(body.content || ''),
      slug,
      order: body.order != null ? Number(body.order) : data.pages.length,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    data.pages.push(page);
    writeData(data);
    return json(res, page, 201);
  }

  return methodNotAllowed(res, 'GET, POST');
};
