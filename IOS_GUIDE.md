# Bloom iOS Native Setup Guide

This project is now configured with **Capacitor 8** and native iOS support with **unrestricted hardware haptic engine access**.

---

## 1. What's Included
- **Native iOS Xcode Project**: Located in `./ios/App/App.xcodeproj`
- **Native Haptics Plugin**: `@capacitor/haptics` configured via Swift Package Manager (`Package.swift`)
- **Dual-Mode Codebase**: Runs as both a high-performance web app (PWA) and a native iOS app.

---

## 2. Running on Your iPhone (via Mac / Xcode)

1. Open the project in Xcode:
   ```bash
   npx cap open ios
   ```
   *(Or double-click `ios/App/App.xcodeproj`)*

2. In Xcode:
   - Select the **App** target.
   - Go to **Signing & Capabilities**.
   - Select your personal Apple ID under **Team** (free Apple Developer account is sufficient).
   - Plug your iPhone into your Mac via USB / Wi-Fi.
   - Select your iPhone in the device dropdown at the top.
   - Press **Run (⌘R)**.

3. On your iPhone:
   - If prompted with "Untrusted Developer", go to **Settings > General > VPN & Device Management** and trust your Apple ID profile.
   - Open Bloom!

---

## 3. How Vibration & Taptic Engine Work in the Native App

| Action | Native iOS Feedback |
| :--- | :--- |
| **Timer / Routine Done** | **Full 5-second continuous hardware vibration** + heavy Taptic pulses |
| **8-Glass Water Goal** | **Continuous celebration vibration** (5 sec) |
| **Habit / Task Check** | **Crisp Taptic Engine Click** (`UIImpactFeedbackGenerator`) |
| **App Navigation** | **Subtle tactile response** |

---

## 4. Syncing Web Changes to iOS

Whenever you make changes to the React code:
```bash
# 1. Build the web app
pnpm build

# 2. Copy the updated web assets into the iOS project
npx cap sync ios
```
