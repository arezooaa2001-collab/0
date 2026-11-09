package app.echowords;

import android.Manifest;
import android.app.Activity;
import android.content.ActivityNotFoundException;
import android.content.Intent;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Bundle;
import android.os.Handler;
import android.os.Looper;
import android.speech.RecognitionListener;
import android.speech.RecognizerIntent;
import android.speech.SpeechRecognizer;
import android.speech.tts.TextToSpeech;
import android.speech.tts.UtteranceProgressListener;
import android.util.Base64;
import android.view.Window;
import android.webkit.JavascriptInterface;
import android.webkit.PermissionRequest;
import android.webkit.ValueCallback;
import android.webkit.WebChromeClient;
import android.webkit.WebResourceRequest;
import android.webkit.WebResourceResponse;
import android.webkit.WebSettings;
import android.webkit.WebView;
import android.webkit.WebViewClient;

import org.json.JSONObject;

import java.io.ByteArrayInputStream;
import java.io.IOException;
import java.io.InputStream;
import java.io.OutputStream;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.concurrent.CountDownLatch;
import java.util.concurrent.TimeUnit;

/**
 * «گنجینه صدای من» as an Android app.
 *
 * The web app (assets/index.html) is served from a private https address inside the app
 * (https://appassets.androidplatform.net/), so it is a secure page: the microphone and camera
 * are requested with Android's normal permission dialogs, and IndexedDB keeps the words
 * inside the app's own storage.
 *
 * Things Android's WebView cannot do by itself are provided natively through
 * window.EchoWordsAndroid: text-to-speech («🔊 تلفظ»), speech recognition (the tutor's
 * voice and live mode), and saving backup files with the system «save as» screen.
 */
public class MainActivity extends Activity {
    private static final String HOST = "appassets.androidplatform.net";
    private static final String START = "https://" + HOST + "/index.html";

    private static final int REQ_PERM_WEB = 1;
    private static final int REQ_PERM_LISTEN = 2;
    private static final int REQ_FILE = 10;
    private static final int REQ_SAVE = 11;

    private final Handler main = new Handler(Looper.getMainLooper());
    private WebView web;

    private TextToSpeech tts;
    private final CountDownLatch ttsInit = new CountDownLatch(1);
    private volatile boolean ttsReady = false;

    private SpeechRecognizer recognizer;
    private String listenId;
    private String pendingListenTag;

    private PermissionRequest pendingWebPermission;
    private ValueCallback<Uri[]> fileCallback;
    private String saveId;
    private byte[] saveData;

    @Override
    protected void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        Window w = getWindow();
        w.setStatusBarColor(0xff6c4cf5);

        web = new WebView(this);
        setContentView(web);
        WebSettings s = web.getSettings();
        s.setJavaScriptEnabled(true);
        s.setDomStorageEnabled(true);
        s.setDatabaseEnabled(true);
        s.setMediaPlaybackRequiresUserGesture(false);
        s.setAllowFileAccess(false);
        s.setAllowContentAccess(true);
        s.setTextZoom(100);
        web.addJavascriptInterface(new Bridge(), "EchoWordsAndroid");

        web.setWebViewClient(new WebViewClient() {
            @Override
            public WebResourceResponse shouldInterceptRequest(WebView view, WebResourceRequest request) {
                Uri u = request.getUrl();
                if (HOST.equals(u.getHost())) return asset(u.getPath());
                return null; // everything else (e.g. the speech model) comes from the internet as usual
            }

            // The String form exists on every Android version (newer ones forward to it).
            @Override
            @SuppressWarnings("deprecation")
            public boolean shouldOverrideUrlLoading(WebView view, String url) {
                Uri u = Uri.parse(url);
                if (HOST.equals(u.getHost())) return false;
                try {
                    startActivity(new Intent(Intent.ACTION_VIEW, u)); // other links open in the browser
                } catch (ActivityNotFoundException ignored) {
                }
                return true;
            }
        });

