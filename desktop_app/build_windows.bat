@echo off
REM Builds the Windows installer for Ada The Coder.
REM Needs: Python 3.10-3.12 (python.org), and Inno Setup 6 (free, https://jrsoftware.org/isdl.php) for the installer.
REM Put the lesson videos in the "vid" folder first (see vid\README.txt).
setlocal
cd /d "%~dp0"

python -m pip install --upgrade pip pyinstaller -r requirements.txt || goto :error
python -m unittest discover tests || goto :error
python -m PyInstaller --noconfirm --clean AdaTheCoder.spec || goto :error

for /f "delims=" %%v in ('python -c "from ada_coder.config import APP_VERSION; print(APP_VERSION)"') do set VERSION=%%v

set ISCC=
where iscc >nul 2>nul && set ISCC=iscc
if not defined ISCC if exist "%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe" set ISCC="%ProgramFiles(x86)%\Inno Setup 6\ISCC.exe"
if not defined ISCC if exist "%ProgramFiles%\Inno Setup 6\ISCC.exe" set ISCC="%ProgramFiles%\Inno Setup 6\ISCC.exe"

if defined ISCC (
  %ISCC% /DAppVersion=%VERSION% installer.iss || goto :error
  echo.
  echo Done: dist\AdaTheCoder-%VERSION%-Windows-Setup.exe
) else (
  powershell -NoProfile -Command "Compress-Archive -Force 'dist\AdaTheCoder' 'dist\AdaTheCoder-%VERSION%-Windows.zip'" || goto :error
  echo.
  echo Inno Setup isn't installed, so a zip was made instead: dist\AdaTheCoder-%VERSION%-Windows.zip
)
echo Upload it in the website admin under "App versions" as version %VERSION%.
goto :eof

:error
echo Build failed.
exit /b 1
