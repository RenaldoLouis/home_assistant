import React, { useState } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  ScrollView,
  Pressable,
} from 'react-native';
import { Colors } from '../theme/colors';
import { Icon } from './Icon';
import { WHITELISTED_BANK_APPS } from '../notifications/expenseNotificationParser';

export interface PrivacyTransparencyModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PrivacyTransparencyModal: React.FC<PrivacyTransparencyModalProps> = ({
  visible,
  onClose,
}) => {
  const [showAppList, setShowAppList] = useState(false);
  const [isPressingClose, setIsPressingClose] = useState(false);

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <View style={styles.backdrop}>
        <View style={styles.sheetContainer}>
          <View style={styles.handleBar} />

          <View style={styles.header}>
            <View style={styles.badgeContainer}>
              <View style={styles.badge}>
                <Icon name="spark" color={Colors.accent} size={22} />
              </View>
            </View>
            <Text style={styles.eyebrow}>DATA SAFETY & INTEGRITY</Text>
            <Text style={styles.title}>Privacy & Transparency</Text>
            <Text style={styles.subtitle}>
              How Jarvis safely processes financial notifications on this device.
            </Text>
          </View>

          <ScrollView
            style={styles.scrollArea}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {/* Card 1: Whitelist */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBadge}>
                  <Text style={styles.cardIconText}>🛡️</Text>
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardTitle}>Whitelisted Apps Only</Text>
                  <Text style={styles.cardTag}>ZERO CHAT ACCESS</Text>
                </View>
              </View>
              <Text style={styles.cardBody}>
                Notifications are strictly checked against verified Indonesian banking and fintech package IDs. Personal chat, SMS, social media, and email apps (WhatsApp, Telegram, Signal, Messages, Gmail) are immediately dropped without reading.
              </Text>

              <Pressable
                testID="toggle-whitelisted-apps"
                onPress={() => setShowAppList(!showAppList)}
                style={styles.toggleRow}
              >
                <Text style={styles.toggleText}>
                  {showAppList ? 'Hide supported apps' : 'View supported banking & fintech apps'}
                </Text>
                <Text style={styles.toggleChevron}>{showAppList ? '▲' : '▼'}</Text>
              </Pressable>

              {showAppList ? (
                <View style={styles.appListContainer}>
                  {WHITELISTED_BANK_APPS.map(app => (
                    <View key={app.packageName} style={styles.appChip}>
                      <Text style={styles.appName}>{app.name}</Text>
                      <Text style={styles.appPkg}>{app.packageName}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>

            {/* Card 2: OTP Kill-Switch */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBadge}>
                  <Text style={styles.cardIconText}>⚡</Text>
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardTitle}>OTP & Credential Kill-Switch</Text>
                  <Text style={styles.cardTag}>INSTANT MEMORY WIPE</Text>
                </View>
              </View>
              <Text style={styles.cardBody}>
                Any notification containing sensitive keywords such as OTP, verification code, PIN, password, CVV, or secret codes triggers an immediate kill-switch. It is permanently wiped from RAM without any processing.
              </Text>
            </View>

            {/* Card 3: RAM-Only Processing */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBadge}>
                  <Text style={styles.cardIconText}>🔒</Text>
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardTitle}>100% Local On-Device Parsing</Text>
                  <Text style={styles.cardTag}>NO CLOUD AI ON RAW TEXT</Text>
                </View>
              </View>
              <Text style={styles.cardBody}>
                Raw notification strings are never sent to Gemini AI, external servers, or third parties. Parsing happens purely on your phone’s CPU using deterministic rules. Raw text is never saved to disk.
              </Text>
            </View>

            {/* Card 4: Scoped Cloud Space */}
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <View style={styles.cardIconBadge}>
                  <Text style={styles.cardIconText}>👤</Text>
                </View>
                <View style={styles.cardTitleContainer}>
                  <Text style={styles.cardTitle}>Private Scoped Cloud Storage</Text>
                  <Text style={styles.cardTag}>GOOGLE AUTH ISOLATED</Text>
                </View>
              </View>
              <Text style={styles.cardBody}>
                Only minimal, scrubbed transaction numbers (amount, category, merchant, timestamp) sync to your Google Account under /users/{'{userId}'}/expenses, locked down by Firestore cloud security rules.
              </Text>
            </View>

            <View style={styles.complianceCard}>
              <Text style={styles.complianceTitle}>Google Play Data Safety</Text>
              <Text style={styles.complianceText}>
                Jarvis adheres to Google Play Store Financial Data and Notification Listener policies. No personal identifying messages or contact lists are ever collected.
              </Text>
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              testID="close-privacy-modal"
              onPress={onClose}
              onPressIn={() => setIsPressingClose(true)}
              onPressOut={() => setIsPressingClose(false)}
              style={[
                styles.closeButton,
                isPressingClose && styles.buttonPressed,
              ]}
            >
              <Text style={styles.closeButtonText}>Understood & Close</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(34, 40, 36, 0.45)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: Colors.background,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    maxHeight: '90%',
    paddingBottom: 28,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 8,
  },
  handleBar: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#D2DCD0',
    alignSelf: 'center',
    marginTop: 12,
    marginBottom: 8,
  },
  header: {
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 14,
  },
  badgeContainer: {
    marginBottom: 8,
  },
  badge: {
    width: 44,
    height: 44,
    borderRadius: 22,
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
    marginBottom: 4,
  },
  title: {
    fontFamily: 'serif',
    fontSize: 24,
    color: Colors.textPrimary,
    letterSpacing: -0.4,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    color: Colors.textSecondary,
    textAlign: 'center',
    maxWidth: 320,
    lineHeight: 18,
  },
  scrollArea: {
    maxHeight: 460,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 16,
    gap: 12,
  },
  card: {
    backgroundColor: Colors.card,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: Colors.cardBorder,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.03,
    shadowRadius: 4,
    elevation: 1,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 8,
  },
  cardIconBadge: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: Colors.mint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardIconText: {
    fontSize: 18,
  },
  cardTitleContainer: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 14.5,
    fontWeight: '700',
    color: Colors.textPrimary,
    marginBottom: 2,
  },
  cardTag: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.accent,
  },
  cardBody: {
    fontSize: 12.5,
    lineHeight: 18,
    color: Colors.textSecondary,
  },
  toggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: '#F0F0EA',
  },
  toggleText: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.accent,
  },
  toggleChevron: {
    fontSize: 10,
    color: Colors.accent,
  },
  appListContainer: {
    marginTop: 10,
    gap: 6,
  },
  appChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F7F4',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
  },
  appName: {
    fontSize: 12,
    fontWeight: '600',
    color: Colors.textPrimary,
  },
  appPkg: {
    fontSize: 10.5,
    fontFamily: 'monospace',
    color: Colors.textSecondary,
  },
  complianceCard: {
    backgroundColor: '#F0F4EC',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#D2DCD0',
    padding: 14,
  },
  complianceTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: Colors.accent,
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.8,
  },
  complianceText: {
    fontSize: 11.5,
    color: Colors.textSecondary,
    lineHeight: 16,
  },
  footer: {
    paddingHorizontal: 20,
    paddingTop: 12,
  },
  closeButton: {
    backgroundColor: Colors.accent,
    minHeight: 50,
    borderRadius: 25,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  closeButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '600',
  },
  buttonPressed: {
    transform: [{ scale: 0.97 }],
    opacity: 0.9,
  },
});
