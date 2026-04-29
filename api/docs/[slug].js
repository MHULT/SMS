const { json, error, methodNotAllowed, readData, writeData, getAuthenticatedUser } = require('../_utils');

module.exports = (req, res) => {
  const { slug } = req.query || {};
  if (!slug) return error(res, 400, 'Missing slug or id');

  if (req.method === 'GET') {
    const { pages = [] } = readData();
    const page = pages.find(p => p.slug === slug || p.id === slug);
    if (!page) return error(res, 404, 'Page not found');
    return json(res, page);
  }

  if (!getAuthenticatedUser(req)) return error(res, 401, 'Unauthorized');

  const data = readData();
  const pageIndex = data.pages.findIndex(p => p.slug === slug || p.id === slug);
  if (pageIndex === -1) return error(res, 404, 'Page not found');

  if (req.method === 'PUT') {
    const body = req.body || {};
    const existing = data.pages[pageIndex];
    data.pages[pageIndex] = {
      ...existing,
      ...(body.title != null && { title: String(body.title).trim() }),
      ...(body.subtitle != null && { subtitle: String(body.subtitle).trim() }),
      ...(body.category != null && { category: String(body.category).trim() || 'General' }),
      ...(body.content != null && { content: String(body.content) }),
      ...(body.order != null && { order: Number(body.order) }),
      updatedAt: new Date().toISOString(),
    };
    writeData(data);
    return json(res, data.pages[pageIndex]);
  }

  if (req.method === 'DELETE') {
    data.pages.splice(pageIndex, 1);
    writeData(data);
    return json(res, { ok: true });
  }

  return methodNotAllowed(res, 'GET, PUT, DELETE');
};
