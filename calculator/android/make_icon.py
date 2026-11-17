# Draws the launcher icon (rainbow tile + the calculator's mascot face) at every density.
import colorsys, os, sys
from PIL import Image, ImageDraw
out = sys.argv[1]
S = 1024
img = Image.new('RGBA', (S, S))
px = img.load()
for y in range(S):
    for x in range(S):
        h = ((x + y) / (2 * S) * 0.85) % 1.0
        r, g, b = colorsys.hsv_to_rgb(h, 0.75, 1.0)
        px[x, y] = (int(r * 255), int(g * 255), int(b * 255), 255)
mask = Image.new('L', (S, S), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], radius=230, fill=255)
icon = Image.new('RGBA', (S, S), (0, 0, 0, 0)); icon.paste(img, (0, 0), mask)
d = ImageDraw.Draw(icon)
d.ellipse([170, 190, 854, 874], fill=(255, 255, 255, 235))           # face
for cx in (380, 644):
    d.ellipse([cx - 75, 400, cx + 75, 580], fill=(27, 16, 48))       # eyes
    d.ellipse([cx - 10, 425, cx + 40, 475], fill=(255, 255, 255))    # sparkle
for cx in (270, 754):
    d.ellipse([cx - 60, 610, cx + 60, 670], fill=(255, 95, 162, 160))  # cheeks
d.chord([400, 560, 624, 760], 0, 180, fill=(122, 24, 64))            # smile
for dens, size in {'mdpi': 48, 'hdpi': 72, 'xhdpi': 96, 'xxhdpi': 144, 'xxxhdpi': 192}.items():
    p = os.path.join(out, 'mipmap-' + dens); os.makedirs(p, exist_ok=True)
    icon.resize((size, size), Image.LANCZOS).save(os.path.join(p, 'ic_launcher.png'))
icon.resize((512, 512), Image.LANCZOS).save(os.path.join(out, '..', 'icon-512.png'))
