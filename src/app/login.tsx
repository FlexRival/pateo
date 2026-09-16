import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { Card } from '@/components/atoms/card';
import { ThemedText } from '@/components/atoms/themed-text';
import { ThemedView } from '@/components/atoms/themed-view';
import { Notice } from '@/components/molecules/notice';
import { SegmentedControl, type SegmentedOption } from '@/components/molecules/segmented-control';
import { TextField } from '@/components/molecules/text-field';
import { ROUTES } from '@/constants/routes';
import { Gradients, MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { signupConfirmationRedirectUrl } from '@/hooks/use-auth-link';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { MIN_PASSWORD_LENGTH } from '@/lib/password';
import { profileRepository, RepositoryError } from '@/repositories';

type Mode = 'signIn' | 'signUp';

/** La función de traducir, para las ayudantes que viven fuera del componente. */
type Translate = ReturnType<typeof useTranslation>['t'];

/**
 * Las dos pestañas. Es función y no constante de módulo porque su texto
 * cambia con el idioma: una constante se congelaría en el idioma que hubiera
 * al cargar el archivo.
 */
function modeOptions(t: Translate): SegmentedOption<Mode>[] {
  return [
    { value: 'signIn', label: t('login.signIn') },
    { value: 'signUp', label: t('login.signUp') },
  ];
}

/**
 * Puerta de entrada sin sesión. `src/app/_layout.tsx` la muestra en vez de
 * `(tabs)` mientras no haya sesión (`Stack.Protected`) — un login exitoso no
 * navega a mano: en cuanto `signInWithPassword`/`signUp` crea sesión,
 * `useProfile()` lo nota vía `onAuthStateChange` y el layout raíz cambia
 * solo. Tras crear cuenta, lo que aparece es el alta guiada
 * (`/onboarding`), porque `onboarded_at` todavía viene a `null`.
 *
 * Es la primera pantalla que ve alguien que llega desde un TikTok, así que
 * carga con el trabajo de explicar de qué va esto: la marca arriba, el
 * reclamo, y los tres argumentos en una línea cada uno. El formulario va
 * dentro de una `Card` para que se lea como una sola pieza y no como campos
 * sueltos flotando sobre el fondo.
 */
export default function LoginScreen() {
  const [mode, setMode] = useState<Mode>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [username, setUsername] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);

  const { t } = useTranslation();

  const canSubmit =
    !submitting &&
    email.trim().length > 0 &&
    // Al entrar vale cualquier longitud: la contraseña ya existe y quien
    // manda es el servidor. El mínimo solo aplica a la que se está creando.
    (mode === 'signIn' ? password.length > 0 : password.length >= MIN_PASSWORD_LENGTH) &&
    (mode === 'signIn' || username.trim().length >= 3);

  async function handleSubmit() {
    setError(null);
    setInfo(null);
    setSubmitting(true);

    try {
      if (mode === 'signIn') {
        await profileRepository.signInWithPassword(email.trim(), password);
      } else {
        const { needsEmailConfirmation } = await profileRepository.signUp(
          email.trim(),
          password,
          username.trim(),
          signupConfirmationRedirectUrl(),
        );

        if (needsEmailConfirmation) {
          setInfo(t('login.confirmEmail'));
        }
      }
    } catch (caught) {
      setError(caught instanceof RepositoryError ? caught.message : t('common.somethingWentWrong'));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
<<<<<<< HEAD
          <BrandHeader tagline={t('login.tagline')} />
=======
          <View style={styles.brand}>
            <ThemedText type="title" style={styles.centered}>
              PATEO
            </ThemedText>
            <ThemedText type="small" themeColor="textMuted" style={styles.centered}>
              {t('login.tagline')}
            </ThemedText>
          </View>
>>>>>>> 54d9138bc9d01025cfb41a2175a4f5bb6753ebb5

          <Card style={styles.form}>
            <SegmentedControl options={modeOptions(t)} value={mode} onChange={setMode} />

            <View style={styles.fields}>
              {mode === 'signUp' && (
                <TextField
                  label={t('login.username')}
                  value={username}
                  onChangeText={setUsername}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder={t('login.usernamePlaceholder')}
                />
              )}

              <TextField
                label={t('login.email')}
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                placeholder={t('login.emailPlaceholder')}
              />

              <TextField
                label={t('login.password')}
                value={password}
                onChangeText={setPassword}
                secureTextEntry
                revealable
                placeholder="••••••••"
              />

              {/*
                Solo al crear cuenta: en «sign in» la contraseña ya existe y
                recordarle el mínimo a quien solo intenta entrar es ruido.
              */}
              {mode === 'signUp' ? (
                <ThemedText type="caption" themeColor="textDim">
                  {t('login.passwordHint', { count: MIN_PASSWORD_LENGTH })}
                </ThemedText>
              ) : null}
            </View>

            {error ? <Notice tone="rival" message={error} /> : null}
            {info ? <Notice tone="info" message={info} /> : null}

            <Button
              label={submitLabel(t, mode, submitting)}
              onPress={handleSubmit}
              disabled={!canSubmit}
            />

            {/*
              Solo al entrar: a quien está creando una cuenta no se le ofrece
              recuperar una que todavía no tiene.
            */}
            {mode === 'signIn' ? (
              <Button
                label={t('login.forgotPassword')}
                variant="ghost"
                onPress={() => router.push(ROUTES.forgotPassword.href)}
              />
            ) : null}
          </Card>

          {/*
            Los tres argumentos, debajo del formulario y no encima: quien ya
            tiene cuenta viene a entrar, no a que le vendan la app otra vez.
          */}
          {mode === 'signUp' ? <SellingPoints /> : null}

          <LegalFooter mode={mode} />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

/**
 * Marca: el icono real de la app, el nombre y el reclamo.
 *
 * El icono se importa de `assets/images/` en vez de dibujar un logotipo a
 * mano aquí — es el mismo que verá en la pantalla de inicio del teléfono, y
 * que coincidan es media identidad de marca.
 */
function BrandHeader({ tagline }: { tagline: string }) {
  const theme = useTheme();

  return (
    <View style={styles.brand}>
      <View style={[styles.markWrap, { borderColor: theme.primaryEdge }]}>
        <Image
          source={require('@/assets/images/icon.png')}
          style={styles.mark}
          contentFit="contain"
        />
      </View>

      <ThemedText type="title" style={styles.centered}>
        PATEO
      </ThemedText>

      {/* Regla de marca: la única pincelada de color saturado de la pantalla. */}
      <LinearGradient
        colors={Gradients.power}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.rule}
      />

      <ThemedText type="small" themeColor="textMuted" style={styles.centered}>
        {tagline}
      </ThemedText>
    </View>
  );
}

/**
 * Qué se lleva quien se registra, en tres líneas.
 *
 * Son texto y no iconos: la app no tiene un set de iconografía propio (solo
 * los glifos nativos de las pestañas), y meter emojis aquí chocaría con una
 * pantalla que por lo demás es puramente tipográfica.
 */
function SellingPoints() {
  const { t } = useTranslation();

  return (
    <View style={styles.points}>
      {(['points1', 'points2', 'points3'] as const).map((key) => (
        <View key={key} style={styles.point}>
          <ThemedText type="smallBold" themeColor="primary">
            ·
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.pointText}>
            {t(`login.${key}`)}
          </ThemedText>
        </View>
      ))}
    </View>
  );
}

/**
 * Enlaces legales. Aparecen siempre, pero el texto cambia: al crear cuenta se
 * están **aceptando**, y decirlo es requisito, no cortesía (`docs/legal.md`).
 *
 * Las dos rutas viven fuera de los `Stack.Protected` justo para que se puedan
 * abrir desde aquí, sin sesión — ver `_layout.tsx`.
 */
function LegalFooter({ mode }: { mode: Mode }) {
  const { t } = useTranslation();

  return (
    <View style={styles.legal}>
      {mode === 'signUp' ? (
        <ThemedText type="caption" themeColor="textDim" style={styles.centered}>
          {t('login.legalIntro')}
        </ThemedText>
      ) : null}

      <View style={styles.legalLinks}>
        <Pressable onPress={() => router.push(ROUTES.terms.href)} accessibilityRole="link">
          <ThemedText type="caption" themeColor="textMuted">
            {t('login.terms')}
          </ThemedText>
        </Pressable>

        <ThemedText type="caption" themeColor="textDim">
          ·
        </ThemedText>

        <Pressable onPress={() => router.push(ROUTES.privacy.href)} accessibilityRole="link">
          <ThemedText type="caption" themeColor="textMuted">
            {t('login.privacy')}
          </ThemedText>
        </Pressable>
      </View>
    </View>
  );
}

/**
 * El botón es el único sitio donde se ve que la petición está en marcha:
 * deshabilitarlo sin más deja la pantalla igual que si no hubiera pasado
 * nada, y el usuario vuelve a pulsar.
 */
function submitLabel(t: Translate, mode: Mode, submitting: boolean): string {
  if (mode === 'signIn') {
    return t(submitting ? 'login.signingIn' : 'login.signIn');
  }

  return t(submitting ? 'login.creatingAccount' : 'login.createAccount');
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  safeArea: { flex: 1 },
  content: {
    flexGrow: 1,
    justifyContent: 'center',
    alignSelf: 'center',
    width: '100%',
    maxWidth: MaxContentWidth,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  brand: { alignItems: 'center', gap: Spacing.two },
  markWrap: {
    width: 72,
    height: 72,
    borderRadius: Radius.xl,
    borderWidth: 1,
    overflow: 'hidden',
  },
  mark: { width: '100%', height: '100%' },
  rule: { width: 56, height: 2, borderRadius: Radius.pill },
  centered: { textAlign: 'center' },
  form: { gap: Spacing.three },
  fields: { gap: Spacing.three },
  points: { gap: Spacing.two, paddingHorizontal: Spacing.two },
  point: { flexDirection: 'row', gap: Spacing.two },
  // Sin esto, una línea larga desborda en vez de partirse: en una fila, el
  // texto no se encoge por debajo de su ancho natural salvo que se le diga.
  pointText: { flex: 1 },
  legal: { gap: Spacing.two },
  legalLinks: { flexDirection: 'row', justifyContent: 'center', gap: Spacing.two },
});
