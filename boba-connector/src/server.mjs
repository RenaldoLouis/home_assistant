import express from 'express';
import { createMcpExpressApp } from '@modelcontextprotocol/sdk/server/express.js';
import { mcpAuthRouter, createOAuthMetadata, getOAuthProtectedResourceMetadataUrl } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { BobaOAuth } from './auth.mjs';
import { TaskService } from './tasks.mjs';
import { createTools } from './tools.mjs';
import { linkPage } from './link-page.mjs';

export function createConnector({ config, db, verifyGoogleIdentity }) {
  const app = createMcpExpressApp({ allowedHosts: [new URL(config.origin).hostname] });
  app.disable('x-powered-by');
  app.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer', 'X-Content-Type-Options': 'nosniff' }); next(); });
  const provider = new BobaOAuth({ config, db, verifyGoogleIdentity });
  const service = new TaskService({ db, ownerUid: config.ownerUid, timeZone: config.timeZone, resetHour: config.resetHour });
  const issuerUrl = new URL(config.origin);
  const resourceServerUrl = new URL(config.resource);
  const authOptions = { provider, issuerUrl, resourceServerUrl, scopesSupported: ['boba:tasks'], resourceName: 'Personal Boba tasks' };
  // The SDK supports public clients on both endpoints; advertise only the mode in use.
  app.get('/.well-known/oauth-authorization-server', (_req, res) => res.json({ ...createOAuthMetadata(authOptions), token_endpoint_auth_methods_supported: ['none'], revocation_endpoint_auth_methods_supported: ['none'] }));
  app.use(mcpAuthRouter(authOptions));
  const cookie = req => req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${provider.cookieName}=`))?.slice(provider.cookieName.length + 1);
  app.get('/link/:flowId', async (req, res) => {
    try {
      const flow = await provider.flow(req.params.flowId, cookie(req));
      res.set('Content-Security-Policy', `default-src 'none'; script-src 'nonce-${flow.nonce}' https://accounts.google.com; style-src 'unsafe-inline' https://accounts.google.com; frame-src https://accounts.google.com; connect-src 'self' https://accounts.google.com; base-uri 'none'; form-action 'self'; frame-ancestors 'none'`);
      res.type('html').send(linkPage(config, req.params.flowId, flow.nonce));
    } catch { res.status(403).send('Start account linking again.'); }
  });
  app.post('/link/:flowId/approve', express.json({ limit: '24kb' }), async (req, res) => {
    if (req.headers.origin !== config.origin || typeof req.body?.idToken !== 'string' || req.body.idToken.length > 16000) return res.status(403).json({ error: 'access_denied' });
    try {
      const redirect = await provider.approve(req.params.flowId, cookie(req), req.body.idToken);
      res.clearCookie(provider.cookieName, { path: '/', secure: config.origin.startsWith('https:'), sameSite: 'lax', httpOnly: true });
      return res.json({ redirect });
    } catch { return res.status(403).json({ error: 'access_denied' }); }
  });
  const bearer = requireBearerAuth({ verifier: provider, requiredScopes: ['boba:tasks'], expectedResource: resourceServerUrl, resourceMetadataUrl: getOAuthProtectedResourceMetadataUrl(resourceServerUrl) });
  app.post('/mcp', bearer, async (req, res) => {
    if (req.headers.origin && ![config.origin, 'https://chatgpt.com'].includes(req.headers.origin)) return res.status(403).end();
    const server = createTools(service, req.auth.extra.ownerUid);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on('close', () => { transport.close(); server.close(); });
    try { await server.connect(transport); await transport.handleRequest(req, res, req.body); }
    catch { if (!res.headersSent) res.status(500).json({ error: 'connector_unavailable' }); }
  });
  app.all('/mcp', bearer, (_req, res) => res.status(405).set('Allow', 'POST').end());
  app.use((_error, _req, res, _next) => res.status(400).json({ error: 'invalid_request' }));
  return app;
}
