@echo off
chcp 65001 >nul
cd /d "%~dp0"
call .venv\Scripts\activate.bat || (echo Aval install.bat ra ejra kon. & pause & exit /b 1)
python app.py
pause
