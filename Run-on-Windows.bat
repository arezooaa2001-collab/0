@echo off
rem Meme Thief 3D - Windows launcher
rem Opens the game in its own app window (Microsoft Edge or Google Chrome "app mode"), like a desktop program.
setlocal
chcp 65001 >nul
set "GAME=%~dp0meme-thief.html"
if not exist "%GAME%" (
  echo meme-thief.html was not found next to this file.
  echo Put Run-on-Windows.bat and meme-thief.html in the same folder.
  pause
  exit /b 1
)
set "URL=file:///%GAME:\=/%"
for %%B in (
  "%ProgramFiles(x86)%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Microsoft\Edge\Application\msedge.exe"
  "%LocalAppData%\Microsoft\Edge\Application\msedge.exe"
  "%ProgramFiles%\Google\Chrome\Application\chrome.exe"
  "%ProgramFiles(x86)%\Google\Chrome\Application\chrome.exe"
  "%LocalAppData%\Google\Chrome\Application\chrome.exe"
) do (
  if exist %%B (
    start "" %%B --app="%URL%" --start-maximized
    exit /b 0
  )
)
rem no Edge/Chrome found: open with the default browser
start "" "%GAME%"
