#!/bin/bash
# What the website gives one family for one theme, and which of its videos were really downloaded.
#   bash ~/check_theme.sh                       → lists the themes
#   bash ~/check_theme.sh parent@email Data     → that family and that theme
cd ~/Ada/api || exit 1
v() { grep -E "^$1=" .env | head -1 | cut -d= -f2- | tr -d '\r"'; }
CNF=$(mktemp); chmod 600 "$CNF"; trap 'rm -f "$CNF"' EXIT
printf '[client]\nhost=%s\nport=%s\nuser=%s\npassword=%s\n' "$(v DB_HOST)" "$(v DB_PORT)" "$(v DB_USER)" "$(v DB_PASSWORD)" > "$CNF"
M() { mysql --defaults-extra-file="$CNF" "$(v DB_NAME)" -N -B -e "$1" 2>/dev/null; }
q() { printf '%s' "$1" | sed "s/'/''/g"; }
if [ -z "${2:-}" ]; then echo "Themes:"; M "SELECT name FROM courses ORDER BY position, id" | sed 's/^/   /'; echo "Use: bash ~/check_theme.sh parent@email ThemeName"; exit 0; fi
EMAIL=$(q "$1"); NAME=$(q "$2")
read -r CID PREMIUM FREE CNAME <<< "$(M "SELECT id, premium, free_lessons, name FROM courses WHERE name LIKE '%$NAME%' ORDER BY position LIMIT 1")"
[ -n "$CID" ] || { echo "No theme matching '$2'. Run: bash ~/check_theme.sh"; exit 1; }
read -r UID_ <<< "$(M "SELECT id FROM users WHERE email='$EMAIL'")"
[ -n "$UID_" ] || { echo "No parent account with the email $1"; exit 1; }
LIC=$(M "SELECT CONCAT(licence, '  (bought ', created_at, ' UTC)') FROM user_licences WHERE user_id=$UID_ AND course_id=$CID")
FREE=$(( FREE < 1 ? 1 : FREE ))
echo "THEME: $CNAME   $([ "$PREMIUM" = 1 ] && echo "paid, first $FREE free" || echo "free theme")"
echo "PARENT: $1   licence: ${LIC:-none}"
FULL=0; { [ "$PREMIUM" != 1 ] || [ -n "$LIC" ]; } && FULL=1
LOGS=$(ls ${NGINX_LOGS:-/var/log/nginx}/access.log* 2>/dev/null)
echo
echo "Lesson | what the website gives this family | real downloads of its video (date, computer address)"
i=0
while IFS=$'\t' read -r LNAME VFILE; do
  if [ "$FULL" = 1 ] || [ "$i" -lt "$FREE" ]; then GIVE="lesson + video"; else GIVE="LOCKED: video stays on the server"; fi
  [ -z "$VFILE" ] && GIVE="$GIVE (no video uploaded)"
  echo "$((i+1)). $LNAME | $GIVE"
  if [ -n "$VFILE" ] && [ -n "$LOGS" ]; then
    BASE="${VFILE%.*}"
    zgrep -hE "GET /media/videos/$BASE\.[a-z0-9]+[? ].* (200|206) " $LOGS 2>/dev/null | awk '{print "      downloaded " substr($4,2,17) "  from " $1}' | sort -u | tail -5
    N=$(zgrep -hE "GET /media/videos/$BASE\.[a-z0-9]+[? ].* 403 " $LOGS 2>/dev/null | wc -l)
    [ "$N" -gt 0 ] && echo "      refused (no key) $N time(s)"
  fi
  i=$((i+1))
done < <(M "SELECT name, video_file FROM lessons WHERE course_id=$CID AND published=1 ORDER BY position, id")
[ -z "$LOGS" ] && echo "(The download records can't be read: run with sudo, or ask me.)"
echo
echo "Downloads are from the website's records (about the last 2 weeks), for every family; the address shows which computer."
