#!/usr/bin/env bash
# =============================================================================
# VisionCount - Systemd Service Installer
# Installs visioncount-backend and visioncount-frontend as 24x7 system services.
#
# Usage:
#   chmod +x scripts/install-services.sh
#   sudo ./scripts/install-services.sh
#
# After install, manage with:
#   sudo systemctl status  visioncount-backend
#   sudo systemctl status  visioncount-frontend
#   sudo journalctl -u visioncount-backend  -f
#   sudo journalctl -u visioncount-frontend -f
# =============================================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
SERVICE_DIR="/etc/systemd/system"

# ---------- sanity checks ----------
if [ "$EUID" -ne 0 ]; then
    echo "ERROR: This script must be run with sudo."
    exit 1
fi

if [ ! -f "$PROJECT_DIR/backend/.venv/bin/python" ]; then
    echo "ERROR: backend/.venv not found. Run ./setup.sh first."
    exit 1
fi

if [ ! -d "$PROJECT_DIR/frontend/.next" ]; then
    echo "ERROR: frontend/.next not found. Run 'cd frontend && npm run build' first."
    exit 1
fi

if [ ! -f "$PROJECT_DIR/.env" ]; then
    echo "Copying .env.example -> .env"
    cp "$PROJECT_DIR/.env.example" "$PROJECT_DIR/.env"
fi

DEPLOY_USER="${SUDO_USER:-arpit}"
echo "Installing services as user: $DEPLOY_USER"

# ---------- patch service files with the actual paths ----------
# Replace placeholder paths/users in service templates with real values

sed \
    -e "s|/home/arpit/Desktop/age-gender|$PROJECT_DIR|g" \
    -e "s|User=arpit|User=$DEPLOY_USER|g" \
    -e "s|Group=arpit|Group=$DEPLOY_USER|g" \
    "$SCRIPT_DIR/visioncount-backend.service" \
    > "$SERVICE_DIR/visioncount-backend.service"

sed \
    -e "s|/home/arpit/Desktop/age-gender|$PROJECT_DIR|g" \
    -e "s|User=arpit|User=$DEPLOY_USER|g" \
    -e "s|Group=arpit|Group=$DEPLOY_USER|g" \
    "$SCRIPT_DIR/visioncount-frontend.service" \
    > "$SERVICE_DIR/visioncount-frontend.service"

echo "Service files written to $SERVICE_DIR"

# ---------- reload, enable, start ----------
systemctl daemon-reload

systemctl enable visioncount-backend
systemctl enable visioncount-frontend

systemctl restart visioncount-backend
echo "Waiting 5s for backend to start..."
sleep 5
systemctl restart visioncount-frontend

# ---------- status ----------
echo ""
echo "============================================="
echo " VisionCount services installed and started"
echo "============================================="
echo ""
systemctl status visioncount-backend  --no-pager -l | head -20
echo ""
systemctl status visioncount-frontend --no-pager -l | head -20
echo ""
echo "Useful commands:"
echo "  sudo systemctl stop    visioncount-backend visioncount-frontend"
echo "  sudo systemctl start   visioncount-backend visioncount-frontend"
echo "  sudo systemctl restart visioncount-backend visioncount-frontend"
echo "  sudo journalctl -u visioncount-backend  -f"
echo "  sudo journalctl -u visioncount-frontend -f"
echo ""
echo "Dashboard : http://localhost:3000"
echo "API Docs  : http://localhost:8000/docs"
echo "FRP Panel : http://general.cactusxpo.com/"