        web.setWebChromeClient(new WebChromeClient() {
            @Override
            public void onPermissionRequest(final PermissionRequest request) {
                main.post(new Runnable() {
                    public void run() {
                        handleWebPermission(request);
                    }
                });
            }

            @Override
            public boolean onShowFileChooser(WebView view, ValueCallback<Uri[]> callback, FileChooserParams params) {
                if (fileCallback != null) fileCallback.onReceiveValue(null);
                fileCallback = callback;
                try {
                    startActivityForResult(params.createIntent(), REQ_FILE);
                    return true;
                } catch (ActivityNotFoundException e) {
                    fileCallback = null;
                    return false;
                }
            }
        });

        tts = new TextToSpeech(this, new TextToSpeech.OnInitListener() {
            public void onInit(int status) {
                ttsReady = status == TextToSpeech.SUCCESS;
                ttsInit.countDown();
            }
        });
        tts.setOnUtteranceProgressListener(new UtteranceProgressListener() {
            public void onStart(String id) {
            }

            public void onDone(String id) {
                done(id, "{\"status\":\"ok\"}");
            }

            public void onError(String id) {
                done(id, "{\"status\":\"error\"}");
            }

            @Override
            public void onStop(String id, boolean interrupted) {
                done(id, "{\"status\":\"ok\"}");
            }
        });

