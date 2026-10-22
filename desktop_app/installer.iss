; Inno Setup script: turns dist\AdaTheCoder into one installer file for parents.
; build_windows.bat runs this for you.
#ifndef AppVersion
  #define AppVersion "1.1.0"
#endif

[Setup]
AppId={{6E2B9B34-8C1E-4F6A-9A51-ADA0C0DE0001}
AppName=Ada The Coder
AppVersion={#AppVersion}
AppPublisher=Ada The Coder
AppPublisherURL=https://www.adathecoder.com
DefaultDirName={autopf}\Ada The Coder
DefaultGroupName=Ada The Coder
DisableProgramGroupPage=yes
; Installs for the current user, so no administrator password is needed
PrivilegesRequired=lowest
OutputDir=dist
OutputBaseFilename=AdaTheCoder-{#AppVersion}-Windows-Setup
SetupIconFile=assets\images\app_icon.ico
UninstallDisplayIcon={app}\AdaTheCoder.exe
Compression=lzma2
SolidCompression=yes
WizardStyle=modern

[Tasks]
Name: "desktopicon"; Description: "Put Ada The Coder on the desktop"

[Files]
Source: "dist\AdaTheCoder\*"; DestDir: "{app}"; Flags: recursesubdirs ignoreversion

[Icons]
Name: "{group}\Ada The Coder"; Filename: "{app}\AdaTheCoder.exe"
Name: "{autodesktop}\Ada The Coder"; Filename: "{app}\AdaTheCoder.exe"; Tasks: desktopicon

[Run]
Filename: "{app}\AdaTheCoder.exe"; Description: "Open Ada The Coder now"; Flags: nowait postinstall skipifsilent
