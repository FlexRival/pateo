/**
 * Contrato de sincronización de pasos. Ni este archivo ni quien lo consuma
 * saben que detrás hay Supabase — eso vive en `supabase/steps-repository.ts`.
 *
 * El reparto de trabajo con `src/lib/steps/` es deliberado: aquella capa LEE
 * del teléfono, esta ESCRIBE en el servidor. Se pueden probar por separado y,
 * si algún día cambia el backend, la lectura de pasos no se entera.
 */

import type { DailySteps } from '@/lib/steps/types';

/**
 * Cuántos días hacia atrás sincroniza la app.
 *
 * Espeja `step_sync_backfill_days()` en
 * `20260906130000_step_sync_anticheat.sql`. Se duplica a propósito: no tiene
 * sentido gastar una petición en días que el servidor va a descartar, ni leer
 * del teléfono un histórico que después no se puede subir.
 *
 * Si los dos valores se desincronizan no se rompe nada: el servidor manda, y
 * su ventana lleva un día de margen a cada lado (`± 1` por husos horarios),
 * así que esta ventana local siempre cabe dentro de la suya. Un valor de más
 * aquí solo hace que el servidor se salte esos días; uno de menos desaprovecha
 * histórico. Aun así, conviene cambiarlos a la vez.
 *
 * Vive en el contrato y no en la implementación de Supabase porque también lo
 * necesita quien **lee del teléfono** (`useSteps`), y esa capa no puede
 * importar nada del backend (skill `repository-pattern`, regla 1).
 */
export const SYNC_WINDOW_DAYS = 7;

/** Qué pasó al intentar subir un día. */
export type StepSyncOutcome = {
  date: string;
  /** Lo que el servidor guardó de verdad, que puede no ser lo que se mandó. */
  storedSteps: number;
  /**
   * `true` si el servidor recortó la cifra por el tope diario
   * (`daily_step_cap()`). La app no debería enseñar un número que el servidor
   * no acepta: el marcador del duelo va a usar el recortado.
   */
  capped: boolean;
};

/**
 * Entre qué dos cifras puede moverse el reto diario. Las dicta el servidor;
 * ver `getStepGoalBounds`.
 */
export type StepGoalBounds = {
  min: number;
  max: number;
};

export interface StepsRepository {
  /**
   * Sube un rango de días ya leídos del teléfono.
   *
   * El servidor **es la autoridad** sobre lo que se guarda: recorta por el
   * tope diario, rechaza fechas fuera de la ventana sincronizable y nunca deja
   * que una lectura menor pise a una mayor del mismo día. Por eso devuelve lo
   * que quedó guardado en vez de un `void`: es lo único de lo que la app se
   * puede fiar para pintar.
   *
   * Los días fuera de la ventana que acepta el servidor se descartan **antes**
   * de la llamada, no se mandan para que los rechace. Y si alguno se cuela —el
   * cliente y el servidor calculan «hoy» en husos distintos—, el servidor lo
   * salta sin tumbar el resto: **puede devolver menos días de los enviados**, y
   * lo que vuelve es lo único que se ha guardado de verdad.
   */
  syncDailySteps(days: DailySteps[]): Promise<StepSyncOutcome[]>;

  /** Los pasos que el servidor tiene guardados para el usuario de la sesión. */
  getStoredSteps(from: string, to: string): Promise<StepSyncOutcome[]>;

  /**
   * El reto diario de pasos **del usuario de la sesión**.
   *
   * Se pregunta en vez de calcularla en la app porque es **la misma cifra que
   * decide la racha** (`recompute_streak`, `supabase/SCHEMA.md` §8): una meta
   * local distinta enseñaría un objetivo cumplido junto a una racha que no
   * sube.
   *
   * Desde `20260916120000_daily_goal_streaks_bonus.sql` ya no es una constante
   * global: cada usuario elige la suya entre los límites que da
   * `getStepGoalBounds()`.
   */
  getDailyStepGoal(): Promise<number>;

  /**
   * Cambia el reto diario y devuelve el que quedó guardado.
   *
   * No es solo un `UPDATE`: el servidor resella además la meta de hoy y
   * recalcula la racha en la misma operación, porque acaba de cambiar el
   * criterio con el que se mide. Una meta fuera de los límites llega como
   * `RepositoryError`.
   */
  setDailyStepGoal(goal: number): Promise<number>;

  /**
   * Entre qué dos cifras puede moverse el reto.
   *
   * Los decide el servidor (`min_daily_step_goal()` / `max_daily_step_goal()`)
   * por lo mismo que la meta: son placeholders tuneables, y si la app los
   * duplicara, subirlos obligaría a publicar una versión nueva para que el
   * selector dejara de rechazar lo que el servidor ya acepta.
   */
  getStepGoalBounds(): Promise<StepGoalBounds>;

  /**
   * Todos los pasos que el servidor tiene guardados del usuario, sumados.
   *
   * Lo suma el servidor y no la app a propósito: el histórico crece sin techo
   * con cada día jugado, y traérselo entero para sumarlo en el cliente gastaría
   * una petición cada vez mayor para acabar enseñando un solo número.
   */
  getTotalSteps(): Promise<number>;
}
