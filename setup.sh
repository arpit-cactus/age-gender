#!/usr/bin/env bash
set -e

# ==============================================================================
# VisionCount - People Analytics (Count, Age & Gender Estimation)
# One-Command Master Setup Script
# ==============================================================================

echo "=================================================================="
echo "    🚀 Starting VisionCount (Camsense AI) Automated Setup       "
echo "=================================================================="

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# 1. Check Prerequisite Tools & Environment
echo ""
echo "[1/6] Checking system tools and environment..."
command -v python3 >/dev/null 2>&1 || { echo "❌ Python3 is required but not installed."; exit 1; }
command -v node >/dev/null 2>&1 || { echo "❌ Node.js is required but not installed."; exit 1; }
command -v npm >/dev/null 2>&1 || { echo "❌ npm is required but not installed."; exit 1; }
command -v mysql >/dev/null 2>&1 || { echo "❌ MySQL client is required but not installed."; exit 1; }

PYTHON_VER=$(python3 --version)
NODE_VER=$(node -v)
echo "   ✓ Found $PYTHON_VER"
echo "   ✓ Found Node.js $NODE_VER"

if [ ! -f ".env" ]; then
    echo "   Creating default .env from .env.example..."
    cp .env.example .env
    echo "   ✓ Created .env configuration file."
fi

# 2. Setup Python Virtual Environment & Dependencies
echo ""
echo "[2/6] Setting up backend Python virtual environment (.venv)..."
if [ ! -d "backend/.venv" ]; then
    python3 -m venv --system-site-packages backend/.venv
    echo "   ✓ Created backend/.venv"
else
    echo "   ✓ Existing backend/.venv detected."
fi

PYTHON_BIN="backend/.venv/bin/python"
PIP_BIN="backend/.venv/bin/pip"

echo "   Installing dependencies into backend/.venv..."
$PIP_BIN install -q -r backend/requirements.txt
echo "   ✓ Python dependencies installed into backend/.venv."

# 3. Setup MySQL Database & Seed Data
echo ""
echo "[3/6] Configuring MySQL database and schema..."

# ---------------------------------------------------------------------------
# Detect which MySQL command works on this machine.
# Priority:
#   1. root with no password          (MariaDB default, local dev)
#   2. sudo mysql (no password)        (Ubuntu/Debian auth_socket default)
#   3. root with $MYSQL_PWD env var    (CI / Docker with explicit password)
#   4. interactive password prompt     (fallback)
# ---------------------------------------------------------------------------
MYSQL_CMD=""

if mysql -u root -e "SELECT 1;" >/dev/null 2>&1; then
    MYSQL_CMD="mysql -u root"
    echo "   Connected as root (no password)."

elif sudo mysql -u root -e "SELECT 1;" >/dev/null 2>&1; then
    MYSQL_CMD="sudo mysql -u root"
    echo "   Connected via sudo (auth_socket / Ubuntu default)."

elif [ -n "$MYSQL_PWD" ] && mysql -u root -p"$MYSQL_PWD" -e "SELECT 1;" >/dev/null 2>&1; then
    MYSQL_CMD="mysql -u root -p$MYSQL_PWD"
    echo "   Connected as root with MYSQL_PWD env var."

else
    echo ""
    echo "   Could not connect to MySQL automatically."
    echo "   Enter the MySQL root password (leave blank and press Enter if none):"
    read -rs DB_PASS
    if [ -z "$DB_PASS" ]; then
        MYSQL_CMD="mysql -u root"
    else
        MYSQL_CMD="mysql -u root -p$DB_PASS"
    fi
    if ! $MYSQL_CMD -e "SELECT 1;" >/dev/null 2>&1; then
        echo "   ERROR: Could not connect to MySQL with the provided credentials."
        echo "   Make sure MySQL/MariaDB is running: sudo systemctl start mysql"
        exit 1
    fi
    echo "   Connected as root (manual password)."
fi

# Create database
$MYSQL_CMD -e "CREATE DATABASE IF NOT EXISTS visioncount CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
echo "   ✓ Database 'visioncount' verified."

