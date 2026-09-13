import React, {
  useEffect,
  useState,
  useCallback,
  useMemo,
  useRef,
  Component,
  ErrorInfo,
} from 'react';
import {
  AppState,
  PermissionsAndroid,
  Platform,
  Linking,
  Text,
  View,
  StyleSheet,
} from 'react-native';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import {
  getFirestore,
  collection,
  doc,
  onSnapshot,
  updateDoc,
  serverTimestamp,
} from '@react-native-firebase/firestore';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OrbState } from './src/components/JarvisOrb';
import { JARVIS_USER_ID } from './src/expenses/constants';
import { buildDayReport } from './src/expenses/expenseSummary';
import { normalizeDate, parseDay, dayKey } from './src/expenses/dates';
import { buildExpenseUpdate } from './src/expenses/expenseEditing';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import {
  buildExpenseCategoryOptions,
  normalizeExpenseCategory,
} from './src/expenses/categories';
import {
  EditableExpense,
  ExpenseEdit,
  TransactionType,
} from './src/expenses/types';
import {
  GeminiLiveService,
  LiveSessionStatus,
  TranscriptEvent,
} from './src/services/GeminiLiveService';
import { ToolExecutionHandlers } from './src/services/JarvisToolExecutor';

interface ErrorBoundaryState {
  hasError: boolean;
  error: Error | null;
}

