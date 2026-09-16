/**
 * Verifica los tokens de color de Pateo contra los mínimos de contraste de
 * WCAG 2.1. Se ejecuta con `pnpm check:contrast`.
 *
 * Carga `src/constants/colors.ts` directamente: Node le quita los tipos, y por
 * eso ese archivo no puede tener imports.
 *
 * Cada token de `Colors` tiene que estar clasificado en una de las listas de
 * abajo. Si añades uno y no lo clasificas, la comprobación falla a propósito:
 * un token de color sin garantía de contraste no debería llegar a una pantalla.
 */

import { Colors } from '../src/constants/colors.ts';

const MIN_TEXT = 4.5; // WCAG 1.4.3, texto normal
const MIN_NON_TEXT = 3; // WCAG 1.4.11, componentes de interfaz

/** Superficies principales: todo token de texto debe leerse sobre las cinco. */
const MAIN_SURFACES = ['background', 'surface', 'surfaceRaised', 'surfaceSunken', 'locked'];

/** Tokens de texto e iconografía. */
const TEXT_TOKENS = [
  'text',
  'textSecondary',
  'textMuted',
  'navIdle',
  'primary',
  'xp',
  'streak',
  'victory',
  'defeat',
  'info',
  // Mismo valor que `text`, pero con nombre propio: es el rol «pasos», que el
  // diseño mantiene neutro a propósito. Se comprueba como texto porque la
  // cifra grande de pasos lo usa.
  'steps',
];

/** Superficies de cromo heredadas del scaffold, solo con texto a plena fuerza. */
const CHROME_SURFACES = ['backgroundElement', 'backgroundSelected'];
const CHROME_TEXT = ['text', 'textSecondary'];

/** Texto sobre relleno sólido. */
const SOLID_PAIRS = [
  ['onPrimary', 'primarySolid'],
  ['onXp', 'xpSolid'],
];

/**
 * Pares no textuales que deben distinguirse entre sí.
 *
 * Vacío desde que `xpTrack` pasó a ser translúcido (blanco al 7 %, tal y como
 * está medido en el diseño): esta comprobación solo sabe leer hex. La pareja
 * que había, relleno contra pista de la barra de XP, es de todas formas verde
 * brillante sobre casi negro — no era el par en riesgo.
 */
const NON_TEXT_PAIRS = [];

/**
 * Exentos.
 *
 * `border`, `borderStrong`, `overlay`, `dock`, `primaryEdge`,
 * `primaryEdgeStrong` y `rivalEdge` llevan alfa (`rgba(...)`): su contraste
 * depende de lo que haya debajo y esta comprobación (que solo sabe leer hex)
 * no puede evaluarlos. Por eso el diseño ya no tiene un "borde interactivo"
 * garantizado por token — ver docs/design.md § Bordes.
 *
 * `textDim` es de-enfatizado a propósito (labels de sección, contenido
 * bloqueado): no tiene que cumplir el mínimo de texto normal, igual que un
 * estado disabled.
 *
 * `primarySurface`, `rivalSurface`, `neutralSurface` y `xpTrack` son
 * rellenos teñidos: también llevan alfa, así que caen en el mismo caso que
 * los bordes. Lo que sí se comprueba es el texto que va encima, porque ese
 * texto se declara contra la superficie de debajo (`surface`), no contra el
 * tinte.
 */
const EXEMPT = [
  'border',
  'borderStrong',
  'overlay',
  'dock',
  'primaryEdge',
  'primaryEdgeStrong',
  'rivalEdge',
  'textDim',
  'primarySurface',
  'rivalSurface',
  'neutralSurface',
  'xpTrack',
  // Blanco al 10 %: alfa, igual que `xpTrack`, así que esta comprobación (que
  // solo sabe leer hex) no puede evaluarla.
  'meterTrack',
];

function channelLuminance(value) {
  const c = value / 255;
  return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

function relativeLuminance(hex) {
  const n = Number.parseInt(hex.slice(1), 16);
  return (
    0.2126 * channelLuminance((n >> 16) & 255) +
    0.7152 * channelLuminance((n >> 8) & 255) +
    0.0722 * channelLuminance(n & 255)
  );
}

function contrastRatio(foreground, background) {
  const a = relativeLuminance(foreground);
  const b = relativeLuminance(background);
  const [lighter, darker] = a > b ? [a, b] : [b, a];
  return (lighter + 0.05) / (darker + 0.05);
}

const failures = [];
const checks = [];

function check(scheme, tokens, foregroundKey, backgroundKey, minimum) {
  const foreground = tokens[foregroundKey];
  const background = tokens[backgroundKey];
  const ratio = contrastRatio(foreground, background);
  const passed = ratio >= minimum;
  const row = { scheme, foregroundKey, backgroundKey, ratio, minimum, passed };
  checks.push(row);
  if (!passed) failures.push(row);
}

function assertEveryTokenClassified(scheme, tokens) {
  const classified = new Set([
    ...MAIN_SURFACES,
    ...TEXT_TOKENS,
    ...CHROME_SURFACES,
    ...EXEMPT,
    ...SOLID_PAIRS.flat(),
    ...NON_TEXT_PAIRS.flat(),
  ]);
  const unclassified = Object.keys(tokens).filter((key) => !classified.has(key));
  if (unclassified.length > 0) {
    console.error(
      `\n[${scheme}] tokens sin clasificar en check-contrast.mjs: ${unclassified.join(', ')}\n` +
        'Añádelos a una de las listas (texto, superficie, sólido, no textual o exento).',
    );
    process.exitCode = 1;
  }
}

for (const [scheme, tokens] of Object.entries(Colors)) {
  assertEveryTokenClassified(scheme, tokens);

  for (const text of TEXT_TOKENS) {
    for (const surface of MAIN_SURFACES) check(scheme, tokens, text, surface, MIN_TEXT);
  }
  for (const text of CHROME_TEXT) {
    for (const surface of CHROME_SURFACES) check(scheme, tokens, text, surface, MIN_TEXT);
  }
  for (const [text, fill] of SOLID_PAIRS) check(scheme, tokens, text, fill, MIN_TEXT);
  for (const [a, b] of NON_TEXT_PAIRS) check(scheme, tokens, a, b, MIN_NON_TEXT);
}

for (const row of failures) {
  console.error(
    `FALLO  ${row.scheme}  ${row.foregroundKey} sobre ${row.backgroundKey}  ` +
      `${row.ratio.toFixed(2)}:1  (mínimo ${row.minimum}:1)`,
  );
}

const worst = checks.reduce((a, b) => (a.ratio < b.ratio ? a : b));
console.log(
  `${checks.length} pares comprobados, ${failures.length} fallos. ` +
    `Par más ajustado: ${worst.scheme} ${worst.foregroundKey}/${worst.backgroundKey} ` +
    `${worst.ratio.toFixed(2)}:1 (mínimo ${worst.minimum}:1).`,
);

if (failures.length > 0) process.exitCode = 1;
