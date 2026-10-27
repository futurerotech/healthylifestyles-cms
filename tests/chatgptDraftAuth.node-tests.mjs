import test from 'node:test';
import assert from 'node:assert/strict';
import { draftBridgeAuth } from '../src/lib/chatgptDraftAuth.ts';

const token = '9d'.repeat(32);
const requestHeaders = (headers = {}) => new Headers(headers);

test('valid server-only bearer token is permitted', () => {
  assert.equal(draftBridgeAuth(requestHeaders({ Authorization: `Bearer ${token}` }), token), 'ok');
});
test('route fails closed without configured or sufficiently strong secret', () => {
  for (const weak of [undefined, '', 'a'.repeat(42), 'with space'.repeat(6), 'a'.repeat(1025)]) {
    assert.equal(draftBridgeAuth(requestHeaders({ Authorization: `Bearer ${token}` }), weak), 'unconfigured');
  }
});
test('rejects absent, incorrect and malformed bearer tokens', () => {
  for (const value of ['', token, 'Basic '+token, 'Bearer '+token.slice(0,-1), 'Bearer '+token+'x', 'bearer '+token]) {
    assert.equal(draftBridgeAuth(requestHeaders(value ? { Authorization: value } : {}), token), 'denied');
  }
});
test('rejects browser Origin even with correct bearer token', () => {
  assert.equal(draftBridgeAuth(requestHeaders({Authorization:`Bearer ${token}`,Origin:'https://evil.example'}), token),'denied');
});
test('rejects cookies even with correct bearer token', () => {
  assert.equal(draftBridgeAuth(requestHeaders({Authorization:`Bearer ${token}`,Cookie:'session=stolen'}), token),'denied');
});
test('rejects browser Origin plus cookies with correct bearer token', () => {
  assert.equal(draftBridgeAuth(requestHeaders({Authorization:`Bearer ${token}`,Cookie:'x=y',Origin:'https://cms.healthylifesstyles.com'}), token),'denied');
});
test('case-insensitive HTTP headers cannot bypass checks', () => {
  assert.equal(draftBridgeAuth(requestHeaders({AUTHORIZATION:`Bearer ${token}`,COOKIE:'x=y'}), token),'denied');
  assert.equal(draftBridgeAuth(requestHeaders({AUTHORIZATION:`Bearer ${token}`,ORIGIN:'https://sample.org'}), token),'denied');
});
