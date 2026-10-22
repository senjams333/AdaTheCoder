#!/bin/bash
# Ubuntu: installs MySQL (if needed) and creates the database admin_db and the user Admin from .env.
#   bash setup_mysql.sh
set -euo pipefail
cd "$(dirname "$0")"
[ -f .env ] || cp .env.example .env
get() { grep -E "^$1=" .env | head -1 | cut -d= -f2-; }
DB_NAME=$(get DB_NAME); DB_USER=$(get DB_USER); DB_PASSWORD=$(get DB_PASSWORD)

if ! command -v mysql >/dev/null 2>&1; then
  echo "Installing MySQL server (asks for your password)..."
  sudo apt-get update -qq && sudo apt-get install -y mysql-server
fi
sudo systemctl start mysql 2>/dev/null || sudo service mysql start

echo "Creating database '$DB_NAME' and user '$DB_USER'..."
sudo mysql <<SQL
CREATE DATABASE IF NOT EXISTS \`$DB_NAME\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
CREATE USER IF NOT EXISTS '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'localhost' IDENTIFIED BY '$DB_PASSWORD';
ALTER USER '$DB_USER'@'127.0.0.1' IDENTIFIED BY '$DB_PASSWORD';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'localhost';
GRANT ALL PRIVILEGES ON \`$DB_NAME\`.* TO '$DB_USER'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL
mysql -h 127.0.0.1 -u "$DB_USER" -p"$DB_PASSWORD" -e "SELECT 'MySQL is ready' AS ok;" "$DB_NAME"
