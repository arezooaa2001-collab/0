#!/usr/bin/env python3
"""Generates the AMIR ABC launcher icons (adaptive + legacy) into the Android res folder."""
import pathlib, sys
from PIL import Image, ImageDraw, ImageFont, ImageFilter
root = pathlib.Path(__file__).resolve().parent
res = root / "android/app/src/main/res"
FONT = sys.argv[1] if len(sys.argv) > 1 else str(root / "assets/Vazirmatn-Black.ttf")
STOPS = [(0.0, (232, 38, 28)), (0.5, (255, 138, 0)), (1.0, (24, 184, 74))]

def lerp(a, b, t): return tuple(int(a[i] + (b[i] - a[i]) * t) for i in range(3))
def grad(size):
    S = 256
    im = Image.new("RGB", (S, S))
    px = im.load()
    for y in range(S):
        for x in range(S):
            t = (x + y) / (2 * (S - 1))  # diagonal: top-left red -> bottom-right green
            for (t0, c0), (t1, c1) in zip(STOPS, STOPS[1:]):
                if t <= t1:
                    px[x, y] = lerp(c0, c1, (t - t0) / (t1 - t0)); break
    im = im.resize((size, size), Image.BICUBIC)
    glow = Image.new("L", (size, size), 0)
    ImageDraw.Draw(glow).ellipse((-size * .2, -size * .45, size * .9, size * .45), fill=70)
    glow = glow.filter(ImageFilter.GaussianBlur(size * .12))
    return Image.composite(Image.new("RGB", (size, size), (255, 236, 200)), im, glow)

def text_layer(size, text_w):
    layer = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    fs = int(size * 0.5)
    while True:
        f = ImageFont.truetype(FONT, fs)
        bb = d.textbbox((0, 0), "ABC", font=f)
        if bb[2] - bb[0] <= text_w or fs < 8: break
        fs -= 2
    w, h = bb[2] - bb[0], bb[3] - bb[1]
    x, y = (size - w) / 2 - bb[0], (size - h) / 2 - bb[1]
    sh = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    ImageDraw.Draw(sh).text((x, y + size * .025), "ABC", font=f, fill=(70, 10, 0, 150))
    sh = sh.filter(ImageFilter.GaussianBlur(size * .02))
    layer = Image.alpha_composite(sh, layer)
    ImageDraw.Draw(layer).text((x, y), "ABC", font=f, fill=(255, 255, 255, 255))
    return layer

dens = {"mdpi": 1, "hdpi": 1.5, "xhdpi": 2, "xxhdpi": 3, "xxxhdpi": 4}
for name, k in dens.items():
    d = res / f"mipmap-{name}"; d.mkdir(parents=True, exist_ok=True)
    # adaptive icon layers (108dp, content inside the 66dp safe zone)
    s = int(108 * k)
    grad(s).save(d / "ic_launcher_background.png", optimize=True)
    text_layer(s, int(58 * k)).save(d / "ic_launcher_foreground.png", optimize=True)
    # legacy icons (48dp): rounded square and circle
    L = int(48 * k); big = L * 4
    base = grad(big).convert("RGBA")
    base = Image.alpha_composite(base, text_layer(big, int(big * .74)))
    for fname, shape in (("ic_launcher.png", "rr"), ("ic_launcher_round.png", "c")):
        m = Image.new("L", (big, big), 0); md = ImageDraw.Draw(m)
        if shape == "rr": md.rounded_rectangle((big*.04, big*.04, big*.96, big*.96), radius=big*.2, fill=255)
        else: md.ellipse((big*.04, big*.04, big*.96, big*.96), fill=255)
        out = Image.new("RGBA", (big, big), (0, 0, 0, 0)); out.paste(base, (0, 0), m)
        out.resize((L, L), Image.LANCZOS).save(d / fname, optimize=True)
# 512px preview / store icon
big = 512
p = grad(big).convert("RGBA"); p = Image.alpha_composite(p, text_layer(big, int(big * .74)))
p.save(root / "assets/AMIR_ABC_icon_512.png", optimize=True)
print("icons done")
