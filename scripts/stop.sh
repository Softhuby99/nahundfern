#!/usr/bin/env bash
# Stop the stack (independent of the mode it was started with).
set -euo pipefail
cd "$(dirname "$0")/.."
docker compose down "$@"
