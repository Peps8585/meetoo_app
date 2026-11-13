#!/bin/bash
# Applica una o piu' migrazioni SOLO sul database di prova (MeeToo_Dev).
# Si ferma se il repo e' collegato a un altro progetto. L'esito va in
# _out/applica-su-prova.txt, cosi' chi ha preparato la migrazione lo rilegge.
#   bash scripts/applica-su-prova.sh supabase/migrations/<file>.sql [...]
set -u
cd "$(dirname "$0")/.."
PROVA="szxnyjosyiyqkgeqpzxh"
ESITO="_out/applica-su-prova.txt"
mkdir -p _out
: > "$ESITO"
if [ "$(cat supabase/.temp/project-ref 2>/dev/null)" != "$PROVA" ]; then
  echo "FERMO: il repo non e' collegato al database di prova." | tee -a "$ESITO"
  exit 1
fi
for f in "$@"; do
  echo "=== $f" >> "$ESITO"
  if supabase db query --linked -f "$f" >> "$ESITO" 2>&1; then
    echo "ok: $f"
  else
    echo "ERRORE: $f (dettagli in $ESITO)"
    exit 1
  fi
done
echo "Migrazioni applicate sul database di prova."
