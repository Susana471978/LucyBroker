#!/bin/bash
set -e
cd /opt/emailsystem
echo "=== Pulling latest code ==="
git pull
echo "=== Building frontend ==="
cd frontend
npm run build --legacy-peer-deps
cp -r build/* /var/www/lucy/
echo "=== Updating service worker cache version ==="
BUILD_HASH=$(git rev-parse --short HEAD)
sed -i "s/lucy-BUILD_HASH/lucy-${BUILD_HASH}/" /var/www/lucy/service-worker.js
echo "Cache version: lucy-${BUILD_HASH}"
echo "=== Restarting backend ==="
sudo systemctl restart ecs-backend
echo "=== Verifying ==="
sleep 2
curl -s http://127.0.0.1:8000/api/billing/plans | head -20 > /dev/null && echo "Backend: OK" || echo "Backend: FAILED"
grep "lucy-" /var/www/lucy/service-worker.js | head -1
echo "=== Deploy complete ==="
