/**
 * Stub iOS de `healthConnectReader`. Existe por el mismo motivo que
 * `storage.web.ts` o `revenuecat/subscription-repository.web.ts`: que la
 * plataforma que no tiene el módulo nativo ni llegue a cargarlo.
 *
 * Aquí no es una precaución teórica. `react-native-health-connect` resuelve su
 * módulo con `Platform.select({ android: require('./NativeHealthConnect') })`,
 * y el objeto literal se construye **antes** de que `Platform.select` elija:
 * el `require` se ejecuta también en iOS y acaba en
 * `TurboModuleRegistry.getEnforcing('HealthConnect')`, que lanza porque ese
 * módulo solo existe en Android. Como `index.ts` importa los dos lectores de
 * forma estática, bastaba con abrir la app en iOS para que el bundle muriera
 * al cargar — en Expo Go y en un dev build por igual.
 *
 * No es una pérdida de funcionalidad: Health Connect es una app de Android y
 * en iOS el lector que se usa es siempre el podómetro (`readerForPlatform`).
 * Si algo llamara a esto, es un error de enrutado de plataforma, no un
 * dispositivo sin permisos — por eso lanza en vez de devolver `unavailable`.
 */

import type { DailySteps, StepsAccess, StepsReader } from '@/lib/steps/types';

const ONLY_ANDROID = 'Health Connect es solo de Android; en iOS los pasos vienen del podómetro.';

export const healthConnectReader: StepsReader = {
  source: 'health-connect',

  getAccess(): Promise<StepsAccess> {
    throw new Error(ONLY_ANDROID);
  },

  requestAccess(): Promise<StepsAccess> {
    throw new Error(ONLY_ANDROID);
  },

  readDailySteps(): Promise<DailySteps[]> {
    throw new Error(ONLY_ANDROID);
  },
};
