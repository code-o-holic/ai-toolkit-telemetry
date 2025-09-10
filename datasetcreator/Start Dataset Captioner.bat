@echo off
SETLOCAL

REM Try to use the current Python if available
where python >nul 2>nul
if %ERRORLEVEL% NEQ 0 (
  echo Python not found in PATH. Trying py launcher...
  where py >nul 2>nul
  if %ERRORLEVEL% NEQ 0 (
    echo Neither python nor py launcher found. Please install Python 3.10+ and retry.
    pause
    exit /b 1
  ) else (
    py -m pip install --upgrade pip
    py -m pip install -r requirements.txt
    py -m ui.flet_app
    exit /b %ERRORLEVEL%
  )
) else (
  python -m pip install --upgrade pip
  python -m pip install -r requirements.txt
  python -m ui.flet_app
  exit /b %ERRORLEVEL%
)

ENDLOCAL
