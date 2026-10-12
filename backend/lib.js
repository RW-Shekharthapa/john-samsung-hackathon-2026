const crypto = require('crypto');

const hashPassword = (pw, salt = crypto.randomBytes(16).toString('hex')) =>
  `${salt}:${crypto.scryptSync(pw, salt, 64).toString('hex')}`;
const verifyPassword = (pw, stored) => {
  const [salt, hash] = stored.split(':');
  const test = crypto.scryptSync(pw, salt, 64);
  const orig = Buffer.from(hash, 'hex');
  return orig.length === test.length && crypto.timingSafeEqual(orig, test);
};
const str = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const isUrl = (v) => { try { return ['http:', 'https:'].includes(new URL(v).protocol); } catch { return false; } };

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

module.exports = { hashPassword, verifyPassword, str, isUrl, validateArticle };
