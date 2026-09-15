/**
 * Aritmética de XP y nivel.
 *
 * Espeja `xp_for_level` / `level_for_xp` de
 * `supabase/migrations/20260915120000_steps_xp_progressive_level.sql`. La
 * fórmula se duplica a propósito, aunque el esquema exponga las RPC al
 * cliente: la barra de XP se repinta en cada fotograma de la animación y no
 * puede pagar una ida y vuelta de red por fotograma.
 *
 * Esa duplicación es el riesgo real de este archivo, así que
 * `scripts/check-xp-formula.mjs` compara `LEVEL_BASE_XP`/`LEVEL_XP_STEP` con
 * el SQL y falla si se separan. Ejecútalo con `pnpm check:xp`.
 */

/**
 * Curva PROGRESIVA, no plana: el coste de cada nivel crece linealmente con el
 * nivel, así que el XP acumulado crece en cuadrática — más caro cada vez, sin
 * ser exponencial. `LEVEL_BASE_XP` = coste del nivel 1 -> 2. `LEVEL_XP_STEP` =
 * cuánto sube ese coste en cada nivel siguiente. Placeholders deliberados,
 * igual que en el SQL — `supabase/SCHEMA.md` los lista como pendientes de
 * ajustar.
 */
export const LEVEL_BASE_XP = 1000;
export const LEVEL_XP_STEP = 50;

/**
 * XP acumulado necesario para LLEGAR al nivel `level` (es decir, el XP con el
 * que `levelForXp` empieza a devolver ese nivel). Espeja `xp_for_level()` en
 * SQL — es la única función de las dos que `check-xp-formula.mjs` compara,
 * porque `levelForXp` es su inversa y no lleva ningún literal propio.
 */
export function xpForLevel(level: number): number {
  if (level <= 1) return 0;

  const k = level - 1;

  return LEVEL_BASE_XP * k + Math.floor((LEVEL_XP_STEP * k * (k - 1)) / 2);
}

/**
 * Inversa de `xpForLevel`. Estimación cerrada (resolviendo la cuadrática) más
 * una corrección por comparación directa contra `xpForLevel`: el SQL invierte
 * por búsqueda binaria en vez de `sqrt()`, así que aquí no hace falta que la
 * coma flotante coincida bit a bit entre Postgres y JS — solo que las dos
 * lleguen al mismo entero, y la corrección lo garantiza sea cual sea el punto
 * de partida.
 */
export function levelForXp(xp: number): number {
  const total = normalizeXp(xp);
  const a = LEVEL_XP_STEP / 2;
  const b = LEVEL_BASE_XP - LEVEL_XP_STEP / 2;
  const k = a === 0 ? total / b : (-b + Math.sqrt(b * b + 4 * a * total)) / (2 * a);

  let level = Math.max(1, Math.floor(k) + 1);

  while (xpForLevel(level + 1) <= total) level += 1;
  while (level > 1 && xpForLevel(level) > total) level -= 1;

  return level;
}

export type LevelProgress = {
  level: number;
  /** XP acumulado dentro del nivel actual. */
  xpIntoLevel: number;
  /** XP que hay que juntar para pasar de este nivel al siguiente. */
  xpForNextLevel: number;
  /** Fracción de 0 a 1, lista para el ancho de la barra. */
  ratio: number;
};

/** Todo lo que la barra de XP necesita para pintarse, desde un solo número. */
export function levelProgress(xp: number): LevelProgress {
  const total = normalizeXp(xp);
  const level = levelForXp(total);
  const levelStartXp = xpForLevel(level);
  const levelEndXp = xpForLevel(level + 1);
  const xpForNextLevel = levelEndXp - levelStartXp;

  return {
    level,
    xpIntoLevel: total - levelStartXp,
    xpForNextLevel,
    ratio: xpForNextLevel > 0 ? (total - levelStartXp) / xpForNextLevel : 1,
  };
}

/**
 * El esquema tiene `CHECK (xp >= 0)`, así que un valor negativo solo puede
 * venir de un bug. Se recorta en vez de propagar una barra de ancho negativo.
 */
function normalizeXp(xp: number): number {
  return Math.max(0, Math.floor(xp));
}

/**
 * XP que se lleva quien gana un duelo.
 *
 * Espeja `xp += floor(pasos_ganador / 10)` de `resolve_duel`
 * (`supabase/SCHEMA.md` §7). Igual que la curva de nivel, se duplica a
 * propósito: la pantalla de victoria enseña la cifra antes de volver a
 * consultar al servidor, y el cálculo real ya lo hizo Postgres. No cambia con
 * esta migración — solo se le suma el XP de pasos, no se le toca el suyo.
 */
export const STEPS_PER_XP = 10;

export function xpForDuelWin(winnerSteps: number): number {
  return Math.floor(normalizeXp(winnerSteps) / STEPS_PER_XP);
}

/**
 * Si un delta de XP hizo subir de nivel, comparando el nivel antes y después.
 *
 * Compartido entre duelos (`src/lib/duel-result.ts`) y pasos
 * (`src/hooks/use-steps.ts`): los dos derivan la subida en vez de que el
 * servidor la mande explícita, porque `resolve_duel` y `sync_daily_steps`
 * devuelven el XP ya sumado, no el "antes" y el "después" por separado.
 */
export function levelUpFrom(
  currentXp: number,
  xpEarned: number,
): { fromLevel: number; toLevel: number; reward: string | null } | null {
  if (xpEarned <= 0) {
    return null;
  }

  const before = levelForXp(currentXp - xpEarned);
  const after = levelForXp(currentXp);

  if (after <= before) {
    return null;
  }

  // Sin recompensa: el diseño reserva una card para ello, pero no existe el
  // sistema que la llene. Ver `LevelUp.reward` en `level-up.ts`.
  return { fromLevel: before, toLevel: after, reward: null };
}
