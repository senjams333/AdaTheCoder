@echo off
REM Runs the API, the website and the app together on Windows.
REM Needs: Node.js 20 (nodejs.org), Python 3.10-3.12 (python.org, tick "Add Python to PATH"),
REM and MySQL 8 with the database and user from api\.env (see api\README.md).
setlocal
cd /d "%~dp0"
if not exist api\.env copy api\.env.example api\.env >nul
if not exist web\.env.local copy web\.env.example web\.env.local >nul
if not exist api\node_modules (cd api && call npm install --no-audit --no-fund && cd ..)
if not exist web\node_modules (cd web && call npm install --no-audit --no-fund && cd ..)
python -m pip install -q -r desktop_app\requirements.txt || goto :error

start "Ada The Coder API (close to stop)" /D "%~dp0api" cmd /k npm run start:dev
start "Ada The Coder website (close to stop)" /D "%~dp0web" cmd /k npm run dev
echo Waiting for the API and the website to start...
timeout /t 25 /nobreak >nul
start "" http://127.0.0.1:5000/admin/login

cd desktop_app
python run.py --server http://127.0.0.1:3000 --check
python run.py --server http://127.0.0.1:3000
goto :eof

:error
echo Something went wrong. Check that Node.js 20 and Python 3.10-3.12 are installed.
pause
exit /b 1
