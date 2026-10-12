const { test, describe } = require('node:test');
const assert = require('node:assert/strict');
const { hashPassword, verifyPassword, str, isUrl, validateArticle } = require('../lib');

describe('password hashing', () => {
  test('verifies the correct password', () => {
    assert.equal(verifyPassword('secret1', hashPassword('secret1')), true);
  });
  test('rejects a wrong password', () => {
    assert.equal(verifyPassword('other', hashPassword('secret1')), false);
  });
  test('uses a random salt so hashes differ', () => {
    assert.notEqual(hashPassword('secret1'), hashPassword('secret1'));
  });
  test('is deterministic for a fixed salt', () => {
    assert.equal(hashPassword('pw', 'abc'), hashPassword('pw', 'abc'));
  });
  test('does not contain the plain password', () => {
    assert.ok(!hashPassword('secret1').includes('secret1'));
  });
});

describe('str', () => {
  test('trims whitespace', () => assert.equal(str('  hi  ', 10), 'hi'));
  test('truncates to max length', () => assert.equal(str('abcdef', 3), 'abc'));
  test('returns empty string for non-strings', () => {
    for (const v of [undefined, null, 5, {}, []]) assert.equal(str(v, 10), '');
  });
});

describe('isUrl', () => {
  test('accepts http and https', () => {
    assert.equal(isUrl('http://example.com'), true);
    assert.equal(isUrl('https://example.com/a?b=1'), true);
  });
  test('rejects other protocols', () => {
    for (const v of ['javascript:alert(1)', 'ftp://x.com', 'data:text/html,hi', 'file:///etc/passwd'])
      assert.equal(isUrl(v), false, v);
  });
  test('rejects garbage', () => {
    for (const v of ['', 'not a url', 'example.com']) assert.equal(isUrl(v), false, v);
  });
});

describe('validateArticle', () => {
  test('requires a title', () => {
    assert.deepEqual(validateArticle({}), { error: 'Title is required' });
    assert.deepEqual(validateArticle({ title: '   ' }), { error: 'Title is required' });
  });
  test('accepts a minimal article', () => {
    const { value, error } = validateArticle({ title: ' Hello ' });
    assert.equal(error, undefined);
    assert.equal(value.title, 'Hello');
    assert.equal(value.summary, '');
  });
  test('rejects a non-http link', () => {
    assert.match(validateArticle({ title: 't', url: 'javascript:1' }).error, /Link/);
  });
  test('rejects a non-http image', () => {
    assert.match(validateArticle({ title: 't', imageUrl: 'ftp://x' }).error, /Image/);
  });
  test('accepts valid link and image', () => {
    const r = validateArticle({ title: 't', url: 'https://a.com', imageUrl: 'http://b.com/i.png', source: 'S' });
    assert.equal(r.error, undefined);
    assert.equal(r.value.source, 'S');
  });
  test('truncates long fields', () => {
    const r = validateArticle({ title: 'x'.repeat(400), summary: 'y'.repeat(6000) });
    assert.equal(r.value.title.length, 300);
    assert.equal(r.value.summary.length, 5000);
  });
  test('ignores non-string field values', () => {
    assert.equal(validateArticle({ title: 123 }).error, 'Title is required');
  });
});
