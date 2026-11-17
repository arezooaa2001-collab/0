package com.ranginhesab.calc;

import android.app.Activity;
import android.content.Intent;
import android.graphics.Color;
import android.net.Uri;
import android.os.Bundle;
import android.view.Window;
import android.webkit.ValueCallback;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(Color.parseColor("#1a0b33"));
        w.setNavigationBarColor(Color.parseColor("#1a0b33"));

        web = new WebView(this);
        web.setBackgroundColor(Color.parseColor("#1a0b33"));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);           // settings + history (localStorage)
        s.setMediaPlaybackRequiresUserGesture(false); // sounds
        s.setTextZoom(100);
        s.setSupportZoom(false);
        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri u = Uri.parse(url);
                if ("file".equals(u.getScheme())) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, u)); } catch (Exception e) { }
                return true;
            }
        });
        setContentView(web);
        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl("file:///android_asset/index.html");
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() { super.onPause(); web.onPause(); }

    @Override
    protected void onResume() { super.onResume(); web.onResume(); }

    @Override
    public void onBackPressed() {
        // close an open settings/history sheet first, otherwise leave the app
        web.evaluateJavascript(
            "(function(){var s=document.querySelector('.sheet:not([hidden])');if(s){s.hidden=true;return 'closed';}return 'none';})()",
            new ValueCallback<String>() {
                @Override
                public void onReceiveValue(String v) {
                    if (v == null || !v.contains("closed")) finish();
                }
            });
    }
}
