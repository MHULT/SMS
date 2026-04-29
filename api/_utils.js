const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const DATA_FILE = path.join(__dirname, '..', 'data', 'docs.json');
const TMP_FILE = path.join('/tmp', 'docs.json');
const COOKIE_NAME = 'sms_auth';
const COOKIE_MAX_AGE = 8 * 60 * 60; // 8 hours in seconds
const CREDENTIALS = { username: 'admin', password: 'Sms@2025' };
const SECRET = process.env.SMS_SESSION_SECRET || 'sms-session-secret-xk9z7p2025';

function json(res, payload, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(payload));
}

function error(res, status, message) {
  json(res, { error: message }, status);
}

function methodNotAllowed(res, allowed = 'GET, POST') {
  res.statusCode = 405;
  res.setHeader('Allow', allowed);
  res.end('Method Not Allowed');
}

function parseCookies(cookieHeader = '') {
  return cookieHeader.split(';').reduce((acc, cookie) => {
    const [name, ...rest] = cookie.split('=');
    if (!name) return acc;
    acc[name.trim()] = rest.join('=').trim();
    return acc;
  }, {});
}

function getStorageFile() {
  if (fs.existsSync(TMP_FILE)) return TMP_FILE;
  return DATA_FILE;
}

function readData() {
  const file = getStorageFile();
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

function writeData(data) {
  const payload = JSON.stringify(data, null, 2);
  try {
    fs.writeFileSync(DATA_FILE, payload);
  } catch (err) {
    if (err.code === 'EROFS' || err.code === 'EPERM') {
      fs.writeFileSync(TMP_FILE, payload);
    } else {
      throw err;
    }
  }
}

function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function signToken(username, timestamp) {
  return crypto
    .createHmac('sha256', SECRET)
    .update(`${username}|${timestamp}`)
    .digest('hex');
}

function createToken(username) {
  const timestamp = Date.now();
  return `${username}|${timestamp}|${signToken(username, timestamp)}`;
}

function verifyToken(token) {
  if (!token) return null;
  const [username, timestamp, signature] = token.split('|');
  if (!username || !timestamp || !signature) return null;
  if (signature !== signToken(username, timestamp)) return null;
  if (Date.now() - Number(timestamp) > COOKIE_MAX_AGE * 1000) return null;
  if (username !== CREDENTIALS.username) return null;
  return username;
}

function getAuthToken(req) {
  const cookies = parseCookies(req.headers.cookie || '');
  return cookies[COOKIE_NAME];
}

function authCookieString(value) {
  const secure = process.env.NODE_ENV === 'production';
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${COOKIE_MAX_AGE}${secure ? '; Secure' : ''}`;
}

function setAuthCookie(res) {
  res.setHeader('Set-Cookie', authCookieString(createToken(CREDENTIALS.username)));
}

function clearAuthCookie(res) {
  res.setHeader('Set-Cookie', `${COOKIE_NAME}=deleted; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
}

function getAuthenticatedUser(req) {
  const token = getAuthToken(req);
  return verifyToken(token);
}

module.exports = {
  json,
  error,
  methodNotAllowed,
  readData,
  writeData,
  slugify,
  CREDENTIALS,
  setAuthCookie,
  clearAuthCookie,
  getAuthenticatedUser,
};
