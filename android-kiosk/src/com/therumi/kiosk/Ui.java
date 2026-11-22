package com.therumi.kiosk;

import android.content.Context;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.util.TypedValue;
import android.view.Gravity;
import android.widget.Button;
import android.widget.TextView;

/** Colours and small view helpers matching the web app (forest green, cream, gold). */
final class Ui {
    private Ui() {}

    static final int FOREST = Color.parseColor("#0E3B2E");
    static final int FOREST_DEEP = Color.parseColor("#0A2A21");
    static final int CREAM = Color.parseColor("#F6F2E7");
    static final int GOLD_LIGHT = Color.parseColor("#ECCD78");
    static final int INK = Color.parseColor("#17221D");
    static final int MUTED = Color.parseColor("#56615B");
    static final int LINE = Color.parseColor("#E8DFC9");
    static final int DANGER = Color.parseColor("#9A3412");

    static int dp(Context c, float v) {
        return Math.round(TypedValue.applyDimension(TypedValue.COMPLEX_UNIT_DIP, v, c.getResources().getDisplayMetrics()));
    }

    static TextView text(Context c, String s, float sp, int color, boolean bold) {
        TextView t = new TextView(c);
        t.setText(s);
        t.setTextSize(TypedValue.COMPLEX_UNIT_SP, sp);
        t.setTextColor(color);
        if (bold) t.setTypeface(Typeface.create(Typeface.DEFAULT, Typeface.BOLD));
        return t;
    }

    static TextView serif(Context c, String s, float sp, int color) {
        TextView t = text(c, s, sp, color, false);
        t.setTypeface(Typeface.create(Typeface.SERIF, Typeface.BOLD));
        return t;
    }

    /** Large touch button. kind: 0 = primary (forest), 1 = secondary (outline), 2 = danger. */
    static Button button(Context c, String label, int kind) {
        Button b = new Button(c);
        b.setText(label);
        b.setAllCaps(false);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 18);
        b.setMinHeight(dp(c, 60));
        b.setPadding(dp(c, 20), 0, dp(c, 20), 0);
        b.setGravity(Gravity.CENTER);
        b.setStateListAnimator(null);
        GradientDrawable bg = new GradientDrawable();
        bg.setCornerRadius(dp(c, 12));
        if (kind == 0) {
            bg.setColor(FOREST);
            b.setTextColor(CREAM);
        } else if (kind == 2) {
            bg.setColor(Color.WHITE);
            bg.setStroke(dp(c, 2), DANGER);
            b.setTextColor(DANGER);
        } else {
            bg.setColor(Color.WHITE);
            bg.setStroke(dp(c, 2), FOREST);
            b.setTextColor(FOREST);
        }
        b.setBackground(bg);
        return b;
    }
}
