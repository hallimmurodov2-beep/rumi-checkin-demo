#!/usr/bin/env bash
# Turns a freshly reset Android tablet into the Rumi check-in kiosk.
#   ./provision.sh 1234        # 1234 = the admin PIN for the kiosk menu (4-8 digits)
# The tablet must be reset, set up WITHOUT any Google/Samsung account and WITHOUT a screen lock,
# with USB debugging on and this computer allowed. Safe to run again (e.g. to install an update).
set -euo pipefail
cd "$(dirname "$0")"

ADB="${ADB:-$HOME/Library/Android/sdk/platform-tools/adb}"
PKG=com.therumi.kiosk
ADMIN="$PKG/.AdminReceiver"
PIN="${1:-}"
APK=build/rumi-kiosk.apk

[ -f "$APK" ] || ./build.sh
echo "Waiting for the tablet..."
"$ADB" wait-for-device
echo "Tablet: $("$ADB" shell getprop ro.product.model) / Android $("$ADB" shell getprop ro.build.version.release)"

owner=$("$ADB" shell dpm list-owners 2>/dev/null | grep -c "$PKG" || true)
if [ "$owner" = "0" ]; then
  accounts=$("$ADB" shell dumpsys account | grep -c "Account {" || true)
  users=$("$ADB" shell pm list users | grep -c "UserInfo{" || true)
  if [ "$accounts" != "0" ]; then
    echo "STOP: the tablet has $accounts account(s). Android only allows a kiosk owner on a tablet with no accounts."
    echo "Remove them (Settings > Accounts) or factory reset and skip account sign-in during setup."
    exit 1
  fi
  if [ "$users" != "1" ]; then
    echo "STOP: the tablet has $users users (Secure Folder or a guest user?). Remove the extra users first."
    exit 1
  fi
fi

echo "Installing $APK"
"$ADB" install -r -t "$APK"

if [ "$owner" = "0" ]; then
  echo "Making the kiosk app the device owner"
  "$ADB" shell dpm set-device-owner "$ADMIN"
else
  echo "Already the device owner"
fi

if [ -n "$PIN" ]; then
  "$ADB" shell am start -n "$PKG/.KioskActivity" --es set_initial_pin "$PIN" >/dev/null
  echo "Admin PIN set (only applies if no PIN was set before; change it later in the admin menu)"
fi

# Never show Android's one-time "This app is using the full screen" tip to guests.
"$ADB" shell settings put secure immersive_mode_confirmations confirmed >/dev/null 2>&1 || true

# Samsung: stop charging at 85% to protect a battery that is plugged in all day (ignored elsewhere).
"$ADB" shell settings put global protect_battery 1 >/dev/null 2>&1 || true

"$ADB" shell am start -n "$PKG/.KioskActivity" >/dev/null
sleep 3
echo "Lock task state: $("$ADB" shell dumpsys activity activities | grep -m1 -o 'mLockTaskModeState=[A-Z]*')"
echo "Home screen:     $("$ADB" shell cmd package resolve-activity --brief -a android.intent.action.MAIN -c android.intent.category.HOME | tail -1)"
echo "Done. Restart the tablet to check it comes back by itself: $ADB reboot"
