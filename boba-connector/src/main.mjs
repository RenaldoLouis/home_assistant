import { initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { OAuth2Client } from 'google-auth-library';
import { createConnector } from './server.mjs';

function required(name) {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing ${name}`);
  return value;
}

const origin = new URL(required('BOBA_CONNECTOR_ORIGIN'));
if (origin.protocol !== 'https:' || origin.href !== origin.origin + '/') {
  throw new Error('BOBA_CONNECTOR_ORIGIN must be an HTTPS origin');
}
const redirect = new URL(required('CHATGPT_REDIRECT_URI'));
if (redirect.protocol !== 'https:' || redirect.hash || redirect.username || redirect.password) {
  throw new Error('Supply the HTTPS callback provided by ChatGPT');
}
const config = {
  origin: origin.origin, resource: origin.origin + '/mcp',
  resetHour: Number(process.env.BOBA_RESET_HOUR ?? 4), ownerUid: required('BOBA_OWNER_UID'), timeZone: required('BOBA_TIME_ZONE'),
  clientId: required('CHATGPT_CLIENT_ID'), redirectUri: redirect.href,
  googleClientId: required('GOOGLE_WEB_CLIENT_ID'),
};
if (!Number.isInteger(config.resetHour) || config.resetHour < 0 || config.resetHour > 23) throw new Error('Invalid BOBA_RESET_HOUR');
new Intl.DateTimeFormat('en', { timeZone: config.timeZone });
const firebase = initializeApp({ credential: applicationDefault(), projectId: required('FIREBASE_PROJECT_ID') });
const google = new OAuth2Client();
const app = createConnector({
  config, db: getFirestore(firebase),
  async verifyGoogleIdentity(idToken, nonce) {
    const ticket = await google.verifyIdToken({ idToken, audience: config.googleClientId });
    const claims = ticket.getPayload();
    if (!claims?.sub || claims.nonce !== nonce) throw new Error('Invalid Google login');
    const user = await getAuth(firebase).getUserByProviderUid('google.com', claims.sub);
    if (user.disabled) throw new Error('Account disabled');
    return user.uid;
  },
});
const port = Number(process.env.PORT ?? 8080);
const server = app.listen(port, process.env.LISTEN_HOST ?? '127.0.0.1', () => {
  console.log('Personal Boba connector listening on port', port);
});
process.once('SIGTERM', () => server.close());