# Create tables
$MYSQL_CMD visioncount << 'EOF'
CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('admin','viewer') NOT NULL DEFAULT 'viewer',
  is_active TINYINT(1) NOT NULL DEFAULT 1,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cameras (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  source VARCHAR(500) NOT NULL,
  line_x1 FLOAT NULL, line_y1 FLOAT NULL,
  line_x2 FLOAT NULL, line_y2 FLOAT NULL,
  lines_json TEXT NULL,
  roi_x1 FLOAT NULL, roi_y1 FLOAT NULL,
  roi_x2 FLOAT NULL, roi_y2 FLOAT NULL,
  in_direction ENUM('left','right') NOT NULL DEFAULT 'right',
  status ENUM('stopped','running','error') NOT NULL DEFAULT 'stopped',
  last_error VARCHAR(255) NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS count_events (
  id BIGINT AUTO_INCREMENT PRIMARY KEY,
  camera_id INT NOT NULL,
  direction ENUM('in','out') NOT NULL,
  track_id INT NOT NULL,
  line_id VARCHAR(50) NULL,
  line_name VARCHAR(100) NULL,
  age TINYINT UNSIGNED NULL,
  age_group ENUM('child','teen','young_adult','adult','senior','unknown') NOT NULL DEFAULT 'unknown',
  gender ENUM('male','female','unknown') NOT NULL DEFAULT 'unknown',
  confidence FLOAT NULL,
  event_time DATETIME NOT NULL,
  CONSTRAINT fk_event_camera FOREIGN KEY (camera_id) REFERENCES cameras(id) ON DELETE CASCADE,
  INDEX idx_event_time (event_time),
  INDEX idx_camera_time (camera_id, event_time),
  INDEX idx_direction_time (direction, event_time),
  INDEX idx_camera_line (camera_id, line_id)
);

CREATE TABLE IF NOT EXISTS system_settings (
  setting_key VARCHAR(100) PRIMARY KEY,
  setting_value VARCHAR(500) NOT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
EOF

# Ensure lines_json exists on cameras table if created previously
$MYSQL_CMD visioncount -e "ALTER TABLE cameras ADD COLUMN lines_json TEXT NULL;" 2>/dev/null || true
$MYSQL_CMD visioncount -e "ALTER TABLE count_events ADD COLUMN line_id VARCHAR(50) NULL, ADD COLUMN line_name VARCHAR(100) NULL, ADD INDEX idx_camera_line (camera_id, line_id);" 2>/dev/null || true
echo "   ✓ Database tables created and schema synchronized."

# Seed required user accounts and default system settings via SQL.
# No dummy analytics data is inserted — the app starts clean.
ADMIN_HASH=$($PYTHON_BIN -c "import bcrypt; print(bcrypt.hashpw(b'admin123',  bcrypt.gensalt()).decode())")
VIEWER_HASH=$($PYTHON_BIN -c "import bcrypt; print(bcrypt.hashpw(b'viewer123', bcrypt.gensalt()).decode())")

$MYSQL_CMD visioncount <<EOF
INSERT INTO users (name, email, password_hash, role, is_active)
VALUES ('Admin Manager', 'admin@camsense.ai', '$ADMIN_HASH', 'admin', 1)
ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role=VALUES(role);

INSERT INTO users (name, email, password_hash, role, is_active)
VALUES ('Viewer Analyst', 'viewer@camsense.ai', '$VIEWER_HASH', 'viewer', 1)
ON DUPLICATE KEY UPDATE password_hash=VALUES(password_hash), role=VALUES(role);

INSERT IGNORE INTO system_settings (setting_key, setting_value) VALUES
  ('poll_interval_sec',          '5'),
  ('process_fps',                '10'),
  ('double_count_cooldown_sec',  '10'),
  ('face_conf_threshold',        '0.45'),
  ('person_conf_threshold',      '0.35'),
  ('max_face_samples',           '5');
EOF
echo "   ✓ Admin and Viewer accounts created. No sample data seeded."

# 4. Download and Verify AI Models
echo ""
echo "[4/6] Verifying Vision AI Models & Pre-downloading Weights..."
$PYTHON_BIN -c "
import os
import torch
from ultralytics import YOLO

# Hardware acceleration check
if torch.cuda.is_available():
    print(f'   ✓ NVIDIA GPU detected: {torch.cuda.get_device_name(0)} (CUDA Hardware Acceleration ACTIVE)')
else:
    print('   ℹ️ No CUDA GPU detected locally. Running in CPU mode (auto-accelerates on CUDA servers).')

# 1. Person detector model
yolo = YOLO('yolov8n.pt')
print('   ✓ YOLOv8n person detector model ready.')

# 2. InsightFace buffalo_s (Fast MobileNet face detector + genderage)
models_s_dir = os.path.expanduser('~/.insightface/models/buffalo_s')
os.makedirs(models_s_dir, exist_ok=True)
import insightface
from insightface.app import FaceAnalysis

print('   ⏳ Verifying / Downloading InsightFace buffalo_s...')
app_s = FaceAnalysis(name='buffalo_s', allowed_modules=['detection', 'genderage'], providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
app_s.prepare(ctx_id=0, det_size=(320, 320))
print('   ✓ InsightFace buffalo_s detector ready.')

# 3. InsightFace buffalo_l (High-accuracy ResNet50 face detector)
models_l_dir = os.path.expanduser('~/.insightface/models/buffalo_l')
os.makedirs(models_l_dir, exist_ok=True)
print('   ⏳ Verifying / Downloading InsightFace buffalo_l...')
try:
    app_l = FaceAnalysis(name='buffalo_l', allowed_modules=['detection', 'genderage'], providers=['CUDAExecutionProvider', 'CPUExecutionProvider'])
    app_l.prepare(ctx_id=0, det_size=(640, 640))
    print('   ✓ InsightFace buffalo_l detector ready.')
except Exception as e:
    print(f'   ⚠️ InsightFace buffalo_l note: {e}')

# 4. MiVOLO v2 SOTA Demographic Transformer
print('   ⏳ Verifying / Pre-caching MiVOLO v2 Transformer...')
try:
    from transformers import AutoModelForImageClassification, AutoImageProcessor, AutoConfig
    model_id = 'iitolstykh/mivolo_v2'
    AutoConfig.from_pretrained(model_id, trust_remote_code=True)
    AutoImageProcessor.from_pretrained(model_id, trust_remote_code=True)
    AutoModelForImageClassification.from_pretrained(model_id, trust_remote_code=True)
    print('   ✓ MiVOLO v2 model & processor weights cached.')
except Exception as e:
    print(f'   ⚠️ MiVOLO v2 pre-cache note: {e}')
"

# 5. Setup Frontend Branding & Build
echo ""
echo "[5/6] Building Next.js Frontend Dashboard..."
mkdir -p frontend/public/fonts frontend/public/logos
cp "images/Camsense Fevicon-Blue-Brown.svg" frontend/public/camsense-favicon.svg 2>/dev/null || true
cp "images/Camsense Logo-Beige-Brown.svg" frontend/public/camsense-logo.svg 2>/dev/null || true
cp "images/Powered by Camsense Logo-Blue-Brown.svg" frontend/public/powered-by-camsense.svg 2>/dev/null || true
cp "fonts/UcC73FwrK3iLTeHuS_nVMrMxCp50SjIa1ZL7.woff2" frontend/public/fonts/inter.woff2 2>/dev/null || true

cd frontend
npm install --silent
npm run build
cd ..
echo "   ✓ Next.js frontend built successfully."

# 6. Summary & Execution
echo ""
echo "=================================================================="
echo "    🎉 VisionCount Setup Completed Successfully!                "
echo "=================================================================="
echo ""
echo "Login Credentials:"
echo "   • Admin:  admin@camsense.ai  /  admin123"
echo "   • Viewer: viewer@camsense.ai /  viewer123"
echo ""
echo "To start both Backend and Frontend:"
echo "   ./start.sh"
echo ""
echo "Or start individually:"
echo "   Backend:  uvicorn backend.app.main:app --host 0.0.0.0 --port 8000"
echo "   Frontend: cd frontend && npm run start"
echo ""

if [ "$1" == "--start" ]; then
    echo "Starting VisionCount stack now..."
    ./start.sh
fi
