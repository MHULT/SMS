const { json, methodNotAllowed, getAuthenticatedUser } = require('./_utils');

module.exports = (req, res) => {
  if (req.method !== 'GET') return methodNotAllowed(res, 'GET');
  const authenticated = !!getAuthenticatedUser(req);
  return json(res, { authenticated });
};
