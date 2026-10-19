import { test } from 'node:test';
import assert from 'node:assert/strict';
import { isNewer } from './version.ts';

test('isNewer vergleicht Versionen numerisch', () => {
  assert.ok(isNewer('0.3.0', '0.2.0'));
  assert.ok(isNewer('v0.10.0', '0.9.5'));
  assert.ok(isNewer('1.0.0', '0.99.99'));
  assert.ok(!isNewer('0.2.0', '0.2.0'));
  assert.ok(!isNewer('v0.2.0', '0.2.1'));
  assert.ok(isNewer('0.2.1', '0.2'));
});
