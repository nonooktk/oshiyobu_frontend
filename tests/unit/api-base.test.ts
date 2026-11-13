// API の接続先（VITE_API_BASE）の正規化（設計 D-16・D-24）。未設定・不正なら、サーバーなしで動く
import { describe, expect, it } from 'vitest';
import { normalizeApiBase } from '../../src/shared/meter/apiBase';

describe('normalizeApiBase', () => {
  it.each([
    ['https://api.example.test', 'https://api.example.test'],
    ['https://api.example.test/', 'https://api.example.test'],
    ['  https://api.example.test/some/path?q=1  ', 'https://api.example.test'],
    ['http://localhost:8787', 'http://localhost:8787'],
  ])('%s は origin にする', (raw, expected) => {
    expect(normalizeApiBase(raw)).toBe(expected);
  });

  it.each([
    undefined,
    null,
    '',
    '   ',
    'not a url',
    'ftp://example.test',
    'javascript:alert(1)',
    42,
  ])('%s は空（サーバーなし）にする', (raw) => {
    expect(normalizeApiBase(raw)).toBe('');
  });
});
