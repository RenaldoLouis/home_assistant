import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Dimensions,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  TextInput,
} from 'react-native';
import { BarChart } from 'react-native-chart-kit';
import { Colors } from '../theme/colors';
import { JarvisOrb, OrbState } from '../components/JarvisOrb';
import { GlassCard } from '../components/GlassCard';
import { AnimatedPressable } from '../components/AnimatedPressable';

interface ExpenseData {
  today: number;
  lastWeek: number;
  lastMonth: number;
  chartData: {
    labels: string[];
    datasets: { data: number[] }[];
  };
}

interface DashboardScreenProps {
  isRecordingCommand: boolean;
  commandText: string;
  notifPermission: string;
  showNotifModal: boolean;
  expenseData: ExpenseData;
  setShowNotifModal: (show: boolean) => void;
  startListening: () => void;
  stopListening: () => void;
  onRequestNotifPermission: () => void;
  dailyNotes: string;
  setDailyNotes: (notes: string) => void;
  orbState: OrbState;
}

export const DashboardScreen: React.FC<DashboardScreenProps> = ({
  isRecordingCommand,
  commandText,
  notifPermission,
  showNotifModal,
  expenseData,
  setShowNotifModal,
  startListening,
  stopListening,
  onRequestNotifPermission,
  dailyNotes,
  setDailyNotes,
  orbState,
}) => {
  return (
    <SafeAreaView style={styles.container}>
      {/* Notification Permission Modal */}
      <Modal
        visible={showNotifModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowNotifModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>⚠️ Notification Access Required</Text>
            <Text style={styles.modalText}>
              Jarvis needs Notification Access to automatically track your spending from bank notifications (myBCA, etc.).
              {'\n\n'}
              Please enable it in Settings → Notification Access → JarvisAssistant.
            </Text>
            <TouchableOpacity style={styles.modalButton} onPress={onRequestNotifPermission}>
              <Text style={styles.modalButtonText}>Go to Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.modalDismissButton} onPress={() => setShowNotifModal(false)}>
              <Text style={styles.modalDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>Good Morning, Sir.</Text>
          <Text style={styles.subtitle}>I am ready to assist you today.</Text>
        </View>

        {/* Jarvis Orb */}
        <View style={styles.orbContainer}>
          <JarvisOrb state={orbState} size={150} />
          
          <AnimatedPressable
            style={styles.micButton}
            onPress={isRecordingCommand ? stopListening : startListening}
            hapticStyle="impactMedium"
          >
            <Text style={styles.micButtonText}>
              {isRecordingCommand ? '■' : '🎤'}
            </Text>
          </AnimatedPressable>
        </View>
        
        <Text style={styles.commandText}>
          {commandText ? `"${commandText}"` : (isRecordingCommand ? 'Listening...' : 'Tap mic to speak')}
        </Text>

        {/* Daily Notes Section */}
        <GlassCard style={styles.sectionCard}>
          <Text style={styles.sectionTitle}>Daily Objectives & Notes</Text>
          <TextInput
            style={styles.notesInput}
            multiline
            placeholder="What needs to be done today?"
            placeholderTextColor={Colors.textSecondary}
            value={dailyNotes}
            onChangeText={setDailyNotes}
          />
        </GlassCard>

        {/* Spending Dashboard */}
        <GlassCard style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Spending Overview</Text>
            <AnimatedPressable
              onPress={() => { if (notifPermission !== 'authorized') setShowNotifModal(true); }}
            >
              <Text style={[
                styles.statusText,
                { color: notifPermission === 'authorized' ? Colors.success : Colors.warning }
              ]}>
                {notifPermission === 'authorized' ? '✅ Active' : '⚠️ Setup'}
              </Text>
            </AnimatedPressable>
          </View>
          
          <View style={styles.summaryCards}>
            <View style={styles.miniCard}>
              <Text style={styles.miniCardTitle}>Today</Text>
              <Text style={styles.miniCardAmount}>Rp {expenseData.today.toLocaleString()}</Text>
            </View>
            <View style={styles.miniCard}>
              <Text style={styles.miniCardTitle}>7 Days</Text>
              <Text style={styles.miniCardAmount}>Rp {expenseData.lastWeek.toLocaleString()}</Text>
            </View>
            <View style={styles.miniCard}>
              <Text style={styles.miniCardTitle}>30 Days</Text>
              <Text style={styles.miniCardAmount}>Rp {expenseData.lastMonth.toLocaleString()}</Text>
            </View>
          </View>

          <BarChart
            data={expenseData.chartData}
            width={Dimensions.get('window').width - 80}
            height={200}
            yAxisLabel="Rp "
            yAxisSuffix=""
            withInnerLines={false}
            chartConfig={{
              backgroundColor: 'transparent',
              backgroundGradientFrom: Colors.card,
              backgroundGradientTo: Colors.card,
              backgroundGradientFromOpacity: 0,
              backgroundGradientToOpacity: 0,
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(10, 132, 255, ${opacity})`,
              labelColor: (opacity = 1) => Colors.textSecondary,
              barPercentage: 0.6,
            }}
            style={{ marginVertical: 8, borderRadius: 16 }}
            showValuesOnTopOfBars={false}
          />
        </GlassCard>

        <GlassCard style={[styles.sectionCard, { marginBottom: 40 }]}>
          <Text style={styles.sectionTitle}>Capabilities</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, what are my tasks for today?"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, play some music"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, turn on the lights"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, how much did I spend today?"</Text>
        </GlassCard>

      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flexGrow: 1,
    padding: 20,
    paddingTop: 10,
  },
  header: {
    marginBottom: 40,
    marginTop: 20,
  },
  greeting: {
    fontSize: 34,
    fontWeight: '800',
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 16,
    color: Colors.textSecondary,
    marginTop: 8,
  },
  orbContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 20,
    height: 180,
  },
  micButton: {
    position: 'absolute',
    bottom: -20,
    backgroundColor: Colors.cardBorder,
    width: 60,
    height: 60,
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  micButtonText: {
    fontSize: 24,
    color: Colors.textPrimary,
  },
  commandText: {
    color: Colors.textSecondary,
    fontSize: 16,
    textAlign: 'center',
    marginTop: 30,
    marginBottom: 40,
    fontStyle: 'italic',
    minHeight: 20,
  },
  sectionCard: {
    marginBottom: 20,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 15,
  },
  sectionTitle: {
    color: Colors.textPrimary,
    fontSize: 18,
    fontWeight: '700',
    marginBottom: 15,
  },
  notesInput: {
    color: Colors.textPrimary,
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statusText: {
    fontSize: 14,
    fontWeight: '600',
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 15,
  },
  miniCard: {
    flex: 1,
    alignItems: 'center',
  },
  miniCardTitle: {
    color: Colors.textSecondary,
    fontSize: 12,
    marginBottom: 4,
  },
  miniCardAmount: {
    color: Colors.textPrimary,
    fontSize: 14,
    fontWeight: '700',
  },
  capabilityItem: {
    color: Colors.textSecondary,
    fontSize: 14,
    marginBottom: 10,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.8)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: Colors.card,
    borderRadius: 24,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.cardBorder,
  },
  modalTitle: {
    color: Colors.warning,
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    color: Colors.textPrimary,
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 24,
  },
  modalButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 12,
    width: '100%',
    alignItems: 'center',
    marginBottom: 12,
  },
  modalButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 16,
  },
  modalDismissButton: {
    paddingVertical: 10,
  },
  modalDismissText: {
    color: Colors.textSecondary,
    fontSize: 15,
    fontWeight: '600',
  },
});
