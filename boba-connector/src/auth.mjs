import { createHash, randomBytes } from 'node:crypto';
import { AccessDeniedError, InvalidGrantError, InvalidRequestError, InvalidScopeError, InvalidTokenError } from '@modelcontextprotocol/sdk/server/auth/errors.js';

const digest = value => createHash('sha256').update(value).digest('hex');
const secret = () => randomBytes(32).toString('base64url');
const scope = 'boba:tasks';
const lifetime = 15 * 60;

/** SDK OAuth provider. Only hashes of bearer credentials are persisted. */
export class BobaOAuth {
  constructor({ config, db, verifyGoogleIdentity }) {
    Object.assign(this, { config, db, verifyGoogleIdentity });
    this.cookieName = config.origin.startsWith('https:') ? '__Host-boba_link' : 'boba_link';
    this.clientsStore = { getClient: clientId => clientId === config.clientId ? {
      client_id: config.clientId, redirect_uris: [config.redirectUri], token_endpoint_auth_method: 'none',
      grant_types: ['authorization_code', 'refresh_token'], response_types: ['code'], scope,
    } : undefined };
  }
  ref(kind, value) { return this.db.doc(`bobaConnectorAuthState/${kind}_${digest(value)}`); }
  async owner(uid, transaction) {
    const ref = this.db.doc(`personalTaskOwners/${this.config.ownerUid}`);
    if (uid !== this.config.ownerUid || !(await (transaction ? transaction.get(ref) : ref.get())).exists) {
      throw new AccessDeniedError('Personal Boba access has not been authorized.');
    }
  }
  resource(resource) {
    if (resource?.href !== this.config.resource) throw new InvalidRequestError('The exact Boba MCP resource is required.');
  }
  async authorize(client, params, res) {
    this.resource(params.resource);
    const scopes = params.scopes?.length ? params.scopes : [scope];
    if (scopes.length !== 1 || scopes[0] !== scope) throw new InvalidScopeError('Only personal Boba tasks are available.');
    if (!/^[A-Za-z0-9_-]{43}$/.test(params.codeChallenge) || (params.state?.length ?? 0) > 2048) throw new InvalidRequestError('Invalid authorization request.');
    const flowId = secret();
    const binding = secret();
    await this.ref('flow', flowId).create({ clientId: client.client_id, redirectUri: params.redirectUri, codeChallenge: params.codeChallenge, state: params.state ?? null, scopes, resource: this.config.resource, nonce: secret(), bindingHash: digest(binding), expiresAt: Date.now() + 300000 });
    res.cookie(this.cookieName, binding, { httpOnly: true, secure: this.config.origin.startsWith('https:'), sameSite: 'lax', path: '/', maxAge: 300000 });
    res.redirect(302, `/link/${flowId}`);
  }
  async flow(flowId, binding) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(flowId) || !binding) throw new AccessDeniedError('Start account linking again.');
    const data = (await this.ref('flow', flowId).get()).data();
    if (!data || data.expiresAt <= Date.now() || data.bindingHash !== digest(binding)) throw new AccessDeniedError('Start account linking again.');
    return data;
  }
  async approve(flowId, binding, idToken) {
    const flow = await this.flow(flowId, binding);
    let uid;
    try { uid = await this.verifyGoogleIdentity(idToken, flow.nonce); }
    catch { throw new AccessDeniedError('Google account verification failed.'); }
    await this.owner(uid);
    const code = secret();
    const grantId = secret();
    await this.db.runTransaction(async transaction => {
      const current = (await transaction.get(this.ref('flow', flowId))).data();
      await this.owner(uid, transaction);
      if (!current || current.bindingHash !== digest(binding) || current.expiresAt <= Date.now()) throw new AccessDeniedError('Start account linking again.');
      const grant = { ownerUid: uid, clientId: flow.clientId, scopes: flow.scopes, resource: flow.resource, expiresAt: Date.now() + 30 * 86400000, revoked: false };
      transaction.create(this.ref('grant', grantId), grant);
      transaction.create(this.ref('code', code), { ...flow, ownerUid: uid, grantId, expiresAt: Date.now() + 60000 });
      transaction.delete(this.ref('flow', flowId));
    });
    const callback = new URL(flow.redirectUri);
    callback.searchParams.set('code', code);
    if (flow.state !== null) callback.searchParams.set('state', flow.state);
    return callback.href;
  }
  async challengeForAuthorizationCode(client, code) {
    const data = (await this.ref('code', code).get()).data();
    if (!data || data.clientId !== client.client_id || data.expiresAt <= Date.now()) throw new InvalidGrantError('Invalid or expired authorization code.');
    return data.codeChallenge;
  }
  issue(transaction, grantId, grant) {
    const accessToken = secret();
    const refreshToken = secret();
    const expiresAt = Math.min(Date.now() + lifetime * 1000, grant.expiresAt);
    const common = { ownerUid: grant.ownerUid, clientId: grant.clientId, resource: grant.resource, scopes: grant.scopes, grantId };
    transaction.create(this.ref('token', accessToken), { ...common, kind: 'access', expiresAt });
    transaction.create(this.ref('token', refreshToken), { ...common, kind: 'refresh', expiresAt: grant.expiresAt });
    return { access_token: accessToken, refresh_token: refreshToken, token_type: 'Bearer', expires_in: Math.floor((expiresAt - Date.now()) / 1000), scope };
  }
  async exchangeAuthorizationCode(client, code, _verifier, redirectUri, resource) {
    this.resource(resource);
    return this.db.runTransaction(async transaction => {
      const data = (await transaction.get(this.ref('code', code))).data();
      if (!data || data.clientId !== client.client_id || data.redirectUri !== redirectUri || data.expiresAt <= Date.now() || data.resource !== this.config.resource) throw new InvalidGrantError('Invalid authorization code.');
      const grant = (await transaction.get(this.ref('grant', data.grantId))).data();
      await this.owner(data.ownerUid, transaction);
      if (!grant || grant.revoked || grant.expiresAt <= Date.now()) throw new InvalidGrantError('Connection revoked or expired.');
      transaction.delete(this.ref('code', code));
      return this.issue(transaction, data.grantId, grant);
    });
  }
  async exchangeRefreshToken(client, token, scopes, resource) {
    this.resource(resource);
    if (scopes && (scopes.length !== 1 || scopes[0] !== scope)) throw new InvalidScopeError('Scope cannot be expanded.');
    return this.db.runTransaction(async transaction => {
      const data = (await transaction.get(this.ref('token', token))).data();
      if (!data || data.kind !== 'refresh' || data.clientId !== client.client_id || data.expiresAt <= Date.now() || data.resource !== this.config.resource) throw new InvalidGrantError('Invalid refresh token.');
      const grant = (await transaction.get(this.ref('grant', data.grantId))).data();
      await this.owner(data.ownerUid, transaction);
      if (!grant || grant.revoked || grant.expiresAt <= Date.now()) throw new InvalidGrantError('Connection revoked or expired.');
      transaction.delete(this.ref('token', token));
      return this.issue(transaction, data.grantId, grant);
    });
  }
  async verifyAccessToken(token) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new InvalidTokenError('Invalid Boba access token.');
    return this.db.runTransaction(async transaction => {
      const data = (await transaction.get(this.ref('token', token))).data();
      if (!data || data.kind !== 'access' || data.expiresAt <= Date.now() || data.resource !== this.config.resource || data.clientId !== this.config.clientId || !data.scopes.includes(scope)) throw new InvalidTokenError('Invalid Boba access token.');
      const grant = (await transaction.get(this.ref('grant', data.grantId))).data();
      if (!grant || grant.revoked || grant.expiresAt <= Date.now()) throw new InvalidTokenError('Connection revoked or expired.');
      try { await this.owner(data.ownerUid, transaction); }
      catch { throw new InvalidTokenError('Personal task access was revoked.'); }
      return { token, clientId: data.clientId, scopes: data.scopes, expiresAt: Math.floor(data.expiresAt / 1000), resource: new URL(data.resource), extra: { ownerUid: data.ownerUid } };
    });
  }
  async revokeToken(client, request) {
    await this.db.runTransaction(async transaction => {
      const data = (await transaction.get(this.ref('token', request.token))).data();
      if (data?.clientId === client.client_id) transaction.update(this.ref('grant', data.grantId), { revoked: true });
    });
  }
}
