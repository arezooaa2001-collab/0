#!/usr/bin/env python3
"""Assemble the single-file game: python3 build.py  ->  index.html (+ artifact variant in $ARTIFACT_OUT)."""
import glob, os, re, sys
D = os.path.dirname(os.path.abspath(__file__))
rd = lambda p: open(os.path.join(D, p), encoding='utf-8').read()
head = rd('src/head.html')
css = rd('src/style.css')
body = rd('src/body.html')
three = rd('vendor/three.min.js')
game = ''.join(rd(p) if False else open(p, encoding='utf-8').read() for p in sorted(glob.glob(os.path.join(D, 'src', '[0-9][0-9]_*.js'))))
assert '</script' not in three and '</script' not in game
html = head + '<style>\n' + css + '</style>\n</head>\n<body>\n' + body + '<script>\n' + three + '\n</script>\n<script>\n' + game + '</script>\n</body>\n</html>\n'
open(os.path.join(D, 'index.html'), 'w', encoding='utf-8').write(html)
out = os.environ.get('ARTIFACT_OUT')
if out:
    a = html
    for t in ['<!doctype html>\n', '<html lang="fa">\n', '<head>\n', '</head>\n', '<body>\n', '</body>\n', '</html>\n']:
        assert t in a, t
        a = a.replace(t, '', 1)
    a = re.sub(r'<meta charset="utf-8">\n<meta name="viewport"[^\n]*\n', '', a, count=1)
    open(out, 'w', encoding='utf-8').write(a)
print('built index.html', len(html))
