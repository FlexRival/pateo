/**
 * Genera `landing/styles/tokens.css` a partir de `src/constants/colors.ts`.
 *
 *   node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON landing/scripts/build-tokens.mjs
 *
 * Por qué existe: la landing es web y la app es React Native, así que no
 * pueden compartir el mismo objeto en tiempo de ejecución. Lo que sí pueden
 * compartir es la fuente: este script lee los mismos tokens que corre la app
 * y los escupe como variables CSS, para que un cambio de color en
 * `colors.ts` llegue a la landing ejecutando esto y no copiando hex a mano.
 *
 * Misma técnica que `scripts/check-contrast.mjs`: Node importa el `.ts`
 * directamente quitándole los tipos. Por eso `colors.ts` no puede tener
 * imports, y por eso este script tampoco carga `theme.ts` (ese sí importa
 * `react-native`). La escala de tipografía, radios, espaciado y motion vive
 * espejada a mano en `landing/styles/theme.css`.
 *
 * `tokens.css` es un fichero GENERADO. No se edita a mano: se toca
 * `src/constants/colors.ts` y se vuelve a ejecutar esto.
 */

import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { Colors, Gradients, Palette } from '../../src/constants/colors.ts';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, '..', 'styles', 'tokens.css');

/** `powerBright` -> `power-bright`, para que las variables CSS vayan en kebab. */
const kebab = (name) => name.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();

const lines = (entries, prefix) =>
  Object.entries(entries)
    .map(([name, value]) => `  --${prefix}-${kebab(name)}: ${value};`)
    .join('\n');

/**
 * Un degradado es un array de paradas, no un color. Se emite como el
 * `linear-gradient()` ya montado (90deg: la barra de XP va de izquierda a
 * derecha, ver docs/design.md) más las paradas sueltas por si una pieza
 * necesita solo el extremo.
 */
const gradients = Object.entries(Gradients)
  .map(([name, stops]) => {
    const key = kebab(name);
    const single = `  --gradient-${key}: linear-gradient(90deg, ${stops.join(', ')});`;
    const parts = stops.map((stop, i) => `  --gradient-${key}-${i + 1}: ${stop};`);
    return [single, ...parts].join('\n');
  })
  .join('\n');

const css = `/**
 * Tokens de color de Prooffit para web. FICHERO GENERADO.
 *
 * Fuente: src/constants/colors.ts (la misma que corre en la app).
 * Referencia legible: docs/design.md.
 *
 * No lo edites a mano. Para cambiar un color:
 *   1. tocas src/constants/colors.ts
 *   2. actualizas docs/design.md en el mismo commit
 *   3. pnpm check:contrast
 *   4. node --no-warnings=MODULE_TYPELESS_PACKAGE_JSON landing/scripts/build-tokens.mjs
 *
 * Tres familias de variables:
 *   --color-*     tokens semánticos (Colors.dark). Es lo que usa la landing.
 *   --palette-*   valores en bruto (Palette). Solo para casos sin token.
 *   --gradient-*  rellenos con degradado (Gradients).
 *
 * Prooffit es de tema único y oscuro (docs/design.md): no hay bloque para
 * prefers-color-scheme: light a propósito, no es un olvido.
 */

:root {
  /* Semánticos. Un componente pide --color-surface, nunca --palette-card. */
${lines(Colors.dark, 'color')}

  /* En bruto. Bájate aquí solo si no hay token semántico para el rol. */
${lines(Palette, 'palette')}

  /* Degradados. */
${gradients}
}
`;

writeFileSync(OUT, css, 'utf8');

const count =
  Object.keys(Colors.dark).length + Object.keys(Palette).length + Object.keys(Gradients).length;
console.log(`tokens.css escrito con ${count} tokens desde src/constants/colors.ts`);
