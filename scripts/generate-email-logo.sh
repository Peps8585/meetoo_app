#!/bin/bash
# Genera public/brand/email-logo.png — lockup 'full' per le email transazionali.
# Replica la geometria canonica di app/Logo.tsx + app/Mark.tsx:
#   MARK_RATIO 0.499 · fullMarkGap 0.076 · stroke 9 · r = 42.586 - 9/2 = 38.086
# Render a W=320 (2x di un display 160px), sfondo #f5f0e8 BAKATO (leggibilità nei
# client di posta in dark mode), ink #2c2c2c. Eseguire offline dopo ogni modifica
# al lockup; il PNG è committato statico (Chrome non serve in build).
set -euo pipefail
cd "$(dirname "$0")/.."

TMP=$(mktemp -d)
trap 'rm -rf "$TMP"' EXIT
WORDMARK=$(cat public/brand/meetoo-wordmark.svg)

cat > "$TMP/logo_compose.html" <<EOF
<!doctype html><html><head><meta charset="utf-8"><style>
  html,body{margin:0;padding:0;background:#f5f0e8;}
  .wrap{width:368px;padding:24px;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;color:#2c2c2c;}
  .mark{width:159.68px;}
  .word{width:320px;margin-top:24.32px;}
  svg{display:block;width:100%;height:auto;}
</style></head><body>
<div class="wrap">
  <div class="mark"><svg viewBox="0 0 127.758 85.172" fill="none" stroke="currentColor" stroke-width="9" xmlns="http://www.w3.org/2000/svg"><circle cx="42.586" cy="42.586" r="38.086"/><circle cx="85.172" cy="42.586" r="38.086"/></svg></div>
  <div class="word">${WORDMARK}</div>
</div>
</body></html>
EOF

# Canvas: 368 × (mark 106.45 + gap 24.32 + wordmark 320*181/256=226.25 + padding 48) ≈ 405
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless --disable-gpu --hide-scrollbars \
  --screenshot="public/brand/email-logo.png" \
  --window-size=368,405 \
  "file://$TMP/logo_compose.html" 2>/dev/null

echo "OK: public/brand/email-logo.png rigenerato"
