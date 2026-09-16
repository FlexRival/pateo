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

import {
  dailyGoalBonusXp,
  GOAL_BONUS_HALF_STEPS,
  GOAL_BONUS_MAX_XP,
  LEVEL_BASE_XP,
  LEVEL_XP_STEP,
} from '../src/lib/xp.ts';

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

// ---------------------------------------------------------------------------
// Bonus por cumplir el reto diario.
//
// Mismo problema y misma defensa que la curva de nivel: `dailyGoalBonusXp()`
// en TypeScript duplica `daily_goal_bonus_xp()` del SQL para que la pantalla
// principal pueda anticipar el bonus sin llamar al servidor. Si alguien tunea
// la hipérbola en la migración y no toca el TypeScript, la app promete un
// bonus que no es el que otorga `sync_daily_steps`.
// ---------------------------------------------------------------------------
const GOAL_MIGRATION = fileURLToPath(
  new URL('../supabase/migrations/20260916120000_daily_goal_streaks_bonus.sql', import.meta.url),
);

const goalSql = readFileSync(GOAL_MIGRATION, 'utf8');

const goalBody = goalSql.match(
  /CREATE OR REPLACE FUNCTION public\.daily_goal_bonus_xp[\s\S]*?AS \$fn\$([\s\S]*?)\$fn\$/,
);

if (!goalBody) {
  console.error(
    `No se encontró daily_goal_bonus_xp() en ${GOAL_MIGRATION}.\n` +
      'Si la función se movió a otra migración, actualiza la ruta de este script.',
  );
  process.exit(1);
}

const maxBonus = goalBody[1].match(/(\d+)::BIGINT[^\n]*--\s*GOAL_BONUS_MAX_XP/);
const halfBonus = goalBody[1].match(/(\d+)::BIGINT[^\n]*--\s*GOAL_BONUS_HALF_STEPS/);

if (!maxBonus || !halfBonus) {
  console.error(
    'daily_goal_bonus_xp() ya no marca sus dos literales con los comentarios ' +
      '`-- GOAL_BONUS_MAX_XP` / `-- GOAL_BONUS_HALF_STEPS` que este script busca.\n' +
      `Cuerpo encontrado:${goalBody[1]}\n` +
      'Revisa a mano si src/lib/xp.ts sigue reflejando la fórmula, y si ' +
      'sigue siendo así, actualiza los patrones de este script.',
  );
  process.exit(1);
}

const sqlMaxBonus = Number(maxBonus[1]);
const sqlHalfBonus = Number(halfBonus[1]);

if (sqlMaxBonus !== GOAL_BONUS_MAX_XP || sqlHalfBonus !== GOAL_BONUS_HALF_STEPS) {
  console.error(
    `Desajuste en el bonus del reto diario.\n` +
      `  SQL  daily_goal_bonus_xp(): GOAL_BONUS_MAX_XP=${sqlMaxBonus}, GOAL_BONUS_HALF_STEPS=${sqlHalfBonus}\n` +
      `  TS   xp.ts:                 GOAL_BONUS_MAX_XP=${GOAL_BONUS_MAX_XP}, GOAL_BONUS_HALF_STEPS=${GOAL_BONUS_HALF_STEPS}\n` +
      'La app prometería un bonus distinto al que otorga sync_daily_steps.\n' +
      'Pon src/lib/xp.ts al día con la migración.',
  );
  process.exit(1);
}

// La igualdad de literales no basta: la hipérbola se evalúa con división
// ENTERA en los dos lados (`/` de Postgres sobre BIGINT, `Math.floor` en JS) y
// es justo donde se colaría una diferencia de redondeo. Se comprueba la
// función entera sobre el rango real de metas.
const MIN_GOAL = 2000;
const MAX_GOAL = 30000;

for (let goal = MIN_GOAL; goal <= MAX_GOAL; goal += 100) {
  const expected = Math.floor((sqlMaxBonus * goal) / (goal + sqlHalfBonus));

  if (dailyGoalBonusXp(goal) !== expected) {
    console.error(
      `dailyGoalBonusXp(${goal}) = ${dailyGoalBonusXp(goal)}, pero la fórmula ` +
        `del SQL da ${expected}. Las dos implementaciones han divergido.`,
    );
    process.exit(1);
  }
}

// La propiedad de producto, no solo la aritmética: el bonus tiene que CRECER
// con la meta (ponerse un reto mayor nunca puede rentar menos) y SATURAR por
// debajo de su asíntota. Si alguien tunea los literales a algo que rompa
// cualquiera de las dos, el incentivo se invierte en silencio.
for (let goal = MIN_GOAL; goal < MAX_GOAL; goal += 100) {
  if (dailyGoalBonusXp(goal + 100) < dailyGoalBonusXp(goal)) {
    console.error(
      `El bonus deja de crecer con la meta entre ${goal} y ${goal + 100} pasos: ` +
        'ponerse un reto mayor daría menos XP que uno menor.',
    );
    process.exit(1);
  }
}

if (dailyGoalBonusXp(MAX_GOAL) >= GOAL_BONUS_MAX_XP) {
  console.error(
    `El bonus con la meta máxima (${dailyGoalBonusXp(MAX_GOAL)}) alcanza su ` +
      `asíntota (${GOAL_BONUS_MAX_XP}): la curva ha dejado de saturar.`,
  );
  process.exit(1);
}

console.log(
  `Bonus del reto alineado: GOAL_BONUS_MAX_XP=${GOAL_BONUS_MAX_XP}, ` +
    `GOAL_BONUS_HALF_STEPS=${GOAL_BONUS_HALF_STEPS} ` +
    `(meta ${MIN_GOAL} → ${dailyGoalBonusXp(MIN_GOAL)} XP, ` +
    `meta ${MAX_GOAL} → ${dailyGoalBonusXp(MAX_GOAL)} XP).`,
);
