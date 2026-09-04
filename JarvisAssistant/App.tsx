import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

import React, { useEffect, useState, useCallback } from 'react';
import {
  SafeAreaView,
  StyleSheet,
  Text,
  View,
  PermissionsAndroid,
  Platform,
  TouchableOpacity,
  Linking,
  ScrollView,
  Dimensions,
  NativeModules,
  NativeEventEmitter,
  Modal,
  AppState,
} from 'react-native';
import SendIntentAndroid from 'react-native-send-intent';
import RNAndroidNotificationListener from 'react-native-android-notification-listener';
import { BleManager } from 'react-native-ble-plx';
import { getFirestore, collection, doc, query, where, getDocs, onSnapshot, writeBatch, updateDoc } from '@react-native-firebase/firestore';
import 'react-native-get-random-values';
import { v4 as uuidv4 } from 'uuid';
import { BarChart } from 'react-native-chart-kit';
import { DashboardScreen } from './src/screens/DashboardScreen';
import { OrbState } from './src/components/JarvisOrb';

const bleManager = new BleManager();

// TODO: Replace with your actual Gemini API Key securely from environment or config
const GEMINI_API_KEY: string = 'YOUR_GEMINI_API_KEY_HERE';

const genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
const model = genAI.getGenerativeModel({
  model: 'gemini-3.6-flash',
  tools: [{
    functionDeclarations: [
      {
        name: 'control_light',
        description: 'Turn a smart light on or off.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            state: { type: SchemaType.BOOLEAN, description: 'True to turn on, false to turn off.' },
            protocol: { type: SchemaType.STRING, description: 'Either "wifi" or "ble". Defaults to wifi if unspecified.' }
          },
          required: ['state', 'protocol']
        }
      },
      {
        name: 'play_music',
        description: 'Play music on a specific app like Spotify.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            app: { type: SchemaType.STRING, description: 'The name of the app to play music on, e.g., "spotify".' }
          },
          required: ['app']
        }
      },
      {
        name: 'get_todos',
        description: 'Get the list of to-do items from the Boba To-Do List app.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            date: { type: SchemaType.STRING, description: 'Optional date to filter tasks (YYYY-MM-DD). If omitted, gets today.' }
          }
        }
      },
      {
        name: 'create_subtasks',
        description: 'Create subtasks for an existing to-do item.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            parentTaskId: { type: SchemaType.STRING, description: 'The ID of the parent task.' },
            subtasks: {
              type: SchemaType.ARRAY,
              items: { type: SchemaType.STRING },
              description: 'List of subtask titles.'
            }
          },
          required: ['parentTaskId', 'subtasks']
        }
      },
      {
        name: 'reschedule_todo',
        description: 'Reschedule a to-do item to a new date.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING, description: 'The ID of the task to reschedule.' },
            newDate: { type: SchemaType.STRING, description: 'The new date (YYYY-MM-DD) or "tomorrow".' }
          },
          required: ['taskId', 'newDate']
        }
      },
      {
        name: 'complete_todo',
        description: 'Mark a to-do item as completed.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            taskId: { type: SchemaType.STRING, description: 'The ID of the task to complete.' }
          },
          required: ['taskId']
        }
      },
      {
        name: 'get_daily_recap',
        description: 'Get a recap of all daily expenses tracked today.',
        parameters: {
          type: SchemaType.OBJECT,
          properties: {
            date: { type: SchemaType.STRING, description: 'Optional date (YYYY-MM-DD) to get the recap for. If omitted, gets today.' }
          }
        }
      }
    ]
  }]
});
const { SpeechRecognizerModule, TtsModule } = NativeModules;
const Tts = TtsModule;

export default function App() {
  const [isRecordingCommand, setIsRecordingCommand] = useState(false);
  const [commandText, setCommandText] = useState('');
  const [notifPermission, setNotifPermission] = useState<string>('unknown');
  const [showNotifModal, setShowNotifModal] = useState(false);
  const [dailyNotes, setDailyNotes] = useState('');
  
  const [expenseData, setExpenseData] = useState({
    today: 0,
    lastWeek: 0,
    lastMonth: 0,
    chartData: {
      labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      datasets: [{ data: [0, 0, 0, 0, 0, 0, 0] }]
    }
  });

  // Request Permissions
  const requestPermissions = async () => {
    if (Platform.OS === 'android') {
      try {
        await PermissionsAndroid.requestMultiple([
          PermissionsAndroid.PERMISSIONS.RECORD_AUDIO,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_CONNECT,
          PermissionsAndroid.PERMISSIONS.BLUETOOTH_SCAN,
          PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION,
        ]);
      } catch (err) {
        console.warn(err);
      }
    }
  };

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

    
  const orbState: OrbState = isRecordingCommand ? 'listening' : 'idle';

  return (
    <DashboardScreen 
      isRecordingCommand={isRecordingCommand}
      commandText={commandText}
      notifPermission={notifPermission}
      showNotifModal={showNotifModal}
      expenseData={expenseData}
      setShowNotifModal={setShowNotifModal}
      startListening={startListening}
      stopListening={stopListening}
      onRequestNotifPermission={() => RNAndroidNotificationListener.requestPermission()}
      dailyNotes={dailyNotes}
      setDailyNotes={setDailyNotes}
      orbState={orbState}
    />
  );
}
