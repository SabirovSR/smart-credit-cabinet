#!/usr/bin/env bash
set -euo pipefail
if [[ -z "${TELEGRAM_BOT_TOKEN:-}" || -z "${TELEGRAM_CHAT_ID:-}" ]]; then
  echo "Telegram is not configured; notification skipped."
  exit 0
fi
export DEPLOY_RESULT RUN_URL SHA STATUS
payload=$(python3 - <<'PY'
import json, os
deploy = os.environ.get('DEPLOY_RESULT', 'skipped')
status = os.environ.get('STATUS', 'failure')
if status != 'success':
    title = '❌ Дело: CI/CD требует внимания'
elif deploy == 'success':
    title = '✅ Дело: деплой успешен'
else:
    title = '✅ Дело: CI зелёный, деплой не запускался'
text = title + '\n\n' + os.environ.get('RUN_URL', '') + '\nCommit: ' + os.environ.get('SHA', '')[:12]
print(json.dumps({'chat_id': os.environ['TELEGRAM_CHAT_ID'], 'text': text, 'disable_web_page_preview': True}))
PY
)
curl --fail --silent --show-error --request POST \
  --header 'Content-Type: application/json' \
  --data "$payload" "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" > /dev/null
