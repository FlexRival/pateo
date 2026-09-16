import { Pressable, StyleSheet, View } from 'react-native';

import { Card } from '@/components/atoms/card';
import { ThemedText } from '@/components/atoms/themed-text';
import { Radius, Spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';
import { useTranslation } from '@/hooks/use-translation';
import { formatCount } from '@/lib/format';
import { dailyGoalBonusXp } from '@/lib/xp';

/** Cuánto mueve cada pulsación. Un paso más fino haría eterno ir de 2.000 a 30.000. */
const STEP = 500;

export type StepGoalPickerProps = {
  value: number;
  onChange: (goal: number) => void;
  /** Límites del servidor (`getStepGoalBounds()`). */
  min: number;
  max: number;
};

/**
 * Elegir el reto diario de pasos.
 *
 * Enseña el bonus de XP junto a la cifra, y no como un detalle: es la única
 * forma de que se entienda la regla. La curva satura a propósito
 * (`dailyGoalBonusXp`), así que al subir el reto se ve cómo el bonus crece
 * cada vez menos — y eso responde solo a la pregunta «¿me compensa ponerme
 * 30.000?» sin tener que explicarlo con un párrafo.
 *
 * El bonus se calcula en la app con el espejo de la fórmula del servidor
 * (`src/lib/xp.ts`, verificado por `pnpm check:xp`) porque hay que repintarlo
 * en cada pulsación del `+`, y una RPC por pulsación se notaría.
 */
export function StepGoalPicker({ value, onChange, min, max }: StepGoalPickerProps) {
  const { t } = useTranslation();

  const canDecrease = value > min;
  const canIncrease = value < max;

  // Se recorta contra los límites en vez de deshabilitar y ya está: con un
  // paso de 500 y un mínimo de 2.000 los dos siempre encajan, pero si alguien
  // tunea `min`/`max` en el servidor a algo que no sea múltiplo de 500, sin
  // esto el selector no podría llegar al extremo.
  const decrease = () => onChange(Math.max(min, value - STEP));
  const increase = () => onChange(Math.min(max, value + STEP));

  return (
    <Card variant="highlight" style={styles.card}>
      <ThemedText type="label" themeColor="textDim">
        {t('goal.title')}
      </ThemedText>

      <View style={styles.row}>
        <StepButton label="−" onPress={decrease} disabled={!canDecrease} />

        <View style={styles.readout}>
          <ThemedText type="subtitle" themeColor="steps">
            {formatCount(value)}
          </ThemedText>
          <ThemedText type="caption" themeColor="textMuted">
            {t('goal.stepsPerDay')}
          </ThemedText>
        </View>

        <StepButton label="+" onPress={increase} disabled={!canIncrease} />
      </View>

      <ThemedText type="smallBold" themeColor="xp" style={styles.centered}>
        {t('goal.bonus', { xp: formatCount(dailyGoalBonusXp(value)) })}
      </ThemedText>

      <ThemedText type="caption" themeColor="textMuted" style={styles.centered}>
        {t('goal.note')}
      </ThemedText>
    </Card>
  );
}

type StepButtonProps = {
  label: string;
  onPress: () => void;
  disabled: boolean;
};

/**
 * No usa `Button`: los botones de la app son rectangulares y con el label en
 * mayúsculas y letra ancha, y aquí hacen falta dos objetivos táctiles
 * cuadrados de un solo carácter a los lados de la cifra.
 */
function StepButton({ label, onPress, disabled }: StepButtonProps) {
  const theme = useTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      onPress={onPress}
      disabled={disabled}
      style={[
        styles.stepButton,
        { backgroundColor: theme.surfaceRaised, borderColor: theme.border },
        disabled && styles.stepButtonDisabled,
      ]}>
      <ThemedText type="heading" themeColor={disabled ? 'textDim' : 'primary'}>
        {label}
      </ThemedText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { gap: Spacing.three, alignItems: 'center' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.four,
    width: '100%',
  },
  readout: { alignItems: 'center', gap: Spacing.half },
  stepButton: {
    width: 56,
    height: 56,
    borderRadius: Radius.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Sin color propio: el token del texto ya baja a `textDim`, y bajar además
  // el fondo dejaría el botón casi invisible sobre la card.
  stepButtonDisabled: { opacity: 0.5 },
  centered: { textAlign: 'center' },
});
