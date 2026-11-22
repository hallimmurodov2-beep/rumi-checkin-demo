package com.therumi.kiosk;

import android.app.admin.DeviceAdminReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/** Device-admin entry point. Becomes the device owner via `adb shell dpm set-device-owner`. */
public class AdminReceiver extends DeviceAdminReceiver {
    @Override
    public void onEnabled(Context c, Intent intent) {
        Log.i(Policy.TAG, "Device admin enabled");
        Policy.apply(c);
    }

    @Override
    public void onLockTaskModeEntering(Context c, Intent intent, String pkg) {
        Log.i(Policy.TAG, "Lock task on");
    }

    @Override
    public void onLockTaskModeExiting(Context c, Intent intent) {
        Log.i(Policy.TAG, "Lock task off");
    }
}
