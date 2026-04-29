const { json, methodNotAllowed, clearAuthCookie } = require('./_utils');

module.exports = (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  clearAuthCookie(res);
  return json(res, { ok: true });
};
