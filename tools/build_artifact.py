#!/usr/bin/env python3
"""Make the Claude artifact version of the game.

    python3 tools/build_artifact.py [out.html]

The artifact viewer wraps a page in its own <!doctype>/<head>/<body> with a charset and viewport
meta, so this drops the game's own document tags and metas, puts the <title> first (only the first
8 KB are scanned for it) and keeps everything else as it is: three.js comes from jsDelivr (unpkg as
the fallback) and the fonts from Google Fonts, the hosts the viewer allows.

Publish it with the capabilities the game uses inside Claude:
    sample: {images: true}   the AI item builder (text or photo) and free chat with Arash
    downloads: true          saving the backup file and photos
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / 'games' / 'arash-castle-adventure.html'


def build(src: str) -> str:
    m = re.search(r'<title>(.*?)</title>', src)
    title = m.group(1) if m else 'Arash Castle'
    out = src
    for pat in (r'<!doctype html>\s*', r'<html[^>]*>\s*', r'<head>\s*', r'\s*</head>', r'<body[^>]*>', r'</body>\s*', r'</html>\s*',
                r'<meta charset="utf-8">\s*', r'<meta name="viewport"[^>]*>\s*', r'<title>.*?</title>\s*'):
        out, n = re.subn(pat, '', out, count=1, flags=re.I)
        if not n:
            raise SystemExit('pattern not found: ' + pat)
    head = (f'<title>{title}</title>\n'
            '<script>document.documentElement.lang="fa";document.documentElement.dir="rtl";</script>\n'
            '<style>:root{color-scheme:dark}</style>\n')
    return head + out


if __name__ == '__main__':
    dst = Path(sys.argv[1]) if len(sys.argv) > 1 else ROOT / 'dist' / 'arash-castle-claude.html'
    html = build(SRC.read_text(encoding='utf-8'))
    dst.write_text(html, encoding='utf-8')
    print(f'wrote {dst} ({len(html.encode()) // 1024} KB)')
