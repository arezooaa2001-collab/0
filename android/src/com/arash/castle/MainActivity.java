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

import java.io.ByteArrayOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.OutputStream;
import java.lang.reflect.Method;
import java.util.HashMap;
import java.util.Map;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.Future;
import java.util.concurrent.TimeUnit;

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
    private Store store;

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
        store = new Store(new File(getFilesDir(), "save"));
        web.addJavascriptInterface(new Bridge(), "AndroidApp");
        web.addJavascriptInterface(store, "AndroidStore");
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
        // Ask the game to save everything now, then pause it. The bridge writes to disk on
        // its own thread, so the save survives the app being swiped away or killed.
        final Runnable pause = new Runnable() {
            boolean done;
            public void run() {
                if (done) return;
                done = true;
                store.flushAsync();
                web.pauseTimers(); // stops game loop and sound while in the background
            }
        };
        evaluate("window.__appSave&&window.__appSave()", pause);
        web.postDelayed(pause, 700); // in case the page does not answer
        web.onPause();
    }

    @Override
    protected void onStop() {
        super.onStop();
        store.flush(1500);
    }

    /** WebView.evaluateJavascript (API 19) via reflection: the compile stubs are API 16. */
    private void evaluate(String js, final Runnable then) {
        try {
            Method m = WebView.class.getMethod("evaluateJavascript", String.class, ValueCallback.class);
            m.invoke(web, js, new ValueCallback<String>() {
                public void onReceiveValue(String v) { if (then != null) then.run(); }
            });
        } catch (Exception e) {
            web.loadUrl("javascript:" + js);
        }
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
        if (store != null) store.flush(1500);
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

    /**
     * The game's save data (its localStorage) mirrored into the app's own files, one file per
     * key, written atomically on a background thread. WebView storage alone lost progress when
     * the app was closed or killed, and has a size quota; this has neither problem.
     */
    static class Store {
        private static final String DELETE = new String("\u0000delete");
        private final File dir;
        private final ExecutorService io = Executors.newSingleThreadExecutor();
        private final Map<String, String> pending = new HashMap<String, String>();
        private final Runnable drain = new Runnable() { public void run() { drain(); } };

        Store(File dir) { this.dir = dir; dir.mkdirs(); }

        private static String fileName(String key) {
            StringBuilder sb = new StringBuilder("k");
            try { for (byte b : key.getBytes("UTF-8")) sb.append(String.format("%02x", b & 0xff)); } catch (Exception ignored) { }
            return sb.toString();
        }

        private static String keyOf(String name) {
            try {
                byte[] out = new byte[(name.length() - 1) / 2];
                for (int i = 0; i < out.length; i++) out[i] = (byte) Integer.parseInt(name.substring(1 + 2 * i, 3 + 2 * i), 16);
                return new String(out, "UTF-8");
            } catch (Exception e) { return null; }
        }

        @JavascriptInterface
        public String loadAll() {
            flush(3000);
            StringBuilder o = new StringBuilder("{");
            File[] files = dir.listFiles();
            if (files != null) for (File f : files) {
                String name = f.getName();
                if (!name.startsWith("k") || name.endsWith(".tmp")) continue;
                String key = keyOf(name);
                if (key == null) continue;
                try {
                    FileInputStream in = new FileInputStream(f);
                    ByteArrayOutputStream buf = new ByteArrayOutputStream((int) Math.max(16, f.length()));
                    byte[] b = new byte[65536];
                    int n;
                    while ((n = in.read(b)) > 0) buf.write(b, 0, n);
                    in.close();
                    if (o.length() > 1) o.append(',');
                    quote(o, key);
                    o.append(':');
                    quote(o, new String(buf.toByteArray(), "UTF-8"));
                } catch (Exception ignored) { }
            }
            return o.append('}').toString();
        }

        /** JSON string literal (also escapes U+2028/2029 so the result is valid JavaScript). */
        private static void quote(StringBuilder sb, String s) {
            sb.append('"');
            for (int i = 0; i < s.length(); i++) {
                char c = s.charAt(i);
                if (c == '"' || c == '\\') sb.append('\\').append(c);
                else if (c < 0x20 || c == 0x2028 || c == 0x2029) sb.append(String.format("\\u%04x", (int) c));
                else sb.append(c);
            }
            sb.append('"');
        }

        @JavascriptInterface
        public void setItem(String key, String value) {
            if (key == null) return;
            synchronized (pending) { pending.put(key, value == null ? "" : value); }
            io.execute(drain);
        }

        @JavascriptInterface
        public void removeItem(String key) {
            if (key == null) return;
            synchronized (pending) { pending.put(key, DELETE); }
            io.execute(drain);
        }

        @JavascriptInterface
        public void clear() {
            synchronized (pending) {
                pending.clear();
                File[] files = dir.listFiles();
                if (files != null) for (File f : files) f.delete();
            }
        }

        private void drain() {
            Map<String, String> work;
            synchronized (pending) {
                if (pending.isEmpty()) return;
                work = new HashMap<String, String>(pending);
                pending.clear();
            }
            for (Map.Entry<String, String> e : work.entrySet()) {
                File target = new File(dir, fileName(e.getKey()));
                try {
                    if (e.getValue() == DELETE) { target.delete(); continue; }
                    File tmp = new File(dir, target.getName() + ".tmp");
                    FileOutputStream out = new FileOutputStream(tmp);
                    out.write(e.getValue().getBytes("UTF-8"));
                    out.getFD().sync();
                    out.close();
                    if (!tmp.renameTo(target)) { target.delete(); tmp.renameTo(target); }
                } catch (Exception ignored) { }
            }
        }

        void flushAsync() { io.execute(drain); }

        void flush(long ms) {
            try {
                Future<?> f = io.submit(drain);
                f.get(ms, TimeUnit.MILLISECONDS);
            } catch (Exception ignored) { }
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
