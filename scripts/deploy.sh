#!/bin/bash
# ──────────────────────────────────────────────────────────────────────────────
# ReconcileX — One-command build & deploy to ServerByt via FTP
# Usage:  npm run deploy   (or ./scripts/deploy.sh)
# ──────────────────────────────────────────────────────────────────────────────
set -euo pipefail

# Load FTP credentials from .env.local (handles special chars in values)
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

# Step 1: Build
echo "🔨 Building production bundle..."
npm run build
echo "✅ Build complete!"
echo ""

# Never ship live secrets or overwrite CRM JSON from local seeds
rm -f ./out/api/secrets.php
find ./out/data -type f \( -name '*.json' -o -name '*.sqlite' -o -name '*.sqlite-*' \) -delete 2>/dev/null || true

echo "🚀 Deploying to ${FTP_HOST}:${FTP_REMOTE} ..."
echo "   (preserving remote data/* and api/secrets.php)"
lftp <<EOF
set ssl:verify-certificate no
set ftp:ssl-allow yes
set net:timeout 25
set net:max-retries 3
set net:reconnect-interval-base 2
open -u "${FTP_USER}","${FTP_PASS}" "ftp://${FTP_HOST}"
mirror --reverse --delete --verbose --parallel=3 \
  --exclude-glob .DS_Store \
  --exclude-glob "*.zip" \
  --exclude-glob "data/*.json" \
  --exclude-glob "data/*.sqlite" \
  --exclude-glob "data/*.sqlite-*" \
  --exclude-glob "api/secrets.php" \
  --exclude-glob "uploads/*" \
  ./out/ ${FTP_REMOTE}/
bye
EOF

echo ""
echo "╔══════════════════════════════════════════════════╗"
echo "║  ✅ Deployed to https://reconcilex.in            ║"
echo "║  Remember: keep api/secrets.php + data/*         ║"
echo "╚══════════════════════════════════════════════════╝"
echo ""
