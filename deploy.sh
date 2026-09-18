#!/bin/bash
set -euo pipefail
cd ~/apps/vea-api
docker build -t vea-api:latest .
docker rm -f vea-api || true
docker run -d --name vea-api --network backend --restart unless-stopped -p 4300:3000 --env-file ~/apps/vea-api/.env vea-api:latest
docker image prune -f
