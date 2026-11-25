#!/bin/bash
set -euo pipefail
cd ~/apps/vea-api
docker build -t vea-api:latest .
# stop (SIGTERM, 15 s grace) before rm: `rm -f` alone SIGKILLs and cuts off in-flight requests.
docker stop -t 15 vea-api 2>/dev/null || true
docker rm vea-api 2>/dev/null || true
docker run -d --name vea-api --network backend --restart unless-stopped --log-opt max-size=10m --log-opt max-file=3 -p 127.0.0.1:4300:3000 --env-file ~/apps/vea-api/.env vea-api:latest
docker image prune -f
