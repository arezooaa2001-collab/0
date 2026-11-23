#!/usr/bin/env python3
"""Build the AMIR ABC Apps web outputs from index.html + assets/.

  dist/amir-abc-apps.html          one self-contained file (images, fonts, music inlined)
  android/app/src/main/assets/www  the web files the Android app loads

Optional: --preview OUT.html writes a variant for a claude.ai artifact preview
(no document wrapper, Google Fonts link instead of the local font files).
"""
import base64
import os
import re
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "index.html")
ASSETS = os.path.join(ROOT, "assets")
DIST = os.path.join(ROOT, "dist")
WWW = os.path.join(ROOT, "android", "app", "src", "main", "assets", "www")

MIME = {".png": "image/png", ".woff2": "font/woff2", ".mp3": "audio/mpeg"}
WEB_FILES = ["index.html", "assets/gym.png", "assets/taxi.png", "assets/castle.png",
             "assets/music.mp3", "assets/fonts/russo-one-latin.woff2",
             "assets/fonts/vazirmatn-arabic.woff2", "assets/fonts/vazirmatn-latin.woff2"]
GOOGLE_FONTS = ('<link rel="stylesheet" href="https://fonts.googleapis.com/css2?'
                'family=Russo+One&family=Vazirmatn:wght@400;700;900&display=swap">')


def b64(path):
    with open(os.path.join(ROOT, path), "rb") as f:
        return base64.b64encode(f.read()).decode("ascii")


def data_uri(path):
    return f"data:{MIME[os.path.splitext(path)[1]]};base64,{b64(path)}"


def single_file(html):
    html = re.sub(r'url\("(assets/fonts/[^"]+)"\)', lambda m: f'url("{data_uri(m.group(1))}")', html)
    html = re.sub(r'src="(assets/[^"]+\.png)"', lambda m: f'src="{data_uri(m.group(1))}"', html)
    music = f'<script>window.__MUSIC_B64__ = "{b64("assets/music.mp3")}";</script>\n'
    marker = "<script>\n/* ---------- Stars"
    assert marker in html
    return html.replace(marker, music + marker, 1)


def preview(html):
    html = re.sub(r"/\* fonts:start \*/.*?/\* fonts:end \*/\n", "", html, flags=re.S)
    html = html.replace("</title>\n", "</title>\n" + GOOGLE_FONTS + "\n", 1)
    for pat in [r"<!doctype html>\n", r'<html lang="fa">\n', r"<head>\n", r'<meta charset="utf-8">\n',
                r'<meta name="viewport"[^>]*>\n', r"</head>\n", r"<body>\n", r"</body>\n", r"</html>\n?"]:
        html, n = re.subn(pat, "", html, count=1)
        assert n == 1, pat
    return html


def main():
    with open(SRC, encoding="utf-8") as f:
        html = f.read()

    os.makedirs(DIST, exist_ok=True)
    out = os.path.join(DIST, "amir-abc-apps.html")
    with open(out, "w", encoding="utf-8") as f:
        f.write(single_file(html))
    print("wrote", os.path.relpath(out, ROOT), os.path.getsize(out) // 1024, "KB")

    shutil.rmtree(WWW, ignore_errors=True)
    for rel in WEB_FILES:
        dst = os.path.join(WWW, rel)
        os.makedirs(os.path.dirname(dst), exist_ok=True)
        shutil.copyfile(os.path.join(ROOT, rel), dst)
    print("copied", len(WEB_FILES), "files to", os.path.relpath(WWW, ROOT))

    if "--preview" in sys.argv:
        dst = sys.argv[sys.argv.index("--preview") + 1]
        with open(dst, "w", encoding="utf-8") as f:
            f.write(preview(html))
        print("wrote preview", dst)


if __name__ == "__main__":
    main()
