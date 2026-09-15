/**
 * El resultado de un duelo ya cerrado, listo para pintarlo.
 *
 * Antes esto se leía de la URL (`/victory?opponent=…&steps=…`). Ya no: desde
 * KAN-32 el duelo existe de verdad en el servidor, así que la pantalla lo carga
 * por su id y esta capa solo deriva lo que no está guardado —el XP y si hubo
 * subida de nivel—, sin volver a preguntar.
 *
 * Nada de esto habla con el backend: es aritmética sobre un `Duel` que ya vino
 * del repositorio.
 */

import type { LevelUp } from '@/lib/level-up';
import { levelUpFrom, xpForDuelWin } from '@/lib/xp';
import type { Duel, DuelOutcome } from '@/repositories';

export type DuelResult = {
  duel: Duel;
  outcome: DuelOutcome;
  /** XP que se llevó el usuario. `0` si perdió o empató: solo gana el ganador. */
  xpEarned: number;
  /** `null` si el duelo no le hizo cambiar de nivel. */
  levelUp: LevelUp | null;
};

/**
 * Traduce un duelo cerrado a lo que enseña la pantalla de resultado, o `null`
 * si ese duelo todavía no ha terminado — no hay nada que contar de un duelo en
 * marcha, y celebrarlo antes de tiempo sería mentir.
 *
 * El nivel «de antes» se deduce restando el XP de este duelo al XP que tiene
 * el perfil **ahora** (`levelUpFrom`, en `lib/xp.ts`), en vez de pasarlo por
 * la URL: un parámetro se puede quedar viejo o falsear, y el XP del perfil ya
 * lo escribió `resolve_duel` en el mismo momento que el resultado.
 *
 * Límite conocido: si el jugador cierra **dos** duelos ganados a la vez —al
 * abrir la app después de varios días—, restar solo el XP de este duelo puede
 * situar el nivel «de antes» más arriba de lo que estaba, y entonces la subida
 * no se celebra. Se prefiere callar una subida real a inventar una que no fue.
 */
export function duelResultFor(duel: Duel, currentXp: number): DuelResult | null {
  if (duel.status !== 'finished' || duel.outcome === null) {
    return null;
  }

  const xpEarned = duel.outcome === 'win' ? xpForDuelWin(duel.yourSteps) : 0;

  return {
    duel,
    outcome: duel.outcome,
    xpEarned,
    levelUp: levelUpFrom(currentXp, xpEarned),
  };
}
