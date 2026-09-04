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

    return () => subscription.remove();
  }, [checkNotificationPermission]);

  // Initialize TTS
  useEffect(() => {
    Tts.getInitStatus().then(() => {
      Tts.setDefaultLanguage('en-US');
      Tts.setDefaultRate(0.5);
    });
  }, []);

  // Initialize Voice (STT)
  useEffect(() => {
    requestPermissions();

    const voiceEmitter = new NativeEventEmitter(SpeechRecognizerModule);

    const onStartSub = voiceEmitter.addListener('onSpeechStart', () => setIsRecordingCommand(true));
    const onEndSub = voiceEmitter.addListener('onSpeechEnd', () => setIsRecordingCommand(false));
    const onErrorSub = voiceEmitter.addListener('onSpeechError', (e) => {
      console.error('Voice Error:', e);
      setIsRecordingCommand(false);
    });
    const onResultsSub = voiceEmitter.addListener('onSpeechResults', (e) => {
      if (e.value && e.value.length > 0) {
        const text = e.value[0];
        setCommandText(text);
        handleCommand(text);
      }
    });

    return () => {
      SpeechRecognizerModule.destroy();
      onStartSub.remove();
      onEndSub.remove();
      onErrorSub.remove();
      onResultsSub.remove();
    };
  }, []);

  useEffect(() => {
    const handleDeepLink = (url: string | null) => {
      if (url === 'jarvis://listen') {
        // We use a slight timeout to ensure the app is fully resumed before recording
        setTimeout(() => startListening(), 500);
      }
    };

    // Handle cold start
    Linking.getInitialURL().then(handleDeepLink);

    // Handle warm start
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleDeepLink(url);
    });

    return () => subscription.remove();
  }, []);

  // Listen to Firestore Expenses
  useEffect(() => {
    const db = getFirestore();
    const expensesCol = collection(db, 'users', 'jarvis_user_id', 'expenses');
    const unsubscribe = onSnapshot(expensesCol, (snapshot) => {
        let todaySum = 0;
        let weekSum = 0;
        let monthSum = 0;
        
        // Ensure we handle timezones simply
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const oneDay = 24 * 60 * 60 * 1000;
        
        const dailySums = [0, 0, 0, 0, 0, 0, 0]; 
        const labels = [];
        for (let i = 6; i >= 0; i--) {
          const d = new Date(now.getTime() - i * oneDay);
          labels.push(d.toLocaleDateString('en-US', { weekday: 'short' }));
        }

        snapshot.forEach(doc => {
          const data = doc.data();
          if (data.date && data.amount) {
            const expDateStr = data.date.split('T')[0];
            const expDate = new Date(expDateStr);
            const nowDay = new Date(todayStr);
            
            // diff in days
            const diffDays = Math.floor((nowDay.getTime() - expDate.getTime()) / oneDay);
            
            const amount = parseFloat(data.amount) || 0;
            if (diffDays === 0) todaySum += amount;
            if (diffDays >= 0 && diffDays < 7) {
              weekSum += amount;
              const chartIndex = 6 - diffDays;
              if (chartIndex >= 0 && chartIndex < 7) {
                dailySums[chartIndex] += amount;
              }
            }
            if (diffDays >= 0 && diffDays < 30) {
              monthSum += amount;
            }
          }
        });

        setExpenseData({
          today: todaySum,
          lastWeek: weekSum,
          lastMonth: monthSum,
          chartData: {
            labels: labels,
            datasets: [{ data: dailySums }]
          }
        });
      }, (error) => {
         console.error('Firestore snapshot error', error);
      });

    return () => unsubscribe();
  }, []);

  const handleCommand = async (text: string) => {
    console.log('Command received:', text);

    if (GEMINI_API_KEY === 'YOUR_GEMINI_API_KEY_HERE') {
      Tts.speak('Please set your Gemini API key in the code.');
      return;
    }

    try {
      Tts.speak('Thinking...');
      const chat = model.startChat();
      const result = await chat.sendMessage(text);
      const response = result.response;

      const functionCalls = response.functionCalls();

      if (functionCalls && functionCalls.length > 0) {
        const call = functionCalls[0];

        if (call.name === 'control_light') {
          const args = call.args as { state: boolean, protocol: string };
          console.log(`Executing control_light: State=${args.state}`);
          Tts.speak(`Turning the light ${args.state ? 'on' : 'off'}`);
          
          // Phase 3 - BLE Hardware Logic
          bleManager.startDeviceScan(null, null, async (error, device) => {
            if (error) {
              console.log('BLE Scan Error:', error);
              return;
            }
            
            // Log devices we find to help you identify the Prolink bulb's ID
            console.log('Found BLE Device:', device?.name, device?.id);
            
            // Example connection logic (replace 'Prolink' with actual broadcast name if known)
            if (device?.name?.includes('Prolink') || device?.name?.includes('Smart')) {
              bleManager.stopDeviceScan();
              try {
                const connectedDevice = await device.connect();
                await connectedDevice.discoverAllServicesAndCharacteristics();
                console.log('Connected to bulb!');
                
                // TODO: Find the specific Service UUID and Characteristic UUID for this bulb
                // await connectedDevice.writeCharacteristicWithResponseForService(
                //   'SERVICE_UUID',
                //   'CHARACTERISTIC_UUID',
                //   args.state ? 'TURN_ON_BASE64' : 'TURN_OFF_BASE64'
                // );
              } catch (e) {
                console.log('Failed to connect to bulb:', e);
              }
            }
          });
          
          // Stop scanning after 10 seconds to save battery
          setTimeout(() => bleManager.stopDeviceScan(), 10000);

        } else if (call.name === 'play_music') {
          const args = call.args as { app: string };
          console.log(`Executing play_music: App=${args.app}`);
          Tts.speak(`Starting music on ${args.app}`);
          
          if (args.app.toLowerCase() === 'spotify') {
            try {
              // Open Spotify and try to send a play command
              await SendIntentAndroid.openApp('com.spotify.music', {});
              setTimeout(() => {
                // @ts-ignore - sendMediaButton might be a custom native extension
                if (typeof (SendIntentAndroid as any).sendMediaButton === 'function') {
                  (SendIntentAndroid as any).sendMediaButton(126); // 126 is KEYCODE_MEDIA_PLAY
                }
              }, 2000);
            } catch (err) {
              console.log('Failed to launch Spotify:', err);
              Tts.speak('I could not open Spotify.');
            }
          }
        } else if (call.name === 'get_todos') {
          console.log(`Executing get_todos`);
          Tts.speak('Checking your to-do list...');
          try {
            const db = getFirestore();
            const tasksCol = collection(db, 'users', 'jarvis_user_id', 'tasks');
            const q = query(tasksCol, where('isCompleted', '==', false));
            const snapshot = await getDocs(q);
            const tasks = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            
            if (tasks.length === 0) {
              Tts.speak("You have no uncompleted tasks.");
            } else {
              const taskListString = tasks.map(t => `- ${(t as any).title} (ID: ${t.id})`).join('\n');
              console.log('Tasks:', taskListString);
              const secondResult = await chat.sendMessage(`Here are the tasks from the database:\n${taskListString}\nPlease summarize them naturally to the user in a short sentence, and mention that if they want to break any of them down, they can just ask.`);
              Tts.speak(secondResult.response.text());
            }
          } catch (e) {
            console.error('Firestore Error:', e);
            Tts.speak('I could not access your to-do list.');
          }
        } else if (call.name === 'create_subtasks') {
          const args = call.args as { parentTaskId: string, subtasks: string[] };
          console.log(`Executing create_subtasks for ${args.parentTaskId}`);
          try {
            const db = getFirestore();
            const batch = writeBatch(db);
            const now = new Date().toISOString();
            const targetDate = new Date().toISOString().split('T')[0];

            for (const title of args.subtasks) {
              const taskId = uuidv4();
              const newRef = doc(db, 'users', 'jarvis_user_id', 'tasks', taskId);
              batch.set(newRef, {
                id: taskId,
                title: title,
                description: 'Created by Jarvis',
                targetDate: targetDate,
                date: targetDate,
                createdAt: now,
                isCompleted: false,
                completedAt: null,
                sortOrder: 0,
                parentId: args.parentTaskId,
                scheduledTime: null,
                estimatedTimeMins: null
              });
            }
            await batch.commit();
            Tts.speak(`I have created ${args.subtasks.length} subtasks.`);
          } catch (e) {
            console.error('Firestore Error:', e);
            Tts.speak('I failed to create the subtasks.');
          }
        } else if (call.name === 'reschedule_todo') {
          const args = call.args as { taskId: string, newDate: string };
          console.log(`Executing reschedule_todo for ${args.taskId} to ${args.newDate}`);
          try {
            // Note: Simplistic date handling, should parse newDate robustly
            let parsedDate = new Date(args.newDate);
            if (args.newDate.toLowerCase() === 'tomorrow') {
               parsedDate = new Date();
               parsedDate.setDate(parsedDate.getDate() + 1);
            }
            const dateStr = parsedDate.toISOString().split('T')[0];
            const db = getFirestore();
            const taskRef = doc(db, 'users', 'jarvis_user_id', 'tasks', args.taskId);
            await updateDoc(taskRef, {
              targetDate: dateStr,
              date: dateStr
            });
            Tts.speak(`Task rescheduled.`);
          } catch (e) {
            console.error('Firestore Error:', e);
            Tts.speak('I failed to reschedule the task.');
          }
        } else if (call.name === 'complete_todo') {
          const args = call.args as { taskId: string };
          console.log(`Executing complete_todo for ${args.taskId}`);
          try {
            const now = new Date().toISOString();
            const db = getFirestore();
            const taskRef = doc(db, 'users', 'jarvis_user_id', 'tasks', args.taskId);
            await updateDoc(taskRef, {
              isCompleted: true,
              completedAt: now
            });
            Tts.speak(`Task marked as complete.`);
          } catch (e) {
            console.error('Firestore Error:', e);
            Tts.speak('I failed to complete the task.');
          }
        } else if (call.name === 'get_daily_recap') {
          const args = call.args as { date?: string };
          console.log(`Executing get_daily_recap`);
          Tts.speak('Checking your expenses for today...');
          try {
            let searchDate = args.date;
            if (!searchDate) {
               searchDate = new Date().toISOString().split('T')[0];
            }
            
            // Note: date format stored in Firestore might vary. The headless task saves ISO date.
            // A simpler fetch is getting all recent expenses and filtering by substring
            const db = getFirestore();
            const expensesCol = collection(db, 'users', 'jarvis_user_id', 'expenses');
            const snapshot = await getDocs(expensesCol);
            const expenses = snapshot.docs
              .map(doc => ({ id: doc.id, ...doc.data() }))
              .filter(exp => (exp as any).date && (exp as any).date.startsWith(searchDate));
            
            if (expenses.length === 0) {
              Tts.speak("You have no expenses recorded for this date.");
            } else {
              const expenseListString = expenses.map(e => `- IDR ${(e as any).amount} at ${(e as any).merchant} via ${(e as any).bank}`).join('\n');
              console.log('Expenses:', expenseListString);
              const secondResult = await chat.sendMessage(`Here are the expenses tracked today:\n${expenseListString}\nPlease summarize them naturally to the user in a short sentence, including the total amount spent, and remind them that they did a good job tracking it.`);
              Tts.speak(secondResult.response.text());
            }
          } catch (e) {
            console.error('Firestore Error:', e);
            Tts.speak('I could not access your expense records.');
          }
        }
      } else {
        const textReply = response.text();
        Tts.speak(textReply);
      }
    } catch (error) {
      console.error('Gemini API Error:', error);
      Tts.speak('Sorry, I encountered an error.');
    }
  };

  const startListening = async () => {
    setCommandText('');
    try {
      await NativeModules.SpeechRecognizerModule.startListening();
    } catch (e) {
      console.error(e);
    }
  };

  const stopListening = async () => {
    try {
      await NativeModules.SpeechRecognizerModule.stopListening();
    } catch (e) {
      console.error(e);
    }
  };

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
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                RNAndroidNotificationListener.requestPermission();
              }}
            >
              <Text style={styles.modalButtonText}>Go to Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.modalDismissButton}
              onPress={() => setShowNotifModal(false)}
            >
              <Text style={styles.modalDismissText}>Dismiss</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <ScrollView contentContainerStyle={styles.content}>
        <Text style={styles.title}>Jarvis Home Assistant</Text>

        <View style={styles.statusBox}>
          <Text style={styles.statusText}>
            Status: {isRecordingCommand ? 'Listening for Command...' : 'Idle'}
          </Text>
          <TouchableOpacity
            onPress={notifPermission !== 'authorized' ? () => setShowNotifModal(true) : undefined}
          >
            <Text style={[
              styles.statusText,
              { color: notifPermission === 'authorized' ? '#4CAF50' : '#FF9800' }
            ]}>
              Expense Tracking: {notifPermission === 'authorized' ? '✅ Active' : '⚠️ Tap to enable'}
            </Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[styles.button, isRecordingCommand && styles.buttonRecording]}
          onPress={isRecordingCommand ? stopListening : startListening}
        >
          <Text style={styles.buttonText}>
            {isRecordingCommand ? 'Stop Recording' : 'Push to Talk'}
          </Text>
        </TouchableOpacity>

        <Text style={styles.commandText}>
          Last Command: {commandText || 'None'}
        </Text>

        <View style={styles.dashboardContainer}>
          <Text style={styles.dashboardTitle}>Spending Dashboard</Text>
          
          <View style={styles.summaryCards}>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Today</Text>
              <Text style={styles.cardAmount}>Rp {expenseData.today.toLocaleString()}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>7 Days</Text>
              <Text style={styles.cardAmount}>Rp {expenseData.lastWeek.toLocaleString()}</Text>
            </View>
            <View style={styles.card}>
              <Text style={styles.cardTitle}>30 Days</Text>
              <Text style={styles.cardAmount}>Rp {expenseData.lastMonth.toLocaleString()}</Text>
            </View>
          </View>

          <BarChart
            data={expenseData.chartData}
            width={Dimensions.get('window').width - 40}
            height={220}
            yAxisLabel="Rp "
            yAxisSuffix=""
            chartConfig={{
              backgroundColor: '#1E1E1E',
              backgroundGradientFrom: '#2A2A2A',
              backgroundGradientTo: '#2A2A2A',
              decimalPlaces: 0,
              color: (opacity = 1) => `rgba(0, 209, 255, ${opacity})`,
              labelColor: (opacity = 1) => `rgba(255, 255, 255, ${opacity})`,
              style: { borderRadius: 16 },
            }}
            style={{ marginVertical: 8, borderRadius: 16 }}
            showValuesOnTopOfBars={true}
          />
        </View>

        <View style={styles.capabilitiesContainer}>
          <Text style={styles.dashboardTitle}>Capabilities</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, what are my tasks for today?"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, break down my 'Clean the house' task"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, push my 'Buy Groceries' task to tomorrow"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, I finished the 'Pay Bills' task"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, how much did I spend today?"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, play some music"</Text>
          <Text style={styles.capabilityItem}>• "Jarvis, turn on the lights"</Text>
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#1E1E1E',
  },
  content: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#00D1FF',
    marginBottom: 20,
  },
  statusBox: {
    backgroundColor: '#2A2A2A',
    padding: 20,
    borderRadius: 10,
    width: '100%',
    marginBottom: 20,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: 16,
    marginBottom: 10,
  },
  commandText: {
    color: '#AAAAAA',
    fontSize: 14,
    marginVertical: 10,
    textAlign: 'center',
  },
  button: {
    backgroundColor: '#00D1FF',
    paddingHorizontal: 40,
    paddingVertical: 20,
    borderRadius: 35,
    marginTop: 10,
    marginBottom: 20,
  },
  buttonRecording: {
    backgroundColor: '#FF3B30',
  },
  buttonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 18,
  },
  dashboardContainer: {
    width: '100%',
    marginTop: 20,
    alignItems: 'center',
  },
  dashboardTitle: {
    color: '#00D1FF',
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 15,
    alignSelf: 'flex-start'
  },
  summaryCards: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    width: '100%',
    marginBottom: 20,
  },
  card: {
    backgroundColor: '#2A2A2A',
    padding: 15,
    borderRadius: 10,
    flex: 1,
    marginHorizontal: 5,
    alignItems: 'center',
  },
  cardTitle: {
    color: '#AAAAAA',
    fontSize: 12,
    marginBottom: 5,
  },
  cardAmount: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: 'bold',
  },
  capabilitiesContainer: {
    width: '100%',
    marginTop: 20,
    backgroundColor: '#2A2A2A',
    padding: 20,
    borderRadius: 10,
    alignItems: 'flex-start',
  },
  capabilityItem: {
    color: '#E0E0E0',
    fontSize: 14,
    marginBottom: 8,
    fontStyle: 'italic',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#2A2A2A',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
  },
  modalTitle: {
    color: '#FF9800',
    fontSize: 18,
    fontWeight: 'bold',
    marginBottom: 12,
    textAlign: 'center',
  },
  modalText: {
    color: '#E0E0E0',
    fontSize: 14,
    lineHeight: 22,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButton: {
    backgroundColor: '#00D1FF',
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 25,
    width: '100%',
    alignItems: 'center',
    marginBottom: 10,
  },
  modalButtonText: {
    color: '#000000',
    fontWeight: 'bold',
    fontSize: 16,
  },
  modalDismissButton: {
    paddingVertical: 10,
  },
  modalDismissText: {
    color: '#AAAAAA',
    fontSize: 14,
  },
});
