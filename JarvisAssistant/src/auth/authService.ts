import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  linkWithCredential,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from '@react-native-firebase/auth';
import { UserProfile } from './types';
import { Config } from '../config/env';

export function initializeGoogleSignIn(webClientId?: string): void {
  try {
    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      offlineAccess: false,
    });
  } catch (error) {
    console.warn('[Jarvis Auth] Failed to initialize Google Sign-In:', error);
  }
}

export function normalizeFirebaseUser(user: User | null | undefined): UserProfile | null {
  if (!user) {
    return null;
  }

  return {
    uid: user.uid,
    email: user.email ?? null,
    displayName: user.displayName ?? (user.isAnonymous ? 'Guest User' : null),
    photoURL: user.photoURL ?? null,
    isAnonymous: Boolean(user.isAnonymous),
  };
}

export async function signInWithGoogle(): Promise<UserProfile> {
  // Google only returns the ID token Firebase needs when it is asked for one
  // on behalf of the project's web OAuth client.
  const webClientId = Config.GOOGLE_WEB_CLIENT_ID;
  if (!webClientId) {
    throw new Error(
      'Google sign-in is not set up: add GOOGLE_WEB_CLIENT_ID to .env and rebuild.',
    );
  }
  initializeGoogleSignIn(webClientId);

  await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
  const response = await GoogleSignin.signIn();

  // Support both new and legacy response shapes from GoogleSignin
  const idToken =
    (response as { data?: { idToken?: string } })?.data?.idToken ||
    (response as { idToken?: string })?.idToken;

  if (!idToken) {
    throw new Error(
      'No ID token returned from Google Sign-In. Check your Firebase Google OAuth configuration.',
    );
  }

  const credential = GoogleAuthProvider.credential(idToken);
  const auth = getAuth();
  const guest = auth.currentUser?.isAnonymous ? auth.currentUser : null;
  const userCredential = guest
    ? await linkGuestToGoogle(guest, credential)
    : await signInWithCredential(auth, credential);

  const normalized = normalizeFirebaseUser(userCredential.user);
  if (!normalized) {
    throw new Error('Authentication succeeded but user profile was empty.');
  }

  return normalized;
}

// Linking keeps the guest's UID, so everything saved as a guest stays theirs.
// Signing in instead would switch to a different UID and strand that data.
async function linkGuestToGoogle(
  guest: User,
  credential: ReturnType<typeof GoogleAuthProvider.credential>,
) {
  try {
    return await linkWithCredential(guest, credential);
  } catch (error) {
    if ((error as { code?: string }).code === 'auth/credential-already-in-use') {
      throw new Error(
        'This Google account already has its own Jarvis data, so it can’t take over this guest account. You’re still signed in as a guest.',
      );
    }
    throw error;
  }
}

export async function signInAnonymously(): Promise<UserProfile> {
  const userCredential = await firebaseSignInAnonymously(getAuth());
  const normalized = normalizeFirebaseUser(userCredential.user);

  if (!normalized) {
    throw new Error('Anonymous sign-in succeeded but user profile was empty.');
  }

  return normalized;
}

export async function signOut(): Promise<void> {
  try {
    await GoogleSignin.signOut();
  } catch {
    // Ignore error if user was not signed into Google
  }

  await firebaseSignOut(getAuth());
}

// Null when nobody is signed in: there is no shared fallback folder, because
// the Firestore rules only accept requests from the folder's own user.
export function getActiveUserId(): string | null {
  try {
    return getAuth().currentUser?.uid ?? null;
  } catch {
    return null;
  }
}

export function subscribeToAuthState(
  callback: (user: UserProfile | null) => void,
): () => void {
  return onAuthStateChanged(getAuth(), firebaseUser => {
    callback(normalizeFirebaseUser(firebaseUser));
  });
}
