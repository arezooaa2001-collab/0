#!/usr/bin/env python3
"""Assemble the unsigned Arash Castle APK without the Android SDK.

Writes the binary AndroidManifest.xml (AXML) and a one-entry resources.arsc
(the launcher icon) by hand, bundles the game and its libraries as assets so it
runs offline, and stores uncompressed entries 4-byte aligned (zipalign rules).

usage: build_apk.py <game.html> <three.min.js> <fontsource_dir> <classes.dex> <out.apk> [version_code] [version_name]
"""
import io, os, re, struct, sys, zipfile

PKG = 'com.arash.castle'
LABEL = 'قلعهٔ آرش'
MIN_SDK, TARGET_SDK = 24, 34
ANDROID_NS = 'http://schemas.android.com/apk/res/android'
ICON_ID = 0x7f010000
ICON_PATH = 'res/drawable-xxxhdpi-v4/icon.png'

# android.R.attr ids (checked with javap against android.jar)
ATTR = {'theme': 0x01010000, 'label': 0x01010001, 'icon': 0x01010002, 'name': 0x01010003,
        'exported': 0x01010010, 'launchMode': 0x0101001d, 'screenOrientation': 0x0101001e,
        'configChanges': 0x0101001f, 'minSdkVersion': 0x0101020c, 'versionCode': 0x0101021b,
        'versionName': 0x0101021c, 'targetSdkVersion': 0x01010270, 'allowBackup': 0x01010280,
        'hardwareAccelerated': 0x010102d3}
THEME_FULLSCREEN = 0x0103000a  # @android:style/Theme.Black.NoTitleBar.Fullscreen
T_REF, T_STR, T_DEC, T_HEX, T_BOOL = 0x01, 0x03, 0x10, 0x11, 0x12


# ---------------------------------------------------------------- string pools
def string_pool(strings, utf8=False):
    """ResStringPool chunk (UTF-16 by default)."""
    data = bytearray(); offsets = []
    for s in strings:
        offsets.append(len(data))
        if utf8:
            b = s.encode('utf-8')
            def enc_len(n):
                return bytes([n]) if n < 0x80 else bytes([0x80 | (n >> 8), n & 0xff])
            data += enc_len(len(s)) + enc_len(len(b)) + b + b'\x00'
        else:
            u = s.encode('utf-16-le'); n = len(u) // 2
            assert n < 0x8000
            data += struct.pack('<H', n) + u + b'\x00\x00'
    while len(data) % 4: data += b'\x00'
    header_size = 28
    strings_start = header_size + 4 * len(strings)
    size = strings_start + len(data)
    flags = 0x100 if utf8 else 0
    return (struct.pack('<HHI', 0x0001, header_size, size) +
            struct.pack('<IIIII', len(strings), 0, flags, strings_start, 0) +
            b''.join(struct.pack('<I', o) for o in offsets) + bytes(data))


