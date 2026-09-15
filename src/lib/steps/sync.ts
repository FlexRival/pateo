/**
 * Sincroniza los pasos guardados en el teléfono con el servidor y dice si eso
 * hizo subir de nivel (KAN-50 + la migración de XP por pasos).
 *
 * Comparten esta función el sync en primer plano (`useSteps`, cuando se abre
 * la app) y la tarea en segundo plano (`background-task.ts`, cuando no lo
 * está): la única diferencia entre los dos es qué hacen con el resultado —
 * uno navega a `/level-up`, el otro dispara una notificación. Ninguno de los
 * dos vive aquí: esta función no sabe de React ni de notificaciones, solo
 * sincroniza y compara.
 */

import { daysAgoKey, readDailySteps, todayKey } from '@/lib/steps';
import { levelUpFrom } from '@/lib/xp';
import { profileRepository, SYNC_WINDOW_DAYS, stepsRepository } from '@/repositories';

export type SyncLevelUp = { fromLevel: number; toLevel: number };

/**
 * `null` si no hubo subida de nivel (lo normal) o si no hay sesión —esto
 * último puede pasar en la tarea en segundo plano si cae justo después de un
 * cierre de sesión y antes de que se desregistre.
 */
export async function syncStepsAndDetectLevelUp(): Promise<SyncLevelUp | null> {
  const profileBefore = await profileRepository.getCurrentProfile();

  if (!profileBefore) {
    return null;
  }

  const from = daysAgoKey(SYNC_WINDOW_DAYS);
  const to = todayKey();

  await stepsRepository.syncDailySteps(await readDailySteps(from, to));

  // Se invalida y se vuelve a pedir en vez de fiarse de `profileBefore`: el
  // propio sync acaba de escribir `xp`/`level` en el servidor si tocaba
  // (`sync_daily_steps`), y `profileBefore` es del caché de antes de eso.
  profileRepository.invalidate();
  const profileAfter = await profileRepository.getCurrentProfile();

  if (!profileAfter) {
    return null;
  }

  const levelUp = levelUpFrom(profileAfter.xp, profileAfter.xp - profileBefore.xp);

  return levelUp ? { fromLevel: levelUp.fromLevel, toLevel: levelUp.toLevel } : null;
}
