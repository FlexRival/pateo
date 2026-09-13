#!/usr/bin/env bash
#
# Renderiza la tarjeta para compartir desde `landing/scripts/og-image.html` a
# `landing/assets/brand/og-image.png`.
#
#   bash landing/scripts/render-og.sh
#
# Usa el Chrome ya instalado en modo headless: no instala nada ni añade
# dependencias al proyecto. Mismo enfoque que `scripts/render-app-icons.sh`.
#
# La salida es un fichero GENERADO. Para cambiar la tarjeta se toca el HTML de
# al lado y se vuelve a ejecutar esto; el PNG no se retoca a mano.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/scripts/og-image.html"
OUT="$ROOT/assets/brand"

# Chrome en las rutas habituales de Windows, macOS y Linux.
CHROME=""
for candidate in \
  "/c/Program Files/Google/Chrome/Application/chrome.exe" \
  "/c/Program Files (x86)/Google/Chrome/Application/chrome.exe" \
  "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  "$(command -v google-chrome || true)" \
  "$(command -v chromium || true)"
do
  if [ -n "$candidate" ] && [ -x "$candidate" ]; then CHROME="$candidate"; break; fi
done

if [ -z "$CHROME" ]; then
  echo "No encuentro Chrome. Instálalo o edita la lista de rutas de este script." >&2
  exit 1
fi

mkdir -p "$OUT"

# Dentro de file:// la ruta va en formato Windows cuando estamos en Git Bash.
SRC_URL="$SRC"
case "$SRC" in
  /c/*) SRC_URL="C:${SRC#/c}" ;;
esac

# --window-size va en px CSS y el lienzo mide exactamente 1200x630, así que la
# captura sale sin recorte ni margen. --virtual-time-budget le da margen a
# Chakra Petch para cargar: sin eso la P y el titular salen con la tipografía
# del sistema.
"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --window-size=1200,630 \
  --virtual-time-budget=8000 \
  --screenshot="$OUT/og-image.png" \
  "file:///$SRC_URL" >/dev/null 2>&1

echo "  og-image.png                       1200x630"
