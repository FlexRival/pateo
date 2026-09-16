import * as ImagePicker from 'expo-image-picker';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button } from '@/components/atoms/button';
import { ThemedText } from '@/components/atoms/themed-text';
import { ThemedView } from '@/components/atoms/themed-view';
import { Notice } from '@/components/molecules/notice';
import { ProfilePhoto } from '@/components/molecules/profile-photo';
import { StepGoalPicker } from '@/components/molecules/step-goal-picker';
import { TextField } from '@/components/molecules/text-field';
import { MaxContentWidth, Radius, Spacing } from '@/constants/theme';
import { useProfile } from '@/hooks/use-profile';
import { useTranslation } from '@/hooks/use-translation';
import {
  profileRepository,
  RepositoryError,
  stepsRepository,
  type Profile,
  type StepGoalBounds,
} from '@/repositories';

/** Mismo mínimo que exige el login al crear la cuenta. */
const MIN_USERNAME = 3;

/**
 * Alta guiada: lo que pasa **después** de crear la cuenta y antes de entrar a
 * la app por primera vez.
 *
 * No se navega a ella: `_layout.tsx` la pone en lugar de las pestañas
 * mientras `profile.onboardedAt` sea `null`, igual que hace con el login
 * según haya sesión. Así no hay forma de saltársela con un `back`, ni de
 * quedarse a medias — o se termina (y `complete_onboarding()` lo sella en el
 * servidor) o se sigue aquí.
 *
 * Las tres cosas que pide son las tres que la app no puede inventar por ti:
 *
 *   * **La foto** es la única opcional de verdad. Ya hay un avatar puesto —el
 *     robot de `@/lib/avatar`— así que esto no es un hueco que rellenar sino
 *     una mejora, y la pantalla lo dice en vez de presionar.
 *   * **El nombre** viene del registro y casi siempre se deja igual; está
 *     aquí porque es el último momento cómodo para cambiarlo antes de que
 *     empiece a verlo gente.
 *   * **El reto diario** no tiene valor por defecto que sea bueno para todo el
 *     mundo: decide la racha y el bonus de XP, así que elegirlo a ciegas por
 *     el usuario es justo lo que se quería evitar.
 *
 * Todo se guarda al pulsar «empezar», no campo a campo: a mitad del alta
 * todavía no hay nada que se le esté enseñando a nadie, y guardar en cada
 * pulsación del `+` del reto sería una RPC por pulsación.
 */
export default function OnboardingScreen() {
  const { state: profileState, reload } = useProfile();

  // El formulario vive en un componente aparte para que su estado pueda
  // arrancar YA con los valores del perfil (`useState(profile.username)`) en
  // vez de sincronizarse después con un efecto. Es la diferencia entre
  // inicializar una vez y perseguir el dato en cada render — y lo segundo es
  // justo lo que prohíbe `react-hooks/set-state-in-effect`.
  if (profileState.status !== 'ready') {
    return <ThemedView style={styles.screen} />;
  }

  return <OnboardingForm profile={profileState.data} reload={reload} />;
}

type OnboardingFormProps = {
  profile: Profile;
  reload: () => Promise<void>;
};

