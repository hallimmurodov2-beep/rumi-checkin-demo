package com.therumi.kiosk;

import android.app.Activity;
import android.app.ActivityManager;
import android.content.Intent;
import android.graphics.Bitmap;
import android.graphics.Insets;
import android.net.ConnectivityManager;
import android.net.Network;
import android.net.NetworkCapabilities;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.provider.Settings;
import android.util.Log;
import android.view.Gravity;
import android.view.MotionEvent;
import android.view.View;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.CookieManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceError;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Button;
import android.widget.FrameLayout;
import android.widget.ImageView;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * The kiosk screen: the check-in web app full screen, locked with Lock Task Mode.
 *
 * - It is also the home screen, so Android opens it after every restart.
 * - If the web app can't load, a native "Connecting..." screen retries with back-off and reloads
 *   as soon as the network is back. A blank or crashed page is reloaded automatically.
 * - Staff open the admin menu (PIN) by tapping the top-right corner 5 times within 3 seconds,
 *   or from the web app's own tablet settings (hold the emblem 3 s, then "Kiosk controls").
 */
public class KioskActivity extends Activity {
    static final String HOST = "rumi-checkin.vercel.app";
    static final String START_URL = "https://" + HOST + "/tablet";
    static final String EXTRA_RELOAD = "reload";
    /** `adb shell am start -n com.therumi.kiosk/.KioskActivity --es set_initial_pin 1234` (only when no PIN is set yet). */
    static final String EXTRA_INITIAL_PIN = "set_initial_pin";
    /** `adb shell am start -n com.therumi.kiosk/.KioskActivity --ez clear_web_data true`: forget the cached web app (this also unpairs the check-in tablet). */
    static final String EXTRA_CLEAR_WEB = "clear_web_data";

    private static final long HEALTH_MS = 60_000;
    private static final long GUARD_MS = 700;
    private static final long MAX_RETRY_MS = 60_000;

    private final Handler h = new Handler(Looper.getMainLooper());
    private FrameLayout root;
    private WebView web;
    private LinearLayout offline;
    private TextView offlineDetail;
    private LinearLayout maintBar;
    private TextView maintText;

    private boolean pageOk;
    private boolean mainFrameFailed;
    private boolean resumed;
    private long retryDelay = 5_000;
    private int blankChecks;
    private ConnectivityManager.NetworkCallback netCb;

    private final long[] taps = new long[5];
    private int tapCount;

    /* ------------------------------------------------------------ lifecycle */

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        Window w = getWindow();
        w.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        WindowManager.LayoutParams wp = w.getAttributes();
        wp.screenBrightness = 1f; // full brightness while the kiosk is on screen
        w.setAttributes(wp);
        setShowWhenLocked(true);
        setTurnScreenOn(true);
        w.setDecorFitsSystemWindows(false);

        handleIntent(getIntent(), false);
        Policy.apply(this);

        root = new FrameLayout(this);
        root.setBackgroundColor(Ui.CREAM);
        // Edge to edge; when the on-screen keyboard opens, shrink the page so the focused field stays visible.
        root.setOnApplyWindowInsetsListener((v, insets) -> {
            Insets ime = insets.getInsets(WindowInsets.Type.ime());
            v.setPadding(0, 0, 0, ime.bottom);
            return WindowInsets.CONSUMED;
        });
        setContentView(root);

