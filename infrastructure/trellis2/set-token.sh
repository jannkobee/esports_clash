#!/usr/bin/env bash
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WORKSPACE="$(cd "${SCRIPT_DIR}/../.." && pwd)"
TOKEN_DIR="${WORKSPACE}/.local-tools/trellis2"
TOKEN_PATH="${TOKEN_DIR}/hf-token.txt"

mkdir -p "${TOKEN_DIR}"

echo "=================================================================="
echo "Hugging Face Access Token Setup (TRELLIS.2 / DINOv3 Provisioning)"
echo "=================================================================="
echo "Note: Input is hidden while typing/pasting."
read -s -p "Paste your Hugging Face read token (hf_...): " HF_TOKEN
echo ""

HF_TOKEN="$(echo "${HF_TOKEN}" | tr -d '[:space:]')"

if [[ ! "${HF_TOKEN}" =~ ^hf_[A-Za-z0-9]+$ ]]; then
    echo "Error: Token must begin with 'hf_' and contain only alphanumeric characters."
    exit 1
fi

echo "Verifying access to gated checkpoint: facebook/dinov3-vitl16-pretrain-lvd1689m..."
STATUS=$(curl -s -o /dev/null -w "%{http_code}" -I \
  -H "Authorization: Bearer ${HF_TOKEN}" \
  "https://huggingface.co/facebook/dinov3-vitl16-pretrain-lvd1689m/resolve/ea8dc2863c51be0a264bab82070e3e8836b02d51/config.json")

if [ "${STATUS}" != "200" ]; then
    echo "Error: Checkpoint access check failed with HTTP ${STATUS}."
    echo "Make sure your Hugging Face account has been accepted for 'facebook/dinov3-vitl16-pretrain-lvd1689m'"
    echo "at https://huggingface.co/facebook/dinov3-vitl16-pretrain-lvd1689m"
    exit 1
fi

echo "${HF_TOKEN}" > "${TOKEN_PATH}"
chmod 600 "${TOKEN_PATH}"

echo "Official DINOv3 access verified!"
echo "Token saved to git-ignored path: ${TOKEN_PATH}"

