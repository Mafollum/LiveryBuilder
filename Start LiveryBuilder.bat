@echo off
rem LMU Livery Builder - double-click to start.
rem The first start downloads the Electron runtime the program runs on (about 160 MB, once).
setlocal
title LMU Livery Builder
set "HERE=%~dp0"
set "ELECTRON_VERSION=45.3.2"
set "ELECTRON_SHA256=cd1ab0d49c2f76838c0c9ff75afefb4d9d85ca59036691932bf35be8eceba98b"
set "URL=https://github.com/electron/electron/releases/download/v%ELECTRON_VERSION%/electron-v%ELECTRON_VERSION%-win32-x64.zip"
set "APPDIR=%HERE%windows\app"
set "RUNTIME=%HERE%windows\runtime-%ELECTRON_VERSION%"
set "EXE=%RUNTIME%\electron.exe"
set "ZIP=%HERE%windows\electron-runtime.zip"

if not exist "%APPDIR%\package.json" (
  echo Can't find the program files in "%APPDIR%".
  echo Keep "Start LiveryBuilder.bat" next to the "windows" folder it came with.
  goto failed
)
if exist "%EXE%" goto run

echo.
echo  LMU Livery Builder - first start
echo  Downloading the runtime the program needs (about 160 MB, only this once)...
echo.
if exist "%ZIP%" del /q "%ZIP%"
curl.exe -L --fail --progress-bar -o "%ZIP%" "%URL%"
if errorlevel 1 (
  echo curl didn't work, trying PowerShell instead...
  powershell -NoProfile -ExecutionPolicy Bypass -Command "$ProgressPreference='SilentlyContinue'; [Net.ServicePointManager]::SecurityProtocol=[Net.SecurityProtocolType]::Tls12; Invoke-WebRequest -UseBasicParsing -Uri $env:URL -OutFile $env:ZIP"
)
if not exist "%ZIP%" goto failed

echo Checking the download...
set "GOT="
for /f %%h in ('powershell -NoProfile -ExecutionPolicy Bypass -Command "(Get-FileHash -Algorithm SHA256 -LiteralPath $env:ZIP).Hash"') do set "GOT=%%h"
if /i not "%GOT%"=="%ELECTRON_SHA256%" (
  echo The download doesn't match the official file. It was deleted to be safe.
  del /q "%ZIP%"
  goto failed
)

echo Unpacking...
if exist "%RUNTIME%" rmdir /s /q "%RUNTIME%"
mkdir "%RUNTIME%"
tar -xf "%ZIP%" -C "%RUNTIME%"
if not exist "%EXE%" powershell -NoProfile -ExecutionPolicy Bypass -Command "Expand-Archive -LiteralPath $env:ZIP -DestinationPath $env:RUNTIME -Force"
del /q "%ZIP%"
if not exist "%EXE%" goto failed
echo Done. Starting LMU Livery Builder...

:run
start "" "%EXE%" "%APPDIR%"
exit /b 0

:failed
echo.
echo  LMU Livery Builder couldn't be set up.
echo  Check your internet connection and double-click "Start LiveryBuilder.bat" again.
echo.
pause
exit /b 1
