import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { useAuth } from './AuthContext';
import { Colors } from '../theme/colors';
import { Icon } from '../components/Icon';

export interface LoginScreenProps {
  onContinueAsGuest?: () => void;
}

export const LoginScreen: React.FC<LoginScreenProps> = ({ onContinueAsGuest }) => {
  const { signInWithGoogle, signInAnonymously, isLoading, error, clearError } =
    useAuth();
  const [isPressingGoogle, setIsPressingGoogle] = useState(false);
  const [isPressingGuest, setIsPressingGuest] = useState(false);

  const handleGooglePress = async () => {
    clearError();
    await signInWithGoogle();
  };

  const handleGuestPress = async () => {
    clearError();
    if (onContinueAsGuest) {
      onContinueAsGuest();
      return;
    }
    await signInAnonymously();
  };

  return (
    <View style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <View style={styles.brandMarkContainer}>
            <View style={styles.brandMark}>
              <Icon name="spark" color={Colors.accent} size={26} />
            </View>
          </View>
          <Text style={styles.eyebrow}>YOUR EVERYDAY COMPANION</Text>
          <Text style={styles.title}>Jarvis Assistant</Text>
          <Text style={styles.subtitle}>
            A little more clarity in your daily life and spending.
          </Text>
        </View>

        <View style={styles.featuresCard}>
          <View style={styles.featureRow}>
            <View style={styles.featureBadge}>
              <Text style={styles.featureEmoji}>🔒</Text>
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Zero Data Leak Guarantee</Text>
              <Text style={styles.featureDesc}>
                Bank notifications are parsed 100% locally on your device. Raw messages and OTPs are never saved or uploaded.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <View style={styles.featureBadge}>
              <Text style={styles.featureEmoji}>🛡️</Text>
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Private User Space</Text>
              <Text style={styles.featureDesc}>
                Your financial records are strictly isolated to your Google account with cloud security rules.
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <View style={styles.featureRow}>
            <View style={styles.featureBadge}>
              <Text style={styles.featureEmoji}>🎙️</Text>
            </View>
            <View style={styles.featureTextContainer}>
              <Text style={styles.featureTitle}>Gemini Live Voice Review</Text>
              <Text style={styles.featureDesc}>
                Conduct 1-by-1 conversational daily spending reviews and categorize expenses with AI.
              </Text>
            </View>
          </View>
        </View>

        {error ? (
          <View style={styles.errorContainer}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        ) : null}

        <View style={styles.actions}>
          <Pressable
            testID="google-signin-button"
            onPress={handleGooglePress}
            onPressIn={() => setIsPressingGoogle(true)}
            onPressOut={() => setIsPressingGoogle(false)}
            disabled={isLoading}
            style={[
              styles.googleButton,
              isPressingGoogle && styles.buttonPressed,
            ]}
          >
            {isLoading ? (
              <ActivityIndicator color={Colors.accent} />
            ) : (
              <View style={styles.googleButtonContent}>
                <Text style={styles.googleGlyph}>G</Text>
                <Text style={styles.googleButtonText}>Sign in with Google</Text>
              </View>
            )}
          </Pressable>

          <Pressable
            testID="guest-signin-button"
            onPress={handleGuestPress}
            onPressIn={() => setIsPressingGuest(true)}
            onPressOut={() => setIsPressingGuest(false)}
            disabled={isLoading}
            style={[
              styles.guestButton,
              isPressingGuest && styles.buttonPressed,
            ]}
          >
            <Text style={styles.guestButtonText}>Continue in Guest Mode (Offline)</Text>
          </Pressable>
        </View>

        <Text style={styles.footerText}>
          Phase 2 Ready • Multi-user & Couple Sharing Supported
        </Text>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 48,
    paddingBottom: 44,
  },
  header: {
    alignItems: 'center',
    paddingTop: 8,
  },
  brandMarkContainer: {
    marginBottom: 16,
  },
  brandMark: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D2DCD0',
  },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: '600',
    letterSpacing: 1.8,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 32,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 300,
    lineHeight: 20,
  },
  featuresCard: {
    backgroundColor: Colors.card,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 18,
    marginVertical: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 2,
  },
  featureRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  featureBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  featureEmoji: {
    fontSize: 18,
  },
  featureTextContainer: {
    flex: 1,
  },
  featureTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  featureDesc: {
    fontSize: 12,
    color: Colors.textSecondary,
    lineHeight: 17,
  },
  divider: {
    height: 1,
    backgroundColor: '#F0F0EA',
    marginVertical: 12,
  },
  errorContainer: {
    backgroundColor: '#FDF2F0',
    borderColor: '#F3C5BD',
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 14,
  },
  errorText: {
    color: Colors.danger,
    fontSize: 13,
    textAlign: 'center',
    lineHeight: 18,
  },
  actions: {
    gap: 10,
  },
  googleButton: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    minHeight: 50,
    borderWidth: 1,
    borderColor: '#D2DCD0',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  googleButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  googleGlyph: {
    fontSize: 18,
    fontWeight: '800',
    color: '#4285F4',
  },
  googleButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  guestButton: {
    minHeight: 48,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#D2DCD0',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'transparent',
  },
  guestButtonText: {
    color: Colors.accent,
    fontWeight: '600',
    fontSize: 14,
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
  footerText: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginTop: 16,
  },
});
