package ir.telezar.game;

import android.app.Activity;
import android.graphics.Color;
import android.os.Build;
import android.os.Bundle;
import android.view.View;
import android.view.Window;
import android.view.WindowManager;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

/** Runs the single-file game (assets/index.html) full screen in a WebView. */
public class MainActivity extends Activity {
    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        requestWindowFeature(Window.FEATURE_NO_TITLE);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);
        if (Build.VERSION.SDK_INT >= 28) {
            // draw under the camera notch too (field added in API 28, set by name so older SDKs compile)
            try {
                WindowManager.LayoutParams lp = getWindow().getAttributes();
                lp.getClass().getField("layoutInDisplayCutoutMode").setInt(lp, 1);
                getWindow().setAttributes(lp);
            } catch (Exception ignored) { }
        }
        web = new WebView(this);
        web.setBackgroundColor(Color.rgb(11, 9, 32));
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);          // saves (localStorage)
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setLoadWithOverviewMode(true);
        s.setUseWideViewPort(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100);
        web.setWebViewClient(new WebViewClient());
        web.setWebChromeClient(new WebChromeClient());
        web.setVerticalScrollBarEnabled(false);
        web.setHorizontalScrollBarEnabled(false);
        setContentView(web);
        hideBars();
        if (state != null) web.restoreState(state);
        else web.loadUrl("file:///android_asset/index.html");
    }

    private void hideBars() {
        getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY | View.SYSTEM_UI_FLAG_FULLSCREEN
            | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION | View.SYSTEM_UI_FLAG_LAYOUT_STABLE | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
            | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideBars();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        if (web != null) web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        if (web != null) {
            // tell the game it is hidden (it pauses and saves), then pause the page
            web.evaluateJavascript("try{if(app.state==='play')app.pause();writeSave();}catch(e){}", null);
            web.onPause();
        }
    }

    @Override
    protected void onResume() {
        super.onResume();
        if (web != null) web.onResume();
        hideBars();
    }

    @Override
    public void onBackPressed() {
        if (web == null) { super.onBackPressed(); return; }
        // the back key acts like Escape in the game (pause / go back); on the title screen it closes the app
        web.evaluateJavascript("(function(){try{if(app.state==='title'&&app.screen==='sTitle')return 'exit';"
            + "if(app.state==='play'){app.pause();return 'ok';}"
            + "if(app.state==='pause'&&app.screen==='sPause'){app.resume();return 'ok';}"
            + "window.dispatchEvent(new KeyboardEvent('keydown',{code:'Escape',key:'Escape'}));return 'ok';}catch(e){return 'exit';}})()",
            new ValueCallback<String>() {
                @Override public void onReceiveValue(String v) { if (v != null && v.contains("exit")) finish(); }
            });
    }

    @Override
    protected void onDestroy() {
        if (web != null) { web.destroy(); web = null; }
        super.onDestroy();
    }
}