# ---------------------------------------------------------------- binary XML
class AXML:
    """Tiny binary-XML writer. Elements: (tag, [(name, type, value)], [children]).
    Attribute names in the android namespace get resource ids; strings that carry
    resource ids come first in the pool, in resource-map order."""

    def __init__(self, root):
        self.root = root
        attr_names = []
        def walk(e):
            for (n, _t, _v) in e[1]:
                if n.startswith('android:') and n[8:] not in attr_names: attr_names.append(n[8:])
            for c in e[2]: walk(c)
        walk(root)
        attr_names.sort(key=lambda n: ATTR[n])
        self.strings = list(attr_names)
        self.res_ids = [ATTR[n] for n in attr_names]

    def idx(self, s):
        if s not in self.strings: self.strings.append(s)
        return self.strings.index(s)

    def build(self):
        body = bytearray(); line = [1]
        ns_prefix, ns_uri = self.idx('android'), self.idx(ANDROID_NS)
        def node(t, payload):
            n = struct.pack('<HHI', t, 16, 16 + len(payload)) + struct.pack('<Ii', line[0], -1) + payload
            line[0] += 1
            return n
        body += node(0x0100, struct.pack('<II', ns_prefix, ns_uri))
        def elem(e):
            tag, attrs, kids = e
            enc = []
            for (n, t, v) in attrs:
                android = n.startswith('android:')
                local = n[8:] if android else n
                ns = ns_uri if android else 0xffffffff
                name_i = self.idx(local)
                raw = 0xffffffff
                if t == T_STR:
                    raw = self.idx(v); data = raw
                elif t == T_BOOL:
                    data = 0xffffffff if v else 0
                else:
                    data = v & 0xffffffff
                rid = ATTR.get(local, 0) if android else 0
                enc.append((rid == 0, rid, struct.pack('<IIIHBBI', ns, name_i, raw, 8, 0, t, data)))
            enc.sort(key=lambda x: (x[0], x[1]))  # resource attrs ascending by id, then plain ones
            payload = struct.pack('<iIHHHHHH', -1, self.idx(tag), 20, 20, len(enc), 0, 0, 0) + b''.join(x[2] for x in enc)
            body.extend(node(0x0102, payload))
            for k in kids: elem(k)
            body.extend(node(0x0103, struct.pack('<iI', -1, self.idx(tag))))
        elem(self.root)
        body += node(0x0101, struct.pack('<II', ns_prefix, ns_uri))
        pool = string_pool(self.strings)
        resmap = struct.pack('<HHI', 0x0180, 8, 8 + 4 * len(self.res_ids)) + b''.join(struct.pack('<I', i) for i in self.res_ids)
        total = 8 + len(pool) + len(resmap) + len(body)
        return struct.pack('<HHI', 0x0003, 8, total) + pool + resmap + bytes(body)


def manifest(version_code, version_name):
    A = lambda n, t, v: ('android:' + n, t, v)
    config_changes = 0x80 | 0x20 | 0x10 | 0x400 | 0x800 | 0x100 | 0x200 | 0x1000 | 0x40
    activity = ('activity', [A('name', T_STR, PKG + '.MainActivity'), A('exported', T_BOOL, True),
                             A('configChanges', T_HEX, config_changes), A('launchMode', T_DEC, 2),  # singleTask
                             A('screenOrientation', T_DEC, -1)],                                    # unspecified
                [('intent-filter', [], [('action', [A('name', T_STR, 'android.intent.action.MAIN')], []),
                                        ('category', [A('name', T_STR, 'android.intent.category.LAUNCHER')], [])])])
    app = ('application', [A('label', T_STR, LABEL), A('icon', T_REF, ICON_ID), A('theme', T_REF, THEME_FULLSCREEN),
                           A('allowBackup', T_BOOL, True), A('hardwareAccelerated', T_BOOL, True)], [activity])
    root = ('manifest', [A('versionCode', T_DEC, version_code), A('versionName', T_STR, version_name), ('package', T_STR, PKG)],
            [('uses-sdk', [A('minSdkVersion', T_DEC, MIN_SDK), A('targetSdkVersion', T_DEC, TARGET_SDK)], []),
             ('uses-permission', [A('name', T_STR, 'android.permission.VIBRATE')], []),
             app])
    return AXML(root).build()


# ---------------------------------------------------------------- resources.arsc
def resources_arsc():
    """One package (0x7f), one type (drawable), one entry (icon) at xxxhdpi."""
    gpool = string_pool([ICON_PATH], utf8=True)
    type_pool = string_pool(['drawable'], utf8=True)
    key_pool = string_pool(['icon'], utf8=True)
    spec = struct.pack('<HHI', 0x0202, 16, 16 + 4) + struct.pack('<BBHI', 1, 0, 0, 1) + struct.pack('<I', 0)
    config = bytearray(64); struct.pack_into('<I', config, 0, 64)
    struct.pack_into('<H', config, 14, 640)   # density = xxxhdpi
    struct.pack_into('<H', config, 24, 4)     # sdkVersion = 4 (the -v4 qualifier aapt adds)
    type_hdr = 8 + 1 + 1 + 2 + 4 + 4 + len(config)
    entries_start = type_hdr + 4
    entry = struct.pack('<HHI', 8, 0, 0) + struct.pack('<HBBI', 8, 0, T_STR, 0)
    type_chunk = (struct.pack('<HHI', 0x0201, type_hdr, entries_start + len(entry)) +
                  struct.pack('<BBHII', 1, 0, 0, 1, entries_start) + bytes(config) + struct.pack('<I', 0) + entry)
    name = PKG.encode('utf-16-le'); name += b'\x00' * (256 - len(name))
    pkg_hdr = 288
    type_off = pkg_hdr; key_off = type_off + len(type_pool)
    pkg_body = type_pool + key_pool + spec + type_chunk
    package = (struct.pack('<HHI', 0x0200, pkg_hdr, pkg_hdr + len(pkg_body)) +
               struct.pack('<I', 0x7f) + name + struct.pack('<IIIII', type_off, 1, key_off, 1, 0) + pkg_body)
    total = 12 + len(gpool) + len(package)
    return struct.pack('<HHII', 0x0002, 12, total, 1) + gpool + package


