const { json, error, methodNotAllowed, CREDENTIALS, setAuthCookie } = require('./_utils');

module.exports = (req, res) => {
  if (req.method !== 'POST') return methodNotAllowed(res, 'POST');
  const body = req.body || {};

  if (body.username === CREDENTIALS.username && body.password === CREDENTIALS.password) {
    setAuthCookie(res);
    return json(res, { ok: true });
  }

  return error(res, 401, 'Invalid username or password');
};
