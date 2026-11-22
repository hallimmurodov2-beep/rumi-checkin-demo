package com.therumi.kiosk;

import android.app.admin.DevicePolicyManager;
import android.app.admin.SystemUpdatePolicy;
import android.content.ComponentName;
import android.content.Context;
import android.content.Intent;
import android.content.IntentFilter;
import android.os.BatteryManager;
import android.os.UserManager;
import android.provider.Settings;
import android.util.Log;

import java.util.TimeZone;

/** Device-owner policies that turn the tablet into a single-purpose kiosk. */
final class Policy {
    private Policy() {}

    static final String TAG = "RumiKiosk";
    static final String TIME_ZONE = "Asia/Dushanbe";

    /** Restrictions that stay on while the kiosk is installed (also during maintenance). */
    static final String[] RESTRICTIONS = {
        UserManager.DISALLOW_SAFE_BOOT,            // safe mode would start Android without the kiosk
        UserManager.DISALLOW_ADD_USER,
        UserManager.DISALLOW_MOUNT_PHYSICAL_MEDIA,
        UserManager.DISALLOW_CREATE_WINDOWS,       // no overlays or toasts from other apps
        UserManager.DISALLOW_SYSTEM_ERROR_DIALOGS, // no "app isn't responding" dialogs for guests
    };

    static DevicePolicyManager dpm(Context c) {
        return (DevicePolicyManager) c.getSystemService(Context.DEVICE_POLICY_SERVICE);
    }

    static ComponentName admin(Context c) {
        return new ComponentName(c, AdminReceiver.class);
    }

    static boolean isOwner(Context c) {
        return dpm(c).isDeviceOwnerApp(c.getPackageName());
    }

    /** Applies every kiosk policy. Safe to call again and again (every start, boot and update). */
    static void apply(Context c) {
        if (!isOwner(c)) return;
        DevicePolicyManager d = dpm(c);
        ComponentName a = admin(c);
        String pkg = c.getPackageName();

        if (!inMaintenance(c)) {
            run("lock task packages", () -> d.setLockTaskPackages(a, new String[] {pkg}));
            // No home, recents, notifications, status icons, power menu or lock screen while locked.
            run("lock task features", () -> d.setLockTaskFeatures(a, DevicePolicyManager.LOCK_TASK_FEATURE_NONE));
            run("status bar", () -> d.setStatusBarDisabled(a, true));
        }
        run("home screen", () -> {
            IntentFilter home = new IntentFilter(Intent.ACTION_MAIN);
            home.addCategory(Intent.CATEGORY_HOME);
            home.addCategory(Intent.CATEGORY_DEFAULT);
            d.addPersistentPreferredActivity(a, home, new ComponentName(c, KioskActivity.class));
        });
        run("keyguard", () -> {
            if (!d.setKeyguardDisabled(a, true)) Log.w(TAG, "Lock screen could not be disabled: remove the screen lock PIN/pattern");
        });
        run("stay awake", () -> d.setGlobalSetting(a, Settings.Global.STAY_ON_WHILE_PLUGGED_IN,
            String.valueOf(BatteryManager.BATTERY_PLUGGED_AC | BatteryManager.BATTERY_PLUGGED_USB | BatteryManager.BATTERY_PLUGGED_WIRELESS)));
        for (String r : RESTRICTIONS) run(r, () -> d.addUserRestriction(a, r));
        // System updates install only between 02:00 and 04:00, never during the day.
        run("update window", () -> d.setSystemUpdatePolicy(a, SystemUpdatePolicy.createWindowedInstallPolicy(120, 240)));
        run("auto time", () -> d.setAutoTimeEnabled(a, true));
        run("time zone", () -> {
            if (!TIME_ZONE.equals(TimeZone.getDefault().getID())) {
                d.setAutoTimeZoneEnabled(a, false);
                d.setTimeZone(a, TIME_ZONE);
            }
        });
    }

    /* ---------------- Maintenance: the admin's temporary way out ---------------- */

    static boolean inMaintenance(Context c) {
        return Store.maintenanceUntil(c) > System.currentTimeMillis();
    }

    /** Unlocks the tablet for a while. Removing our package from the lock-task list ends lock task at once. */
    static void startMaintenance(Context c, int minutes) {
        Store.setMaintenanceUntil(c, System.currentTimeMillis() + minutes * 60_000L);
        if (!isOwner(c)) return;
        DevicePolicyManager d = dpm(c);
        ComponentName a = admin(c);
        run("unlock task", () -> d.setLockTaskPackages(a, new String[0]));
        run("status bar on", () -> d.setStatusBarDisabled(a, false));
        Log.i(TAG, "Maintenance for " + minutes + " min");
    }

    static void endMaintenance(Context c) {
        Store.setMaintenanceUntil(c, 0);
        apply(c);
        Log.i(TAG, "Maintenance ended");
    }

    /* ---------------- USB debugging ---------------- */

    static boolean debuggingAllowed(Context c) {
        UserManager um = (UserManager) c.getSystemService(Context.USER_SERVICE);
        return !um.hasUserRestriction(UserManager.DISALLOW_DEBUGGING_FEATURES);
    }

    static void setDebuggingAllowed(Context c, boolean allowed) {
        if (!isOwner(c)) return;
        if (allowed) dpm(c).clearUserRestriction(admin(c), UserManager.DISALLOW_DEBUGGING_FEATURES);
        else dpm(c).addUserRestriction(admin(c), UserManager.DISALLOW_DEBUGGING_FEATURES);
    }

    /* ---------------- Full removal ---------------- */

    /** Undoes every policy and gives up device ownership. The app can then be uninstalled normally. */
    static void removeKiosk(Context c) {
        if (!isOwner(c)) return;
        DevicePolicyManager d = dpm(c);
        ComponentName a = admin(c);
        String pkg = c.getPackageName();
        for (String r : RESTRICTIONS) run("clear " + r, () -> d.clearUserRestriction(a, r));
        run("clear debugging", () -> d.clearUserRestriction(a, UserManager.DISALLOW_DEBUGGING_FEATURES));
        run("clear home", () -> d.clearPackagePersistentPreferredActivities(a, pkg));
        run("status bar on", () -> d.setStatusBarDisabled(a, false));
        run("keyguard on", () -> d.setKeyguardDisabled(a, false));
        run("lock task off", () -> d.setLockTaskPackages(a, new String[0]));
        run("update policy", () -> d.setSystemUpdatePolicy(a, null));
        run("auto time zone", () -> d.setAutoTimeZoneEnabled(a, true));
        run("stay awake off", () -> d.setGlobalSetting(a, Settings.Global.STAY_ON_WHILE_PLUGGED_IN, "0"));
        Store.setMaintenanceUntil(c, 0);
        run("clear device owner", () -> d.clearDeviceOwnerApp(pkg));
        Log.i(TAG, "Kiosk removed");
    }

    private interface Step { void run() throws Exception; }

    /** Each policy is applied on its own, so one refused setting never stops the others. */
    private static void run(String what, Step s) {
        try {
            s.run();
        } catch (Throwable t) {
            Log.w(TAG, "Policy '" + what + "' failed: " + t);
        }
    }
}
