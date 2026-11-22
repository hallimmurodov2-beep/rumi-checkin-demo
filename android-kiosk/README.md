# The Rumi check-in kiosk (Android)

A small Android app that turns a tablet into a dedicated check-in kiosk. It shows the check-in web app (`https://rumi-checkin.vercel.app/tablet`) full screen and nothing else. It is set up on the lobby **Samsung Galaxy Tab A8 (SM-X205, Android 14)**.

## How it works

The app is the tablet's **device owner** (Android Enterprise). It uses that to:

- **Lock Task Mode:** the tablet is locked to this app. No home or recent-apps buttons, notification shade, status bar, power menu or lock screen. Other apps can't open.
- **Home screen:** the app replaces the Samsung launcher, so Android opens it after every restart. A boot receiver opens it as well.
- **Screen:** always on while plugged in, landscape, with no system bars.
- **Blocked:** safe mode (which would start Android without the kiosk), new users, SD cards, pop-ups from other apps, and Android's "app isn't responding" dialogs.
- **System updates:** only installed between 02:00 and 04:00.
- **Time:** time zone fixed to Asia/Dushanbe, network time on.

The web app runs in a WebView, Chrome's engine built into Android. We chose this over a Trusted Web Activity (TWA), which hands the page to the Chrome app. In lock task, Chrome would have to be allowed too, and can still show its own sign-in, update and translate prompts. It also gives the kiosk no control when the page fails to load. The WebView keeps everything inside one locked app.

## When the internet drops

- **Already loaded once:** the web app's service worker keeps it working from the tablet's cache. It shows "No internet connection" until the network is back.
- **Can't load at all** (for example right after a restart with no Wi-Fi): the kiosk shows its own "Connecting to the hotel system…" screen in English, Russian and Tajik. It retries after 5 s, 10 s, 20 s and so on up to every 60 s. It also reloads the moment Android reports a working connection.
- **Blank page:** if the page goes blank for 3 minutes, it is reloaded.
- **Crash:** if the WebView crashes, a new one is started.
- **Links:** the kiosk never leaves `rumi-checkin.vercel.app`. Links to other sites are blocked.

## Staff: the admin menu

Open it in either of two ways:

1. Tap the **top-right corner 5 times within 3 seconds**. This works on every screen, including the "Connecting…" screen.
2. On the check-in Welcome screen, **hold the emblem for 3 seconds**, then tap **Kiosk controls**.

Both ask for the **admin PIN**. After 5 wrong PINs the menu locks for 5 minutes. The menu closes itself after 90 seconds without a touch.

| Menu item | What it does |
|---|---|
| Back to check-in | Closes the menu. |
| Reload the check-in app | Starts the web app again from scratch. |
| Wi-Fi settings / Android settings | Unlocks the tablet for **15 minutes** (maintenance mode) and opens Settings. A yellow bar on the kiosk screen shows the time left and has **Lock kiosk now**. A restart also ends maintenance. |
| Restart the tablet | Reboots. The kiosk comes back by itself. |
| USB debugging | Allows or blocks USB debugging (adb). See "Security" below. |
| Change admin PIN | 4 to 8 digits. |
| Remove kiosk mode completely | Gives up device ownership and makes it a normal tablet again. To make it a kiosk again, run the setup below. |

## Setting up a tablet (from scratch)

1. **Factory reset** the tablet. In setup, connect to Wi-Fi.
   - **Skip** Google and Samsung account sign-in. Android refuses a kiosk owner if any account exists.
   - **Don't set a screen lock.**
2. **Developer options:** Settings → About tablet → Software information → tap **Build number** 7 times.
3. **USB debugging:** Developer options → turn on **USB debugging**. Connect the cable and allow this computer.
4. **Run the setup script** on the Mac:

   ```bash
   cd android-kiosk && ./provision.sh 1234
   ```

   Replace `1234` with the admin PIN. The script builds the app if needed, installs it, makes it the device owner, sets the PIN and starts it.
5. **Pair the check-in app:** in the staff app, go to Settings → Tablets → Add tablet, then type the code on the tablet.
6. **Check:** restart the tablet (`adb reboot`). It should come back straight into the check-in app.

## Building and updating the app

```bash
cd android-kiosk && ./build.sh
```

This needs only the Android SDK and the JDK bundled with Android Studio (no Gradle). It writes `build/rumi-kiosk.apk`.

To update a tablet that is already a kiosk:

```bash
adb install -r -t build/rumi-kiosk.apk
```

The kiosk restarts itself after an update. The web app updates itself and needs no reinstall.

**Back up `android-kiosk/signing/`** (keystore and password). It is not in git. Updates must be signed with the same key. Without it, the kiosk has to be removed and set up again.

## Recovery

Try these in order.

1. **Admin menu:** maintenance mode to get into Settings, or **Remove kiosk mode completely**.
2. **Forgotten PIN, USB debugging allowed.** The app is built `testOnly`, so adb can remove it:

   ```bash
   adb shell dpm remove-active-admin com.therumi.kiosk/.AdminReceiver
   adb uninstall com.therumi.kiosk
   ```

   The tablet is now a normal tablet. To make it a kiosk again, run `./provision.sh` with a new PIN.
3. **Tablet stuck and adb blocked: factory reset from recovery mode.** Kiosk mode does not block this.
   1. Hold **Power + Volume down** for about 10 seconds to force a restart.
   2. As soon as the screen goes black, hold **Power + Volume up** until the Samsung logo appears. On some models the tablet must be connected to a computer by USB.
   3. In the recovery menu, use the volume keys to select **Wipe data/factory reset** and press Power to confirm.
   4. Then set the tablet up again from scratch. There is no Google account on the kiosk, so there is no Google account lock after the reset.

Useful adb commands:

```bash
adb shell dpm list-owners                                          # is the kiosk the device owner?
adb shell dumpsys activity activities | grep mLockTaskModeState    # LOCKED = kiosk is locked
adb logcat -s RumiKiosk                                            # what the kiosk is doing
adb shell am start -n com.therumi.kiosk/.KioskActivity --ez reload true
adb exec-out screencap -p > screen.png
```

## Security notes

- **USB debugging** is allowed after setup, so a computer that was allowed before can manage the tablet. Anyone plugging into the tablet's USB port must still be approved on the tablet's own screen. Once the tablet is in place, block it in the admin menu. Allow it again from the menu when you need adb.
- **Browser engine updates:** with no Google account, the Play Store doesn't update Android System WebView. During maintenance you can add a hotel Google account (Android settings → Accounts) so the Play Store keeps it up to date. This doesn't affect the kiosk.
- **Admin PIN:** stored only as a salted hash on the tablet.
