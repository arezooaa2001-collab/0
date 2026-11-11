package com.arash.castle;

import android.app.Activity;
import android.app.AlertDialog;
import android.content.ClipData;
import android.content.DialogInterface;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.OutputStream;
import java.lang.reflect.Method;

/**
 * Full-screen WebView shell for the game. Everything (game, three.js, fonts)
 * is bundled in assets/, so it runs offline.
 */
public class MainActivity extends Activity {
    private static final int REQ_PICK = 1;
    private static final int REQ_SAVE = 2;
    // View.SYSTEM_UI_FLAG_* (API 19) as literals; the compile stubs are API 16.
    private static final int IMMERSIVE = 0x100 | 0x200 | 0x400 | 0x2 | 0x4 | 0x1000;

    private WebView web;
    private ValueCallback<Uri[]> pickCallback;
    private byte[] pendingSave;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON | WindowManager.LayoutParams.FLAG_FULLSCREEN);

        web = new WebView(this);
        web.setBackgroundColor(0xff080817);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setAllowFileAccess(true);
        s.setUseWideViewPort(true);
        s.setLoadWithOverviewMode(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);
        s.setTextZoom(100); // the HUD is laid out for 100% text size
        callIfExists(s, "setMediaPlaybackRequiresUserGesture", false); // API 17+

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                if (url.startsWith("file:") || url.startsWith("blob:") || url.startsWith("data:")) return false;
                try { startActivity(new Intent(Intent.ACTION_VIEW, Uri.parse(url))); } catch (Exception ignored) { }
                return true;
            }
        });
        web.setWebChromeClient(new Chrome());
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        setContentView(web);

        if (state != null) web.restoreState(state);
        if (web.getUrl() == null) web.loadUrl("file:///android_asset/index.html");
        immersive();
    }

    private static void callIfExists(Object target, String name, boolean arg) {
        try {
            Method m = target.getClass().getMethod(name, boolean.class);
            m.invoke(target, arg);
        } catch (Exception ignored) { }
    }

    private void immersive() {
        getWindow().getDecorView().setSystemUiVisibility(IMMERSIVE);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) immersive();
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
        web.pauseTimers(); // stops game loop and sound while in the background
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.resumeTimers();
        web.onResume();
        immersive();
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onDestroy() {
        if (web != null) web.destroy();
        super.onDestroy();
    }

    @Override
    public void onBackPressed() {
        new AlertDialog.Builder(this)
                .setMessage("از بازی خارج می‌شی؟ پیشرفتت ذخیره شده.")
                .setPositiveButton("خروج", new DialogInterface.OnClickListener() {
                    public void onClick(DialogInterface d, int w) { finish(); }
                })
                .setNegativeButton("ادامهٔ بازی", null)
                .show();
    }

    /* <input type="file">: photos for the builder, backup restore */
    private class Chrome extends WebChromeClient {
        public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, WebChromeClient.FileChooserParams params) {
            if (pickCallback != null) pickCallback.onReceiveValue(null);
            pickCallback = callback;
            String type = "*/*";
            String[] accept = params.getAcceptTypes();
            if (accept != null) for (String a : accept) if (a != null && a.startsWith("image")) type = "image/*";
            Intent i = new Intent(Intent.ACTION_GET_CONTENT);
            i.addCategory(Intent.CATEGORY_OPENABLE);
            i.setType(type);
            if (params.getMode() == WebChromeClient.FileChooserParams.MODE_OPEN_MULTIPLE)
                i.putExtra("android.intent.extra.ALLOW_MULTIPLE", true);
            try {
                startActivityForResult(Intent.createChooser(i, "انتخاب فایل"), REQ_PICK);
            } catch (Exception e) {
                pickCallback = null;
                return false;
            }
            return true;
        }
    }

    /* JS bridge: the game's "save backup" download goes to Android's save dialog */
    private class Bridge {
        @JavascriptInterface
        public void saveFile(final String name, final String mime, final String base64) {
            final byte[] data;
            try { data = Base64.decode(base64, Base64.DEFAULT); } catch (Exception e) { return; }
            runOnUiThread(new Runnable() {
                public void run() {
                    pendingSave = data;
                    Intent i = new Intent("android.intent.action.CREATE_DOCUMENT");
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime == null || mime.length() == 0 ? "application/octet-stream" : mime);
                    i.putExtra("android.intent.extra.TITLE", name);
                    try {
                        startActivityForResult(i, REQ_SAVE);
                    } catch (Exception e) {
                        pendingSave = null;
                        Toast.makeText(MainActivity.this, "ذخیرهٔ فایل روی این گوشی پشتیبانی نمی‌شه.", Toast.LENGTH_LONG).show();
                    }
                }
            });
        }
    }

    @Override
    protected void onActivityResult(int req, int res, Intent data) {
        super.onActivityResult(req, res, data);
        if (req == REQ_PICK) {
            Uri[] result = null;
            if (res == RESULT_OK && data != null) {
                ClipData clip = data.getClipData();
                if (clip != null && clip.getItemCount() > 0) {
                    result = new Uri[clip.getItemCount()];
                    for (int k = 0; k < result.length; k++) result[k] = clip.getItemAt(k).getUri();
                } else if (data.getData() != null) {
                    result = new Uri[]{data.getData()};
                }
            }
            if (pickCallback != null) pickCallback.onReceiveValue(result);
            pickCallback = null;
        } else if (req == REQ_SAVE) {
            byte[] bytes = pendingSave;
            pendingSave = null;
            if (res != RESULT_OK || data == null || data.getData() == null || bytes == null) return;
            try {
                OutputStream o = getContentResolver().openOutputStream(data.getData());
                o.write(bytes);
                o.close();
                Toast.makeText(this, "✅ فایل پشتیبان ذخیره شد.", Toast.LENGTH_LONG).show();
            } catch (Exception e) {
                Toast.makeText(this, "ذخیرهٔ فایل انجام نشد.", Toast.LENGTH_LONG).show();
            }
        }
    }
}