function OnboardingForm({ profile, reload }: OnboardingFormProps) {
  const { t } = useTranslation();

  // Se inicializan una sola vez, al montar: a partir de ahí manda lo que el
  // usuario escriba, y una recarga del perfil (subir la foto, por ejemplo) no
  // puede pisárselo.
  const [username, setUsername] = useState(profile.username);
  const [goal, setGoal] = useState(profile.dailyStepGoal);
  const [bounds, setBounds] = useState<StepGoalBounds | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let subscribed = true;

    void stepsRepository
      .getStepGoalBounds()
      .then((next) => {
        if (subscribed) setBounds(next);
      })
      // Un fallo aquí no puede bloquear el alta: sin límites el selector no se
      // pinta, pero el resto sigue funcionando y el servidor valida igual.
      .catch(() => undefined);

    return () => {
      subscribed = false;
    };
  }, []);

  async function handleChangePhoto() {
    setError(null);

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      setError(t('settings.photoPermission'));
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
      base64: true,
    });

    if (result.canceled) return;

    const asset = result.assets[0];
    if (!asset.base64) {
      setError(t('settings.photoUnreadable'));
      return;
    }

    setUploading(true);
    try {
      await profileRepository.updateAvatar({
        base64: asset.base64,
        mimeType: asset.mimeType ?? 'image/jpeg',
      });
      await reload();
    } catch (caught) {
      setError(caught instanceof RepositoryError ? caught.message : t('settings.photoUploadFailed'));
    } finally {
      setUploading(false);
    }
  }

  /**
   * Guarda solo lo que cambió y deja `completeOnboarding()` para el final.
   *
   * El orden importa: si el nombre choca con otro que ya existe, esto falla
   * ANTES de marcar el alta como terminada, así que el usuario se queda aquí
   * con el error a la vista en vez de entrar a la app con un nombre que no es
   * el suyo.
   */
  async function handleFinish() {
    setError(null);
    setSaving(true);

    try {
      const trimmed = username.trim();

      if (trimmed !== profile.username) {
        await profileRepository.updateUsername(trimmed);
      }

      if (goal !== profile.dailyStepGoal) {
        await stepsRepository.setDailyStepGoal(goal);
      }

      await profileRepository.completeOnboarding();

      // No hay `router.replace`: al quedar `onboardedAt` con fecha, el guard
      // de `_layout.tsx` desmonta esta pantalla y monta las pestañas solo.
      await reload();
    } catch (caught) {
      setError(caught instanceof RepositoryError ? caught.message : t('common.somethingWentWrong'));
    } finally {
      setSaving(false);
    }
  }

  const canFinish = !saving && !uploading && username.trim().length >= MIN_USERNAME;

  return (
    <ThemedView style={styles.screen}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled">
          <View style={styles.intro}>
            <ThemedText type="label" themeColor="primary">
              {t('onboarding.eyebrow')}
            </ThemedText>
            <ThemedText type="subtitle">{t('onboarding.title')}</ThemedText>
            <ThemedText type="small" themeColor="textMuted">
              {t('onboarding.subtitle')}
            </ThemedText>
          </View>

          <View style={styles.photoBlock}>
            <Pressable onPress={handleChangePhoto} disabled={uploading} accessibilityRole="button">
              <ProfilePhoto avatarUrl={profile.avatarUrl} seed={profile.id} style={styles.photo} />
            </Pressable>

            <Button
              label={uploading ? t('onboarding.uploading') : t('onboarding.choosePhoto')}
              variant="secondary"
              onPress={handleChangePhoto}
              disabled={uploading}
            />

            <ThemedText type="caption" themeColor="textMuted" style={styles.centered}>
              {t('onboarding.photoOptional')}
            </ThemedText>
          </View>

          <TextField
            label={t('login.username')}
            value={username}
            onChangeText={setUsername}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder={t('login.usernamePlaceholder')}
          />

          {/*
            Sin límites todavía (la petición falló o va en camino) no se pinta:
            un selector con un rango inventado dejaría elegir algo que el
            servidor luego rechaza.
          */}
          {bounds ? (
            <StepGoalPicker value={goal} onChange={setGoal} min={bounds.min} max={bounds.max} />
          ) : null}

          {error ? <Notice tone="rival" message={error} /> : null}

          <Button
            label={saving ? t('onboarding.saving') : t('onboarding.start')}
            onPress={handleFinish}
            disabled={!canFinish}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
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
  intro: { gap: Spacing.one },
  photoBlock: { alignItems: 'center', gap: Spacing.three },
  photo: { width: 120, height: 120, borderRadius: Radius.pill },
  centered: { textAlign: 'center' },
});
