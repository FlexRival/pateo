import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';
import { AppState } from 'react-native';

/**
 * Vuelve a pedir los datos cuando el usuario regresa: a la pantalla o a la app.
 *
 * Los hooks de datos (`useDuels`, `useFriendships`) cargan una sola vez al
 * montarse y solo se resincronizan si cambia la sesión. Eso deja una lista
 * congelada: un duelo o una solicitud que llega mientras la app está abierta no
 * aparece hasta cerrarla y volver a abrirla, porque solo entonces se remonta.
 *
 * Aquí se cubren los dos regresos que sí ocurren en la práctica:
 *
 *  - **Volver a la pantalla** (`useFocusEffect`): cambiar de pestaña y volver.
 *    Se salta el primer foco a propósito —coincide con el montaje, y el hook ya
 *    está cargando por su cuenta en ese momento; sin el salto, cada arranque
 *    pediría los datos dos veces.
 *  - **Volver a la app** (`AppState` → `active`): traerla desde segundo plano.
 *
 * La suscripción a `AppState` se monta **dentro** del efecto de foco, así que
 * solo escucha la pantalla visible. Si no, al volver a la app recargarían a la
 * vez las tres pantallas que usan `useDuels`, y cada `reload` son varias
 * peticiones.
 *
 * Lo que NO cubre: quedarse quieto en la pantalla. Para que entre solo, sin que
 * el usuario toque nada, haría falta Realtime de Supabase o un sondeo.
 *
 * @param refresh Callback estable (envuélvelo en `useCallback`).
 */
export function useRefreshOnReturn(refresh: () => void | Promise<void>) {
  const hasFocusedBefore = useRef(false);

  useFocusEffect(
    useCallback(() => {
      if (hasFocusedBefore.current) {
        void refresh();
      } else {
        hasFocusedBefore.current = true;
      }

      const subscription = AppState.addEventListener('change', (status) => {
        if (status === 'active') {
          void refresh();
        }
      });

      return () => {
        subscription.remove();
      };
    }, [refresh]),
  );
}
