#!/usr/bin/env bash
#
# Renderiza la pantalla de la app desde `landing/scripts/app-screen.html` a
# `landing/assets/screenshots/home.png`.
#
#   bash landing/scripts/render-screens.sh
#
# Usa el Chrome ya instalado en modo headless: no instala nada ni añade
# dependencias. Mismo enfoque que `scripts/render-app-icons.sh`.
#
# ⚠️ La salida es una REPRODUCCIÓN montada con los tokens del sistema de
# diseño, no una captura de la app corriendo. Sirve para la landing; para la
# ficha de Google Play hacen falta capturas del dispositivo de verdad (ver
# `landing/assets/screenshots/README.md`).
#
# El lienzo mide 360x800 px CSS y se renderiza a 3x para sacar 1080x2400, que
# es la resolución que pide Play. --window-size va SIEMPRE en px CSS: bajarlo
# no encoge la imagen, recorta el lienzo.

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$ROOT/scripts/app-screen.html"
OUT="$ROOT/assets/screenshots"

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

"$CHROME" \
  --headless=new \
  --disable-gpu \
  --hide-scrollbars \
  --window-size=360,800 \
  --force-device-scale-factor=3 \
  --virtual-time-budget=8000 \
  --screenshot="$OUT/home.png" \
  "file:///$SRC_URL" >/dev/null 2>&1

echo "  home.png                           1080x2400"
