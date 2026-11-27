import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bobaDates } from '../src/tools.mjs';

test('Boba Today changes at the configured local reset, across a year boundary', () => {
  assert.deepEqual(bobaDates(new Date('2026-12-31T20:59Z'), 'Asia/Jakarta', 4), { localDate: '2027-01-01', bobaDay: '2026-12-31' });
  assert.equal(bobaDates(new Date('2026-12-31T21:00Z'), 'Asia/Jakarta', 4).bobaDay, '2027-01-01');
});
