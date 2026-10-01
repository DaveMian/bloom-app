# How to Build & Install Bloom on iPhone from Windows (No Mac Needed)

This guide shows you how to use **GitHub's free Cloud Mac** to build the iOS app and install it onto your iPhone from your Windows computer using **Sideloadly**.

---

### Step 1: Push Your Code to GitHub

1. Create a new repository on [GitHub](https://github.com) (can be Private or Public), e.g. `bloom-ios`.
2. In your `bloom` folder on Windows, initialize git and push:
   ```bash
   git init
   git add .
   git commit -m "Bloom iOS setup"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/bloom-ios.git
   git push -u origin main
   ```
   *(Or use GitHub Desktop: File > Add Local Repository > Publish Repository)*

---

### Step 2: Download Your `.ipa` from GitHub Actions

1. Open your repository on GitHub.
2. Click the **Actions** tab at the top.
3. You will see the **Build iOS IPA** workflow running automatically on a free Apple Silicon Mac.
4. When it turns green (approx. 2–3 minutes):
   - Click on the completed run.
   - Scroll down to the **Artifacts** section at the bottom.
   - Click **Bloom-iOS-IPA** to download the zip file containing `Bloom.ipa`.
   - Extract the zip on your Windows PC to get `Bloom.ipa`.

---

### Step 3: Install onto Your iPhone using Sideloadly (Windows)

1. **Download & Install Sideloadly**:
   - Go to [sideloadly.io](https://sideloadly.io) and download the Windows version (requires iTunes / iCloud installed on Windows, which Sideloadly can also prompt you to install automatically).
2. **Connect Your iPhone**:
   - Plug your iPhone into your Windows PC via USB cable.
   - Unlock your iPhone and tap **"Trust This Computer"** if prompted.
3. **Install the App**:
   - Open Sideloadly on Windows. Your iPhone will appear in the top device menu.
   - Drag and drop `Bloom.ipa` into the Sideloadly window.
   - Enter your personal Apple ID email under **Apple ID** (this is only used to generate a free personal developer signature on your computer).
   - Click **Start**. Sideloadly will sign and install Bloom directly onto your iPhone in ~30 seconds.

---

### Step 4: First-Time Launch on iPhone

1. On your iPhone, go to **Settings > General > VPN & Device Management**.
2. Tap your Apple ID profile under *Developer App*.
3. Tap **Trust "[Your Apple ID]"**.
4. Open **Bloom** on your iPhone!

---

### What You Get in the Native App
* **100% Unrestricted 5-Second Vibration**: Native hardware motor vibration when routines or timers finish.
* **Crisp Apple Taptic Engine Feedback**: Light, medium, and heavy physical haptic clicks for task checkoffs.
* **Works Completely Offline**: No internet needed.
