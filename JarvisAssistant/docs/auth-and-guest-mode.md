# Sign-in and Guest Mode

Every Jarvis user is a Firebase Auth user, either a Google account or an anonymous guest. Their data lives under `users/{uid}/expenses`, and the Firestore rules let only that user read or write it (`request.auth.uid == userId`). The app has no shared or signed-out folder.

## How it works

| Situation | What happens |
|---|---|
| App opens, nobody signed in | `LoginScreen`. Nothing reads Firestore. |
| **Sign in with Google** | Google returns an ID token, then `signInWithCredential`. The UID is the Google account's. |
| **Continue as Guest** | `signInAnonymously`, which creates a new anonymous UID for this install. |
| Guest taps **Sign in with Google** (Settings) | `linkWithCredential` links Google to the *same* account. The UID stays the same, so every expense saved as a guest stays. |
| That Google account already has its own Jarvis data | Firebase refuses the link (`auth/credential-already-in-use`). The guest stays signed in and sees an explanation. Nothing is switched or lost. |
| Bank notification arrives while nobody is signed in | `headlessTask.js` skips it, because the rules would refuse the write. |

Guests have no **Sign Out**. An anonymous account can't be signed back into, so signing out would lock its data away for good. Clearing app data or reinstalling has the same effect, which is why the guest card suggests linking Google.

Code: `src/auth/authService.ts` (`signInWithGoogle`, `linkGuestToGoogle`, `getActiveUserId`), `src/auth/AuthContext.tsx`, `App.tsx` (`JarvisMainContent` is the sign-in gate, and `SignedInContent` holds all the Firestore work), and the guest card in `src/screens/DashboardScreen.tsx`.

## Firebase setup (project `boba-todo-list`)

The project is shared with the Boba todo app, so its rules are edited line by line in the Console, never replaced wholesale.

1. **Authentication → Sign-in method**: enable **Google** and **Anonymous**.
2. **Project settings → Your apps**: Android app `com.jarvisassistant` (nickname `jarvis_home_assistant`) with both SHA-1 fingerprints:
   - Release (`jarvis.keystore`): `10:F3:66:FB:66:58:BC:2D:DE:39:82:34:94:D6:E5:94:51:A9:3B:D6`
   - Debug: `5E:8F:16:06:2E:A3:CD:2C:4A:0D:54:78:76:BA:A6:F3:8C:AB:F6:25`
   - A Play Store build will need the Play App Signing SHA-1 as well.
3. Download that app's `google-services.json` **after** adding the fingerprints, and put it at `android/app/google-services.json`. It's gitignored. Under `com.jarvisassistant` it must list `oauth_client` entries of type 1 (one per fingerprint) and type 3 (web).
4. Copy the type 3 (web) `client_id` into `.env` as `GOOGLE_WEB_CLIENT_ID`. Without it Google returns no ID token, and `signInWithGoogle` fails early with a message naming the variable. Rebuild after changing `.env`.

## Incident: "Couldn't load expenses" (October 14, 2026)

- **Symptom**: guest users saw `Couldn’t load expenses`. Background notifications also stopped saving.
- **Cause**: "Continue in Guest Mode (Offline)" skipped Firebase sign-in. With no user, the app used a fixed folder, `users/jarvis_user_id`. Those requests carried no `request.auth`, so the ownership rule refused them. A request made the same way to the Firestore REST API with only the API key returned `403 PERMISSION_DENIED`. The live rules, checked on October 14, match `firestore.rules` exactly and contain no open or time-limited rule. So guest access must have relied on an older open rule that was replaced or expired, most likely with the October 13 publish. The exact date was not confirmed. Those live rules also contain nothing for the Boba todo app.
- **Google sign-in never worked**: the Jarvis Android app was not registered in Firebase. The old `google-services.json` had been copied from the todo app's registration with the package name changed. Also, no web client ID was passed to `GoogleSignin.configure`.
- **Data**: on October 14, 2026 the 159 expenses in `users/jarvis_user_id/expenses` were copied into the user's account (159 copied, 0 failed, 0 missing) with a one-off admin script. The script used the gcloud application-default login and the Firestore REST API. It keeps document IDs, sets `userId` / `ledgerId`, never overwrites, and never deletes the source.
