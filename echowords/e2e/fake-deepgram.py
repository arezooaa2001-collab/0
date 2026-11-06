#!/usr/bin/env python3
"""TEST DOUBLE ONLY — never used in production.

A tiny HTTP server that speaks the Deepgram /v1/listen response format but runs a
real offline English recognizer (PocketSphinx). It lets the end-to-end test exercise the
real pipeline (browser mic → private storage → Edge Function → provider → database)
without a paid API key. Accuracy is far below Deepgram; it only proves the plumbing.

The incoming audio is decoded to a temporary 16 kHz PCM derivative in memory; the
original recording in storage is never touched.
"""
import json, os, subprocess, sys
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import urlparse, parse_qs
from pocketsphinx import Decoder

DECODER = Decoder(samprate=16000)
LOG = []

class H(BaseHTTPRequestHandler):
    def do_POST(self):
        u = urlparse(self.path)
        q = parse_qs(u.query)
        if u.path != '/v1/listen' or not self.headers.get('Authorization', '').startswith('Token '):
            self.send_response(401); self.end_headers(); return
        body = self.rfile.read(int(self.headers.get('Content-Length', 0)))
        pcm = subprocess.run(['ffmpeg', '-loglevel', 'error', '-i', 'pipe:0', '-ac', '1', '-ar', '16000', '-f', 's16le', 'pipe:1'],
                             input=body, capture_output=True).stdout
        text = ''
        if pcm:
            DECODER.start_utt(); DECODER.process_raw(pcm, full_utt=True); DECODER.end_utt()
            h = DECODER.hyp()
            text = h.hypstr if h else ''
        LOG.append({'query': q, 'content_type': self.headers.get('Content-Type'), 'bytes': len(body), 'text': text})
        print(json.dumps(LOG[-1]), flush=True)
        out = {'results': {'channels': [{'alternatives': [{'transcript': text, 'confidence': 0.9 if text else 0.0}]}]}}
        data = json.dumps(out).encode()
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Content-Length', str(len(data)))
        self.end_headers(); self.wfile.write(data)

    def log_message(self, *a):
        pass

if __name__ == '__main__':
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 8787
    ThreadingHTTPServer(('0.0.0.0', port), H).serve_forever()
