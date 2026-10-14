#!/bin/sh
# Serves out/ with a local Apache 2.4 and AllowOverride All, so out/.htaccess
# applies like on Plesk. Check the rules with `pnpm check-htaccess`.
#
#   pnpm serve-apache          start on http://127.0.0.1:3098 (PORT=…)
#   pnpm serve-apache stop
#
# Uses the Apache of macOS (/usr/sbin/httpd); elsewhere set HTTPD and
# APACHE_MODULES (Debian: HTTPD=/usr/sbin/apache2 APACHE_MODULES=/usr/lib/apache2/modules).
set -eu

ROOT=$(cd "$(dirname "$0")/.." && pwd)
DIR="$ROOT/.cache/apache"
PORT=${PORT:-3098}
HTTPD=${HTTPD:-/usr/sbin/httpd}
MODULES=${APACHE_MODULES:-/usr/libexec/apache2}
MIME=${APACHE_MIME_TYPES:-/private/etc/apache2/mime.types}
[ -f "$MIME" ] || MIME=/etc/mime.types

mkdir -p "$DIR"
if [ "${1:-}" = "stop" ]; then
  "$HTTPD" -f "$DIR/httpd.conf" -k stop
  exit 0
fi

cat > "$DIR/httpd.conf" <<EOF
Listen 127.0.0.1:$PORT
ServerName localhost
PidFile "$DIR/httpd.pid"
LoadModule mpm_prefork_module $MODULES/mod_mpm_prefork.so
LoadModule authz_core_module $MODULES/mod_authz_core.so
LoadModule authz_host_module $MODULES/mod_authz_host.so
LoadModule mime_module $MODULES/mod_mime.so
LoadModule dir_module $MODULES/mod_dir.so
LoadModule rewrite_module $MODULES/mod_rewrite.so
LoadModule headers_module $MODULES/mod_headers.so
LoadModule unixd_module $MODULES/mod_unixd.so
LoadModule log_config_module $MODULES/mod_log_config.so
TypesConfig "$MIME"
ErrorLog "$DIR/error_log"
LogFormat "%h %>s %r" short
CustomLog "$DIR/access_log" short
DocumentRoot "$ROOT/out"
DirectoryIndex index.html
<Directory "$ROOT/out">
  AllowOverride All
  Require all granted
</Directory>
EOF

"$HTTPD" -f "$DIR/httpd.conf" -k start
echo "Apache serves $ROOT/out on http://127.0.0.1:$PORT (logs in .cache/apache/)"
