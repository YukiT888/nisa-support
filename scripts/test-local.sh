#!/usr/bin/env bash
set -euo pipefail
PORT=${PORT:-3000}

# Start Next.js in the background with mock enabled
OPENAI_MOCK=1 npm run start &
PID=$!

# Wait for server to be ready
for i in $(seq 1 60); do
  if curl -fsS http://localhost:$PORT >/dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Prepare a tiny 1x1 png as data URL
IMG_DATA="data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4nGMAAQAABQABDQottQAAAABJRU5ErkJggg=="

# Call analyze-photo (no external AlphaVantage)
RESP=$(curl -sS -X POST http://localhost:$PORT/api/analyze-photo \
  -H 'Content-Type: application/json' \
  -d "{\"image\":\"$IMG_DATA\",\"hints\":{\"symbolText\":\"AAPL\"}}")

echo "Analyze-photo response:\n$RESP\n"

# Call advice
RESP2=$(curl -sS -X POST http://localhost:$PORT/api/advice \
  -H 'Content-Type: application/json' \
  -d '{"decision":"NEUTRAL","reasons":["理由1","理由2","理由3"],"counters":["反対1","反対2"],"nextSteps":["次1","次2"]}')

echo "Advice response:\n$RESP2\n"

# Cleanup
kill $PID || true
