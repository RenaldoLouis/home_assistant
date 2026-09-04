const fs = require('fs');

let content = fs.readFileSync('JarvisAssistant/App.tsx', 'utf8');

// Add imports
content = content.replace(
  "import { BarChart } from 'react-native-chart-kit';",
  "import { BarChart } from 'react-native-chart-kit';\nimport { DashboardScreen } from './src/screens/DashboardScreen';\nimport { OrbState } from './src/components/JarvisOrb';"
);

// Add state
content = content.replace(
  "const [showNotifModal, setShowNotifModal] = useState(false);",
  "const [showNotifModal, setShowNotifModal] = useState(false);\n  const [dailyNotes, setDailyNotes] = useState('');"
);

// Replace return and styles
const returnStartIndex = content.indexOf('return (');
const stylesheetStartIndex = content.indexOf('const styles = StyleSheet.create({');

if (returnStartIndex > -1 && stylesheetStartIndex > -1) {
  // We'll replace everything from return ( ... to the end of the file.
  const beforeReturn = content.substring(0, returnStartIndex);
  const newReturn = `
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
`;
  content = beforeReturn + newReturn;
  fs.writeFileSync('JarvisAssistant/App.tsx', content, 'utf8');
  console.log('App.tsx updated successfully.');
} else {
  console.log('Could not find return block or styles block.');
}
