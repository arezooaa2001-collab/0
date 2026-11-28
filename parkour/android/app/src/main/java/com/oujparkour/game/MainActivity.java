package com.oujparkour.game;

import android.annotation.SuppressLint;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.ApplicationInfo;
import android.graphics.Color;
import android.graphics.Insets;
import android.graphics.drawable.ColorDrawable;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.os.SystemClock;
import android.util.Log;
import android.view.View;
import android.view.ViewGroup;
import android.view.Window;
import android.view.WindowInsets;
import android.view.WindowInsetsController;
import android.view.WindowManager;
import android.webkit.ConsoleMessage;
import android.webkit.RenderProcessGoneDetail;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.window.OnBackInvokedCallback;
import android.window.OnBackInvokedDispatcher;

import androidx.annotation.NonNull;
import androidx.annotation.Nullable;
import androidx.annotation.RequiresApi;
import androidx.webkit.WebViewAssetLoader;

/**
 * Single full-screen WebView that runs the game from APK assets.
 *
 * The page is served by WebViewAssetLoader at
 * https://appassets.androidplatform.net/assets/index.html, so it has a real
 * https origin: localStorage persists and fetch() to HTTPS APIs is subject to
 * normal CORS rules instead of the "null" file:// origin.
 */
public class MainActivity extends Activity {

    static final String TAG = "OujParkour";
    static final String ASSET_HOST = WebViewAssetLoader.DEFAULT_DOMAIN; // appassets.androidplatform.net
    static final String START_URL = "https://" + ASSET_HOST + "/assets/index.html";

    /** Asks the page whether it consumed the back press. Must return "true" synchronously. */
    private static final String BACK_JS =
            "(function(){try{return window.__onAndroidBack ? String(window.__onAndroidBack()) : 'false';}"
                    + "catch(e){return 'false';}})()";

    /** If the page does not answer the back query in time (busy main thread), leave anyway. */
    private static final long BACK_TIMEOUT_MS = 2000;

    /** Render into a hardware layer as well as using the hardware-accelerated window. */
    private static final boolean USE_HARDWARE_LAYER = true;

    private final Handler mainHandler = new Handler(Looper.getMainLooper());

    private FrameLayout root;
    private WebView webView;
    private WebViewAssetLoader assetLoader;

    private View customView;
    private WebChromeClient.CustomViewCallback customViewCallback;

    private int backRequestId;
    private boolean backPending;
    private long backRequestedAt;
    private Object backInvokedCallback; // OnBackInvokedCallback on API 33+

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        configureWindow();

        if ((getApplicationInfo().flags & ApplicationInfo.FLAG_DEBUGGABLE) != 0) {
            WebView.setWebContentsDebuggingEnabled(true);
        }

        assetLoader = new WebViewAssetLoader.Builder()
                .setDomain(ASSET_HOST)
                .addPathHandler("/assets/", new Utf8PathHandler(new WebViewAssetLoader.AssetsPathHandler(this)))
                .build();

        root = new FrameLayout(this);
        root.setBackgroundColor(Color.BLACK);
        setContentView(root);

        createWebView();
        if (Build.VERSION.SDK_INT >= 30) {
            Api30.applyImePadding(root);
        }
        hideSystemUi();
        registerBackHandler();

