package com.amirabc.official;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.graphics.Color;
import android.graphics.Typeface;
import android.graphics.drawable.GradientDrawable;
import android.net.Uri;
import android.os.Bundle;
import android.util.TypedValue;
import android.view.Gravity;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.CookieManager;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.FrameLayout;
import android.widget.LinearLayout;
import android.widget.ProgressBar;
import android.widget.TextView;
import android.widget.Toast;

/**
 * The AMIR ABC Instagram page inside the app, on Instagram's own website.
 * People can browse posts and reels, and like after logging in on Instagram's own login page.
 * This code never reads, stores or sends what is typed on Instagram's pages.
 * Only Instagram (and Facebook, for "log in with Facebook") pages open here; other links go to the browser.
 */
public class InstagramActivity extends Activity {

    static final String PROFILE_URL = "https://www.instagram.com/amir_khan_2020b?mdxt=cHBpemQ1am9rZDA5";

    private WebView web;
    private FullscreenChrome chrome;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);

        FrameLayout root = new FrameLayout(this);
        LinearLayout content = new LinearLayout(this);
        content.setOrientation(LinearLayout.VERTICAL);
        root.addView(content, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));

        // --- top bar (right-to-left) ---
        LinearLayout bar = new LinearLayout(this);
        bar.setOrientation(LinearLayout.HORIZONTAL);
        bar.setLayoutDirection(View.LAYOUT_DIRECTION_RTL);
        bar.setGravity(Gravity.CENTER_VERTICAL);
        bar.setPadding(dp(6), 0, dp(6), 0);
        GradientDrawable bg = new GradientDrawable(GradientDrawable.Orientation.RIGHT_LEFT,
            new int[] {0xFFFA7E1E, 0xFFD62976, 0xFF962FBF});
        bar.setBackground(bg);
        content.addView(bar, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(56)));

        TextView back = barButton(getString(R.string.ig_back));
        back.setContentDescription(getString(R.string.ig_back_desc));
        back.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { finish(); }
        });
        bar.addView(back);

        TextView title = new TextView(this);
        title.setText(R.string.ig_title);
        title.setTextColor(Color.WHITE);
        title.setTextSize(TypedValue.COMPLEX_UNIT_SP, 16);
        title.setTypeface(Typeface.DEFAULT_BOLD);
        title.setGravity(Gravity.CENTER);
        title.setSingleLine(true);
        bar.addView(title, new LinearLayout.LayoutParams(0, ViewGroup.LayoutParams.WRAP_CONTENT, 1f));

        TextView reload = barButton("⟳");
        reload.setTextSize(TypedValue.COMPLEX_UNIT_SP, 22);
        reload.setContentDescription(getString(R.string.ig_reload));
        reload.setOnClickListener(new View.OnClickListener() {
            @Override public void onClick(View v) { if (web != null) web.reload(); }
        });
        bar.addView(reload);

        // --- loading bar ---
        ProgressBar progress = new ProgressBar(this, null, android.R.attr.progressBarStyleHorizontal);
        progress.setMax(100);
        progress.setIndeterminate(false);
        content.addView(progress, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, dp(3)));

        // --- Instagram web page ---
        web = new WebView(this);
        web.setBackgroundColor(Color.WHITE);
        content.addView(web, new LinearLayout.LayoutParams(ViewGroup.LayoutParams.MATCH_PARENT, 0, 1f));
        setContentView(root);

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);      // Instagram's site needs JavaScript
        s.setDomStorageEnabled(true);      // ...and storage, to stay logged in
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(false);
        s.setGeolocationEnabled(false);
        s.setSaveFormData(false);
        s.setSupportMultipleWindows(false);
        s.setMediaPlaybackRequiresUserGesture(false);
        CookieManager.getInstance().setAcceptCookie(true);
        CookieManager.getInstance().setAcceptThirdPartyCookies(web, true);

        chrome = new FullscreenChrome(this, root, content, progress);
        web.setWebChromeClient(chrome);
        web.setWebViewClient(new Client());

        if (savedInstanceState == null || web.restoreState(savedInstanceState) == null) {
            web.loadUrl(PROFILE_URL);
        }
    }

    private TextView barButton(String text) {
        TextView b = new TextView(this);
        b.setText(text);
        b.setTextColor(Color.WHITE);
        b.setTextSize(TypedValue.COMPLEX_UNIT_SP, 15);
        b.setTypeface(Typeface.DEFAULT_BOLD);
        b.setGravity(Gravity.CENTER);
        b.setMinWidth(dp(48));
        b.setMinHeight(dp(48));
        b.setPadding(dp(10), 0, dp(10), 0);
        b.setClickable(true);
        b.setFocusable(true);
        TypedValue tv = new TypedValue();
        if (getTheme().resolveAttribute(android.R.attr.selectableItemBackgroundBorderless, tv, true)) {
            b.setBackgroundResource(tv.resourceId);
        }
        return b;
    }

    private int dp(int v) {
        return Math.round(v * getResources().getDisplayMetrics().density);
    }

    static boolean isInstagramOrLogin(String host) {
        if (host == null) return false;
        host = host.toLowerCase();
        return host.equals("instagram.com") || host.endsWith(".instagram.com")
            || host.equals("facebook.com") || host.endsWith(".facebook.com");
    }

    private final class Client extends WebViewClient {
        @Override
        public boolean shouldOverrideUrlLoading(WebView view, String url) {
            if (url == null) return true;
            Uri uri = Uri.parse(url);
            String scheme = uri.getScheme() == null ? "" : uri.getScheme().toLowerCase();
            if (!scheme.equals("http") && !scheme.equals("https")) {
                return true;                               // e.g. intent:// "open the app" links: stay here
            }
            if (isInstagramOrLogin(uri.getHost())) return false;   // keep Instagram inside the app
            Intent browser = new Intent(Intent.ACTION_VIEW, uri);  // any other site: normal browser
            browser.addCategory(Intent.CATEGORY_BROWSABLE);
            try {
                startActivity(browser);
            } catch (ActivityNotFoundException e) {
                Toast.makeText(InstagramActivity.this, R.string.no_app, Toast.LENGTH_LONG).show();
            }
            return true;
        }

        @Override
        public void onReceivedError(WebView view, int errorCode, String description, String failingUrl) {
            // Only called for the main page: show a friendly message instead of Android's raw error page.
            String html = "<!doctype html><html lang='fa' dir='rtl'><head><meta charset='utf-8'>"
                + "<meta name='viewport' content='width=device-width,initial-scale=1'></head>"
                + "<body style=\"margin:0;min-height:100vh;display:flex;align-items:center;justify-content:center;"
                + "font-family:sans-serif;color:#fff;text-align:center;padding:24px;box-sizing:border-box;"
                + "background:linear-gradient(160deg,#962fbf,#d62976 50%,#fa7e1e)\">"
                + "<div><h1 style='direction:ltr'>AMIR ABC</h1><p style='line-height:1.9'>"
                + getString(R.string.ig_error) + "</p>"
                + "<p><a href='" + PROFILE_URL + "' style='display:inline-block;padding:12px 22px;border-radius:14px;"
                + "background:#fff;color:#962fbf;font-weight:bold;text-decoration:none'>"
                + getString(R.string.ig_retry) + "</a></p></div></body></html>";
            view.loadDataWithBaseURL(null, html, "text/html", "utf-8", null);
        }
    }

    @Override
    public void onBackPressed() {
        if (chrome != null && chrome.exit()) return;
        if (web != null && web.canGoBack()) {
            web.goBack();
        } else {
            super.onBackPressed();
        }
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
        CookieManager.getInstance().flush();   // keep the Instagram login
        super.onPause();
    }

    @Override
    protected void onDestroy() {
        if (web != null) {
            web.stopLoading();
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