# ---------------------------------------------------------------- icon
def icon_png():
    from PIL import Image, ImageDraw, ImageFilter
    S = 192; img = Image.new('RGBA', (S, S)); d = ImageDraw.Draw(img)
    for y in range(S):  # night sky
        t = y / S; d.line([(0, y), (S, y)], fill=(int(20 + 40 * t), int(18 + 30 * t), int(60 + 50 * t), 255))
    mask = Image.new('L', (S, S), 0); ImageDraw.Draw(mask).rounded_rectangle([0, 0, S - 1, S - 1], 44, fill=255)
    glow = Image.new('RGBA', (S, S)); ImageDraw.Draw(glow).ellipse([112, 18, 170, 76], fill=(255, 214, 120, 180))
    img = Image.alpha_composite(img, glow.filter(ImageFilter.GaussianBlur(10))); d = ImageDraw.Draw(img)
    d.ellipse([124, 30, 158, 64], fill=(255, 236, 170, 255))                       # moon
    for (x, y) in [(30, 30), (60, 52), (96, 24), (24, 80), (176, 96)]:
        d.ellipse([x - 2, y - 2, x + 2, y + 2], fill=(255, 255, 230, 255))        # stars
    stone, dark = (196, 132, 70, 255), (120, 70, 34, 255)
    d.rectangle([40, 96, 152, 172], fill=stone)                                     # wall
    for x0 in (26, 132):                                                            # towers
        d.rectangle([x0, 72, x0 + 34, 172], fill=stone)
        for k in range(3): d.rectangle([x0 + k * 12, 62, x0 + k * 12 + 8, 74], fill=stone)
        d.polygon([(x0 - 4, 62), (x0 + 17, 30), (x0 + 38, 62)], fill=(178, 52, 46, 255))
    for k in range(5): d.rectangle([44 + k * 22, 86, 56 + k * 22, 98], fill=stone)  # battlements
    d.rounded_rectangle([80, 120, 112, 172], 14, fill=dark)                         # gate
    d.rectangle([84, 118, 108, 124], fill=dark)
    for x in (36, 142): d.rectangle([x, 96, x + 12, 112], fill=(255, 210, 110, 255))  # lit windows
    d.rectangle([0, 170, S, S], fill=(60, 110, 60, 255))                            # grass
    img.putalpha(Image.composite(img.getchannel('A'), Image.new('L', (S, S), 0), mask))
    out = io.BytesIO(); img.save(out, 'PNG', optimize=True); return out.getvalue()


# ---------------------------------------------------------------- game page for the app
BRIDGE = r"""<script>
/* Android app: send the game's "save backup" download to the native save dialog.
   Blobs are kept when created, because fetch() of a blob: URL is refused on file:// pages. */
(function(){if(!window.AndroidApp)return;
 var blobs={},create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
 URL.createObjectURL=function(o){var u=create(o);if(o instanceof Blob)blobs[u]=o;return u;};
 URL.revokeObjectURL=function(u){setTimeout(function(){delete blobs[u];revoke(u);},60000);};
 function send(name,type,dataUrl){AndroidApp.saveFile(name,type||'application/octet-stream',String(dataUrl).split(',')[1]||'');}
 var click=HTMLAnchorElement.prototype.click;
 HTMLAnchorElement.prototype.click=function(){
  var name=this.download,href=this.href;
  if(name&&blobs[href]){var b=blobs[href],fr=new FileReader();fr.onload=function(){send(name,b.type,fr.result);};fr.readAsDataURL(b);return;}
  if(name&&/^data:/.test(href)){send(name,(href.match(/^data:([^;,]*)/)||[])[1],href);return;}
  return click.call(this);};
})();
</script>"""


