import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  User,
} from '@react-native-firebase/auth';
import { UserProfile } from './types';
import { JARVIS_USER_ID } from '../expenses/constants';

let isGoogleSignInInitialized = false;

export function initializeGoogleSignIn(webClientId?: string): void {
  try {
    GoogleSignin.configure({
      webClientId: webClientId || undefined,
      offlineAccess: false,
    });
    isGoogleSignInInitialized = true;
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
  if (!isGoogleSignInInitialized) {
    initializeGoogleSignIn();
  }

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
  const userCredential = await signInWithCredential(getAuth(), credential);

  const normalized = normalizeFirebaseUser(userCredential.user);
  if (!normalized) {
    throw new Error('Authentication succeeded but user profile was empty.');
  }

  return normalized;
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

export function getActiveUserId(): string {
  try {
    return getAuth().currentUser?.uid || JARVIS_USER_ID;
  } catch {
    return JARVIS_USER_ID;
  }
}

export function subscribeToAuthState(
  callback: (user: UserProfile | null) => void,
): () => void {
  return onAuthStateChanged(getAuth(), firebaseUser => {
    callback(normalizeFirebaseUser(firebaseUser));
  });
}
