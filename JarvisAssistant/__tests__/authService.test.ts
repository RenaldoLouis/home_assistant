import { GoogleSignin } from '@react-native-google-signin/google-signin';
import {
  getAuth,
  GoogleAuthProvider,
  signInWithCredential,
  signInAnonymously as firebaseSignInAnonymously,
  signOut as firebaseSignOut,
  User,
} from '@react-native-firebase/auth';
import {
  initializeGoogleSignIn,
  signInWithGoogle,
  signInAnonymously,
  signOut,
  normalizeFirebaseUser,
  getActiveUserId,
} from '../src/auth/authService';
import { JARVIS_USER_ID } from '../src/expenses/constants';

describe('authService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    const authInstance = getAuth();
    (authInstance as any).currentUser = null;
  });

  describe('initializeGoogleSignIn', () => {
    it('calls GoogleSignin.configure with webClientId if provided', () => {
      initializeGoogleSignIn('test-web-client-id');
      expect(GoogleSignin.configure).toHaveBeenCalledWith(
        expect.objectContaining({
          webClientId: 'test-web-client-id',
        }),
      );
    });

    it('calls GoogleSignin.configure even without webClientId', () => {
      initializeGoogleSignIn();
      expect(GoogleSignin.configure).toHaveBeenCalled();
    });
  });

  describe('signInWithGoogle', () => {
    it('signs in with Google, gets idToken, and signs in to Firebase', async () => {
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        data: {
          idToken: 'mock-google-id-token',
        },
      });
      const fakeFirebaseUser = {
        uid: 'user-google-123',
        email: 'alex@example.com',
        displayName: 'Alex Jarvis',
        photoURL: 'https://example.com/photo.jpg',
        isAnonymous: false,
      };
      (signInWithCredential as jest.Mock).mockResolvedValue({
        user: fakeFirebaseUser,
      });

      const user = await signInWithGoogle();

      expect(GoogleSignin.hasPlayServices).toHaveBeenCalledWith({
        showPlayServicesUpdateDialog: true,
      });
      expect(GoogleSignin.signIn).toHaveBeenCalled();
      expect(GoogleAuthProvider.credential).toHaveBeenCalledWith('mock-google-id-token');
      expect(signInWithCredential).toHaveBeenCalled();
      expect(user).toEqual({
        uid: 'user-google-123',
        email: 'alex@example.com',
        displayName: 'Alex Jarvis',
        photoURL: 'https://example.com/photo.jpg',
        isAnonymous: false,
      });
    });

    it('throws when idToken is missing from Google response', async () => {
      (GoogleSignin.hasPlayServices as jest.Mock).mockResolvedValue(true);
      (GoogleSignin.signIn as jest.Mock).mockResolvedValue({
        data: {},
      });

      await expect(signInWithGoogle()).rejects.toThrow(
        /No ID token returned from Google Sign-In/,
      );
    });
  });

  describe('signInAnonymously', () => {
    it('signs in anonymously and returns normalized user profile', async () => {
      const fakeAnonUser = {
        uid: 'anon-user-999',
        email: null,
        displayName: 'Guest User',
        photoURL: null,
        isAnonymous: true,
      };
      (firebaseSignInAnonymously as jest.Mock).mockResolvedValue({
        user: fakeAnonUser,
      });

      const user = await signInAnonymously();

      expect(firebaseSignInAnonymously).toHaveBeenCalled();
      expect(user).toEqual({
        uid: 'anon-user-999',
        email: null,
        displayName: 'Guest User',
        photoURL: null,
        isAnonymous: true,
      });
    });
  });

  describe('signOut', () => {
    it('signs out from Google and Firebase Auth', async () => {
      (GoogleSignin.signOut as jest.Mock).mockResolvedValue(undefined);
      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(GoogleSignin.signOut).toHaveBeenCalled();
      expect(firebaseSignOut).toHaveBeenCalled();
    });

    it('still signs out of Firebase if Google signOut throws (e.g. not signed in with Google)', async () => {
      (GoogleSignin.signOut as jest.Mock).mockRejectedValue(new Error('not signed in with google'));
      (firebaseSignOut as jest.Mock).mockResolvedValue(undefined);

      await signOut();

      expect(firebaseSignOut).toHaveBeenCalled();
    });
  });

  describe('normalizeFirebaseUser', () => {
    it('returns null when input is null or undefined', () => {
      expect(normalizeFirebaseUser(null)).toBeNull();
      expect(normalizeFirebaseUser(undefined)).toBeNull();
    });

    it('extracts uid, email, displayName, photoURL, isAnonymous', () => {
      const normalized = normalizeFirebaseUser({
        uid: 'uid-42',
        email: 'user@jarvis.ai',
        displayName: 'Tony Stark',
        photoURL: 'https://ironman.com/avatar.png',
        isAnonymous: false,
      } as User);

      expect(normalized).toEqual({
        uid: 'uid-42',
        email: 'user@jarvis.ai',
        displayName: 'Tony Stark',
        photoURL: 'https://ironman.com/avatar.png',
        isAnonymous: false,
      });
    });
  });

  describe('getActiveUserId', () => {
    it('returns currentUser.uid when user is logged in', () => {
      const authInstance = getAuth();
      (authInstance as any).currentUser = { uid: 'logged-in-uid' };
      expect(getActiveUserId()).toBe('logged-in-uid');
    });

    it('falls back to JARVIS_USER_ID when currentUser is null', () => {
      const authInstance = getAuth();
      (authInstance as any).currentUser = null;
      expect(getActiveUserId()).toBe(JARVIS_USER_ID);
    });
  });
});
