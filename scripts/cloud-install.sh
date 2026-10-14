#!/usr/bin/env bash
set -euo pipefail
cd /workspace/summit
node -e 'if (Number(process.versions.node.split(".")[0]) < 22) process.exit(1)'
npm ci --ignore-scripts --no-audit --no-fund --cache /workspace/.npm-cache
npm run build
