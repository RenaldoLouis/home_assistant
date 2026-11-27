import { beforeEach, after, test } from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { createHash } from 'node:crypto';
import { db, ownerUid, reset } from './helpers.mjs';
import { createConnector } from '../src/server.mjs';

beforeEach(reset);
after(() => db.terminate());

test('the HTTP connector requires owner linking, PKCE and the exact resource, and supports independent revocation', async () => {
  let app;
  const server = createServer((req, res) => app(req, res));
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const origin = `http://127.0.0.1:${server.address().port}`;
  const resource = `${origin}/mcp`;
  const redirectUri = 'https://chatgpt.com/connector/oauth/test-connection';
  const config = { origin, resource, ownerUid, timeZone: 'Asia/Jakarta', clientId: 'chatgpt-test', redirectUri, googleClientId: 'fixture.apps.googleusercontent.com' };
  app = createConnector({ config, db, verifyGoogleIdentity: async token => {
    if (token !== 'verified-google-owner') throw new Error('Invalid identity');
    return ownerUid;
  } });
  const tokenRequest = body => fetch(`${origin}/token`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body) });
  try {
    const denied = await fetch(resource, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' });
    assert.equal(denied.status, 401);
    assert.match(denied.headers.get('www-authenticate'), /resource_metadata=/);
    const metadata = await (await fetch(`${origin}/.well-known/oauth-authorization-server`)).json();
    assert.ok(metadata.code_challenge_methods_supported.includes('S256'));
    const verifier = 'v'.repeat(64);
    const challenge = createHash('sha256').update(verifier).digest('base64url');
    const authorization = new URL(`${origin}/authorize`);
    authorization.search = new URLSearchParams({ client_id: config.clientId, response_type: 'code', redirect_uri: redirectUri, scope: 'boba:tasks', state: 'state-from-chatgpt', code_challenge: challenge, code_challenge_method: 'S256', resource });
    const started = await fetch(authorization, { redirect: 'manual' });
    assert.equal(started.status, 302);
    const cookie = started.headers.get('set-cookie').split(';')[0];
    const link = new URL(started.headers.get('location'), origin);
    assert.equal((await fetch(link, { headers: { Cookie: cookie } })).status, 200);
    const approve = () => fetch(`${link}/approve`, { method: 'POST', headers: { Cookie: cookie, Origin: origin, 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: 'verified-google-owner' }) });
    assert.equal((await approve()).status, 403);
    await db.doc(`personalTaskOwners/${ownerUid}`).set({});
    const approved = await approve();
    assert.equal(approved.status, 200);
    const callback = new URL((await approved.json()).redirect);
    assert.equal(callback.searchParams.get('state'), 'state-from-chatgpt');
    const exchange = { grant_type: 'authorization_code', client_id: config.clientId, code: callback.searchParams.get('code'), redirect_uri: redirectUri, resource, code_verifier: verifier };
    assert.equal((await tokenRequest({ ...exchange, code_verifier: 'wrong'.repeat(16) })).status, 400);
    assert.equal((await tokenRequest({ ...exchange, resource: 'https://wrong.example/mcp' })).status, 400);
    const tokenResponse = await tokenRequest(exchange);
    assert.equal(tokenResponse.status, 200);
    const tokens = await tokenResponse.json();
    assert.equal((await tokenRequest(exchange)).status, 400);
    const initialize = token => fetch(resource, { method: 'POST', headers: { Authorization: `Bearer ${token}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 'fixture', version: '1' } } }) });
    assert.equal((await initialize(tokens.access_token)).status, 200);
    const rpc = async (method, params) => {
      const response = await fetch(resource, {
        method: 'POST', headers: { Authorization: `Bearer ${tokens.access_token}`, Accept: 'application/json, text/event-stream', 'Content-Type': 'application/json' },
        body: JSON.stringify({ jsonrpc: '2.0', id: 2, method, params }),
      });
      assert.equal(response.status, 200);
      const payload = await response.json();
      assert.equal(payload.error, undefined);
      return payload.result;
    };
    const call = async (name, args) => {
      const result = await rpc('tools/call', { name, arguments: args });
      assert.ok(!result.isError, JSON.stringify(result.content));
      return result.structuredContent;
    };
    assert.equal((await rpc('tools/list', {})).tools.length, 8);
    const created = await call('create_boba_task', { requestId: 'r1', task: { title: 'Walk', targetDate: '2026-11-27' } });
    assert.equal(created.status, 'pending');
    const taskId = created.taskIds[0];
    const item = (await call('list_boba_tasks', { query: 'Walk' })).tasks[0];
    assert.equal(item.id, taskId);
    await call('edit_boba_task', { taskId, expectedVersion: item.version, requestId: 'r2', patch: { title: 'Morning walk' } });
    assert.equal((await call('get_boba_task', { taskId })).task.title, 'Morning walk');
    const preview = await call('preview_boba_task_deletion', { taskId });
    await call('delete_boba_task', { requestId: 'r3', taskId, confirmed: true, affectedTaskIds: [taskId], confirmationToken: preview.confirmationToken });
    assert.deepEqual((await call('list_boba_tasks', {})).tasks, []);
    const refresh = await tokenRequest({ grant_type: 'refresh_token', client_id: config.clientId, refresh_token: tokens.refresh_token, resource });
    assert.equal(refresh.status, 200);
    const refreshed = await refresh.json();
    assert.equal((await tokenRequest({ grant_type: 'refresh_token', client_id: config.clientId, refresh_token: tokens.refresh_token, resource })).status, 400);
    const revoked = await fetch(`${origin}/revoke`, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ client_id: config.clientId, token: refreshed.refresh_token }) });
    assert.equal(revoked.status, 200);
    assert.equal((await initialize(refreshed.access_token)).status, 401);
    assert.equal((await initialize(tokens.access_token)).status, 401);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
