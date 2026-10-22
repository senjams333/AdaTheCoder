@echo off
REM Try the whole thing on one Windows computer: the website (with its admin) and the app, talking to each other.
REM Needs Python 3.10, 3.11 or 3.12 from python.org (tick "Add Python to PATH" when installing).
setlocal
cd /d "%~dp0"

echo Installing what the website and the app need (only slow the first time)...
python -m pip install -q -r website\requirements.txt -r desktop_app\requirements.txt || goto :error

echo Starting the website in its own window...
start "Ada The Coder website (close this window to stop it)" /D "%~dp0website" cmd /k python app.py
timeout /t 4 /nobreak >nul

echo Opening the admin in your browser...
start "" http://127.0.0.1:5000/admin/login

echo Starting the app, connected to the website on this computer...
cd desktop_app
python run.py --server http://127.0.0.1:5000 --check
python run.py --server http://127.0.0.1:5000
goto :eof

:error
echo Something went wrong installing. Check that Python 3.10, 3.11 or 3.12 is installed and on PATH.
pause
exit /b 1
