package com.oujparkour.game;

import android.content.Context;
import android.os.Build;
import android.os.VibrationEffect;
import android.os.Vibrator;
import android.os.VibratorManager;
import android.util.Log;
import android.webkit.JavascriptInterface;

/**
 * Exposed to the page as {@code window.AndroidBridge}.
 *
 * <pre>
 *   if (window.AndroidBridge && AndroidBridge.isAndroid()) {
 *     AndroidBridge.vibrate(30);   // milliseconds, clamped to 1..5000
 *     AndroidBridge.exitApp();     // close the app (finishAndRemoveTask)
 *   }
 * </pre>
 *
 * Methods run on a WebView background thread, never on the UI thread.
 */
final class AndroidBridge {

    static final String NAME = "AndroidBridge";
    private static final int MAX_VIBRATE_MS = 5000;

    private final MainActivity activity;
    private final Vibrator vibrator;

    AndroidBridge(MainActivity activity) {
        this.activity = activity;
        this.vibrator = findVibrator(activity);
    }

    @SuppressWarnings("deprecation")
    private static Vibrator findVibrator(Context context) {
        if (Build.VERSION.SDK_INT >= 31) {
            VibratorManager vm = (VibratorManager) context.getSystemService(Context.VIBRATOR_MANAGER_SERVICE);
            return vm != null ? vm.getDefaultVibrator() : null;
        }
        return (Vibrator) context.getSystemService(Context.VIBRATOR_SERVICE);
    }

    @JavascriptInterface
    @SuppressWarnings("deprecation")
    public void vibrate(int ms) {
        if (ms <= 0 || vibrator == null || !vibrator.hasVibrator()) return;
        long duration = Math.min(ms, MAX_VIBRATE_MS);
        try {
            if (Build.VERSION.SDK_INT >= 26) {
                vibrator.vibrate(VibrationEffect.createOneShot(duration, VibrationEffect.DEFAULT_AMPLITUDE));
            } else {
                vibrator.vibrate(duration);
            }
        } catch (RuntimeException e) {
            Log.w(MainActivity.TAG, "vibrate failed", e);
        }
    }

    @JavascriptInterface
    public void exitApp() {
        activity.exitApp();
    }

    @JavascriptInterface
    public boolean isAndroid() {
        return true;
    }
}
