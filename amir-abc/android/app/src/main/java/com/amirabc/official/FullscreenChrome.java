package com.amirabc.official;

import android.app.Activity;
import android.graphics.Color;
import android.view.View;
import android.view.ViewGroup;
import android.webkit.WebChromeClient;
import android.webkit.WebView;
import android.widget.FrameLayout;
import android.widget.ProgressBar;

/** Full-screen video support (and an optional loading bar) for a WebView screen. */
final class FullscreenChrome extends WebChromeClient {

    private final Activity activity;
    private final FrameLayout root;
    private final View content;
    private final ProgressBar progress;
    private View fullscreenView;
    private CustomViewCallback callback;

    FullscreenChrome(Activity activity, FrameLayout root, View content, ProgressBar progress) {
        this.activity = activity;
        this.root = root;
        this.content = content;
        this.progress = progress;
    }

    @Override
    public void onShowCustomView(View view, CustomViewCallback cb) {
        if (fullscreenView != null) {
            cb.onCustomViewHidden();
            return;
        }
        fullscreenView = view;
        callback = cb;
        view.setBackgroundColor(Color.BLACK);
        root.addView(view, new FrameLayout.LayoutParams(
            ViewGroup.LayoutParams.MATCH_PARENT, ViewGroup.LayoutParams.MATCH_PARENT));
        content.setVisibility(View.GONE);
        activity.getWindow().getDecorView().setSystemUiVisibility(
            View.SYSTEM_UI_FLAG_FULLSCREEN | View.SYSTEM_UI_FLAG_HIDE_NAVIGATION
                | View.SYSTEM_UI_FLAG_IMMERSIVE_STICKY);
    }

    @Override
    public void onHideCustomView() {
        exit();
    }

    @Override
    public void onProgressChanged(WebView view, int newProgress) {
        if (progress == null) return;
        progress.setProgress(newProgress);
        progress.setVisibility(newProgress >= 100 ? View.GONE : View.VISIBLE);
    }

    /** @return true if a full-screen video was showing and has been closed. */
    boolean exit() {
        if (fullscreenView == null) return false;
        root.removeView(fullscreenView);
        fullscreenView = null;
        content.setVisibility(View.VISIBLE);
        activity.getWindow().getDecorView().setSystemUiVisibility(View.SYSTEM_UI_FLAG_VISIBLE);
        if (callback != null) {
            callback.onCustomViewHidden();
            callback = null;
        }
        return true;
    }
}
