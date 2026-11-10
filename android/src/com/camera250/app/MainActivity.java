package com.camera250.app;

import android.Manifest;
import android.app.Activity;
import android.content.ContentResolver;
import android.content.ContentValues;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.graphics.Color;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Bundle;
import android.os.Environment;
import android.provider.MediaStore;
import android.provider.Settings;
import android.util.Base64;
import android.view.View;
import android.view.WindowManager;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;
import android.widget.Toast;

import java.io.BufferedOutputStream;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Map;

/**
 * Camera: hosts the Camera web app (assets/www/Camera.html) in a full-screen WebView.
 * The page is served from a private https origin so the camera, IndexedDB and WebCodecs
 * work exactly as in Chrome. Native parts: Android runtime permissions for the camera and
 * microphone, the photo picker, and saving photos/videos into the device gallery.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/Camera.html";
    private static final int REQ_MEDIA = 1;
    private static final int REQ_STORAGE = 2;
    private static final int REQ_FILE = 3;

    private WebView web;
    private PermissionRequest pendingRequest;
    private ValueCallback<Uri[]> fileCallback;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        getWindow().addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON);
        getWindow().getDecorView().setBackgroundColor(Color.BLACK);

        web = new WebView(this);
        web.setBackgroundColor(Color.BLACK);
        setContentView(web);
        hideSystemBars();

        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setSupportZoom(false);
        s.setBuiltInZoomControls(false);

        web.addJavascriptInterface(new Bridge(), "CameraBridge");
        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri url = request.getUrl();
                if (HOST.equals(url.getHost())) return serveAsset(url.getPath());
                return null;
            }

            @Override
            @SuppressWarnings("deprecation") // the request-based overload needs API 24+ to compile against
            public boolean shouldOverrideUrlLoading(WebView view, String link) {
                Uri url = Uri.parse(link);
                if (HOST.equals(url.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, url));
                } catch (Exception ignored) {
                    // no app can open it
                }
                return true;
            }
        });
        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                runOnUiThread(new Runnable() {
                    @Override
                    public void run() {
                        handlePermissionRequest(request);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                } catch (Exception e) {
                    fileCallback = null;
                    callback.onReceiveValue(null);
                    return false;
                }
                return true;
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START_URL);
    }

    // ------------------------------------------------------------------ assets
    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.equals("/") || path.isEmpty()) path = "/Camera.html";
        if (path.contains("..")) return notFound();
        try {
            InputStream in = getAssets().open("www" + path);
            WebResourceResponse res = new WebResourceResponse(mimeFor(path), "UTF-8", in);
            Map<String, String> headers = new HashMap<String, String>();
            headers.put("Cache-Control", "no-cache");
            res.setResponseHeaders(headers);
            return res;
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "UTF-8", 404, "Not Found",
                new HashMap<String, String>(), new java.io.ByteArrayInputStream(new byte[0]));
    }

    private static String mimeFor(String path) {
        String p = path.toLowerCase();
        if (p.endsWith(".html")) return "text/html";
        if (p.endsWith(".js")) return "text/javascript";
        if (p.endsWith(".css")) return "text/css";
        if (p.endsWith(".svg")) return "image/svg+xml";
        if (p.endsWith(".png")) return "image/png";
        if (p.endsWith(".json") || p.endsWith(".webmanifest")) return "application/json";
        return "application/octet-stream";
    }

    // ------------------------------------------------------------------ permissions
    private boolean has(String permission) {
        return checkSelfPermission(permission) == PackageManager.PERMISSION_GRANTED;
    }

    private void handlePermissionRequest(PermissionRequest request) {
        List<String> needed = new ArrayList<String>();
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && !has(Manifest.permission.CAMERA)) {
                needed.add(Manifest.permission.CAMERA);
            } else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && !has(Manifest.permission.RECORD_AUDIO)) {
                needed.add(Manifest.permission.RECORD_AUDIO);
            }
        }
        if (needed.isEmpty()) {
            grantAllowed(request);
            return;
        }
        if (pendingRequest != null) pendingRequest.deny();
        pendingRequest = request;
        requestPermissions(needed.toArray(new String[0]), REQ_MEDIA);
    }

    private void grantAllowed(PermissionRequest request) {
        List<String> ok = new ArrayList<String>();
        for (String r : request.getResources()) {
            if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(r) && has(Manifest.permission.CAMERA)) ok.add(r);
            else if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(r) && has(Manifest.permission.RECORD_AUDIO)) ok.add(r);
        }
        if (ok.isEmpty()) request.deny();
        else request.grant(ok.toArray(new String[0]));
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode != REQ_MEDIA) return;
        PermissionRequest request = pendingRequest;
        pendingRequest = null;
        if (request != null) grantAllowed(request);
        for (int i = 0; i < permissions.length; i++) {
            if (results.length > i && results[i] != PackageManager.PERMISSION_GRANTED
                    && !shouldShowRequestPermissionRationale(permissions[i])) {
                // "Don't ask again" was chosen earlier: the only way back is the app's settings page.
                Toast.makeText(this, "در تنظیمات، بخش «مجوزها»، دسترسی را روشن کن", Toast.LENGTH_LONG).show();
                try {
                    startActivity(new Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
                            Uri.fromParts("package", getPackageName(), null)));
                } catch (Exception ignored) {
                    // settings page unavailable
                }
                break;
            }
        }
    }

    // ------------------------------------------------------------------ file picker
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
            return;
        }
        super.onActivityResult(requestCode, resultCode, data);
    }

    // ------------------------------------------------------------------ gallery bridge
    private class Bridge {
        private final Map<String, SaveJob> jobs = new HashMap<String, SaveJob>();
        private int seq = 0;

        @JavascriptInterface
        public synchronized String begin(String name, String mime) {
            try {
                String id = String.valueOf(++seq);
                SaveJob job = new SaveJob();
                job.name = name.replaceAll("[\\\\/:*?\"<>|]", "_");
                job.mime = mime == null || mime.isEmpty() ? "application/octet-stream" : mime.split(";")[0];
                job.tmp = new File(getCacheDir(), "save-" + id + ".tmp");
                job.out = new BufferedOutputStream(new FileOutputStream(job.tmp), 1 << 20);
                jobs.put(id, job);
                return id;
            } catch (IOException e) {
                return "";
            }
        }

        @JavascriptInterface
        public synchronized boolean append(String id, String base64) {
            SaveJob job = jobs.get(id);
            if (job == null) return false;
            try {
                job.out.write(Base64.decode(base64, Base64.DEFAULT));
                return true;
            } catch (Exception e) {
                abort(id);
                return false;
            }
        }

        @JavascriptInterface
        public String finish(String id, boolean share) {
            SaveJob job;
            synchronized (this) {
                job = jobs.remove(id);
            }
            if (job == null) return "missing";
            try {
                job.out.close();
                if (Build.VERSION.SDK_INT < 29 && !has(Manifest.permission.WRITE_EXTERNAL_STORAGE)) {
                    runOnUiThread(new Runnable() {
                        @Override
                        public void run() {
                            requestPermissions(new String[]{Manifest.permission.WRITE_EXTERNAL_STORAGE}, REQ_STORAGE);
                        }
                    });
                    return "perm";
                }
                return saveToGallery(job, share) ? "ok" : "save";
            } catch (Exception e) {
                return "save";
            } finally {
                job.tmp.delete();
            }
        }

        @JavascriptInterface
        public boolean isApp() {
            return true;
        }

        private void abort(String id) {
            SaveJob job = jobs.remove(id);
            if (job == null) return;
            try {
                job.out.close();
            } catch (IOException ignored) {
                // already closed
            }
            job.tmp.delete();
        }
    }

    private static class SaveJob {
        String name;
        String mime;
        File tmp;
        OutputStream out;
    }

    private boolean saveToGallery(SaveJob job, final boolean share) throws IOException {
        final boolean video = job.mime.startsWith("video/");
        if (Build.VERSION.SDK_INT >= 29) {
            ContentResolver resolver = getContentResolver();
            ContentValues values = new ContentValues();
            values.put(MediaStore.MediaColumns.DISPLAY_NAME, job.name);
            values.put(MediaStore.MediaColumns.MIME_TYPE, job.mime);
            values.put("relative_path", Environment.DIRECTORY_DCIM + "/Camera");
            values.put("is_pending", 1);
            Uri collection = video ? MediaStore.Video.Media.EXTERNAL_CONTENT_URI : MediaStore.Images.Media.EXTERNAL_CONTENT_URI;
            Uri uri = resolver.insert(collection, values);
            if (uri == null) return false;
            OutputStream out = resolver.openOutputStream(uri);
            if (out == null) return false;
            copy(job.tmp, out);
            values.clear();
            values.put("is_pending", 0);
            resolver.update(uri, values, null, null);
            if (share) shareUri(uri, job.mime);
            return true;
        }
        File dir = new File(Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DCIM), "Camera");
        if (!dir.isDirectory() && !dir.mkdirs()) return false;
        File target = new File(dir, job.name);
        copy(job.tmp, new FileOutputStream(target));
        final String mime = job.mime;
        MediaScannerConnection.scanFile(this, new String[]{target.getAbsolutePath()}, new String[]{mime},
                new MediaScannerConnection.OnScanCompletedListener() {
                    @Override
                    public void onScanCompleted(String path, Uri uri) {
                        if (share && uri != null) shareUri(uri, mime);
                    }
                });
        return true;
    }

    private static void copy(File from, OutputStream out) throws IOException {
        InputStream in = new FileInputStream(from);
        try {
            byte[] buf = new byte[1 << 16];
            int n;
            while ((n = in.read(buf)) > 0) out.write(buf, 0, n);
        } finally {
            in.close();
            out.close();
        }
    }

    private void shareUri(final Uri uri, final String mime) {
        runOnUiThread(new Runnable() {
            @Override
            public void run() {
                Intent send = new Intent(Intent.ACTION_SEND);
                send.setType(mime);
                send.putExtra(Intent.EXTRA_STREAM, uri);
                send.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
                try {
                    startActivity(Intent.createChooser(send, "Camera"));
                } catch (Exception ignored) {
                    // nothing can receive it
                }
            }
        });
    }

    // ------------------------------------------------------------------ lifecycle
    private void hideSystemBars() {
        getWindow().getDecorView().setSystemUiVisibility(
                View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY
                        | View.SYSTEM_UI_FLAG_FULLSCREEN
                        | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_STABLE
                        | View.SYSTEM_UI_FLAG_LAYOUT_HIDE_NAVIGATION
                        | View.SYSTEM_UI_FLAG_LAYOUT_FULLSCREEN);
    }

    @Override
    public void onWindowFocusChanged(boolean hasFocus) {
        super.onWindowFocusChanged(hasFocus);
        if (hasFocus) hideSystemBars();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onPause() {
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onSaveInstanceState(Bundle outState) {
        super.onSaveInstanceState(outState);
        web.saveState(outState);
    }

    @Override
    public void onBackPressed() {
        if (web.canGoBack()) web.goBack();
        else super.onBackPressed();
    }

    @Override
    protected void onDestroy() {
        web.destroy();
        super.onDestroy();
    }
}
