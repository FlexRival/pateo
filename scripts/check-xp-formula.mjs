/**
 * Comprueba que `LEVEL_BASE_XP`/`LEVEL_XP_STEP` en TypeScript siguen
 * coincidiendo con los mismos literales de `xp_for_level()` en el SQL. Se
 * ejecuta con `pnpm check:xp`.
 *
 * `src/lib/xp.ts` duplica la curva a propósito, porque la barra de XP no
 * puede llamar a una RPC por fotograma. El precio de esa decisión es que las
 * dos copias pueden separarse en silencio: los dos números están marcados
 * como placeholder en `supabase/SCHEMA.md`, así que es probable que alguien
 * los cambie. Si eso pasa y nadie toca el TypeScript, la barra de XP miente
 * sin dar ningún error.
 *
 * Solo compara `xp_for_level()` — la curva entera vive ahí. `level_for_xp()`
 * es su inversa por búsqueda binaria y no lleva ningún literal propio que
 * comprobar (`20260915120000_steps_xp_progressive_level.sql`).
 *
 * Carga `src/lib/xp.ts` directamente con Node, y por eso ese archivo no puede
 * tener imports.
 */

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { LEVEL_BASE_XP, LEVEL_XP_STEP } from '../src/lib/xp.ts';

const MIGRATION = fileURLToPath(
  new URL('../supabase/migrations/20260915120000_steps_xp_progressive_level.sql', import.meta.url),
);

const sql = readFileSync(MIGRATION, 'utf8');

const functionBody = sql.match(
  /CREATE OR REPLACE FUNCTION public\.xp_for_level[\s\S]*?AS \$\$([\s\S]*?)\$\$/,
);

if (!functionBody) {
  console.error(
    `No se encontró xp_for_level() en ${MIGRATION}.\n` +
      'Si la función se movió a otra migración, actualiza la ruta de este script.',
  );
  process.exit(1);
}

const body = functionBody[1];
const base = body.match(/(\d+)::BIGINT[^\n]*--\s*LEVEL_BASE_XP/);
const step = body.match(/(\d+)::BIGINT[^\n]*--\s*LEVEL_XP_STEP/);

if (!base || !step) {
  console.error(
    'xp_for_level() ya no marca sus dos literales con los comentarios ' +
      '`-- LEVEL_BASE_XP` / `-- LEVEL_XP_STEP` que este script busca.\n' +
      `Cuerpo encontrado:${body}\n` +
      'Revisa a mano si src/lib/xp.ts sigue reflejando la fórmula, y si ' +
      'sigue siendo así, actualiza los patrones de este script.',
  );
  process.exit(1);
}

const sqlBaseXp = Number(base[1]);
const sqlStepXp = Number(step[1]);

if (sqlBaseXp !== LEVEL_BASE_XP || sqlStepXp !== LEVEL_XP_STEP) {
  console.error(
    `Desajuste en la curva de XP.\n` +
      `  SQL  xp_for_level(): LEVEL_BASE_XP=${sqlBaseXp}, LEVEL_XP_STEP=${sqlStepXp}\n` +
      `  TS   xp.ts:          LEVEL_BASE_XP=${LEVEL_BASE_XP}, LEVEL_XP_STEP=${LEVEL_XP_STEP}\n` +
      'La barra de XP mostraría un progreso distinto al que calcula el servidor.\n' +
      'Pon src/lib/xp.ts al día con la migración.',
  );
  process.exit(1);
}

console.log(
  `Curva de XP alineada: SQL y TypeScript usan LEVEL_BASE_XP=${LEVEL_BASE_XP}, ` +
    `LEVEL_XP_STEP=${LEVEL_XP_STEP}.`,
);
