#!/usr/bin/env bash
# deploy.sh – Build and deploy opencloud-calendar to the OpenCloud server
set -euo pipefail

# ── Configuration ────────────────────────────────────────────────────────────
REMOTE_USER="root"
REMOTE_HOST="cloud.linux-nerds.org"
REMOTE_DIR="/mnt/HC_Volume_103940066/opencloud_keycloak_data/data/web/assets/"
APP_NAME="opencloud-journal"
REMOTE_DOCKER_USER="dockeruser"
# ─────────────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
SSH_OPTS="-i /home/frank/.ssh-jail/opencloud/hetzner_opencloud -o IdentitiesOnly=yes -o GlobalKnownHostsFile=/dev/null -o StrictHostKeyChecking=accept-new"
DIST_DIR="$SCRIPT_DIR/dist"
REMOTE_APP_DIR="$REMOTE_DIR/apps/$APP_NAME"

if [ "${container:-}" = "firejail" ]; then
  echo "ERROR: Dieses Script läuft in einer Firejail-Sandbox (Claude Code)." >&2
  echo "       Bitte im eigenen Terminal ausführen: bash deploy.sh" >&2
  exit 1
fi

echo "==> Building $APP_NAME …"
cd "$SCRIPT_DIR"
CI=true pnpm install
pnpm build

echo "==> Ensuring remote directory exists …"
ssh $SSH_OPTS "${REMOTE_USER}@${REMOTE_HOST}" "mkdir -p '${REMOTE_APP_DIR}'"

echo "==> Uploading dist/ to ${REMOTE_HOST}:${REMOTE_APP_DIR} …"
rsync -av --delete -e "ssh $SSH_OPTS" "$DIST_DIR/" "${REMOTE_USER}@${REMOTE_HOST}:${REMOTE_APP_DIR}/"

echo "==> Restarting OpenCloud container …"
ssh $SSH_OPTS "${REMOTE_USER}@${REMOTE_HOST}" \
    "cd /home/dockeruser/opencloud-compose-keycloak && \
     sudo -u ${REMOTE_DOCKER_USER} docker compose restart opencloud && \
     sleep 3 && \
     sudo -u ${REMOTE_DOCKER_USER} docker compose restart traefik"

echo ""
echo "Done. App available at: https://${REMOTE_HOST}/apps/${APP_NAME}/"
