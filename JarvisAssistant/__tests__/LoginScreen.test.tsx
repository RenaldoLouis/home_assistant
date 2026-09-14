import React from 'react';
import ReactTestRenderer, { act } from 'react-test-renderer';
import { LoginScreen } from '../src/auth/LoginScreen';
import * as AuthContextModule from '../src/auth/AuthContext';

jest.mock('../src/auth/AuthContext');

describe('LoginScreen', () => {
  const mockSignInWithGoogle = jest.fn();
  const mockSignInAnonymously = jest.fn();
  const mockClearError = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (AuthContextModule.useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      error: null,
      signInWithGoogle: mockSignInWithGoogle,
      signInAnonymously: mockSignInAnonymously,
      signOut: jest.fn(),
      clearError: mockClearError,
    });
  });

  it('renders branding, trust badges, and buttons', () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const root = renderer!.root;
    expect(root.findByProps({ testID: 'google-signin-button' })).toBeTruthy();
    expect(root.findByProps({ testID: 'guest-signin-button' })).toBeTruthy();
  });

  it('triggers Google sign-in when Google button is pressed', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const googleBtn = renderer!.root.findByProps({ testID: 'google-signin-button' });
    await act(async () => {
      googleBtn.props.onPress();
    });

    expect(mockClearError).toHaveBeenCalled();
    expect(mockSignInWithGoogle).toHaveBeenCalled();
  });

  it('triggers anonymous sign-in when guest button is pressed without custom callback', async () => {
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const guestBtn = renderer!.root.findByProps({ testID: 'guest-signin-button' });
    await act(async () => {
      guestBtn.props.onPress();
    });

    expect(mockClearError).toHaveBeenCalled();
    expect(mockSignInAnonymously).toHaveBeenCalled();
  });

  it('triggers onContinueAsGuest prop when provided', async () => {
    const onGuestMock = jest.fn();
    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<LoginScreen onContinueAsGuest={onGuestMock} />);
    });

    const guestBtn = renderer!.root.findByProps({ testID: 'guest-signin-button' });
    await act(async () => {
      guestBtn.props.onPress();
    });

    expect(onGuestMock).toHaveBeenCalled();
    expect(mockSignInAnonymously).not.toHaveBeenCalled();
  });

  it('displays error message when error exists', () => {
    (AuthContextModule.useAuth as jest.Mock).mockReturnValue({
      user: null,
      isLoading: false,
      error: 'Google Sign-In failed: network timeout',
      signInWithGoogle: mockSignInWithGoogle,
      signInAnonymously: mockSignInAnonymously,
      signOut: jest.fn(),
      clearError: mockClearError,
    });

    let renderer: ReactTestRenderer.ReactTestRenderer;
    act(() => {
      renderer = ReactTestRenderer.create(<LoginScreen />);
    });

    const root = renderer!.root;
    const errorText = root.findAllByProps({ children: 'Google Sign-In failed: network timeout' });
    expect(errorText.length).toBeGreaterThan(0);
  });
});
