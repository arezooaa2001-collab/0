@echo off
chcp 65001 >nul
cd /d "%~dp0"
echo === Nasb-e Hoosh-e Masnooei (Local AI) ===

where python >nul 2>nul
if errorlevel 1 (
  echo Python peyda nashod. Az https://www.python.org/downloads/ Python 3.11 ra nasb kon
  echo va tik-e "Add Python to PATH" ra bezan. Bad dobare in file ra ejra kon.
  pause
  exit /b 1
)

python -m venv .venv || (pause & exit /b 1)
call .venv\Scripts\activate.bat
python -m pip install --upgrade pip

where nvidia-smi >nul 2>nul
if errorlevel 1 goto cpu
echo Karte grafik NVIDIA peyda shod - nasb-e PyTorch ba CUDA...
pip install torch --index-url https://download.pytorch.org/whl/cu124
goto deps
:cpu
echo Karte NVIDIA peyda nashod - nasb-e PyTorch baraye CPU - kheyli kond ast...
pip install torch
:deps
pip install -r requirements.txt || (pause & exit /b 1)

where ollama >nul 2>nul
if errorlevel 1 (
  echo Ollama nasb nist. Az https://ollama.com/download nasbash kon, bad dobare in file ra ejra kon.
  pause
  exit /b 1
)
ollama pull qwen2.5:7b

echo.
echo Tamam! Hala file start.bat ra ejra kon.
pause
