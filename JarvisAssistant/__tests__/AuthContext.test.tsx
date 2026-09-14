import React from 'react';
import { Text, Button } from 'react-native';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { AuthProvider, useAuth } from '../src/auth/AuthContext';
import * as authService from '../src/auth/authService';

jest.mock('../src/auth/authService');

const TestConsumer = () => {
  const { user, isLoading, error, signInWithGoogle, signInAnonymously, signOut } =
    useAuth();

  return (
    <>
      <Text testID="loading-state">{isLoading ? 'Loading' : 'Idle'}</Text>
      <Text testID="user-state">{user ? user.displayName || user.uid : 'No User'}</Text>
      <Text testID="error-state">{error || 'No Error'}</Text>
      <Button testID="google-btn" title="Google Sign In" onPress={signInWithGoogle} />
      <Button testID="anon-btn" title="Anon Sign In" onPress={signInAnonymously} />
      <Button testID="signout-btn" title="Sign Out" onPress={signOut} />
    </>
  );
};

describe('AuthContext', () => {
  let authStateCallback: ((user: any) => void) | null = null;

  beforeEach(() => {
    jest.clearAllMocks();
    authStateCallback = null;
    (authService.subscribeToAuthState as jest.Mock).mockImplementation(cb => {
      authStateCallback = cb;
      return jest.fn(); // unsubscribe
    });
  });

  it('initializes with loading state and resolves when authState fires', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;

    act(() => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });

    const root = renderer!.root;
    const loadingText = root.findByProps({ testID: 'loading-state' });
    expect(loadingText.props.children).toBe('Loading');

    act(() => {
      authStateCallback?.({
        uid: 'uid-1',
        email: 'test@jarvis.ai',
        displayName: 'Jarvis User',
        photoURL: null,
        isAnonymous: false,
      });
    });

    expect(root.findByProps({ testID: 'loading-state' }).props.children).toBe('Idle');
    expect(root.findByProps({ testID: 'user-state' }).props.children).toBe('Jarvis User');
  });

  it('handles Google sign in success', async () => {
    (authService.signInWithGoogle as jest.Mock).mockResolvedValue({
      uid: 'google-uid',
      email: 'google@jarvis.ai',
      displayName: 'Google Jarvis',
      photoURL: null,
      isAnonymous: false,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });

    act(() => {
      authStateCallback?.(null);
    });

    const root = renderer!.root;
    expect(root.findByProps({ testID: 'user-state' }).props.children).toBe('No User');

    await act(async () => {
      root.findByProps({ testID: 'google-btn' }).props.onPress();
    });

    expect(authService.signInWithGoogle).toHaveBeenCalled();
  });

  it('captures error when Google sign in fails', async () => {
    (authService.signInWithGoogle as jest.Mock).mockRejectedValue(
      new Error('Google Sign-In canceled by user'),
    );

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });

    act(() => {
      authStateCallback?.(null);
    });

    const root = renderer!.root;

    await act(async () => {
      root.findByProps({ testID: 'google-btn' }).props.onPress();
    });

    expect(root.findByProps({ testID: 'error-state' }).props.children).toBe(
      'Google Sign-In canceled by user',
    );
  });

  it('calls signOut and clears user state', async () => {
    (authService.signOut as jest.Mock).mockResolvedValue(undefined);

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(
        <AuthProvider>
          <TestConsumer />
        </AuthProvider>,
      );
    });

    act(() => {
      authStateCallback?.({
        uid: 'logged-in-user',
        displayName: 'Active User',
      });
    });

    const root = renderer!.root;
    expect(root.findByProps({ testID: 'user-state' }).props.children).toBe('Active User');

    await act(async () => {
      root.findByProps({ testID: 'signout-btn' }).props.onPress();
    });

    expect(authService.signOut).toHaveBeenCalled();
  });
});
