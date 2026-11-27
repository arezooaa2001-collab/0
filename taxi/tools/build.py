#!/usr/bin/env python3
"""Bundle taxi/ into one self-contained HTML file, plus a claude.ai artifact variant.

  /home/user/0/taxi-city.html                      the downloadable single file
  <scratchpad>/artifact/taxi-city.html             the same page as an artifact body
"""
import os, re, subprocess, sys

# taxi/tools/build.py -> taxi/ is the source, the repo root gets the single file
SRC = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
ROOT = os.path.dirname(SRC)
OUT = os.path.join(ROOT, 'taxi-city.html')
# the claude.ai artifact body goes wherever ART_OUT points (default: next to the single file)
ART = os.environ.get('ART_OUT') or os.path.join(ROOT, 'taxi-city.artifact.html')
# esbuild: ESBUILD env, else a local node_modules, else npx
ESBUILD = os.environ.get('ESBUILD') or next((p for p in [os.path.join(os.path.dirname(__file__), 'node_modules', '.bin', 'esbuild')] if os.path.exists(p)), None)

js = subprocess.run(([ESBUILD] if ESBUILD else ['npx', '--yes', 'esbuild@0.24.0']) + [
    os.path.join(SRC, 'js', 'main.js'),
    '--bundle', '--format=iife', '--minify', '--target=es2020', '--legal-comments=eof',
    '--alias:three=' + os.path.join(SRC, 'js', 'lib', 'three.module.min.js'),
], capture_output=True, text=True)
if js.returncode:
    sys.stderr.write(js.stderr)
    sys.exit(1)
bundle = js.stdout.replace('</script', '<\\/script')

html = open(os.path.join(SRC, 'index.html'), encoding='utf-8').read()
css = open(os.path.join(SRC, 'css', 'style.css'), encoding='utf-8').read()

# images from brand/ become data URIs so the page stays one self-contained file
import base64
MIME = {'.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml'}
def inline(m):
    path = os.path.join(SRC, m.group(2))
    data = base64.b64encode(open(path, 'rb').read()).decode()
    return f'{m.group(1)}="data:{MIME[os.path.splitext(path)[1]]};base64,{data}"'
html = re.sub(r'(src|href)="(brand/[^"]+)"', inline, html)
assert 'brand/' not in html, 'build: an image was not inlined'
html = html.replace('<link rel="stylesheet" href="css/style.css">', '<style>\n' + css + '\n</style>')
html = re.sub(r'<script type="importmap">.*?</script>\n?', '', html, flags=re.S)
html = re.sub(r'<script type="module" src="js/main.js"></script>', lambda m: '<script>\n' + bundle + '\n</script>', html)
assert '<script>\n' in html and 'css/style.css' not in html, 'build: markers not found'
open(OUT, 'w', encoding='utf-8').write(html)

# claude.ai artifact body: no document skeleton (the host adds one), title first
head_end = html.index('</head>')
head, body = html[:head_end], html[head_end + len('</head>'):]
title = re.search(r'<title>.*?</title>', head).group(0)
head = re.sub(r'<!doctype html>\s*', '', head, flags=re.I)
head = re.sub(r'<html[^>]*>\s*', '', head)
head = re.sub(r'<head>\s*', '', head)
head = re.sub(r'<meta[^>]*>\s*', '', head)
head = head.replace(title, '')
body = re.sub(r'^\s*<body[^>]*>', '', body)
body = re.sub(r'</body>\s*</html>\s*$', '', body)
art = (title + '\n'
       + '<style>:root{color-scheme:dark;direction:rtl}html,body{background:#0d0f14;margin:0}</style>\n'
       + '<script>document.documentElement.lang="fa";document.documentElement.dir="rtl";</script>\n'
       + head.strip() + '\n' + body.strip() + '\n')
os.makedirs(os.path.dirname(ART), exist_ok=True)
open(ART, 'w', encoding='utf-8').write(art)
print('built', OUT, len(html), '|', ART, len(art))
