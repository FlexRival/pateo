/**
 * Tarea en segundo plano: sincroniza pasos con la app cerrada y, si eso hizo
 * subir de nivel, dispara una notificación local. Decisión del 15-sep-2026
 * que reabre "los pasos solo se sincronizan con la app abierta" de KAN-50.
 * Solo Android — v1 no tiene iOS (KAN-46).
 *
 * `TaskManager.defineTask` tiene que llamarse en el scope global del módulo,
 * nunca dentro de un componente: cuando WorkManager despierta la app en
 * segundo plano no hay árbol de React montado, solo se evalúa el bundle y se
 * ejecuta la tarea directamente. Por eso `src/app/_layout.tsx` importa este
 * archivo por su efecto secundario a nivel de módulo, fuera de cualquier
 * componente — así se registra en CADA arranque del JS, headless incluido.
 *
 * Restricciones reales, no ocultas:
 *   - `expo-background-task` corre sobre WorkManager: mínimo 15 minutos entre
 *     ejecuciones, y el momento exacto lo decide el sistema (oportunista, con
 *     more margen de maniobra en algunos fabricantes que otros).
 *   - Leer Health Connect con la app cerrada exige el permiso aparte
 *     `BackgroundAccessPermission` (`getBackgroundAccess` en
 *     `health-connect.ts`), que no todos los dispositivos conceden.
 *   - Sin ese permiso, sin Health Connect, o sin sesión: la tarea no hace
 *     nada ese ciclo. El sync al abrir la app (`useSteps`) sigue siendo el
 *     respaldo real — esto es una mejora sobre eso, no su sustituto.
 */

import { BackgroundTaskResult } from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { getBackgroundAccess } from '@/lib/steps/health-connect';
import { syncStepsAndDetectLevelUp } from '@/lib/steps/sync';
import { translate } from '@/lib/i18n';

export const STEPS_XP_BACKGROUND_TASK = 'steps-xp-background-sync';

/** Mismo canal que crea `useLevelUpNotifications` al conceder el permiso. */
export const LEVEL_UP_NOTIFICATION_CHANNEL = 'level-up';

TaskManager.defineTask(STEPS_XP_BACKGROUND_TASK, async () => {
  if (Platform.OS !== 'android') {
    // No debería registrarse nunca fuera de Android (ver `useLevelUpNotifications`),
    // pero si un registro sobreviviera a una actualización que cambiara la
    // plataforma soportada, no hacer nada es más seguro que fallar.
    return BackgroundTaskResult.Success;
  }

  try {
    const access = await getBackgroundAccess();

    if (access.status !== 'granted') {
      return BackgroundTaskResult.Success;
    }

    const levelUp = await syncStepsAndDetectLevelUp();

    if (levelUp) {
      await notifyLevelUp(levelUp.toLevel);
    }

    return BackgroundTaskResult.Success;
  } catch (error) {
    console.error('[steps-xp-background-task]', error);
    return BackgroundTaskResult.Failed;
  }
});

async function notifyLevelUp(toLevel: number): Promise<void> {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: translate('levelUpNotification.title', { level: toLevel }),
      body: translate('levelUpNotification.body'),
      data: { type: 'level-up', level: toLevel },
    },
    // Con canal explícito en vez de `trigger: null`: esta tarea solo corre en
    // Android, y el canal es donde vive la importancia (si suena, si vibra).
    trigger: { channelId: LEVEL_UP_NOTIFICATION_CHANNEL },
  });
}
