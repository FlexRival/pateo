# Landing pública de Prooffit

Página de descarga de la app. Dos trabajos y ninguno más: que quien llegue se
instale Prooffit, y que Google la encuentre cuando alguien busque una app para
competir por pasos con sus amigos.

Vive aquí dentro y no en `src/`: `src/app/` **es** el enrutado de Expo Router
y cualquier cosa que se meta ahí se convierte en una pantalla de la app.

## Cómo se abre

Es HTML estático. No hay build, ni `package.json`, ni `node_modules`.

```bash
npx serve landing
```

O directamente abriendo `landing/index.html` en el navegador, con una
salvedad: sobre `file://` algunas cosas no se comportan igual que en un
servidor. Para revisar de verdad, sírvela.

## Por qué HTML estático y no React

Porque lo que se pide aquí es posicionar. Un robot de búsqueda recibe el
contenido ya renderizado, sin coste de JavaScript, y el LCP no depende de
hidratar nada. Meter Next.js dentro de un repo de Expo habría traído un
segundo `package.json`, un segundo React y un conflicto de versiones a cambio
de nada que esta página necesite.

## Estructura

```
landing/
  index.html            la página entera
  privacy.html          GENERADO desde src/lib/legal/
  terms.html            GENERADO desde src/lib/legal/
  delete-account.html   GENERADO desde las cadenas de i18n
  robots.txt            ⚠️ lleva dominio de ejemplo
  sitemap.xml           ⚠️ lleva dominio de ejemplo
  styles/
    tokens.css          GENERADO desde src/constants/colors.ts
    theme.css           tipografía, radios, espaciado, motion (espejo de theme.ts)
    base.css            reset, tipografía base, rejilla de página
    components.css      Button, Card, Chip, MeterBar, teléfono, FAQ
    sections.css        composición de cada sección
    motion.css          las diez animaciones, con su motivo cada una
    legal.css           la página de documento legal (privacy/terms)
  scripts/
    build-tokens.mjs    colors.ts -> tokens.css
    build-legal.mjs     src/lib/legal/ -> privacy.html y terms.html
    motion.js           cuándo ocurre cada animación (IntersectionObserver)
    og-image.html       fuente de la tarjeta para compartir
    render-og.sh        og-image.html -> assets/brand/og-image.png
    app-screen.html     fuente de la captura del hero
    render-screens.sh   app-screen.html -> assets/screenshots/home.png
  assets/
    fonts/              Chakra Petch 700 y Space Grotesk 400/500, autoalojadas
    brand/              icono, favicon y og-image
    screenshots/        la pantalla que va dentro del teléfono
```

## De dónde salen los estilos

No se ha inventado ni un color. La landing usa el mismo sistema de diseño que
la app (`docs/design.md`):

- **Color.** `styles/tokens.css` lo **genera** un script desde
  `src/constants/colors.ts`, que es el fichero que corre en la app. Se
  regenera con:

  ```bash
  node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON landing/scripts/build-tokens.mjs
  ```

  No lo edites a mano. Si tocas un color, el orden es: `colors.ts` →
  `docs/design.md` → `pnpm check:contrast` → regenerar `tokens.css`.

- **Escala** (tipografía, radios, espaciado, motion). Espejada a mano en
  `styles/theme.css` porque `src/constants/theme.ts` importa `react-native` y
  Node no puede cargarlo suelto. Si cambias la escala en `theme.ts`, cámbiala
  aquí en el mismo commit.

- **Tipografía.** Chakra Petch 700 y Space Grotesk 400/500, los mismos `.ttf`
  que empaqueta Expo, copiados de `node_modules/@expo-google-fonts/` y
  servidos desde el propio dominio. Nada de `<link>` a Google Fonts: es una
  petición a un tercero delante del primer pintado.

  La regla de siempre: **la familia es el peso.** No hay Space Grotesk Bold;
  lo que sería negrita sube a Chakra Petch.

- **Primitivos.** `styles/components.css` es la traducción a web de
  `Button`, `Card`, `Chip` y `MeterBar`, con los mismos nombres y las mismas
  variantes.

Solo hay tres cosas que la app no tiene y aquí sí, todas documentadas en su
sitio: los pasos de tipografía de escritorio (`--type-hero`,
`--type-section`, `--type-stat`), el ritmo vertical entre secciones
(`--section-y`) y el ancho de página (`--page-max`).

## Animación

Diez, y cada una está en `styles/motion.css` con la frase que la justifica.
Si añades otra y no puedes escribir esa frase, no la añadas.

Reglas que se cumplen en todas:

- Todo el scroll pasa por `IntersectionObserver` o por `animation-timeline`.
  **No hay un solo `addEventListener('scroll')`**, y no debe haberlo: dispara
  en cada frame, no se agrupa, y es la vía más rápida de convertir esto en
  una presentación con tirones en un móvil de gama media.