def game_page(src):
    html = open(src, encoding='utf-8').read()
    # three.js: local copy instead of two CDNs
    html, n = re.subn(r'<script src="https://cdn\.jsdelivr\.net/npm/three@[^"]+"></script>\s*<script>/\* if the first CDN.*?</script>',
                      '<script src="three.min.js"></script>', html, flags=re.S)
    assert n == 1, 'three.js tags not found'
    # fonts: local files instead of Google Fonts
    html, n = re.subn(r'<link rel="preconnect" href="https://fonts\.googleapis\.com">\s*(<link rel="preconnect" href="https://fonts\.gstatic\.com"[^>]*>\s*)?'
                      r'<link rel="stylesheet" href="https://fonts\.googleapis\.com/css2[^"]*">',
                      '<link rel="stylesheet" href="fonts/fonts.css">', html)
    assert n == 1, 'font links not found'
    html = html.replace('<head>', '<head>\n' + BRIDGE, 1)
    return html.encode('utf-8')


def fonts(fontsource_dir):
    """fonts.css with Arabic + Latin subsets of Vazirmatn 400/600/800 and Lalezar."""
    files, css = {}, []
    for fam, folder, weights in [('Vazirmatn', 'vazir', (400, 600, 800)), ('Lalezar', 'lalezar', (400,))]:
        for w in weights:
            src = open(os.path.join(fontsource_dir, folder, f'{w}.css'), encoding='utf-8').read()
            for block in re.findall(r'/\*[^*]*\*/\s*@font-face\s*\{[^}]*\}', src):
                m = re.search(r'url\(\./files/([^)]+\.woff2)\)', block)
                if not m or not re.search(r'-(arabic|latin)-\d', m.group(1)): continue
                fn = m.group(1); files['fonts/' + fn] = open(os.path.join(fontsource_dir, folder, 'files', fn), 'rb').read()
                rng = re.search(r'unicode-range:\s*([^;]+);', block)
                css.append(f"@font-face{{font-family:'{fam}';font-style:normal;font-weight:{w};font-display:swap;"
                           f"src:url(./{fn}) format('woff2');" + (f"unicode-range:{rng.group(1)};" if rng else '') + '}')
    files['fonts/fonts.css'] = '\n'.join(css).encode('utf-8')
    assert len(files) >= 9, files.keys()
    return files


# ---------------------------------------------------------------- zip
def write_apk(out, entries):
    with zipfile.ZipFile(out, 'w') as z:
        for name, data, store in entries:
            zi = zipfile.ZipInfo(name, date_time=(2026, 1, 1, 0, 0, 0))
            zi.create_system = 0
            if store:
                zi.compress_type = zipfile.ZIP_STORED
                off = z.fp.tell() + 30 + len(name.encode('utf-8'))
                pad = (4 - (off + 6) % 4) % 4          # 0xd935 alignment extra: id, size, alignment, padding
                zi.extra = struct.pack('<HHH', 0xd935, 2 + pad, 4) + b'\x00' * pad
            else:
                zi.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(zi, data, compresslevel=9 if not store else None)
    with zipfile.ZipFile(out) as z:                    # check alignment of stored entries
        for zi in z.infolist():
            if zi.compress_type == zipfile.ZIP_STORED:
                data_off = zi.header_offset + 30 + len(zi.filename.encode('utf-8')) + len(zi.extra)
                assert data_off % 4 == 0, (zi.filename, data_off)


def main():
    game, three, fontdir, dex, out = sys.argv[1:6]
    vcode = int(sys.argv[6]) if len(sys.argv) > 6 else 1
    vname = sys.argv[7] if len(sys.argv) > 7 else '1.0'
    entries = [('AndroidManifest.xml', manifest(vcode, vname), False),
               ('classes.dex', open(dex, 'rb').read(), False),
               ('resources.arsc', resources_arsc(), True),
               (ICON_PATH, icon_png(), True),
               ('assets/index.html', game_page(game), False),
               ('assets/three.min.js', open(three, 'rb').read(), False)]
    for name, data in sorted(fonts(fontdir).items()):
        entries.append(('assets/' + name, data, name.endswith('.woff2')))
    write_apk(out, entries)
    print('wrote', out, os.path.getsize(out), 'bytes')


if __name__ == '__main__':
    main()
