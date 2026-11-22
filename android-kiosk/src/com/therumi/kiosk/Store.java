package com.therumi.kiosk;

import android.content.Context;
import android.content.SharedPreferences;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;

/** Small persistent state: the admin PIN (salted hash), PIN lockout and maintenance window. */
final class Store {
    private Store() {}

    static final int MAX_TRIES = 5;
    static final long LOCKOUT_MS = 5 * 60_000L;

    private static SharedPreferences p(Context c) {
        return c.getSharedPreferences("kiosk", Context.MODE_PRIVATE);
    }

    /* ---------------- Admin PIN ---------------- */

    static boolean hasPin(Context c) {
        return p(c).contains("pin_hash");
    }

    static void setPin(Context c, String pin) {
        byte[] salt = new byte[16];
        new SecureRandom().nextBytes(salt);
        String s = hex(salt);
        p(c).edit().putString("pin_salt", s).putString("pin_hash", hash(s, pin)).putInt("pin_fails", 0).putLong("pin_lock_until", 0).apply();
    }

    /** Checks a PIN, counting failures. Returns false while locked out. */
    static boolean checkPin(Context c, String pin) {
        SharedPreferences sp = p(c);
        if (lockedFor(c) > 0) return false;
        String salt = sp.getString("pin_salt", null), want = sp.getString("pin_hash", null);
        if (salt == null || want == null) return false;
        boolean ok = MessageDigest.isEqual(want.getBytes(StandardCharsets.US_ASCII), hash(salt, pin).getBytes(StandardCharsets.US_ASCII));
        if (ok) {
            sp.edit().putInt("pin_fails", 0).putLong("pin_lock_until", 0).apply();
        } else {
            int fails = sp.getInt("pin_fails", 0) + 1;
            SharedPreferences.Editor e = sp.edit().putInt("pin_fails", fails);
            if (fails >= MAX_TRIES) e.putInt("pin_fails", 0).putLong("pin_lock_until", System.currentTimeMillis() + LOCKOUT_MS);
            e.apply();
        }
        return ok;
    }

    /** Milliseconds left in a PIN lockout, or 0. */
    static long lockedFor(Context c) {
        return Math.max(0, p(c).getLong("pin_lock_until", 0) - System.currentTimeMillis());
    }

    static int triesLeft(Context c) {
        return MAX_TRIES - p(c).getInt("pin_fails", 0);
    }

    /* ---------------- Maintenance window ---------------- */

    static long maintenanceUntil(Context c) {
        return p(c).getLong("maintenance_until", 0);
    }

    static void setMaintenanceUntil(Context c, long when) {
        p(c).edit().putLong("maintenance_until", when).apply();
    }

    /* ---------------- helpers ---------------- */

    private static String hash(String salt, String pin) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            byte[] d = md.digest((salt + ":" + pin).getBytes(StandardCharsets.UTF_8));
            for (int i = 0; i < 20_000; i++) d = md.digest(d); // slow down guessing from a copied prefs file
            return hex(d);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static String hex(byte[] b) {
        StringBuilder sb = new StringBuilder();
        for (byte x : b) sb.append(String.format("%02x", x));
        return sb.toString();
    }
}
