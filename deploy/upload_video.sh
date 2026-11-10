#!/bin/bash
# Puts a lesson video in place on the server, without the admin page.
#   bash upload_video.sh                      → lists every lesson with its ID
#   bash upload_video.sh <lesson ID> <video>  → attaches the video to that lesson and makes the WebM copy the app plays
set -e
cd ~/Ada/api
v() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r"'; }
M() { mysql -h "$(v DB_HOST)" -P "$(v DB_PORT)" -u "$(v DB_USER)" -p"$(v DB_PASSWORD)" "$(v DB_NAME)" "$@" 2>/dev/null; }

if [ -z "$2" ]; then
  M -t -e "SELECT l.id AS ID, c.name AS Theme, l.name AS Lesson, l.video_file AS 'Video now' FROM lessons l JOIN courses c ON c.id = l.course_id ORDER BY c.position, c.id, l.position;"
  exit 0
fi

ID="$1"; SRC="$2"
[[ "$ID" =~ ^[0-9]+$ ]] || { echo "The lesson ID must be a number."; exit 1; }
[ -f "$SRC" ] || { echo "Video file not found: $SRC"; exit 1; }
command -v ffmpeg >/dev/null || { echo "ffmpeg is missing. Install it first: sudo apt install -y ffmpeg"; exit 1; }
SLUG=$(M -N -e "SELECT slug FROM lessons WHERE id=$ID")
[ -n "$SLUG" ] || { echo "No lesson with ID $ID. Run: bash upload_video.sh   (to see the IDs)"; exit 1; }
OLD=$(M -N -e "SELECT video_file FROM lessons WHERE id=$ID")

UP=$(v UPLOAD_DIR); UP=${UP:-./uploads}; DIR="$UP/videos"; mkdir -p "$DIR"
EXT=$(echo "${SRC##*.}" | tr 'A-Z' 'a-z')
NAME="$SLUG-$(openssl rand -hex 4).$EXT"
cp "$SRC" "$DIR/$NAME"
SIZE=$(stat -c %s "$DIR/$NAME")
echo "Copied: $NAME ($((SIZE / 1048576)) MB)"

echo "Making the WebM copy the app plays (a few minutes)..."
ffmpeg -v error -y -i "$DIR/$NAME" -vf scale=-2:720 -r 25 -c:v libvpx -b:v 1400k -crf 10 -deadline good -cpu-used 4 \
  -c:a libvorbis -b:a 96k "$DIR/${NAME%.*}.part.webm"
mv "$DIR/${NAME%.*}.part.webm" "$DIR/${NAME%.*}.webm"

M -e "UPDATE lessons SET video_file='$NAME', video_size=$SIZE WHERE id=$ID"
if [ -n "$OLD" ] && [[ "$OLD" != default-* ]]; then rm -f "$DIR/$OLD" "$DIR/${OLD%.*}.webm"; fi
echo "DONE: lesson $ID now has $NAME and its WebM copy. Installed apps download it within a few minutes."
