import React, { useEffect, useState, useCallback, useMemo, useRef, Component, ErrorInfo } from 'react';
import { AppState, PermissionsAndroid, Platform, Linking, Text, ScrollView, SafeAreaView } from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import { getFirestore, collection, doc, onSnapshot, updateDoc } from '@react-native-firebase/firestore';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OrbState } from './src/components/JarvisOrb';
import { JARVIS_USER_ID } from './src/expenses/constants';
import { buildExpenseSummary } from './src/expenses/expenseSummary';
import {
  buildExpenseCategoryOptions,
  normalizeExpenseCategory,
} from './src/expenses/categories';
import { EditableExpense } from './src/expenses/types';
import { GeminiLiveService, LiveSessionStatus, TranscriptEvent } from './src/services/GeminiLiveService';
import { ToolExecutionHandlers } from './src/services/JarvisToolExecutor';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Jarvis ErrorBoundary caught]', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <SafeAreaView style={{ flex: 1, backgroundColor: '#1C1C1E', padding: 24, justifyContent: 'center' }}>
          <Text style={{ color: '#FF453A', fontSize: 22, fontWeight: 'bold', marginBottom: 12 }}>
            ⚠️ Render Crash Detected
          </Text>
          <Text style={{ color: '#FFFFFF', fontSize: 16, marginBottom: 8, fontWeight: '600' }}>
            {this.state.error?.name}: {this.state.error?.message}
          </Text>
          <ScrollView style={{ maxHeight: 300, backgroundColor: '#0D0E12', padding: 12, borderRadius: 8 }}>
            <Text style={{ color: '#8E8E93', fontSize: 12 }}>
              {this.state.error?.stack}
            </Text>
          </ScrollView>
        </SafeAreaView>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  console.log('[Jarvis App] Rendering App component...');
  const [isRecordingCommand, setIsRecordingCommand] = useState(false);
  const [commandText, setCommandText] = useState('');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [notifPermission, setNotifPermission] = useState<string>('unknown');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [dailyNotes, setDailyNotes] = useState('');
  const [expenses, setExpenses] = useState<EditableExpense[]>([]);
  
  const [expenseData, setExpenseData] = useState({
    today: 0,
    lastWeek: 0,
    lastMonth: 0,
    chartData: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
    }
  });

  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  const toolHandlers: ToolExecutionHandlers = useMemo(() => ({
    onGetDailyRecap: () => {
      if (expenseData.today > 0) {
        return `Today you have spent IDR ${expenseData.today.toLocaleString()} across your accounts.`;
      }
      return 'You have not recorded any spending yet today.';
    },
    onPlayMusic: async ({ app }) => {
      console.log('[Jarvis Tools] Playing music on:', app);
      return { success: true, message: `Playing music on ${app}` };
    },
    onControlLight: async ({ state, protocol }) => {
      console.log(`[Jarvis Tools] Turning light ${state ? 'on' : 'off'} via ${protocol || 'wifi'}`);
      return { success: true, message: `Turned the light ${state ? 'on' : 'off'}` };
    },
  }), [expenseData.today]);

  useEffect(() => {
    const liveService = new GeminiLiveService({
      toolHandlers,
    });
    liveServiceRef.current = liveService;

    const unsubStatus = liveService.on('status', (status: LiveSessionStatus) => {
      console.log('[Jarvis App] Live status changed to:', status);
      if (status === 'listening') {
        setOrbState('listening');
        setIsRecordingCommand(true);
        setCommandText(prev => (prev.startsWith('"') || prev.startsWith('Jarvis:') ? prev : 'Listening...'));
      } else if (status === 'speaking') {
        setOrbState('speaking');
        setIsRecordingCommand(true);
      } else if (status === 'idle' || status === 'disconnected') {
        setOrbState('idle');
        setIsRecordingCommand(false);
        setCommandText(prev => (prev === 'Connecting to Jarvis...' ? '' : prev));
      } else if (status === 'connecting') {
        setOrbState('listening');
        setIsRecordingCommand(true);
        setCommandText('Connecting to Jarvis...');
      } else if (status === 'error') {
        setOrbState('idle');
        setIsRecordingCommand(false);
        setCommandText('Connection error. Please try again.');
      }
    });

    const unsubTranscript = liveService.on('transcript', (evt: TranscriptEvent) => {
      if (evt.role === 'user') {
        setCommandText(`"${evt.text}"`);
      } else {
        setCommandText(`Jarvis: "${evt.text}"`);
      }
    });

    return () => {
      unsubStatus();
      unsubTranscript();
      liveService.stopSession();
    };
  }, [toolHandlers]);

  // Request Android audio recording permission
  const requestAudioPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Jarvis Microphone Permission',
            message: 'Jarvis requires microphone access for real-time conversational voice interaction.',
            buttonPositive: 'Grant Permission',
          },
        );
        return granted === PermissionsAndroid.RESULTS.GRANTED;
      } catch (err) {
        console.warn('[Jarvis] Error requesting RECORD_AUDIO permission:', err);
        return false;
      }
    }
    return true;
  }, []);

  const startListening = useCallback(async () => {
    const granted = await requestAudioPermission();
    if (!granted) {
      console.warn('[Jarvis] Microphone permission denied');
      return;
    }
    await liveServiceRef.current?.startSession();
  }, [requestAudioPermission]);

  const stopListening = useCallback(() => {
    liveServiceRef.current?.stopSession();
  }, []);

  // Deep Link (e.g. from homescreen shortcut or widget: jarvis://listen)
  useEffect(() => {
    const handleDeepLink = (url: string | null) => {
      if (url === 'jarvis://listen') {
        setTimeout(() => startListening(), 500);
      }
    };

    Linking.getInitialURL().then(handleDeepLink);
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => {
      subscription.remove();
    };
  }, [startListening]);

  // Check notification listener permission
  const checkNotificationPermission = useCallback(async () => {
    try {
      const status = await RNAndroidNotificationListener.getPermissionStatus();
      console.log('[Jarvis] Notification listener permission status:', status);
      setNotifPermission(status);
      if (status !== 'authorized') {
        setShowNotifModal(true);
      } else {
        setShowNotifModal(false);
      }
    } catch (err) {
      console.warn('[Jarvis] Failed to check notification permission:', err);
    }
  }, []);

  // Check notification permission on mount and when app returns to foreground
  useEffect(() => {
    checkNotificationPermission();

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Re-check when user comes back from Settings
        checkNotificationPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkNotificationPermission]);

  useEffect(() => {
    let unsubscribe: (() => void) | undefined;

    try {
      const db = getFirestore();
      const expensesRef = collection(db, 'users', JARVIS_USER_ID, 'expenses');

      unsubscribe = onSnapshot(
        expensesRef,
        snapshot => {
          const savedExpenses = snapshot.docs
            .map(expenseDoc => toEditableExpense(expenseDoc.id, expenseDoc.data()))
            .filter((expense): expense is EditableExpense => expense !== null)
            .sort((first, second) => Date.parse(second.date) - Date.parse(first.date));

          setExpenses(savedExpenses);
          setExpenseData(buildExpenseSummary(savedExpenses));
        },
        err => {
          console.warn('[Jarvis] Failed to subscribe to expense updates:', err);
        },
      );
    } catch (err) {
      console.warn('[Jarvis] Failed to start expense subscription:', err);
    }

    return () => {
      unsubscribe?.();
    };
  }, []);

  const categoryOptions = useMemo(
    () => buildExpenseCategoryOptions(expenses.map(expense => expense.category)),
    [expenses],
  );

  const handleExpenseCategoryChange = useCallback(async (expenseId: string, category: string) => {
    const db = getFirestore();
    const expenseRef = doc(collection(db, 'users', JARVIS_USER_ID, 'expenses'), expenseId);

    await updateDoc(expenseRef, {
      category: normalizeExpenseCategory(category),
    });
  }, []);

  return (
    <ErrorBoundary>
      <DashboardScreen
        isRecordingCommand={isRecordingCommand}
        commandText={commandText}
        orbState={orbState}
        startListening={startListening}
        stopListening={stopListening}
        expenseData={expenseData}
        notifPermission={notifPermission}
        showNotifModal={showNotifModal}
        setShowNotifModal={setShowNotifModal}
        onRequestNotifPermission={() => {
          RNAndroidNotificationListener.requestPermission();
        }}
        dailyNotes={dailyNotes}
        setDailyNotes={setDailyNotes}
        expenses={expenses}
        categoryOptions={categoryOptions}
        onExpenseCategoryChange={handleExpenseCategoryChange}
      />
    </ErrorBoundary>
  );
}

