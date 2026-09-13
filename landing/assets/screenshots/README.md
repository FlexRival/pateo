# Capturas de la app

## Qué hay ahora

`home.png` (1080x2400) es un **fichero generado**. Sale de
`landing/scripts/app-screen.html` con:

```bash
bash landing/scripts/render-screens.sh
```

No se retoca a mano: se toca el HTML y se vuelve a ejecutar.

## Qué es y qué no es

Es una reproducción de la pantalla principal montada con el sistema de
diseño real: los colores salen de `landing/styles/tokens.css` (que a su vez
sale de `src/constants/colors.ts`), las medidas del `StyleSheet` de
`src/app/(tabs)/index.tsx` y los textos de
`src/lib/i18n/translations/es.ts`, copiados literalmente. No hay ni un color,
ni un radio, ni una cadena inventada.

**No es una captura de la app corriendo.** Para la landing vale: enseña el
producto tal y como se ve. Para la **ficha de Google Play no vale**: Play
exige capturas del producto real y rechaza los montajes.

## Lo que todavía falta

Una captura de verdad, desde un dispositivo o un emulador con un development
build:

```bash
adb exec-out screencap -p > landing/assets/screenshots/home.png
```

Para que la captura sirva:

- Health Connect ya conectado, para que la cifra de pasos no salga a cero.
- Un duelo activo de verdad en pantalla. Es lo que vende la app.
- Tema oscuro, que es el único que hay (`docs/design.md`).

En cuanto exista, sustituye a este PNG sin tocar nada más: `index.html` ya
apunta a `assets/screenshots/home.png`. Si la resolución cambia, actualiza
`width` y `height` en el `<img>` del hero. No son opcionales: sin ellos el
navegador no reserva el hueco, la página da un salto al cargar la imagen y el
CLS se va al garete.
