@echo off
setlocal EnableDelayedExpansion
chcp 65001 >nul
set "PYTHONUTF8=1"

echo Starting backend server...
echo.

cd /d "%~dp0"
rem Listen port: default 3001. (Do not use env var PORT - Node/other tools often set PORT=8001 globally.)
if not defined PILEXY_PORT set "PILEXY_PORT=3001"

rem If this port is already in use (e.g. previous uvicorn), stop that process first.
echo Stopping any process listening on port %PILEXY_PORT%...
powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort %PILEXY_PORT% -State Listen -ErrorAction SilentlyContinue ^| ForEach-Object { Write-Host ('  ending PID ' + $_.OwningProcess); Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"
rem ping avoids "Input redirection is not supported" from timeout when stdin is redirected
ping -n 2 127.0.0.1 >nul

echo Port: %PILEXY_PORT%  ^(override: set PILEXY_PORT=8001 before running this bat^)
echo.

rem --- venv next to this batch ---
set "VENVP=%CD%\backend\.venv\Scripts\python.exe"
if exist "%VENVP%" goto :run_venv

set "VENVP=%CD%\.venv\Scripts\python.exe"
if exist "%VENVP%" goto :run_venv

rem --- no venv: find Python (no FOR-loop parens: avoids cmd parse bugs) ---
set "BOOTPY="
if not defined BOOTPY if exist "!LocalAppData!\Programs\Python\Python313\python.exe" set "BOOTPY=!LocalAppData!\Programs\Python\Python313\python.exe"
if not defined BOOTPY if exist "!LocalAppData!\Programs\Python\Python312\python.exe" set "BOOTPY=!LocalAppData!\Programs\Python\Python312\python.exe"
if not defined BOOTPY if exist "!LocalAppData!\Programs\Python\Python311\python.exe" set "BOOTPY=!LocalAppData!\Programs\Python\Python311\python.exe"
if not defined BOOTPY if exist "!LocalAppData!\Programs\Python\Python310\python.exe" set "BOOTPY=!LocalAppData!\Programs\Python\Python310\python.exe"
if not defined BOOTPY if exist "C:\Program Files\Python312\python.exe" set "BOOTPY=C:\Program Files\Python312\python.exe"

if defined BOOTPY (
  echo No venv found. Creating backend\.venv using:
  echo   !BOOTPY!
  "!BOOTPY!" -m venv "%CD%\backend\.venv"
  if errorlevel 1 (
    echo ERROR: python -m venv failed.
    goto :fail_hint
  )
  set "VENVP=%CD%\backend\.venv\Scripts\python.exe"
  goto :run_venv
)

where py >nul 2>&1
if !errorlevel! equ 0 (
  echo Using Python: py -3 launcher
  echo Syncing backend\requirements.txt...
  py -3 -m pip install -r "%CD%\backend\requirements.txt"
  if errorlevel 1 (
    echo ERROR: pip install failed.
    pause
    exit /b 1
  )
  py -3 -m uvicorn backend.main:app --reload --host 0.0.0.0 --port %PILEXY_PORT%
  goto :finish
)

for /f "delims=" %%P in ('where python 2^>nul') do (
  set "LINE=%%P"
  echo !LINE! | findstr /I "WindowsApps" >nul
  if errorlevel 1 (
    set "PYEXE=!LINE!"
    goto :run_path_python
  )
)

goto :fail_hint

:run_venv
echo Using Python: venv
echo   !VENVP!
echo Syncing backend\requirements.txt...
"!VENVP!" -m pip install -r "%CD%\backend\requirements.txt"
if errorlevel 1 (
  echo ERROR: pip install failed.
  pause
  exit /b 1
)
"!VENVP!" -m uvicorn backend.main:app --reload --host 0.0.0.0 --port %PILEXY_PORT%
goto :finish

:run_path_python
echo Using Python: PATH
echo   !PYEXE!
echo Syncing backend\requirements.txt...
"!PYEXE!" -m pip install -r "%CD%\backend\requirements.txt"
if errorlevel 1 (
  echo ERROR: pip install failed.
  pause
  exit /b 1
)
"!PYEXE!" -m uvicorn backend.main:app --reload --host 0.0.0.0 --port %PILEXY_PORT%
goto :finish

:fail_hint
echo [ERROR] No usable Python found.
echo.
echo This batch file is running from:
echo   %~dp0
echo Checked for venv at:
echo   %~dp0backend\.venv\Scripts\python.exe
echo.
echo Install Python 3.10+ from https://www.python.org/downloads/ (check Add to PATH^)
echo or:  winget install Python.Python.3.12
echo Then run this batch again (it will create backend\.venv automatically^).
echo.
pause
exit /b 1

:finish
if errorlevel 1 (
  echo.
  echo [HINT] If the server exited immediately, from folder backend run:
  echo   .venv\Scripts\pip install -r requirements.txt
  echo.
)
pause
endlocal
