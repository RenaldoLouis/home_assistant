# Personal Boba connector

This Node service exposes the founder's Boba tasks at `/mcp` through eight MCP tools for context, search, exact retrieval, creation, editing, deletion preview, confirmed deletion and operation status. ChatGPT hosts the conversation. Boba applies cloud changes on the phone and acknowledges each revision.

## Run and verify

Use Node 22.11 or later. Run `npm ci` in this directory. Run `npm run check` with Java 21 and the Firebase CLI's Firestore emulator JAR installed. Set FIRESTORE_EMULATOR_JAR when the JAR is outside the default Firebase cache. The tests use a disposable local project. The HTTP test exercises OAuth, authorization, all four task operations, token rotation and revocation. It supplies a test Google identity.

## Configure the service

Provide these environment variables to the service before running `npm start`.

| Variable | Value |
|---|---|
| BOBA_CONNECTOR_ORIGIN | Public HTTPS origin, with the service mounted at its root |
| CHATGPT_CLIENT_ID | Predefined public OAuth client identifier configured in ChatGPT |
| CHATGPT_REDIRECT_URI | Exact redirect URI shown for this connection by ChatGPT |
| GOOGLE_WEB_CLIENT_ID | Google Web OAuth client ID with the connector origin in Authorized JavaScript origins |
| FIREBASE_PROJECT_ID | The Firebase project used by the personal Boba phone build |
| BOBA_OWNER_UID | Firebase UID of the Google account linked in the personal Boba app |
| BOBA_TIME_ZONE | Owner's IANA time zone, for example Asia/Jakarta |
| BOBA_RESET_HOUR | Boba's local reset hour, default 4. Update the configuration if phone settings change. |
| PORT, LISTEN_HOST | Default 8080 on loopback. Use an appropriate bind address behind the HTTPS host. |

Use an attached service identity with Application Default Credentials, Firebase Auth user lookup and Firestore data access. The service validates Google signatures, audience and login nonce, resolves the Google subject to a Firebase UID and checks a server-controlled personalTaskOwners/{uid} record. Provision only the verified owner. The phone also needs the task rules in JarvisAssistant/firestore.rules and its personal premium account link. Operation receipts and authorization state belong to the service.

Configure the private ChatGPT connection with the HTTPS origin followed by /mcp, the predefined client ID, authorization code with S256 PKCE, public client authentication and scope boba:tasks. Copy the callback URI from ChatGPT. [OpenAI plugin authentication](https://developers.openai.com/plugins/build/auth)

## Phone acceptance

Connect the Google account and ask for Boba context. In one voice conversation create a disposable task, retrieve it, rename it, preview its deletion and confirm. Check the result on the phone. A pending receipt means Firestore accepted the change. Only an applied receipt means the phone acknowledged that exact revision. A disconnected phone may have unsynced local tasks. Test revocation from ChatGPT separately from signing the phone out. Removing the owner allowlist record blocks further connector access.
