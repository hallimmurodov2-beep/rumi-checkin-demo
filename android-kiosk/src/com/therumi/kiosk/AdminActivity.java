package com.therumi.kiosk;

import android.app.Activity;
import android.app.ActivityManager;
import android.app.AlertDialog;
import android.content.Intent;
import android.net.ConnectivityManager;
import android.net.NetworkCapabilities;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.View;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.GridLayout;
import android.widget.LinearLayout;
import android.widget.ScrollView;
import android.widget.TextView;
import android.widget.Toast;

/**
 * Staff-only menu behind the admin PIN. Runs inside the locked task, so opening it never
 * exposes Android. Closes itself after 90 seconds without a touch.
 */
public class AdminActivity extends Activity {
    private static final int MAINTENANCE_MIN = 15;
    private static final int UNLOCK = 0, NEW_PIN = 1, REPEAT_PIN = 2;

    private final Handler h = new Handler(Looper.getMainLooper());
    private final Runnable timeout = this::finish;
    private LinearLayout body;
    private final StringBuilder pin = new StringBuilder();
    private TextView dots, msg;
    private int mode;
    private String newPin;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().setDecorFitsSystemWindows(false);

        ScrollView scroll = new ScrollView(this);
        scroll.setBackgroundColor(Ui.CREAM);
        scroll.setFillViewport(true);
        FrameLayout center = new FrameLayout(this);
        body = new LinearLayout(this);
        body.setOrientation(LinearLayout.VERTICAL);
        int p = Ui.dp(this, 40);
        body.setPadding(p, p, p, p);
        center.addView(body, new FrameLayout.LayoutParams(Ui.dp(this, 620), -2, Gravity.CENTER));
        scroll.addView(center, new ScrollView.LayoutParams(-1, -1));
        setContentView(scroll);
        showPinPad(UNLOCK);
    }

    @Override
    protected void onResume() {
        super.onResume();
        WindowInsetsController c = getWindow().getInsetsController();
        if (c != null && !Policy.inMaintenance(this)) {
            c.hide(WindowInsets.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
        onUserInteraction();
    }

    @Override
    protected void onPause() {
        h.removeCallbacks(timeout);
        super.onPause();
    }

    @Override
    public void onUserInteraction() {
        h.removeCallbacks(timeout);
        h.postDelayed(timeout, 90_000);
    }

    /* ------------------------------------------------------------ PIN pad */

    private void showPinPad(int m) {
        mode = m;
        pin.setLength(0);
        body.removeAllViews();
        body.addView(Ui.text(this, "STAFF ONLY", 13, Ui.MUTED, true));
        String title = m == UNLOCK ? "Kiosk admin PIN" : m == NEW_PIN ? "New admin PIN (4 to 8 digits)" : "Repeat the new PIN";
        body.addView(Ui.serif(this, title, 34, Ui.FOREST));

        dots = Ui.text(this, "", 36, Ui.INK, true);
        dots.setGravity(Gravity.CENTER);
        dots.setLetterSpacing(0.3f);
        dots.setMinHeight(Ui.dp(this, 64));
        LinearLayout.LayoutParams dl = new LinearLayout.LayoutParams(-1, -2);
        dl.topMargin = Ui.dp(this, 16);
        body.addView(dots, dl);

        msg = Ui.text(this, "", 16, Ui.DANGER, false);
        msg.setGravity(Gravity.CENTER);
        msg.setMinHeight(Ui.dp(this, 28));
        body.addView(msg, new LinearLayout.LayoutParams(-1, -2));
        if (m == UNLOCK && Store.lockedFor(this) > 0) msg.setText(lockoutText());

        GridLayout grid = new GridLayout(this);
        grid.setColumnCount(3);
        String[] keys = {"1", "2", "3", "4", "5", "6", "7", "8", "9", "Clear", "0", "⌫"};
        for (String k : keys) {
            Button b = Ui.button(this, k, k.length() == 1 ? 1 : 1);
            b.setTextSize(k.length() == 1 ? 26 : 18);
            b.setOnClickListener(v -> key(k));
            GridLayout.LayoutParams gl = new GridLayout.LayoutParams(GridLayout.spec(GridLayout.UNDEFINED, 1f), GridLayout.spec(GridLayout.UNDEFINED, 1f));
            gl.width = 0;
            gl.height = Ui.dp(this, 72);
            int g = Ui.dp(this, 6);
            gl.setMargins(g, g, g, g);
            grid.addView(b, gl);
        }
        LinearLayout.LayoutParams gp = new LinearLayout.LayoutParams(-1, -2);
        gp.topMargin = Ui.dp(this, 8);
        body.addView(grid, gp);

        LinearLayout row = new LinearLayout(this);
        row.setOrientation(LinearLayout.HORIZONTAL);
        Button cancel = Ui.button(this, m == UNLOCK ? "Cancel" : "Back", 1);
        cancel.setOnClickListener(v -> {
            if (m == UNLOCK) finish();
            else showMenu();
        });
        Button ok = Ui.button(this, "OK", 0);
        ok.setOnClickListener(v -> submit());
        LinearLayout.LayoutParams half = new LinearLayout.LayoutParams(0, -2, 1f);
        half.setMargins(Ui.dp(this, 6), Ui.dp(this, 16), Ui.dp(this, 6), 0);
        row.addView(cancel, half);
        row.addView(ok, new LinearLayout.LayoutParams(half));
        body.addView(row, new LinearLayout.LayoutParams(-1, -2));
    }

    private void key(String k) {
        if (k.equals("Clear")) pin.setLength(0);
        else if (k.equals("⌫")) {
            if (pin.length() > 0) pin.setLength(pin.length() - 1);
        } else if (pin.length() < 8) pin.append(k);
        StringBuilder d = new StringBuilder();
        for (int i = 0; i < pin.length(); i++) d.append('•');
        dots.setText(d);
        if (mode != UNLOCK || Store.lockedFor(this) == 0) msg.setText("");
    }

    private String lockoutText() {
        long min = (Store.lockedFor(this) + 59_999) / 60_000;
        return "Too many wrong PINs. Try again in " + min + " min.";
    }

    private void submit() {
        String entered = pin.toString();
        if (mode == UNLOCK) {
            if (Store.lockedFor(this) > 0) {
                msg.setText(lockoutText());
            } else if (Store.checkPin(this, entered)) {
                Log.i(Policy.TAG, "Admin menu opened");
                showMenu();
                return;
            } else {
                msg.setText(Store.lockedFor(this) > 0 ? lockoutText() : "Wrong PIN. " + Store.triesLeft(this) + " tries left.");
            }
        } else if (mode == NEW_PIN) {
            if (entered.length() < 4) {
                msg.setText("Use 4 to 8 digits.");
            } else {
                newPin = entered;
                showPinPad(REPEAT_PIN);
                return;
            }
        } else {
            if (entered.equals(newPin)) {
                Store.setPin(this, entered);
                Toast.makeText(this, "Admin PIN changed", Toast.LENGTH_SHORT).show();
                showMenu();
                return;
            }
            showPinPad(NEW_PIN);
            msg.setText("The PINs didn't match. Try again.");
            return;
        }
        pin.setLength(0);
        dots.setText("");
    }

    /* ------------------------------------------------------------ menu */

    private void showMenu() {
        body.removeAllViews();
        body.addView(Ui.text(this, "STAFF ONLY", 13, Ui.MUTED, true));
        body.addView(Ui.serif(this, "Kiosk admin", 34, Ui.FOREST));

        ActivityManager am = getSystemService(ActivityManager.class);
        boolean locked = am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
        String version;
        try {
            version = getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            version = "?";
        }
        TextView info = Ui.text(this,
            "App " + version + "  ·  Device owner: " + (Policy.isOwner(this) ? "yes" : "NO")
                + "  ·  Lock: " + (locked ? "on" : "off") + "  ·  Internet: " + (online() ? "connected" : "not connected")
                + "\n" + KioskActivity.START_URL,
            14, Ui.MUTED, false);
        LinearLayout.LayoutParams il = new LinearLayout.LayoutParams(-1, -2);
        il.topMargin = Ui.dp(this, 6);
        il.bottomMargin = Ui.dp(this, 12);
        body.addView(info, il);

        add("Back to check-in", 0, v -> finish());
        add("Reload the check-in app", 1, v -> {
            startActivity(new Intent(this, KioskActivity.class).putExtra(KioskActivity.EXTRA_RELOAD, true));
            finish();
        });
        add("Wi-Fi settings (unlocks for " + MAINTENANCE_MIN + " min)", 1, v -> maintenance(Settings.ACTION_WIFI_SETTINGS));
        add("Android settings (unlocks for " + MAINTENANCE_MIN + " min)", 1, v -> maintenance(Settings.ACTION_SETTINGS));
        add("Restart the tablet", 1, v -> confirm("Restart the tablet?", "The check-in app opens again by itself after the restart.", "Restart", () -> {
            try {
                Policy.dpm(this).reboot(Policy.admin(this));
            } catch (Exception e) {
                Toast.makeText(this, "Restart failed: " + e.getMessage(), Toast.LENGTH_LONG).show();
            }
        }));
        boolean dbg = Policy.debuggingAllowed(this);
        add("USB debugging: " + (dbg ? "allowed (tap to block)" : "blocked (tap to allow)"), 1, v -> {
            Policy.setDebuggingAllowed(this, !dbg);
            showMenu();
        });
        add("Change admin PIN", 1, v -> showPinPad(NEW_PIN));
        add("Remove kiosk mode completely", 2, v -> confirm("Remove kiosk mode?",
            "The tablet becomes a normal Android tablet: home screen, other apps and the notification bar come back. "
                + "To use it as a kiosk again, it has to be set up again with a computer (see android-kiosk/README.md).",
            "Remove kiosk mode", () -> {
                Policy.removeKiosk(this);
                try {
                    stopLockTask();
                } catch (Exception ignored) {
                }
                startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
                finishAffinity();
            }));
    }

    private void add(String label, int kind, View.OnClickListener l) {
        Button b = Ui.button(this, label, kind);
        b.setOnClickListener(l);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-1, -2);
        lp.topMargin = Ui.dp(this, 10);
        body.addView(b, lp);
    }

    private void maintenance(String settingsAction) {
        Policy.startMaintenance(this, MAINTENANCE_MIN);
        startActivity(new Intent(settingsAction).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK));
        finish();
    }

    private void confirm(String title, String text, String yes, Runnable action) {
        new AlertDialog.Builder(this, android.R.style.Theme_DeviceDefault_Light_Dialog_Alert)
            .setTitle(title)
            .setMessage(text)
            .setNegativeButton("Cancel", null)
            .setPositiveButton(yes, (d, w) -> action.run())
            .show();
    }

    private boolean online() {
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        NetworkCapabilities caps = cm.getNetworkCapabilities(cm.getActiveNetwork());
        return caps != null && caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED);
    }
}
