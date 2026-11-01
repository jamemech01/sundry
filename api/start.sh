#!/bin/sh
set -e

npx prisma migrate deploy

SHOP_SERVICE_HOST=localhost SHOP_SERVICE_PORT=3001 node dist/apps/shop-service/main.js &
ORDER_SERVICE_HOST=localhost ORDER_SERVICE_PORT=3002 node dist/apps/order-service/main.js &
WALLET_SERVICE_HOST=localhost WALLET_SERVICE_PORT=3003 node dist/apps/wallet-service/main.js &

sleep 3
exec node dist/apps/gateway/main.js