- Solo se animan `transform` y `opacity`, lo único que la GPU compone sin
  repintar. La única excepción es el trazo de la marca del dock, que ocurre
  una vez y sobre un icono de 34px.
- **Todo respeta `prefers-reduced-motion`**, igual que `LevelUpBadge` dentro
  de la app: con esa preferencia activada no queda ni una animación y el
  contenido aparece ya asentado.
- Sin JavaScript la página se sirve entera y quieta. El estado oculto lo pone
  un `data-motion` que solo llega si hay JavaScript vivo.

## Imágenes generadas

Dos PNG salen de un HTML, igual que los iconos de la app
(`scripts/render-app-icons.sh`). Se regeneran con el Chrome ya instalado, sin
añadir dependencias:

```bash
bash landing/scripts/render-og.sh
bash landing/scripts/render-screens.sh
```

⚠️ `assets/screenshots/home.png` es una **reproducción** de la pantalla
principal montada con los tokens del sistema de diseño, no una captura de la
app corriendo. Para la landing vale. Para la ficha de Google Play no: Play
exige capturas del producto real. Ver
`assets/screenshots/README.md`.

## SEO

Lo que ya está hecho:

- `<html lang="es">`, `title` y `meta description` escritos para la búsqueda
  que importa, no para rellenar.
- `link rel="canonical"`, Open Graph y Twitter Card con su imagen de 1200x630.
- JSON-LD con `MobileApplication` y `FAQPage`. **Sin `aggregateRating`**: la
  app no tiene valoraciones todavía y fabricarlas es justo lo que Google
  penaliza.
- `robots.txt` y `sitemap.xml`.
- Una sección de preguntas que responde de verdad a lo que la gente busca
  (de dónde salen los pasos, si hace falta pulsera, si se puede hacer trampa).

## Antes de publicar

1. **Dominio.** Toda la página lleva `https://prooffit.app` como ejemplo. Hay
   que cambiarlo en cuatro sitios: `index.html` (canonical, `og:*`, JSON-LD),
   `robots.txt`, `sitemap.xml` y la constante `SITE_ORIGIN` de
   `scripts/build-legal.mjs` — esta última manda sobre el `canonical` de las
   tres páginas generadas, así que después hay que volver a lanzar
   `pnpm build:legal`. Es el mismo dominio que hay que rellenar en
   `LEGAL_CONTACT.site` (`src/lib/legal/types.ts`), que sigue bloqueando
   publicar (KAN-74).

2. **Las tres páginas que exigen las tiendas.** Ya existen: `privacy.html`,
   `terms.html` y `delete-account.html` las genera `build-legal.mjs` desde lo
   que ya pinta la app, así que la versión web y la de dentro no pueden
   divergir — que es justo lo que un revisor comprueba. Se regeneran con:

   ```bash
   pnpm build:legal
   ```

   Cada una tira de su fuente: privacidad y términos de `src/lib/legal/`
   (`privacy-policy.ts` y `terms.ts`), y la de borrado de cuenta de las
   cadenas `deleteAccount.*` de `src/lib/i18n/translations/es.ts`, que son las
   mismas que lee `src/app/delete-account.tsx`.

   No las edites a mano: son ficheros generados y el siguiente `build:legal`
   se lleva por delante cualquier cambio.

   La de borrado importa tanto como las otras dos: Google Play exige una ruta
   web de borrado de cuenta **alcanzable sin instalar la app**, y es la URL
   que se pega en el formulario de Data safety.

3. **Captura real.** Ver arriba.

4. **iOS.** El segundo botón del hero dice «Pronto en iOS» y no lleva a
   ningún sitio, porque la v1 sale **solo en Android** y no hay cuenta de
   Apple Developer (KAN-46, KAN-81). Cuando exista la app en la App Store, se
   cambia ese `<span class="button button--pending">` por un `<a>` con el
   enlace. No hay que tocar nada más.

5. **Precio de Pro.** La página no dice ninguna cifra, y es deliberado: el
   precio lo pone la tienda ya localizado, y qué desbloquea Pro además de
   quitar el cupo diario sigue sin definirse (KAN-25). Si eso se cierra, la
   sección de precio es lo único que hay que tocar.

## Lo que se puede mejorar cuando haya tiempo

- **Convertir los `.ttf` a `.woff2`.** Es la mitad de peso por archivo y es la
  optimización con más efecto sobre el LCP que queda pendiente. Hace falta una
  herramienta que aquí no hay, por eso se quedaron en `.ttf`.
- **Versión en inglés.** La app habla español e inglés; la landing solo
  español. Sería `en/index.html` con los mismos estilos, más `hreflang` en
  las dos.
