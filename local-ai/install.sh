#!/usr/bin/env bash
# نصب روی لینوکس و مک
set -e
cd "$(dirname "$0")"

command -v python3 >/dev/null || { echo "Python 3.10+ را نصب کن."; exit 1; }
python3 -m venv .venv
. .venv/bin/activate
pip install --upgrade pip

if command -v nvidia-smi >/dev/null; then
  pip install torch --index-url https://download.pytorch.org/whl/cu124
else
  pip install torch
fi
pip install -r requirements.txt

if ! command -v ollama >/dev/null; then
  if [ "$(uname)" = "Linux" ]; then
    curl -fsSL https://ollama.com/install.sh | sh
  else
    echo "Ollama را از https://ollama.com/download نصب کن و دوباره این فایل را اجرا کن."
    exit 1
  fi
fi
ollama pull qwen2.5:7b

echo "تمام! حالا ./start.sh را اجرا کن."