        if (savedInstanceState != null) web.restoreState(savedInstanceState);
        else web.loadUrl(START);
    }

    /** Serve a file from assets/ at https://appassets.androidplatform.net/<path>. */
    private WebResourceResponse asset(String path) {
        if (path == null || path.equals("/") || path.isEmpty()) path = "/index.html";
        String name = path.substring(1);
        String mime = "application/octet-stream";
        if (name.endsWith(".html")) mime = "text/html";
        else if (name.endsWith(".js") || name.endsWith(".mjs")) mime = "text/javascript";
        else if (name.endsWith(".css")) mime = "text/css";
        else if (name.endsWith(".svg")) mime = "image/svg+xml";
        else if (name.endsWith(".json") || name.endsWith(".webmanifest")) mime = "application/json";
        else if (name.endsWith(".png")) mime = "image/png";
        Map<String, String> headers = new HashMap<String, String>();
        headers.put("Cache-Control", "no-cache");
        try {
            InputStream in = getAssets().open(name);
            return new WebResourceResponse(mime, "utf-8", 200, "OK", headers, in);
        } catch (IOException e) {
            return new WebResourceResponse("text/plain", "utf-8", 404, "Not Found", headers, new ByteArrayInputStream(new byte[0]));
        }
    }

    // ── Microphone / camera for the page (getUserMedia) ───────────────────
    private void handleWebPermission(PermissionRequest req) {
        List<String> missing = new ArrayList<String>();
        for (String r : req.getResources()) {
            String p = androidPermissionFor(r);
            if (p != null && checkSelfPermission(p) != PackageManager.PERMISSION_GRANTED && !missing.contains(p)) missing.add(p);
        }
        if (missing.isEmpty()) {
            req.grant(req.getResources());
            return;
        }
        if (pendingWebPermission != null) pendingWebPermission.deny();
        pendingWebPermission = req;
        requestPermissions(missing.toArray(new String[0]), REQ_PERM_WEB); // Android's own «Allow?» dialog
    }

    private static String androidPermissionFor(String resource) {
        if (PermissionRequest.RESOURCE_AUDIO_CAPTURE.equals(resource)) return Manifest.permission.RECORD_AUDIO;
        if (PermissionRequest.RESOURCE_VIDEO_CAPTURE.equals(resource)) return Manifest.permission.CAMERA;
        return null;
    }

    @Override
    public void onRequestPermissionsResult(int requestCode, String[] permissions, int[] results) {
        if (requestCode == REQ_PERM_WEB && pendingWebPermission != null) {
            PermissionRequest req = pendingWebPermission;
            pendingWebPermission = null;
            List<String> allowed = new ArrayList<String>();
            for (String r : req.getResources()) {
                String p = androidPermissionFor(r);
                if (p == null || checkSelfPermission(p) == PackageManager.PERMISSION_GRANTED) allowed.add(r);
            }
            if (allowed.isEmpty()) req.deny();
            else req.grant(allowed.toArray(new String[0]));
        } else if (requestCode == REQ_PERM_LISTEN && listenId != null) {
            if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) == PackageManager.PERMISSION_GRANTED) startListening(pendingListenTag);
            else finishListen("", "not-allowed");
        }
    }

    // ── Files: choosing a photo/backup, saving a backup ───────────────────
    @Override
    protected void onActivityResult(int requestCode, int resultCode, Intent data) {
        if (requestCode == REQ_FILE) {
            if (fileCallback != null) {
                fileCallback.onReceiveValue(WebChromeClient.FileChooserParams.parseResult(resultCode, data));
                fileCallback = null;
            }
        } else if (requestCode == REQ_SAVE) {
            boolean ok = false;
            if (resultCode == RESULT_OK && data != null && data.getData() != null && saveData != null) {
                OutputStream out = null;
                try {
                    out = getContentResolver().openOutputStream(data.getData());
                    if (out != null) {
                        out.write(saveData);
                        ok = true;
                    }
                } catch (IOException ignored) {
                } finally {
                    if (out != null) try {
                        out.close();
                    } catch (IOException ignored) {
                    }
                }
            }
            saveData = null;
            if (saveId != null) done(saveId, ok ? "{\"ok\":true}" : "{\"ok\":false}");
            saveId = null;
        }
    }

    // ── Speech recognition ────────────────────────────────────────────────
    private void startListening(String tag) {
        if (recognizer == null) {
            recognizer = SpeechRecognizer.createSpeechRecognizer(this);
            recognizer.setRecognitionListener(new RecognitionListener() {
                public void onReadyForSpeech(Bundle b) {
                }

                public void onBeginningOfSpeech() {
                }

                public void onRmsChanged(float v) {
                }

                public void onBufferReceived(byte[] b) {
                }

                public void onEndOfSpeech() {
                }

                public void onPartialResults(Bundle b) {
                }

                public void onEvent(int t, Bundle b) {
                }

                public void onResults(Bundle b) {
                    ArrayList<String> list = b.getStringArrayList(SpeechRecognizer.RESULTS_RECOGNITION);
                    finishListen(list != null && !list.isEmpty() ? list.get(0) : "", null);
                }

                public void onError(int error) {
                    String code;
                    if (error == SpeechRecognizer.ERROR_NO_MATCH || error == SpeechRecognizer.ERROR_SPEECH_TIMEOUT) code = "no-speech";
                    else if (error == SpeechRecognizer.ERROR_INSUFFICIENT_PERMISSIONS) code = "not-allowed";
                    else if (error == SpeechRecognizer.ERROR_NETWORK || error == SpeechRecognizer.ERROR_NETWORK_TIMEOUT) code = "network";
                    else code = "other";
                    finishListen("", code);
                }
            });
        }
        Intent i = new Intent(RecognizerIntent.ACTION_RECOGNIZE_SPEECH);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE_MODEL, RecognizerIntent.LANGUAGE_MODEL_FREE_FORM);
        i.putExtra(RecognizerIntent.EXTRA_LANGUAGE, tag);
        i.putExtra(RecognizerIntent.EXTRA_MAX_RESULTS, 1);
        recognizer.startListening(i);
    }

    private void finishListen(String text, String error) {
        String id = listenId;
        listenId = null;
        if (id == null) return;
        try {
            JSONObject o = new JSONObject();
            o.put("text", text);
            o.put("error", error == null ? JSONObject.NULL : error);
            done(id, o.toString());
        } catch (Exception e) {
            done(id, "{\"text\":\"\",\"error\":\"other\"}");
        }
    }

    /** Answer a JavaScript call: window.__ewNative.done(id, json). */
    private void done(final String id, final String json) {
        main.post(new Runnable() {
            public void run() {
                if (web == null) return;
                web.evaluateJavascript("window.__ewNative&&window.__ewNative.done(" + JSONObject.quote(id) + "," + JSONObject.quote(json) + ")", null);
            }
        });
    }

    /** Methods the web app can call (they run on a background thread). */
    private class Bridge {
        @JavascriptInterface
        public String appVersion() {
            return "10";
        }

        @JavascriptInterface
        public boolean hasVoice(String tag) {
            try {
                ttsInit.await(3, TimeUnit.SECONDS); // the speech engine starts up asynchronously
            } catch (InterruptedException ignored) {
            }
            if (!ttsReady) return false;
            int r = tts.isLanguageAvailable(Locale.forLanguageTag(tag));
            return r >= TextToSpeech.LANG_AVAILABLE;
        }

        @JavascriptInterface
        public void speak(final String id, final String text, final String tag) {
            main.post(new Runnable() {
                public void run() {
                    if (!ttsReady) {
                        done(id, "{\"status\":\"no-voice\"}");
                        return;
                    }
                    int lr = tts.setLanguage(Locale.forLanguageTag(tag));
                    if (lr == TextToSpeech.LANG_MISSING_DATA || lr == TextToSpeech.LANG_NOT_SUPPORTED) {
                        done(id, "{\"status\":\"no-voice\"}");
                        return;
                    }
                    tts.setSpeechRate(0.85f); // a little slower for young learners
                    if (tts.speak(text, TextToSpeech.QUEUE_FLUSH, null, id) == TextToSpeech.ERROR) done(id, "{\"status\":\"error\"}");
                }
            });
        }

        @JavascriptInterface
        public void stopSpeaking() {
            main.post(new Runnable() {
                public void run() {
                    if (tts != null) tts.stop();
                }
            });
        }

        @JavascriptInterface
        public boolean canListen() {
            return SpeechRecognizer.isRecognitionAvailable(MainActivity.this);
        }

        @JavascriptInterface
        public void listen(final String id, final String tag) {
            main.post(new Runnable() {
                public void run() {
                    if (listenId != null) finishListen("", "aborted");
                    listenId = id;
                    pendingListenTag = tag;
                    if (checkSelfPermission(Manifest.permission.RECORD_AUDIO) != PackageManager.PERMISSION_GRANTED) {
                        requestPermissions(new String[]{Manifest.permission.RECORD_AUDIO}, REQ_PERM_LISTEN);
                        return;
                    }
                    startListening(tag);
                }
            });
        }

        @JavascriptInterface
        public void stopListening() {
            main.post(new Runnable() {
                public void run() {
                    if (recognizer != null) recognizer.cancel();
                    finishListen("", null);
                }
            });
        }

        @JavascriptInterface
        public void saveFile(final String id, final String name, final String mime, final String base64) {
            final byte[] bytes;
            try {
                bytes = Base64.decode(base64, Base64.DEFAULT);
            } catch (IllegalArgumentException e) {
                done(id, "{\"ok\":false}");
                return;
            }
            main.post(new Runnable() {
                public void run() {
                    if (saveId != null) done(saveId, "{\"ok\":false}");
                    saveId = id;
                    saveData = bytes;
                    Intent i = new Intent(Intent.ACTION_CREATE_DOCUMENT);
                    i.addCategory(Intent.CATEGORY_OPENABLE);
                    i.setType(mime);
                    i.putExtra(Intent.EXTRA_TITLE, name);
                    try {
                        startActivityForResult(i, REQ_SAVE);
                    } catch (ActivityNotFoundException e) {
                        saveId = null;
                        saveData = null;
                        done(id, "{\"ok\":false}");
                    }
                }
            });
        }
    }

    @Override
    protected void onSaveInstanceState(Bundle out) {
        super.onSaveInstanceState(out);
        web.saveState(out);
    }

    @Override
    protected void onPause() {
        super.onPause();
        web.onPause();
    }

    @Override
    protected void onResume() {
        super.onResume();
        web.onResume();
    }

    @Override
    protected void onDestroy() {
        if (tts != null) tts.shutdown();
        if (recognizer != null) recognizer.destroy();
        if (web != null) {
            web.destroy();
            web = null;
        }
        super.onDestroy();
    }
}
