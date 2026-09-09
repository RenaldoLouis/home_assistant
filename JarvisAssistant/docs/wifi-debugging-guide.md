# Wi-Fi Debugging Guide — Jarvis Assistant

> Connect your Samsung phone to Metro bundler over Wi-Fi. No USB cable needed.

## Prerequisites

- Your Mac and phone are on the **same Wi-Fi network**
- **Developer Options** is enabled on your phone
- **Wireless debugging** is enabled on your phone
- The debug APK is already installed on your phone

---

## Step-by-Step

### 1. Enable Wireless Debugging on Phone

1. Go to **Settings → Developer Options → Wireless debugging** → toggle **ON**
2. Tap the **"Wireless debugging"** text (not the toggle) to open the detail screen

### 2. Pair Your Mac with the Phone (First Time Only)

On your phone:

3. Tap **"Pair device with pairing code"**
4. Note the **IP:PORT** and **6-digit code** shown

On your Mac terminal:

```bash
adb pair <IP>:<PAIRING_PORT>
# Enter the 6-digit code when prompted
```

Example:
```bash
adb pair 192.168.210.31:37733
# Enter pairing code: 584870
# Output: Successfully paired to 192.168.210.31:37733
```

> [!NOTE]
> You only need to pair once. After pairing, you can skip this step in future sessions unless you reset your phone's developer settings.

### 3. Connect ADB to the Phone

On the phone's **Wireless debugging** main screen (not the pairing screen), note the **IP:PORT** shown at the top.

```bash
adb connect <IP>:<CONNECTION_PORT>
```

Example:
```bash
adb connect 192.168.210.31:46305
# Output: connected to 192.168.210.31:46305
```

> [!IMPORTANT]
> The **connection port** is different from the **pairing port**. The connection port is shown on the main Wireless debugging screen. The pairing port is only shown when you tap "Pair device with pairing code."

### 4. Verify Connection

```bash
adb devices
```

You should see one device listed:
```
List of devices attached
192.168.210.31:46305    device
```

> [!WARNING]
> If you see **two devices** (e.g., one IP-based and one `adb-XXXX._adb-tls-connect._tcp`), disconnect the duplicate:
> ```bash
> adb disconnect adb-XXXX._adb-tls-connect._tcp
> ```

### 5. Set Up Port Forwarding

This makes `localhost:8081` on the phone route to your Mac's Metro server:

```bash
adb reverse tcp:8081 tcp:8081
```

> [!CAUTION]
> **This step is critical.** Without `adb reverse`, the phone cannot reach Metro and you'll get a blank/grey screen or "Unable to load script" error.

### 6. Start Metro Bundler

```bash
cd JarvisAssistant
npm start
```

Wait until you see:
```
Welcome to Metro v0.84.x
...
i - run on iOS
a - run on Android
```

### 7. Launch the App

Either:
- Tap the **Jarvis Assistant** app icon on your phone, OR
- Run from terminal:
  ```bash
  adb shell am start -n com.jarvisassistant/.MainActivity
  ```

Metro should log:
```
BUNDLE ./index.js
```

The app should render on your phone. ✅

---

## Troubleshooting

### Blank / Grey Screen

1. **Clear app data** and relaunch:
   ```bash
   adb shell pm clear com.jarvisassistant
   adb shell am start -n com.jarvisassistant/.MainActivity
   ```

2. **Re-run port forwarding** (it resets when ADB reconnects):
   ```bash
   adb reverse tcp:8081 tcp:8081
   ```

3. **Check Metro is running** and shows `BUNDLE ./index.js` when the app opens.

### "Unable to Load Script" Error

This means the phone can't reach Metro. Fix:

```bash
adb reverse tcp:8081 tcp:8081
```

Then force close and reopen the app.

### "More Than One Device/Emulator" Error

```bash
# List all connected devices
adb devices

# Disconnect the duplicate
adb disconnect <duplicate-device-id>
```

### View Native Logs (Logcat)

To debug native crashes or see React Native logs:

```bash
# Clear old logs, then stream filtered logs
adb logcat -c
adb logcat -s 'ReactNative:*' 'ReactNativeJS:*' 'AndroidRuntime:*' | head -200
```

Or filter by the app's process:

```bash
adb logcat -d --pid=$(adb shell pidof com.jarvisassistant) | grep -iE 'error|fatal|exception|react' | tail -50
```

> [!TIP]
> Quote the `*` wildcards with single quotes to prevent zsh from interpreting them as file globs.

---

## Quick Reference (Copy-Paste)

Run these commands in order every time you start a new debugging session:

```bash
# 1. Connect (use the port from your phone's Wireless debugging screen)
adb connect <IP>:<PORT>

# 2. Port forwarding
adb reverse tcp:8081 tcp:8081

# 3. Start Metro
cd ~/Documents/Personal/Home\ Assistant/JarvisAssistant
npm start

# 4. Open app on phone (or just tap the icon)
adb shell am start -n com.jarvisassistant/.MainActivity
```

---

## Installing a New Debug APK

If you change **native code** (Java/Kotlin files, `build.gradle`, add/remove native modules), you must rebuild and reinstall:

```bash
cd JarvisAssistant/android
./gradlew assembleDebug
```

Then install:
```bash
adb install -r app/build/outputs/apk/debug/app-debug.apk
```

> [!NOTE]
> **JavaScript-only changes** (`.js`, `.tsx` files) do NOT require a new APK. Metro hot-reloads them automatically. You only need to rebuild the APK when native code changes.
