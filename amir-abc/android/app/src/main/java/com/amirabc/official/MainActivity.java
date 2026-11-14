package com.amirabc.official;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Context;
import android.content.Intent;
import android.graphics.Color;
import android.net.ConnectivityManager;
import android.net.NetworkInfo;
import android.net.Uri;
import android.os.Bundle;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebChromeClient;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.Toast;

/**
 * AMIR ABC: shows the bundled offline page (assets/AMIR_ABC.html) in a WebView.
 * Every http/https link (the Instagram button) is opened outside the app:
 * first in the Instagram app, otherwise in the browser.
 */
public class MainActivity extends Activity {

    private static final String HOME = "file:///android_asset/AMIR_ABC.html";
    private static final String INSTAGRAM_PACKAGE = "com.instagram.android";

    private WebView web;
    private FrameLayout root;
    private View fullscreenView;
    private WebChromeClient.CustomViewCallback fullscreenCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        root = new FrameLayout(this);
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(0xC5, 0x17, 0x0F));
        web.setOverScrollMode(WebView.OVER_SCROLL_NEVER);
        root.addView(web, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);          // reveal animations + button effects
        s.setDomStorageEnabled(true);          // remembers the colour chosen on the colour page
        s.setAllowFileAccess(false);           // android_asset still works; no other file access
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setSaveFormData(false);
        s.setSupportMultipleWindows(false);    // target=_blank -> shouldOverrideUrlLoading
        s.setMediaPlaybackRequiresUserGesture(true);

        web.setWebViewClient(new AppClient());
        web.setWebChromeClient(new AppChrome());
        // Instagram's embedded player (inside an iframe) needs its own cookies to play.
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(HOME);
        }
    }

    private final class AppClient extends WebViewClient {
        // On Android 7+ the default shouldOverrideUrlLoading(WebView, WebResourceRequest)
        // delegates to this method, so this covers every supported version.
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            return handleUrl(url);
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            // Never show Android's raw error page.
            showFriendlyError(view);
        }
    }

    /** Lets videos in the embedded player go full screen. */
    private final class AppChrome extends WebChromeClient {
        @Override
        public void onShowCustomView(View view, CustomViewCallback callback) {
            if (fullscreenView != null) {
                callback.onCustomViewHidden();
                return;
            }
            fullscreenView = view;
            fullscreenCallback = callback;
            view.setBackgroundColor(Color.BLACK);
            root.addView(view, new FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
            web.setVisibility(View.GONE);
            getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                    | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
        }

        @Override
        public void onHideCustomView() {
            exitFullscreen();
        }
    }

    private boolean exitFullscreen() {
        if (fullscreenView == null) return false;
        root.removeView(fullscreenView);
        fullscreenView = null;
        web.setVisibility(View.VISIBLE);
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (fullscreenCallback != null) {
            fullscreenCallback.onCustomViewHidden();
            fullscreenCallback = null;
        }
        return true;
    }

    /** @return true if the WebView must NOT load the URL itself. */
    private boolean handleUrl(String url) {
        if (url == null) return true;
        if (url.startsWith("file:///android_asset/")) return false; // our own page
        Uri uri = Uri.parse(url);
        String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
        if (scheme.equals("http") || scheme.equals("https")) {
            openExternal(uri);
        }
        // Any other scheme (javascript:, intent:, file:, ...) is blocked.
        return true;
    }

    private void openExternal(Uri uri) {
        if (!isOnline()) {
            notifyUser(getString(R.string.no_internet));
            return;
        }
        String host = uri.getHost() == null ? "" : uri.getHost().toLowerCase();
        if (host.equals("instagram.com") || host.endsWith(".instagram.com")) {
            Intent app = new Intent(Intent.ACTION_VIEW, uri);
            app.setPackage(INSTAGRAM_PACKAGE);
            try {
                startActivity(app);
                return;
            } catch (ActivityNotFoundException ignored) {
                // Instagram app not installed: fall back to the browser.
            }
        }
        Intent browser = new Intent(Intent.ACTION_VIEW, uri);
        browser.addCategory(Intent.CATEGORY_BROWSABLE);
        try {
            startActivity(browser);
        } catch (ActivityNotFoundException e) {
            notifyUser(getString(R.string.no_app));
        }
    }

    @SuppressWarnings("deprecation")
    private boolean isOnline() {
        try {
            ConnectivityManager cm = (ConnectivityManager) getSystemService(Context.CONNECTIVITY_SERVICE);
            if (cm == null) return true;
            NetworkInfo info = cm.getActiveNetworkInfo();
            return info != null && info.isConnected();
        } catch (SecurityException e) {
            return true; // can't tell: let the system try
        }
    }

    /** Shows the page's own toast when possible, otherwise a native Toast. */
    private void notifyUser(final String msg) {
        final String safe = msg.replace("\\", "\\\\").replace("'", "\\'");
        if (web != null) {
            web.evaluateJavascript(
                "(function(){if(window.amirAbcToast){window.amirAbcToast('" + safe + "');return 1}return 0})()",
                new ValueCallback<String>() {
                    @Override
                    public void onReceiveValue(String result) {
                        if (!"1".equals(result)) {
                            Toast.makeText(MainActivity.this, msg, Toast.LENGTH_LONG).show();
                        }
                    }
                });
        } else {
            Toast.makeText(this, msg, Toast.LENGTH_LONG).show();
        }
    }

    private void showFriendlyError(WebView view) {
        String html = "<!doctype html><html lang='fa' dir='rtl'><head><meta charset='utf-8'>"
            + "<meta name='viewport' content='width=device-width,initial-scale=1'></head>"
            + "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;"
            + "font-family:sans-serif;color:#fff;text-align:center;padding:24px;box-sizing:border-box;"
            + "background:linear-gradient(160deg,#c5170f,#f47b0c 50%,#0f8f45)\">"
            + "<div><h1 style='direction:ltr'>AMIR ABC</h1><p style='line-height:1.9'>"
            + getString(R.string.load_error) + "</p></div></body></html>";
        view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
    }

    @Override
    public void onBackPressed() {
        if (exitFullscreen()) return;          // leave full-screen video first
        if (web == null) {
            super.onBackPressed();
            return;
        }
        // First let the page close its colour-settings screen; otherwise go back or exit.
        web.evaluateJavascript(
            "(function(){try{return !!(window.amirAbcBack&&window.amirAbcBack())}catch(e){return false}})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String handled) {
                    if ("true".equals(handled)) return;
                    if (web != null && web.canGoBack()) {
                        web.goBack();
                    } else {
                        finish();
                    }
                }
            });
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        if (web != null) web.saveState(outState);
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
    }

    @Override
    protected void onPause() {
        if (web != null) web.onPause();
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
