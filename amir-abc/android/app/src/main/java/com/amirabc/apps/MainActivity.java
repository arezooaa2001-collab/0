package com.amirabc.apps;

import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.net.Uri;
import android.os.Bundle;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.util.Collections;

/**
 * Shows the AMIR ABC page from the app's own assets, offline.
 *
 * Assets are served on https://appassets.androidplatform.net/ (a reserved host that never
 * reaches the network) so the page gets a normal https origin: fetch() for the music and
 * localStorage for the music on/off choice both work. Any other link, such as the
 * Instagram button, opens outside the app (in Instagram if it is installed).
 */
public class MainActivity extends Activity {

    private static final String HOST = "appassets.androidplatform.net";
    private static final String START_URL = "https://" + HOST + "/www/index.html";
    private static final int NIGHT = 0xFF090C24;

    private WebView web;

    @Override
    protected void onCreate(Bundle state) {
        super.onCreate(state);

        web = new WebView(this);
        web.setBackgroundColor(NIGHT);
        setContentView(web);

        WebSettings settings = web.getSettings();
        settings.setJavaScriptEnabled(true);
        settings.setDomStorageEnabled(true);
        settings.setMediaPlaybackRequiresUserGesture(false); // the music may start on launch
        settings.setAllowFileAccess(false);
        settings.setAllowContentAccess(false);

        web.setWebViewClient(new WebViewClient() {
            @Override
            public boolean shouldOverrideUrlLoading(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (HOST.equals(uri.getHost())) return false;
                openOutside(uri);
                return true;
            }

            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri uri = request.getUrl();
                if (!HOST.equals(uri.getHost())) return null;
                return serveAsset(uri.getPath());
            }
        });

        if (state == null || web.restoreState(state) == null) {
            web.loadUrl(START_URL);
        }
    }

    private WebResourceResponse serveAsset(String path) {
        if (path == null || path.length() < 2 || path.contains("..")) return notFound();
        String name = path.substring(1);
        try {
            InputStream in = getAssets().open(name);
            String mime = mimeFor(name);
            String encoding = mime.startsWith("text/") ? "utf-8" : null;
            WebResourceResponse response = new WebResourceResponse(mime, encoding, in);
            response.setResponseHeaders(Collections.singletonMap("Cache-Control", "no-cache"));
            return response;
        } catch (IOException e) {
            return notFound();
        }
    }

    private static WebResourceResponse notFound() {
        return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found",
                Collections.<String, String>emptyMap(), new ByteArrayInputStream(new byte[0]));
    }

    private static String mimeFor(String name) {
        String n = name.toLowerCase();
        if (n.endsWith(".html")) return "text/html";
        if (n.endsWith(".png")) return "image/png";
        if (n.endsWith(".mp3")) return "audio/mpeg";
        if (n.endsWith(".woff2")) return "font/woff2";
        if (n.endsWith(".js")) return "text/javascript";
        if (n.endsWith(".css")) return "text/css";
        return "application/octet-stream";
    }

    private void openOutside(Uri uri) {
        Intent intent = new Intent(Intent.ACTION_VIEW, uri);
        try {
            startActivity(intent);
        } catch (ActivityNotFoundException ignored) {
            // No app can open this link; stay on the page.
        }
    }

    @Override
    @SuppressWarnings("deprecation")
    public void onBackPressed() {
        // Let the page close the AMIR ABC screen first; leave the app only from the main page.
        web.evaluateJavascript("(window.appBack && window.appBack()) ? 'closed' : 'none'", value -> {
            if (!"\"closed\"".equals(value)) finish();
        });
    }

    @Override
    protected void onPause() {
        web.evaluateJavascript("window.dispatchEvent(new Event('app-pause'))", null);
        web.onPause();
        super.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
        web.evaluateJavascript("window.dispatchEvent(new Event('app-resume'))", null);
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
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
