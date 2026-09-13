import * as Linking from 'expo-linking';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { ThemedText } from '@/components/atoms/themed-text';
import { ThemedView } from '@/components/atoms/themed-view';
import { ROUTES } from '@/constants/routes';
import { MaxContentWidth, Spacing } from '@/constants/theme';
import { useTranslation } from '@/hooks/use-translation';
import { LEGAL_CONTACT } from '@/lib/legal/types';

/**
 * Cómo borrar la cuenta sin tener la app instalada.
 *
 * Google Play exige esta ruta para cualquier app con creación de cuentas: una
 * página alcanzable sin sesión y, en cuanto se publique el build web en un
 * dominio real (pendiente de KAN-56, ver `docs/legal.md`), sin instalar la
 * app. Por eso vive fuera de los dos `Stack.Protected`, igual que `/privacy` y
 * `/terms`.
 *
 * No hace nada por sí misma: `deleteAccount()` exige una sesión de Supabase
 * autenticada, así que esta pantalla no puede disparar el borrado — solo
 * explica el camino de dentro de la app y ofrece escribir por correo para
 * quien no la tiene. Es justo lo que la política de privacidad (sección 8)
 * promete, ni más ni menos.
 */
export default function DeleteAccountScreen() {
  const { t } = useTranslation();

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
          <View style={styles.header}>
            <Button label={t('common.back')} variant="secondary" onPress={goBack} />
          </View>

          <View style={styles.titleBlock}>
            <ThemedText type="heading">{t('deleteAccount.title')}</ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="subheading">{t('deleteAccount.withAppTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('deleteAccount.withAppBody')}
            </ThemedText>
          </View>

          <View style={styles.section}>
            <ThemedText type="subheading">{t('deleteAccount.withoutAppTitle')}</ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              {t('deleteAccount.withoutAppBody')}
            </ThemedText>
            <Button label={t('deleteAccount.emailButton')} onPress={openEmail} />
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );

  function openEmail() {
    const subject = encodeURIComponent(t('deleteAccount.emailSubject'));
    const body = encodeURIComponent(t('deleteAccount.emailBody'));
    void Linking.openURL(`mailto:${LEGAL_CONTACT.email}?subject=${subject}&body=${body}`);
  }
}

/**
 * Vuelve por donde se vino; si no hay historial, a la pantalla principal.
 *
 * Igual que en `LegalDocumentView`: quien llega aquí puede no tener ninguna
 * pantalla debajo a la que volver (un enlace suelto en un correo, por
 * ejemplo), así que hace falta el mismo respaldo.
 */
function goBack() {
  if (router.canGoBack()) {
    router.back();
    return;
  }

  router.replace(ROUTES.home.href);
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    gap: Spacing.three,
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    paddingBottom: Spacing.six,
    width: '100%',
    alignSelf: 'center',
  },
  header: { alignItems: 'flex-start' },
  titleBlock: { gap: Spacing.one },
  section: { gap: Spacing.two },
});
