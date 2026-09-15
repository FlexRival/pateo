import * as BackgroundTask from 'expo-background-task';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import {
  LEVEL_UP_NOTIFICATION_CHANNEL,
  STEPS_XP_BACKGROUND_TASK,
} from '@/lib/steps/background-task';
import { requestBackgroundAccess } from '@/lib/steps/health-connect';

/**
 * WorkManager no dispara antes de este intervalo (suelo real de Android) —
 * pedir menos no lo hace más rápido, solo miente en la config.
 * `docs/healthkit-y-health-connect.md` / plan del 15-sep-2026.
 */
const MINIMUM_INTERVAL_MINUTES = 15;

export type LevelUpNotificationsState =
  | { status: 'loading' }
  /** Ni siquiera se ofrece: v1 es solo Android (KAN-46). */
  | { status: 'unavailable' }
  | { status: 'ready'; enabled: boolean };

export type LevelUpNotificationsError = 'notifications-denied' | 'background-denied' | null;

/**
 * El interruptor de "avísame aunque tenga la app cerrada" de Ajustes.
 *
 * Sin tabla de preferencias que guardar (a diferencia de los otros
 * conmutadores de `settings.tsx`, que son de mentira): el estado real es si
 * la tarea está registrada o no, y eso ya lo guarda el propio sistema —
 * `TaskManager`/`WorkManager` persiste el registro entre arranques.
 */
export function useLevelUpNotifications() {
  const [state, setState] = useState<LevelUpNotificationsState>({ status: 'loading' });
  const [error, setError] = useState<LevelUpNotificationsError>(null);

  const reload = useCallback(async () => {
    if (Platform.OS !== 'android') {
      setState({ status: 'unavailable' });
      return;
    }

    setState({ status: 'ready', enabled: await TaskManager.isTaskRegisteredAsync(STEPS_XP_BACKGROUND_TASK) });
  }, []);

  // Mismo patrón que `useSteps`/`useProfile`: un `subscribed` local en vez de
  // llamar a `reload` directo, para no dejar un `setState` colgado si el
  // componente se desmonta antes de que resuelva.
  useEffect(() => {
    let subscribed = true;

    async function sync() {
      if (Platform.OS !== 'android') {
        if (subscribed) setState({ status: 'unavailable' });
        return;
      }

      const enabled = await TaskManager.isTaskRegisteredAsync(STEPS_XP_BACKGROUND_TASK);
      if (subscribed) setState({ status: 'ready', enabled });
    }

    void sync();

    return () => {
      subscribed = false;
    };
  }, []);

  const setEnabled = useCallback(
    async (next: boolean) => {
      setError(null);

      if (!next) {
        await BackgroundTask.unregisterTaskAsync(STEPS_XP_BACKGROUND_TASK);
        await reload();
        return;
      }

      // Los dos permisos son independientes y hace falta preguntar los dos:
      // el de notificaciones (para poder ENSEÑAR el aviso) y el de background
      // de Health Connect (para poder LEER pasos sin la app abierta). Uno sin
      // el otro deja la tarea registrada pero inútil.
      const notificationPermission = await Notifications.requestPermissionsAsync();
      if (!notificationPermission.granted) {
        setError('notifications-denied');
        await reload();
        return;
      }

      const backgroundAccess = await requestBackgroundAccess();
      if (backgroundAccess.status !== 'granted') {
        setError('background-denied');
        await reload();
        return;
      }

      // Obligatorio desde Android 8 antes de que una notificación de este
      // canal pueda mostrarse — `setNotificationChannelAsync` lo crea si no
      // existe.
      await Notifications.setNotificationChannelAsync(LEVEL_UP_NOTIFICATION_CHANNEL, {
        name: 'Level up',
        importance: Notifications.AndroidImportance.HIGH,
      });

      await BackgroundTask.registerTaskAsync(STEPS_XP_BACKGROUND_TASK, {
        minimumInterval: MINIMUM_INTERVAL_MINUTES,
      });
      await reload();
    },
    [reload],
  );

  return { state, error, setEnabled };
}