function toEditableExpense(expenseId: string, data: Record<string, unknown>): EditableExpense | null {
  const amount = normalizeAmount(data.amount);
  const date = normalizeDate(data.date) ?? normalizeDate(data.createdAt);

  if (amount <= 0 || !date) {
    return null;
  }

  return {
    id: normalizeString(data.id) || expenseId,
    amount,
    merchant: normalizeString(data.merchant) || 'Unknown',
    category: normalizeExpenseCategory(data.category),
    bank: normalizeString(data.bank) || 'Unknown',
    date,
  };
}

function normalizeAmount(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.round(value);
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.round(parsed) : 0;
  }

  return 0;
}

function normalizeDate(value: unknown): string | null {
  if (!value) {
    return null;
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString();
  }

  if (typeof value === 'string' || typeof value === 'number') {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  if (typeof value === 'object' && 'toDate' in value && typeof value.toDate === 'function') {
    const date = value.toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date.toISOString() : null;
  }

  if (
    typeof value === 'object' &&
    'seconds' in value &&
    typeof value.seconds === 'number'
  ) {
    const nanoseconds =
      'nanoseconds' in value && typeof value.nanoseconds === 'number'
        ? value.nanoseconds
        : 0;
    const date = new Date(value.seconds * 1000 + Math.floor(nanoseconds / 1000000));

    return Number.isNaN(date.getTime()) ? null : date.toISOString();
  }

  return null;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}
