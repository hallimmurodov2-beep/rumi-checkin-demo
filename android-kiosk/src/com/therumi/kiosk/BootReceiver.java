package com.therumi.kiosk;

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;
import android.util.Log;

/**
 * After a restart or an app update: re-apply the policies and open the kiosk.
 * (The kiosk is also the home screen, so Android opens it on boot anyway; this is a second guarantee.)
 */
public class BootReceiver extends BroadcastReceiver {
    @Override
    public void onReceive(Context c, Intent intent) {
        String action = intent.getAction();
        Log.i(Policy.TAG, "Received " + action);
        if (Intent.ACTION_BOOT_COMPLETED.equals(action)) Store.setMaintenanceUntil(c, 0); // a restart always ends maintenance
        Policy.apply(c);
        if (Policy.isOwner(c)) {
            try {
                c.startActivity(new Intent(c, KioskActivity.class).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
            } catch (Exception e) {
                // Newer Android versions restrict starting activities from the background; the kiosk is the home screen, so the system opens it anyway.
                Log.w(Policy.TAG, "Could not start the kiosk from the receiver: " + e);
            }
        }
    }
}
