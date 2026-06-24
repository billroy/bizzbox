#!/usr/bin/env bash
#
# Deploy BizzBox to a Fly.io Sprite.
#
# Usage:
#   bash deploy-sprite.sh
#   bash deploy-sprite.sh --sprite bizzbox-test
#
# Environment overrides:
#   BIZZBOX_SPRITE_NAME  Sprite name, defaults to bizzbox
#   BIZZBOX_REPO         Git repository URL
#   BIZZBOX_SECRET_KEY   Flask SECRET_KEY to persist on the Sprite
#
set -euo pipefail

REPO="${BIZZBOX_REPO:-https://github.com/billroy/bizzbox.git}"
SPRITE_NAME="${BIZZBOX_SPRITE_NAME:-bizzbox}"
SECRET_KEY="${BIZZBOX_SECRET_KEY:-}"
SERVICE_NAME="bizzbox"
APP_DIR="~/bizzbox"
VENV_DIR="~/.venvs/bizzbox"
HTTP_PORT="8080"

die()  { printf '\033[31mError:\033[0m %s\n' "$1" >&2; exit 1; }
step() { printf '\033[1;34m>\033[0m %s ... ' "$1"; }
ok()   { printf '\033[32mdone\033[0m\n'; }

usage() {
    cat <<'EOF'
BizzBox Sprite Deployer

Usage:
  bash deploy-sprite.sh [options]

Options:
  --sprite NAME       Sprite name (default: bizzbox, or $BIZZBOX_SPRITE_NAME)
  --repo URL          Git repository URL (default: https://github.com/billroy/bizzbox.git)
  --secret-key VALUE  Flask SECRET_KEY to persist on the Sprite
  -h, --help          Show this help

The script creates or updates a Sprite, installs BizzBox into a Python venv,
creates a public HTTP service on port 8080, and checks that the app responds.
EOF
}

while [ "$#" -gt 0 ]; do
    case "$1" in
        --sprite)
            [ "${2:-}" ] || die "--sprite requires a name"
            SPRITE_NAME="$2"
            shift 2
            ;;
        --repo)
            [ "${2:-}" ] || die "--repo requires a URL"
            REPO="$2"
            shift 2
            ;;
        --secret-key)
            [ "${2:-}" ] || die "--secret-key requires a value"
            SECRET_KEY="$2"
            shift 2
            ;;
        -h|--help)
            usage
            exit 0
            ;;
        *)
            die "Unknown option: $1"
            ;;
    esac
done

command -v sprite >/dev/null 2>&1 || {
    echo "The Sprite CLI is not installed."
    echo "Install it with:  curl https://sprites.dev/install.sh | bash"
    echo "Then run:          sprite login"
    exit 1
}

if [ -z "$SECRET_KEY" ]; then
    if command -v python3 >/dev/null 2>&1; then
        SECRET_KEY="$(python3 - <<'PY'
import secrets
print(secrets.token_hex(32))
PY
)"
    else
        SECRET_KEY="$(od -An -N32 -tx1 /dev/urandom | tr -d ' \n')"
    fi
fi

printf '\n\033[1mBizzBox Sprite Deployer\033[0m\n\n'

step "Creating Sprite '${SPRITE_NAME}'"
if sprite list 2>/dev/null | awk '{print $1}' | grep -Fxq "$SPRITE_NAME"; then
    printf '\033[33malready exists\033[0m\n'
else
    sprite create "$SPRITE_NAME" --skip-console >/dev/null
    ok
fi

S="-s $SPRITE_NAME"

step "Cloning repo and installing dependencies"
INSTALL_OUT=$(sprite exec $S -- bash -c "
    set -euo pipefail
    if ! command -v git >/dev/null 2>&1 || ! command -v python3 >/dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y git python3 python3-venv python3-pip
    elif ! python3 -m venv --help >/dev/null 2>&1; then
        sudo apt-get update
        sudo apt-get install -y python3-venv
    fi

    if [ -d ${APP_DIR}/.git ]; then
        cd ${APP_DIR}
        git fetch --all --prune
        git pull --ff-only
    else
        git clone ${REPO} ${APP_DIR}
        cd ${APP_DIR}
    fi

    python3 -m venv ${VENV_DIR}
    ${VENV_DIR}/bin/python -m pip install -q --upgrade pip
    ${VENV_DIR}/bin/python -m pip install -q -r requirements.txt
" 2>&1) || {
    printf '\033[31mfailed\033[0m\n'
    echo "$INSTALL_OUT"
    die "Clone or install failed."
}
ok

