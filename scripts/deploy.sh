#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# ReconcileX — Build & deploy via FTP
# Usage:  npm run deploy   (or ./scripts/deploy.sh)
#
# CRITICAL: Retailer/agent data lives in remote data/ (JSON + SQLite).
# Never upload or delete that directory — mirror --delete used to wipe
# payflow_agents.json / reconcilex.sqlite when those files were not in ./out.
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

ENV_FILE=".env.local"
if [ ! -f "$ENV_FILE" ]; then
  echo "❌ .env.local not found"
  exit 1
fi

FTP_HOST=$(grep '^FTP_HOST=' "$ENV_FILE" | cut -d'=' -f2-)
FTP_USER=$(grep '^FTP_USER=' "$ENV_FILE" | cut -d'=' -f2-)
FTP_PASS=$(grep '^FTP_PASS=' "$ENV_FILE" | cut -d'=' -f2-)
FTP_REMOTE=$(grep '^FTP_REMOTE_DIR=' "$ENV_FILE" | cut -d'=' -f2-)
FTP_REMOTE="${FTP_REMOTE:-/public_html}"

if [ -z "$FTP_HOST" ] || [ -z "$FTP_USER" ] || [ -z "$FTP_PASS" ]; then
  echo "❌ Missing FTP credentials in .env.local"
  echo "   Required: FTP_HOST, FTP_USER, FTP_PASS"
  exit 1
fi

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║       ReconcileX — Build & Deploy                ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""

echo "🔨 Building production bundle..."
npm run build
echo "✅ Build complete!"
echo ""

# Strip anything that must never overwrite production state
rm -f ./out/api/secrets.php
# Remove local seed/empty CRM files so they cannot be uploaded even if excludes fail
if [ -d ./out/data ]; then
  find ./out/data -type f ! -name '.htaccess' -delete 2>/dev/null || true
fi

echo "🚀 Deploying to ${FTP_HOST}:${FTP_REMOTE} ..."
echo "   Preserving remote: data/**, api/secrets.php, uploads/**"
lftp <<EOF
set ssl:verify-certificate no
set ftp:ssl-allow yes
set net:timeout 25
set net:max-retries 3
set net:reconnect-interval-base 2
open -u "${FTP_USER}","${FTP_PASS}" "ftp://${FTP_HOST}"
# Upload site files. --delete cleans removed assets, but data/ + secrets + uploads
# are fully excluded so remote retailer wallets/agents survive every deploy.
mirror --reverse --delete --verbose --parallel=3 \
  --exclude-glob .DS_Store \
  --exclude-glob "*.zip" \
  --exclude-glob "data" \
  --exclude-glob "data/*" \
  --exclude-glob "data/**" \
  --exclude-glob "api/secrets.php" \
  --exclude-glob "uploads" \
  --exclude-glob "uploads/*" \
  --exclude-glob "uploads/**" \
  ./out/ ${FTP_REMOTE}/
bye
EOF

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Deploy finished                              ║"
echo "║  Remote data/ (agents, wallets) was NOT touched  ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
