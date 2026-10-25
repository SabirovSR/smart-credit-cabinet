#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "Telegram is not configured; notification skipped."
  exit 0
fi
export STATUS RUN_URL SHA
payload=$(python3 - <<'PY'
import json, os
status = os.environ.get('STATUS', 'failure')
title = '✅ Дело: деплой успешен' if status == 'success' else '❌ Дело: CI/CD требует внимания'
text = title + '\n\n' + os.environ.get('RUN_URL', '') + '\nCommit: ' + os.environ.get('SHA', '')[:12]
print(json.dumps({'chat_id': os.environ['TELEGRAM_CHAT_ID'], 'text': text, 'disable_web_page_preview': True}))
PY
)
curl --fail --silent --show-error --request POST \
  --header 'Content-Type: application/json' \
  --data "$payload" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" > /dev/null