class ErrorBoundary extends Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
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
        <View style={errorStyles.container}>
          <Text style={errorStyles.title}>Let’s try that again.</Text>
          <Text style={errorStyles.message}>
            Jarvis couldn’t display this screen. Close and reopen the app to
            continue.
          </Text>
        </View>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [isRecordingCommand, setIsRecordingCommand] = useState(false);
  const [commandText, setCommandText] = useState('');
  const [orbState, setOrbState] = useState<OrbState>('idle');
  const [notifPermission, setNotifPermission] = useState<string>('unknown');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [dailyNotes, setDailyNotes] = useState('');
  const [expenses, setExpenses] = useState<EditableExpense[]>([]);

  const [dataStatus, setDataStatus] = useState<
    'loading' | 'synced' | 'cached' | 'pending' | 'error'
  >('loading');
  const [subscriptionVersion, setSubscriptionVersion] = useState(0);
  const [failedSave, setFailedSave] = useState<{
    id: string;
    edit: ExpenseEdit;
  } | null>(null);
  const liveServiceRef = useRef<GeminiLiveService | null>(null);

  const toolHandlers: ToolExecutionHandlers = useMemo(
    () => ({
      onGetDailyRecap: args => {
        if (dataStatus === 'loading' || dataStatus === 'error')
          return 'Spending data is unavailable right now. Please try again.';
        const date = args?.date ? parseDay(args.date) : new Date();
        if (!date) return 'Please use a valid date in YYYY-MM-DD format.';
        const report = buildDayReport(expenses, date);
        const prefix =
          dataStatus === 'cached' || dataStatus === 'pending'
            ? 'From the records currently on this phone: '
            : '';
        const incomePart =
          report.incomeTotal > 0
            ? `, and received IDR ${report.incomeTotal.toLocaleString(
                'id-ID',
              )} in income`
            : '';
        const actualPart =
          report.incomeTotal > 0
            ? ` (actual spend: IDR ${report.netSpend.toLocaleString('id-ID')})`
            : '';
        return `${prefix}For ${dayKey(
          date,
        )}, you have recorded IDR ${report.total.toLocaleString(
          'id-ID',
        )} across ${report.expenseCount} expenses${incomePart}${actualPart}.`;

      },
      onPlayMusic: async () => ({
        success: false,
        message:
          'Your speaker has not arrived yet. Music control is not connected.',
      }),
      onControlLight: async () => ({
        success: false,
        message:
          'Your Prolink DS-3601 lamp still needs to be connected to Jarvis. Use mEzee for now.',
      }),
    }),
    [expenses, dataStatus],
  );

  useEffect(() => {
    const liveService = new GeminiLiveService({});
    liveServiceRef.current = liveService;

    const unsubStatus = liveService.on(
      'status',
      (status: LiveSessionStatus) => {
        console.log('[Jarvis App] Live status changed to:', status);
        if (status === 'listening') {
          setOrbState('listening');
          setIsRecordingCommand(true);
          setCommandText(prev =>
            prev.startsWith('"') || prev.startsWith('Jarvis:')
              ? prev
              : 'Listening...',
          );
        } else if (status === 'speaking') {
          setOrbState('speaking');
          setIsRecordingCommand(true);
        } else if (status === 'idle' || status === 'disconnected') {
          setOrbState('idle');
          setIsRecordingCommand(false);
          setCommandText(prev =>
            prev === 'Connecting to Jarvis...' ? '' : prev,
          );
        } else if (status === 'connecting') {
          setOrbState('listening');
          setIsRecordingCommand(true);
          setCommandText('Connecting to Jarvis...');
        } else if (status === 'error') {
          setOrbState('idle');
          setIsRecordingCommand(false);
          setCommandText('Connection error. Please try again.');
        }
      },
    );

    const unsubTranscript = liveService.on(
      'transcript',
      (evt: TranscriptEvent) => {
        if (evt.role === 'user') {
          setCommandText(`"${evt.text}"`);
        } else {
          setCommandText(`Jarvis: "${evt.text}"`);
        }
      },
    );

    return () => {
      unsubStatus();
      unsubTranscript();
      liveService.stopSession();
    };
  }, []);

  useEffect(() => {
    liveServiceRef.current?.setToolHandlers(toolHandlers);
  }, [toolHandlers]);

  // Request Android audio recording permission
  const requestAudioPermission = useCallback(async () => {
    if (Platform.OS === 'android') {
      try {
        const granted = await PermissionsAndroid.request(
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          {
            title: 'Jarvis Microphone Permission',
            message:
              'Jarvis requires microphone access for real-time conversational voice interaction.',
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

    const subscription = AppState.addEventListener('change', nextAppState => {
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
      setDataStatus('loading');
      const db = getFirestore();
      const expensesRef = collection(db, 'users', JARVIS_USER_ID, 'expenses');

      unsubscribe = onSnapshot(
        expensesRef,
        { includeMetadataChanges: true },
        snapshot => {
          const savedExpenses = snapshot.docs
            .map(expenseDoc =>
              toEditableExpense(expenseDoc.id, expenseDoc.data()),
            )
            .filter((expense): expense is EditableExpense => expense !== null)
            .sort(
              (first, second) =>
                Date.parse(second.date) - Date.parse(first.date),
            );

          setExpenses(savedExpenses);
          setDataStatus(
            snapshot.metadata?.hasPendingWrites
              ? 'pending'
              : snapshot.metadata?.fromCache
              ? 'cached'
              : 'synced',
          );
        },
        err => {
          setDataStatus('error');
          console.warn('[Jarvis] Failed to subscribe to expense updates:', err);
        },
      );
    } catch (err) {
      setDataStatus('error');
      console.warn('[Jarvis] Failed to start expense subscription:', err);
    }

    return () => {
      unsubscribe?.();
    };
  }, [subscriptionVersion]);

  const categoryOptions = useMemo(
    () =>
      buildExpenseCategoryOptions(expenses.map(expense => expense.category)),
    [expenses],
  );

  const handleExpenseSave = useCallback(
    async (expenseId: string, edit: ExpenseEdit) => {
      const expense = expenses.find(item => item.id === expenseId);
      if (!expense)
        throw new Error(
          'This expense is no longer available. Please reopen it.',
        );
      const update = buildExpenseUpdate(expense, edit);
      const expenseRef = doc(
        collection(getFirestore(), 'users', JARVIS_USER_ID, 'expenses'),
        expenseId,
      );
      try {
        await updateDoc(expenseRef, {
          ...update,
          updatedAt: serverTimestamp(),
        });
        setFailedSave(previous =>
          previous?.id === expenseId ? null : previous,
        );
      } catch (error) {
        setFailedSave({ id: expenseId, edit });
        throw error;
      }
    },
    [expenses],
  );

  return (
    <ErrorBoundary>
      <SafeAreaProvider>
        <DashboardScreen
          isRecordingCommand={isRecordingCommand}
          commandText={commandText}
          orbState={orbState}
          startListening={startListening}
          stopListening={stopListening}
          dataStatus={dataStatus}
          onRetry={() => setSubscriptionVersion(value => value + 1)}
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
          onExpenseSave={handleExpenseSave}
          saveFailed={failedSave !== null}
          onRetrySave={() => {
            if (failedSave)
              handleExpenseSave(failedSave.id, failedSave.edit).catch(() => {});
          }}
          onDismissSaveError={() => setFailedSave(null)}
        />
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

function toEditableExpense(
  expenseId: string,
  data: Record<string, unknown>,
): EditableExpense | null {
  const amount = normalizeAmount(data.amount);
  const date = normalizeDate(data.date) ?? normalizeDate(data.createdAt);

  if (amount <= 0 || !date) {
    return null;
  }

  const type: TransactionType = data.type === 'income' ? 'income' : 'expense';
  const note = normalizeString(data.note);

  return {
    id: expenseId,
    amount,
    merchant: normalizeString(data.merchant) || 'Unknown',
    category: normalizeExpenseCategory(data.category),
    bank: normalizeString(data.bank) || 'Unknown',
    date: date.toISOString(),
    type,
    ...(note ? { note } : {}),
    ...(typeof data.originalAmount === 'number'
      ? { originalAmount: data.originalAmount }
      : {}),
    ...(typeof data.originalCategory === 'string'
      ? { originalCategory: data.originalCategory }
      : {}),
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

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

const errorStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F4F0',
    padding: 32,
    justifyContent: 'center',
    gap: 16,
  },
  title: { color: '#222824', fontFamily: 'serif', fontSize: 28 },
  message: { color: '#636B65', fontSize: 16, lineHeight: 24 },
});
