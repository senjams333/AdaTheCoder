#!/bin/bash
# Installs Ada The Coder on Ubuntu / Linux like a normal program: an icon in the app menu (search "Ada The Coder"),
# its own private Python, and the lesson videos. Run from the project folder:
#     bash desktop_app/install_linux.sh                         uses the real website (www.adathecoder.com)
#     bash desktop_app/install_linux.sh http://127.0.0.1:5000   uses a test website (on this computer, or a test server)
# Uninstall: bash ~/.local/share/ada-the-coder/uninstall.sh
set -euo pipefail
SRC="$(cd "$(dirname "$0")/.." && pwd)"
DEST="$HOME/.local/share/ada-the-coder"
SERVER="${1:-}"

echo "Installing Ada The Coder into $DEST ..."
command -v python3 >/dev/null || { echo "Python 3 is needed: sudo apt install python3 python3-venv"; exit 1; }
python3 -c "import venv" 2>/dev/null || { echo "Python's venv is needed: sudo apt install python3-venv"; exit 1; }

mkdir -p "$DEST/apps"
# the app, and the kids app engine each theme opens in (copied fresh; the child's saved work lives elsewhere)
rm -rf "$DEST/desktop_app" "$DEST/apps/engine"
cp -r "$SRC/desktop_app" "$DEST/desktop_app"
cp -r "$SRC/apps/engine" "$DEST/apps/engine"
rm -rf "$DEST/desktop_app/tests" "$DEST/desktop_app/__pycache__" "$DEST/desktop_app/ada_coder/__pycache__"

if [ ! -x "$DEST/venv/bin/python" ]; then python3 -m venv "$DEST/venv"; fi
"$DEST/venv/bin/python" -m pip install -q --upgrade pip
"$DEST/venv/bin/python" -m pip install -q -r "$DEST/desktop_app/requirements.txt" pillow

cat > "$DEST/ada-the-coder" <<RUN
#!/bin/bash
cd "$DEST/desktop_app" && exec "$DEST/venv/bin/python" run.py "\$@"
RUN
chmod +x "$DEST/ada-the-coder"

# the icon in the app menu
mkdir -p "$HOME/.local/share/applications" "$HOME/.local/bin"
cat > "$HOME/.local/share/applications/ada-the-coder.desktop" <<DESK
[Desktop Entry]
Type=Application
Name=Ada The Coder
Comment=Learn Python with friendly lessons
Exec=$DEST/ada-the-coder
Icon=$DEST/desktop_app/assets/images/ada_logo.png
Terminal=false
Categories=Education;Development;
StartupWMClass=Ada The Coder
DESK
ln -sf "$DEST/ada-the-coder" "$HOME/.local/bin/ada-the-coder"
command -v update-desktop-database >/dev/null && update-desktop-database "$HOME/.local/share/applications" 2>/dev/null || true

cat > "$DEST/uninstall.sh" <<UN
#!/bin/bash
rm -f "$HOME/.local/share/applications/ada-the-coder.desktop" "$HOME/.local/bin/ada-the-coder"
rm -rf "$DEST"
echo "Ada The Coder was removed. (The child's settings and work stay in ~/.local/share/AdaTheCoder.)"
UN
chmod +x "$DEST/uninstall.sh"

# which website the installed app talks to
if [ -n "$SERVER" ]; then "$DEST/ada-the-coder" --server "$SERVER" --check >/dev/null 2>&1 || true; echo "It uses the website $SERVER"; fi

echo
echo "Done. Open it from the app menu: search for \"Ada The Coder\" (or run: ada-the-coder)."
echo "Uninstall: bash $DEST/uninstall.sh"
