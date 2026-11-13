#!/usr/bin/env python3
"""Builds the self-contained AMIR_ABC.html (image + font embedded as base64)."""
import base64, pathlib
root = pathlib.Path(__file__).resolve().parent
b64 = lambda p: base64.b64encode((root / p).read_bytes()).decode()
html = (root / "src/template.html").read_text(encoding="utf-8")
html = html.replace("{{IMG}}", b64("assets/amir-abc-hero.webp")).replace("{{FONT}}", b64("assets/Vazirmatn-wght.woff2")).replace("{{GOLDFONT}}", b64("assets/CinzelDecorative-Black.woff2"))
assert "{{" not in html
(root / "AMIR_ABC.html").write_text(html, encoding="utf-8")
print("AMIR_ABC.html", len(html.encode()), "bytes")
