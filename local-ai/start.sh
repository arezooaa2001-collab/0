#!/usr/bin/env bash
cd "$(dirname "$0")"
[ -d .venv ] || { echo "اول ./install.sh را اجرا کن."; exit 1; }
. .venv/bin/activate
pgrep -x ollama >/dev/null || (ollama serve >/dev/null 2>&1 &)
python app.py