        createWebView();
        buildOfflineScreen();
        buildMaintenanceBar();
        watchNetwork();
        load();
        h.postDelayed(health, HEALTH_MS);
        h.postDelayed(guard, GUARD_MS);
    }

    @Override
    protected void onNewIntent(Intent intent) {
        super.onNewIntent(intent);
        setIntent(intent);
        handleIntent(intent, true);
    }

    @Override
    protected void onResume() {
        super.onResume();
        resumed = true;
        updateLockState();
        hideSystemBars();
    }

    @Override
    protected void onPause() {
        resumed = false;
        super.onPause();
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onDestroy() {
        h.removeCallbacksAndMessages(null);
        if (netCb != null) {
            try {
                getSystemService(ConnectivityManager.class).unregisterNetworkCallback(netCb);
            } catch (Exception ignored) {
            }
        }
        if (web != null) web.destroy();
        super.onDestroy();
    }

    /** Guests never leave the app; the web app has its own Back buttons. */
    @Override
    public void onBackPressed() {
    }

    private void handleIntent(Intent i, boolean fromNew) {
        if (i == null) return;
        String pin = i.getStringExtra(EXTRA_INITIAL_PIN);
        if (pin != null) {
            if (!Store.hasPin(this) && pin.matches("\\d{4,8}")) {
                Store.setPin(this, pin);
                Log.i(Policy.TAG, "Initial admin PIN set");
            } else {
                Log.w(Policy.TAG, "Initial PIN ignored (already set, or not 4-8 digits)");
            }
            i.removeExtra(EXTRA_INITIAL_PIN);
        }
        if (fromNew && (i.getBooleanExtra(EXTRA_RELOAD, false) || i.getBooleanExtra(EXTRA_CLEAR_WEB, false))) {
            if (i.getBooleanExtra(EXTRA_CLEAR_WEB, false)) {
                Log.i(Policy.TAG, "Clearing cached web data");
                android.webkit.WebStorage.getInstance().deleteAllData();
                CookieManager.getInstance().removeAllCookies(null);
                if (web != null) web.clearCache(true);
                i.removeExtra(EXTRA_CLEAR_WEB);
            }
            i.removeExtra(EXTRA_RELOAD);
            Policy.apply(this);
            recreateWebView();
        }
    }

    /* ------------------------------------------------------------ lock task and maintenance */

    private boolean inLockTask() {
        ActivityManager am = getSystemService(ActivityManager.class);
        return am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
    }

    private void updateLockState() {
        boolean maint = Policy.inMaintenance(this);
        if (!maint && Store.maintenanceUntil(this) != 0) Policy.endMaintenance(this); // window has run out
        maintBar.setVisibility(maint ? View.VISIBLE : View.GONE);
        h.removeCallbacks(maintTick);
        if (maint) {
            maintTick.run();
            return;
        }
        if (resumed && Policy.isOwner(this) && !inLockTask()) {
            try {
                startLockTask();
            } catch (Exception e) {
                Log.w(Policy.TAG, "startLockTask failed: " + e);
            }
        }
    }

    private final Runnable maintTick = new Runnable() {
        @Override
        public void run() {
            long left = Store.maintenanceUntil(KioskActivity.this) - System.currentTimeMillis();
            if (left <= 0) {
                Policy.endMaintenance(KioskActivity.this);
                // Come back to the front, wherever the admin left the tablet.
                startActivity(new Intent(KioskActivity.this, KioskActivity.class)
                    .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
                updateLockState();
                return;
            }
            long min = (left + 59_999) / 60_000;
            maintText.setText("Maintenance mode: the tablet is unlocked. The kiosk locks again in " + min + " min, or after a restart.");
            h.postDelayed(this, 15_000);
        }
    };

    private void hideSystemBars() {
        WindowInsetsController c = getWindow().getInsetsController();
        if (c == null) return;
        if (Policy.inMaintenance(this)) {
            c.show(WindowInsets.Type.systemBars());
        } else {
            c.hide(WindowInsets.Type.systemBars());
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
        }
    }

    /* ------------------------------------------------------------ hidden admin gesture */

    @Override
    public boolean dispatchTouchEvent(MotionEvent e) {
        if (e.getActionMasked() == MotionEvent.ACTION_DOWN) {
            int corner = Ui.dp(this, 96);
            if (e.getX() > root.getWidth() - corner && e.getY() < corner) {
                long now = SystemClock.uptimeMillis();
                taps[tapCount % taps.length] = now;
                tapCount++;
                if (tapCount >= taps.length && now - taps[tapCount % taps.length] < 3_000) {
                    tapCount = 0;
                    openAdmin();
                }
            } else {
                tapCount = 0;
            }
        }
        return super.dispatchTouchEvent(e); // never swallows the touch: the page still gets it
    }

    void openAdmin() {
        if (!Store.hasPin(this)) {
            Toast.makeText(this, "Admin PIN is not set. See android-kiosk/README.md.", Toast.LENGTH_LONG).show();
            return;
        }
        startActivity(new Intent(this, AdminActivity.class));
    }

    /* ------------------------------------------------------------ web view */

    private String versionName() {
        try {
            return getPackageManager().getPackageInfo(getPackageName(), 0).versionName;
        } catch (Exception e) {
            return "?";
        }
    }

    private void createWebView() {
        WebView.setWebContentsDebuggingEnabled(Policy.debuggingAllowed(this));
        web = new WebView(this);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setTextZoom(100);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        // The web app looks for "RumiKiosk" to hide its own full-screen button and show kiosk controls.
        s.setUserAgentString(s.getUserAgentString() + " RumiKiosk/" + versionName());
        CookieManager.getInstance().setAcceptCookie(true);

        web.setOverScrollMode(View.OVER_SCROLL_NEVER);
        web.setBackgroundColor(Ui.CREAM);
        web.setWebViewClient(new Client());
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(PermissionRequest r) {
                r.deny();
            }

            @Override
            public boolean onConsoleMessage(ConsoleMessage m) {
                if (m.messageLevel() == ConsoleMessage.MessageLevel.ERROR)
                    Log.w(Policy.TAG, "web: " + m.message() + " @" + m.sourceId() + ":" + m.lineNumber());
                return true;
            }
        });
        web.addJavascriptInterface(new Bridge(), "RumiKiosk");
        root.addView(web, 0, new FrameLayout.LayoutParams(FrameLayout.LayoutParams.MATCH_PARENT, FrameLayout.LayoutParams.MATCH_PARENT));
    }

    private void recreateWebView() {
        if (web != null) {
            root.removeView(web);
            web.destroy();
            web = null;
        }
        pageOk = false;
        createWebView();
        load();
    }

    private void load() {
        h.removeCallbacks(retry);
        mainFrameFailed = false;
        web.loadUrl(START_URL);
    }

    private final Runnable retry = this::load;

    private void failed(String why) {
        Log.w(Policy.TAG, "Load failed: " + why);
        mainFrameFailed = true;
        pageOk = false;
        offlineDetail.setText("Retrying in " + (retryDelay / 1000) + " s  ·  " + why);
        offline.setVisibility(View.VISIBLE);
        h.removeCallbacks(retry);
        h.postDelayed(retry, retryDelay);
        retryDelay = Math.min(retryDelay * 2, MAX_RETRY_MS);
    }

    private final class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView v, WebResourceRequest r) {
            Uri u = r.getUrl();
            boolean ours = "https".equals(u.getScheme()) && HOST.equals(u.getHost());
            if (!ours) Log.i(Policy.TAG, "Blocked navigation to " + u);
            return !ours; // the kiosk never leaves the check-in app
        }

        @Override
        public void onPageStarted(WebView v, String url, Bitmap favicon) {
            mainFrameFailed = false;
        }

        @Override
        public void onPageFinished(WebView v, String url) {
            if (mainFrameFailed) return;
            pageOk = true;
            retryDelay = 5_000;
            blankChecks = 0;
            offline.setVisibility(View.GONE);
        }

        @Override
        public void onReceivedError(WebView v, WebResourceRequest r, WebResourceError e) {
            if (r.isForMainFrame()) failed(String.valueOf(e.getDescription()));
        }

        @Override
        public void onReceivedHttpError(WebView v, WebResourceRequest r, WebResourceResponse resp) {
            if (r.isForMainFrame() && resp.getStatusCode() >= 500) failed("HTTP " + resp.getStatusCode());
        }

        @Override
        public boolean onRenderProcessGone(WebView v, RenderProcessGoneDetail d) {
            Log.w(Policy.TAG, "Web renderer gone (crashed: " + d.didCrash() + "), starting a new one");
            h.post(KioskActivity.this::recreateWebView);
            return true;
        }
    }

    /** Called from the web app: window.RumiKiosk.openAdmin() / .info(). */
    private final class Bridge {
        @JavascriptInterface
        public void openAdmin() {
            h.post(() -> {
                Uri u = web == null || web.getUrl() == null ? null : Uri.parse(web.getUrl());
                if (u != null && HOST.equals(u.getHost())) KioskActivity.this.openAdmin();
            });
        }

        @JavascriptInterface
        public String info() {
            ActivityManager am = getSystemService(ActivityManager.class);
            boolean locked = am.getLockTaskModeState() != ActivityManager.LOCK_TASK_MODE_NONE;
            return "{\"version\":\"" + versionName() + "\",\"owner\":" + Policy.isOwner(KioskActivity.this) + ",\"locked\":" + locked + "}";
        }
    }

    /**
     * Foreground guard. Some system screens can still slip in front of a locked app (for example the
     * Samsung keyboard's own settings page from its toolbar). If anything other than the kiosk or its
     * admin menu is in front, pull the kiosk back within a second.
     */
    private final Runnable guard = new Runnable() {
        @Override
        public void run() {
            boolean awake = getSystemService(android.os.PowerManager.class).isInteractive();
            if (awake && !resumed && !AdminActivity.visible && !Policy.inMaintenance(KioskActivity.this) && Policy.isOwner(KioskActivity.this)) {
                Log.w(Policy.TAG, "Another screen is in front, bringing the kiosk back");
                try {
                    startActivity(new Intent(KioskActivity.this, KioskActivity.class)
                        .addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_REORDER_TO_FRONT));
                } catch (Exception e) {
                    Log.w(Policy.TAG, "Could not bring the kiosk back: " + e);
                }
            }
            // Back in front but no longer locked (something knocked us out of lock task): lock again.
            if (resumed && awake && !Policy.inMaintenance(KioskActivity.this) && Policy.isOwner(KioskActivity.this) && !inLockTask()) {
                Log.w(Policy.TAG, "Lock task was off, locking again");
                Policy.apply(KioskActivity.this);
                updateLockState();
            }
            h.postDelayed(this, GUARD_MS);
        }
    };

    /** Every minute: if the page has gone blank (no app rendered), reload it. */
    private final Runnable health = new Runnable() {
        @Override
        public void run() {
            if (pageOk && web != null) {
                web.evaluateJavascript("(function(){var r=document.getElementById('root');return !!(r&&r.childElementCount>0)})()", v -> {
                    if ("true".equals(v)) {
                        blankChecks = 0;
                    } else if (++blankChecks >= 3) {
                        Log.w(Policy.TAG, "Page looks blank, reloading");
                        blankChecks = 0;
                        load();
                    }
                });
            }
            h.postDelayed(this, HEALTH_MS);
        }
    };

    /* ------------------------------------------------------------ network */

    private void watchNetwork() {
        ConnectivityManager cm = getSystemService(ConnectivityManager.class);
        netCb = new ConnectivityManager.NetworkCallback() {
            @Override
            public void onCapabilitiesChanged(Network n, NetworkCapabilities caps) {
                if (caps.hasCapability(NetworkCapabilities.NET_CAPABILITY_VALIDATED)) h.post(KioskActivity.this::onOnline);
            }
        };
        try {
            cm.registerDefaultNetworkCallback(netCb);
        } catch (Exception e) {
            Log.w(Policy.TAG, "Network callback failed: " + e);
        }
    }

    /** Internet is back: if the app never loaded, load it now instead of waiting for the next retry. */
    private void onOnline() {
        if (pageOk) return;
        Log.i(Policy.TAG, "Network is back, loading");
        retryDelay = 5_000;
        load();
    }

    /* ------------------------------------------------------------ native screens */

    private void buildOfflineScreen() {
        offline = new LinearLayout(this);
        offline.setOrientation(LinearLayout.VERTICAL);
        offline.setGravity(Gravity.CENTER);
        offline.setBackgroundColor(Ui.FOREST);
        int pad = Ui.dp(this, 48);
        offline.setPadding(pad, pad, pad, pad);
        offline.setClickable(true);

        ImageView emblem = new ImageView(this);
        emblem.setImageResource(R.drawable.emblem);
        int size = Ui.dp(this, 112);
        offline.addView(emblem, new LinearLayout.LayoutParams(size, size));

        TextView en = Ui.serif(this, "Connecting to the hotel system…", 36, Ui.CREAM);
        en.setGravity(Gravity.CENTER);
        LinearLayout.LayoutParams lp = new LinearLayout.LayoutParams(-2, -2);
        lp.topMargin = Ui.dp(this, 28);
        offline.addView(en, lp);
        TextView ru = Ui.text(this, "Подключение к системе отеля…", 22, Ui.GOLD_LIGHT, false);
        offline.addView(ru);
        TextView tg = Ui.text(this, "Пайвастшавӣ ба системаи меҳмонхона…", 22, Ui.GOLD_LIGHT, false);
        offline.addView(tg);

        TextView help = Ui.text(this,
            "Please ask at the front desk  ·  Пожалуйста, обратитесь на стойку регистрации  ·  Лутфан ба мизи қабул муроҷиат кунед",
            16, Ui.CREAM, false);
        help.setGravity(Gravity.CENTER);
        help.setAlpha(0.85f);
        LinearLayout.LayoutParams hp = new LinearLayout.LayoutParams(-2, -2);
        hp.topMargin = Ui.dp(this, 24);
        offline.addView(help, hp);

        ProgressBar spin = new ProgressBar(this);
        spin.setIndeterminateTintList(android.content.res.ColorStateList.valueOf(Ui.GOLD_LIGHT));
        LinearLayout.LayoutParams sp = new LinearLayout.LayoutParams(Ui.dp(this, 40), Ui.dp(this, 40));
        sp.topMargin = Ui.dp(this, 32);
        offline.addView(spin, sp);

        offlineDetail = Ui.text(this, "", 13, Ui.GOLD_LIGHT, false);
        offlineDetail.setAlpha(0.7f);
        LinearLayout.LayoutParams dp = new LinearLayout.LayoutParams(-2, -2);
        dp.topMargin = Ui.dp(this, 16);
        offline.addView(offlineDetail, dp);

        offline.setVisibility(View.GONE);
        root.addView(offline, new FrameLayout.LayoutParams(-1, -1));
    }

    private void buildMaintenanceBar() {
        maintBar = new LinearLayout(this);
        maintBar.setOrientation(LinearLayout.HORIZONTAL);
        maintBar.setGravity(Gravity.CENTER_VERTICAL);
        maintBar.setBackgroundColor(Ui.GOLD_LIGHT);
        int p = Ui.dp(this, 16);
        maintBar.setPadding(p, Ui.dp(this, 40), p, p); // clear of the status bar, which is visible during maintenance
        maintBar.setElevation(Ui.dp(this, 8));

        maintText = Ui.text(this, "", 17, Ui.INK, true);
        maintBar.addView(maintText, new LinearLayout.LayoutParams(0, -2, 1f));

        Button settings = Ui.button(this, "Android settings", 1);
        settings.setOnClickListener(v -> startActivity(new Intent(Settings.ACTION_SETTINGS).addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)));
        LinearLayout.LayoutParams bp = new LinearLayout.LayoutParams(-2, -2);
        bp.leftMargin = Ui.dp(this, 12);
        maintBar.addView(settings, bp);

        Button lock = Ui.button(this, "Lock kiosk now", 0);
        lock.setOnClickListener(v -> {
            Policy.endMaintenance(this);
            updateLockState();
            hideSystemBars();
        });
        maintBar.addView(lock, new LinearLayout.LayoutParams(bp));

        maintBar.setVisibility(View.GONE);
        root.addView(maintBar, new FrameLayout.LayoutParams(-1, -2, Gravity.TOP));
    }
}