step "Configuring production environment"
ESCAPED_SECRET=$(printf '%s' "$SECRET_KEY" | sed "s/'/'\\\\''/g")
ENV_OUT=$(sprite exec $S -- bash -c "
    set -euo pipefail
    touch ~/.bashrc
    sed -i '/^export BIZZBOX_PRODUCTION=/d' ~/.bashrc
    sed -i '/^export SECRET_KEY=/d' ~/.bashrc
    echo 'export BIZZBOX_PRODUCTION=1' >> ~/.bashrc
    echo 'export SECRET_KEY='\''${ESCAPED_SECRET}'\''' >> ~/.bashrc
" 2>&1) || {
    printf '\033[31mfailed\033[0m\n'
    echo "$ENV_OUT"
    die "Could not configure production environment."
}
ok

step "Creating background service"
SERVICE_OUT=$(sprite exec $S -- bash -c "
    set -euo pipefail
    sprite-env services delete ${SERVICE_NAME} 2>/dev/null || true
    sprite-env services create ${SERVICE_NAME} \
        --cmd /usr/bin/bash \
        --args '-c,source ~/.bashrc && cd ${APP_DIR} && ${VENV_DIR}/bin/python app.py --host 0.0.0.0 --port ${HTTP_PORT}' \
        --http-port ${HTTP_PORT} \
        2>&1
" 2>&1) || {
    printf '\033[31mfailed\033[0m\n'
    echo "$SERVICE_OUT"
    die "Could not create the BizzBox service."
}
ok

step "Making Sprite URL public"
URL_AUTH_OUT=$(sprite url $S update --auth public 2>&1) || {
    printf '\033[31mfailed\033[0m\n'
    echo "$URL_AUTH_OUT"
    die "Could not make Sprite URL public."
}
ok

SPRITE_URL=$(sprite url $S 2>/dev/null | awk '/https:\/\//{for(i=1;i<=NF;i++) if($i ~ /^https:\/\//) {print $i; exit}}')
[ -n "$SPRITE_URL" ] || SPRITE_URL="https://${SPRITE_NAME}.sprites.dev/"

step "Waiting for service to become reachable"
HEALTHY=false
HTTP_CODE="000"
for _ in 1 2 3 4 5 6 7 8 9 10 11 12; do
    sleep 5
    HTTP_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "$SPRITE_URL" 2>/dev/null || echo "000")
    if [ "$HTTP_CODE" != "000" ] && [ "$HTTP_CODE" != "502" ] && [ "$HTTP_CODE" != "503" ]; then
        HEALTHY=true
        break
    fi
done
if $HEALTHY; then
    printf '\033[32mreachable (HTTP %s)\033[0m\n' "$HTTP_CODE"
else
    printf '\033[33mnot yet reachable (HTTP %s)\033[0m\n' "$HTTP_CODE"
    echo ""
    echo "The service may still be starting. Check with:"
    echo "  sprite exec $S -- sprite-env services logs ${SERVICE_NAME}"
fi

step "Checking Socket.IO handshake"
SOCKET_CODE=$(curl -s -o /dev/null -w '%{http_code}' --max-time 10 "${SPRITE_URL%/}/socket.io/?EIO=4&transport=polling" 2>/dev/null || echo "000")
if [ "$SOCKET_CODE" = "200" ]; then
    printf '\033[32mreachable (HTTP %s)\033[0m\n' "$SOCKET_CODE"
else
    printf '\033[33munexpected HTTP %s\033[0m\n' "$SOCKET_CODE"
fi

echo ""
echo "----------------------------------------------------"
printf '\033[1;32m  BizzBox URL:\033[0m  %s\n' "$SPRITE_URL"
echo "----------------------------------------------------"
echo ""
printf 'To update later:\n'
printf '  sprite exec %s -- bash -c "cd ~/bizzbox && git pull --ff-only && ~/.venvs/bizzbox/bin/python -m pip install -q -r requirements.txt"\n' "$S"
printf '  sprite exec %s -- sprite-env services restart %s\n\n' "$S" "$SERVICE_NAME"
