import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { LevelUpBadge } from '@/components/molecules/level-up-badge';
import { ThemedText } from '@/components/atoms/themed-text';
import { ThemedView } from '@/components/atoms/themed-view';
import { XpBar } from '@/components/molecules/xp-bar';
import { ROUTES } from '@/constants/routes';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { parseLevelUp } from '@/lib/level-up';

/**
 * Celebración de subida de nivel.
 *
 * Se abre con el nivel anterior y el nuevo en la URL
 * (`/level-up?from=11&to=12`, más un `reward` opcional). No consulta al
 * backend: cuando esta pantalla se ve, el XP ya está contado y guardado —
 * `resolve_duel` lo hizo en el servidor.
 *
 * La barra de XP se llena hasta el tope porque celebra el nivel que se acaba
 * de completar, no el progreso dentro del nuevo.
 *
 * El hueco del personaje queda reservado en el layout pero vacío: el render
 * del avatar es KAN-19 y todavía no hay primitivo para él.
 */
export default function LevelUpScreen() {
  const params = useLocalSearchParams();
  const levelUp = parseLevelUp(params);

  // Un enlace sin niveles válidos no tiene nada que celebrar. El diseño no
  // define un estado de error para esta pantalla, así que se sale a la
  // principal en vez de inventarse uno.
  if (!levelUp) {
    return <Redirect href={ROUTES.home.href} />;
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.celebration}>
          <ThemedText type="label" themeColor="primary">
            LEVEL UP
          </ThemedText>

          <LevelUpBadge fromLevel={levelUp.fromLevel} toLevel={levelUp.toLevel} />

          {/* Hueco del personaje (KAN-19): reserva el espacio del diseño. */}
          <Card style={styles.characterSlot} />

          {/* Llena a propósito: celebra el nivel que se acaba de completar, no el
              progreso dentro del nuevo. El coste de nivel ya no es fijo (curva
              progresiva), así que "lleno" es value === max, no un XP_PER_LEVEL. */}
          <XpBar value={1} max={1} label={null} revealOnMount style={styles.xpBar} />

          {levelUp.reward ? (
            <Card variant="highlight" style={styles.reward}>
              <ThemedText type="label" themeColor="primary">
                NEW REWARD
              </ThemedText>
              <ThemedText type="small">{levelUp.reward}</ThemedText>
            </Card>
          ) : null}
        </View>

        <Button label="Continue" onPress={dismiss} style={styles.continue} />
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Vuelve por donde se vino. Si la pantalla se abrió desde un enlace externo no
 * hay historial al que volver, así que cae a la pantalla principal.
 */
function dismiss() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(ROUTES.home.href);
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    alignSelf: 'center',
    justifyContent: 'space-between',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
  },
  celebration: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.four,
  },
  characterSlot: {
    width: '100%',
    aspectRatio: 1,
  },
  xpBar: {
    width: '100%',
  },
  reward: {
    width: '100%',
    gap: Spacing.two,
  },
  continue: {
    marginTop: Spacing.four,
  },
});
