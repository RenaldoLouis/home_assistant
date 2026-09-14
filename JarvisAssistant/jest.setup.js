/* eslint-disable no-undef */
jest.mock('@react-native-google-signin/google-signin', () => ({
  __esModule: true,
  GoogleSignin: {
    configure: jest.fn(),
    hasPlayServices: jest.fn().mockResolvedValue(true),
    signIn: jest.fn(),
    signOut: jest.fn(),
  },
  statusCodes: {
    SIGN_IN_CANCELLED: 'SIGN_IN_CANCELLED',
    IN_PROGRESS: 'IN_PROGRESS',
    PLAY_SERVICES_NOT_AVAILABLE: 'PLAY_SERVICES_NOT_AVAILABLE',
  },
}));

jest.mock('@react-native-firebase/auth', () => {
  const credential = jest.fn(idToken => ({
    providerId: 'google.com',
    signInMethod: 'google.com',
    token: idToken,
  }));
  const authInstance = {
    currentUser: null,
  };
  return {
    __esModule: true,
    getAuth: jest.fn(() => authInstance),
    GoogleAuthProvider: {
      credential,
    },
    signInWithCredential: jest.fn(),
    signInAnonymously: jest.fn(),
    signOut: jest.fn(),
    onAuthStateChanged: jest.fn((auth, cb) => (cb ? cb(authInstance.currentUser) : jest.fn())),
  };
});