        webView.loadUrl(START_URL);
    }

    private void configureWindow() {
        Window window = getWindow();
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
                | WindowManager.LayoutParams.FLAG_HARDWARE_ACCELERATED);
        window.setBackgroundDrawable(new ColorDrawable(Color.BLACK));
        if (Build.VERSION.SDK_INT >= 28) {
            WindowManager.LayoutParams lp = window.getAttributes();
            lp.layoutInDisplayCutoutMode = WindowManager.LayoutParams.LAYOUT_IN_DISPLAY_CUTOUT_MODE_SHORT_EDGES;
            window.setAttributes(lp);
        }
        if (Build.VERSION.SDK_INT >= 30) {
            // Bars are hidden through WindowInsetsController instead; the legacy flag (set by
            // the theme for the launch window) would keep IME insets from resizing the game.
            window.clearFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
            window.setDecorFitsSystemWindows(false);
        } else {
            window.addFlags(WindowManager.LayoutParams.FLAG_FULLSCREEN);
        }
    }

    @SuppressLint({"SetJavaScriptEnabled", "JavascriptInterface"})
    private void createWebView() {
        webView = new WebView(this);
        webView.setBackgroundColor(Color.BLACK);
        if (USE_HARDWARE_LAYER) {
            webView.setLayerType(View.LAYER_TYPE_HARDWARE, null);
        }
        webView.setOverScrollMode(View.OVER_SCROLL_NEVER);
        webView.setVerticalScrollBarEnabled(false);
        webView.setHorizontalScrollBarEnabled(false);
        webView.setFocusable(true);
        webView.setFocusableInTouchMode(true);
        webView.setHapticFeedbackEnabled(false);
        webView.setOnLongClickListener(v -> true); // no text-selection / context menu on long press

        WebSettings s = webView.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setMixedContentMode(WebSettings.MIXED_CONTENT_NEVER_ALLOW);
        s.setCacheMode(WebSettings.LOAD_DEFAULT);
        s.setTextZoom(100);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setDisplayZoomControls(false);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setAllowFileAccess(false);   // everything comes through WebViewAssetLoader
        s.setAllowContentAccess(false);
        s.setSupportMultipleWindows(false);
        s.setJavaScriptCanOpenWindowsAutomatically(false);
        s.setGeolocationEnabled(false);

        webView.setWebViewClient(new GameWebViewClient());
        webView.setWebChromeClient(new GameChromeClient());
        webView.addJavascriptInterface(new AndroidBridge(this), AndroidBridge.NAME);

        root.addView(webView, 0, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        webView.requestFocus();
    }

    // ---------------------------------------------------------------- fullscreen

    void hideSystemUi() {
        if (Build.VERSION.SDK_INT >= 30) {
            Api30.hideSystemBars(getWindow());
        } else {
            applyLegacyImmersive(getWindow().getDecorView());
        }
    }

    @SuppressWarnings("deprecation")
    private void applyLegacyImmersive(View decor) {
        decor.setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN
                | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_FULLSCREEN);
        decor.setOnSystemUiVisibilityChangeListener(visibility -> {
            if ((visibility & View.SYSTEM_UI_FLAG_FULLSCREEN) == 0) {
                mainHandler.postDelayed(this::hideSystemUi, 1500);
            }
        });
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) {
            hideSystemUi();
        }
    }

    // ---------------------------------------------------------------- back button

    private void registerBackHandler() {
        if (Build.VERSION.SDK_INT >= 33) {
            backInvokedCallback = Api33.register(this, this::handleBack);
        }
    }

    /** Android 12L and older (Android 13+ goes through the OnBackInvokedCallback). */
    @Override
    @SuppressWarnings({"deprecation", "MissingSuperCall"})
    public void onBackPressed() {
        handleBack();
    }

    /**
     * Back-button contract: the page may define window.__onAndroidBack(), returning
     * true when it handled the press (closed a menu, paused the game, ...). Anything
     * else, an exception, or no answer within BACK_TIMEOUT_MS sends the app to the
     * background (it is not killed, so the game keeps its state).
     */
    void handleBack() {
        if (webView == null) {
            moveTaskToBack(true);
            return;
        }
        long now = SystemClock.uptimeMillis();
        if (backPending && now - backRequestedAt < BACK_TIMEOUT_MS) {
            return; // previous query still running; ignore key repeat
        }
        final int requestId = ++backRequestId;
        backPending = true;
        backRequestedAt = now;
        mainHandler.postDelayed(() -> {
            if (backPending && backRequestId == requestId) {
                Log.w(TAG, "window.__onAndroidBack did not answer in time; moving task to back");
                backPending = false;
                backRequestId++; // ignore the late answer
                moveTaskToBack(true);
            }
        }, BACK_TIMEOUT_MS);
        webView.evaluateJavascript(BACK_JS, value -> {
            if (backRequestId != requestId) {
                return;
            }
            backPending = false;
            if (!"true".equals(unquote(value))) {
                moveTaskToBack(true);
            }
        });
    }

    /** evaluateJavascript returns a JSON value: strings arrive wrapped in quotes. */
    static String unquote(@Nullable String json) {
        if (json == null) return "null";
        String v = json.trim();
        if (v.length() >= 2 && v.charAt(0) == '"' && v.charAt(v.length() - 1) == '"') {
            v = v.substring(1, v.length() - 1);
        }
        return v;
    }

    // ---------------------------------------------------------------- lifecycle

    @Override
    protected void onPause() {
        if (webView != null) {
            dispatchJsEvent("androidpause");
            webView.onPause();
        }
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (webView != null) {
            webView.onResume();
            dispatchJsEvent("androidresume");
        }
        hideSystemUi();
    }

    private void dispatchJsEvent(String name) {
        webView.evaluateJavascript(
                "try{window.dispatchEvent(new Event('" + name + "'));}catch(e){}", null);
    }

    @Override
    protected void onDestroy() {
        mainHandler.removeCallbacksAndMessages(null);
        if (Build.VERSION.SDK_INT >= 33 && backInvokedCallback != null) {
            Api33.unregister(this, backInvokedCallback);
            backInvokedCallback = null;
        }
        destroyWebView();
        super.onDestroy();
    }

    private void destroyWebView() {
        if (webView == null) return;
        WebView wv = webView;
        webView = null;
        root.removeView(wv);
        wv.removeJavascriptInterface(AndroidBridge.NAME);
        wv.stopLoading();
        wv.destroy();
    }

    /** Called from the JS bridge thread. */
    void exitApp() {
        runOnUiThread(this::finishAndRemoveTask);
    }

    // ---------------------------------------------------------------- WebView clients

    private final class GameWebViewClient extends WebViewClient {

        @Nullable
        @Override
        public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
            return assetLoader.shouldInterceptRequest(request.getUrl());
        }

        @Override
        public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
            Uri uri = request.getUrl();
            if (ASSET_HOST.equals(uri.getHost())) {
                return false; // stay inside the game
            }
            if (!request.isForMainFrame()) {
                return false;
            }
            // Any other link (e.g. a credits URL) opens in the user's browser.
            try {
                startActivity(new Intent(Intent.ACTION_VIEW, uri).addCategory(Intent.CATEGORY_BROWSABLE));
            } catch (ActivityNotFoundException e) {
                Log.w(TAG, "No app can open " + uri);
            }
            return true;
        }

        @Override
        @RequiresApi(26) // only ever called on Android 8.0+
        public boolean onRenderProcessGone(WebView view, RenderProcessGoneDetail detail) {
            // The renderer crashed or was killed for memory. Without this the whole app
            // would crash; instead start over with a fresh WebView (localStorage survives).
            Log.e(TAG, "WebView renderer gone (crashed=" + detail.didCrash() + "); recreating");
            if (view == webView) {
                destroyWebView();
                recreate();
            }
            return true;
        }
    }

    private final class GameChromeClient extends WebChromeClient {

        @Override
        public boolean onConsoleMessage(ConsoleMessage m) {
            Log.println(m.messageLevel() == ConsoleMessage.MessageLevel.ERROR ? Log.ERROR : Log.DEBUG,
                    TAG, "[js] " + m.message() + " (" + m.sourceId() + ":" + m.lineNumber() + ")");
            return true;
        }

        // Element.requestFullscreen(): show the fullscreen view on top instead of going black.
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (customView != null) {
                callback.onCustomViewHidden();
                return;
            }
            customView = view;
            customViewCallback = callback;
            view.setBackgroundColor(Color.BLACK);
            root.addView(view, new FrameLayout.LayoutParams(
                    ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            hideSystemUi();
        }

        @Override
        public void onHideCustomView() {
            if (customView == null) return;
            root.removeView(customView);
            customView = null;
            if (customViewCallback != null) {
                customViewCallback.onCustomViewHidden();
                customViewCallback = null;
            }
            hideSystemUi();
            if (webView != null) webView.requestFocus();
        }
    }

    /** Serves assets with an explicit UTF-8 charset so Persian text never depends on a meta tag. */
    private static final class Utf8PathHandler implements WebViewAssetLoader.PathHandler {
        private final WebViewAssetLoader.PathHandler delegate;

        Utf8PathHandler(WebViewAssetLoader.PathHandler delegate) {
            this.delegate = delegate;
        }

        @Nullable
        @Override
        public WebResourceResponse handle(@NonNull String path) {
            WebResourceResponse r = delegate.handle(path);
            if (r != null) {
                String mime = r.getMimeType();
                if (mime != null && (mime.startsWith("text/") || mime.contains("javascript")
                        || mime.contains("json") || mime.contains("svg") || mime.contains("xml"))) {
                    r.setEncoding("UTF-8");
                }
            }
            return r;
        }
    }

    // ---------------------------------------------------------------- API-level helpers
    // Kept in nested classes so older devices never load the newer platform classes.

    @RequiresApi(30)
    private static final class Api30 {
        static void hideSystemBars(Window window) {
            WindowInsetsController c = window.getInsetsController();
            if (c == null) return;
            c.setSystemBarsBehavior(WindowInsetsController.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE);
            c.hide(WindowInsets.Type.statusBars() | WindowInsets.Type.navigationBars());
        }

        /** Shrink the game above the soft keyboard (adjustResize does nothing in fullscreen). */
        static void applyImePadding(View view) {
            view.setOnApplyWindowInsetsListener((v, insets) -> {
                Insets ime = insets.getInsets(WindowInsets.Type.ime());
                v.setPadding(0, 0, 0, ime.bottom);
                return insets;
            });
        }
    }

    @RequiresApi(33)
    private static final class Api33 {
        static Object register(Activity activity, Runnable onBack) {
            OnBackInvokedCallback cb = onBack::run;
            activity.getOnBackInvokedDispatcher()
                    .registerOnBackInvokedCallback(OnBackInvokedDispatcher.PRIORITY_DEFAULT, cb);
            return cb;
        }

        static void unregister(Activity activity, Object cb) {
            activity.getOnBackInvokedDispatcher()
                    .unregisterOnBackInvokedCallback((OnBackInvokedCallback) cb);
        }
    }
}
