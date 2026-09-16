import { Image } from 'expo-image';
import { useMemo } from 'react';
import { StyleSheet, View, type ImageStyle, type StyleProp } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { avatarSvgFor } from '@/lib/avatar';

/**
 * Foto de perfil de un usuario. **Nunca sale vacía**: quien no ha subido
 * ninguna recibe un robot generado a partir de su id (`@/lib/avatar`).
 *
 * Antes este componente pintaba una `Card` vacía en ese caso, coherente con
 * que se hubiera descartado el personaje RPG. El hueco se veía como una
 * ausencia —listas de amigos llenas de rectángulos grises— así que ahora el
 * respaldo es un avatar de verdad. Sigue sin haber personaje ni cosméticos:
 * el robot es una identidad visual, no algo que se equipe ni que suba de
 * nivel.
 *
 * Existe para que las pantallas que la enseñan no repitan cada una su propio
 * `if (avatarUrl)`: fue justo esa duplicación la que dejó a Perfil pintando
 * siempre el hueco y sin enseñar nunca la foto subida (KAN-64).
 */
export type ProfilePhotoProps = {
  avatarUrl: string | null;
  /**
   * **El id del usuario**, no su nombre: es lo que decide qué robot le toca
   * cuando no hay foto. Va obligatorio a propósito — es lo que garantiza que
   * ninguna pantalla pueda volver a pintar un hueco anónimo.
   *
   * Tiene que ser el id y no el nombre para que el robot no cambie al
   * cambiarse el nombre de usuario, y para que sea el mismo que ven los demás.
   */
  seed: string;
  /**
   * Tamaño y forma. Lo pone quien la usa porque los sitios no se parecen en
   * nada: Ajustes la quiere circular y pequeña, Perfil un retrato grande.
   */
  style?: StyleProp<ImageStyle>;
};

export function ProfilePhoto({ avatarUrl, seed, style }: ProfilePhotoProps) {
  // Solo se genera cuando hace falta —quien tiene foto no paga nada— y una vez
  // por seed: una lista de amigos re-renderiza en cada pulsación de la barra
  // de búsqueda. `@/lib/avatar` ya cachea entre componentes; esto evita además
  // volver a entrar ahí en cada render de ESTA instancia.
  const fallback = useMemo(() => (avatarUrl ? null : avatarSvgFor(seed)), [avatarUrl, seed]);

  // La foto real va primero para que TypeScript estreche `avatarUrl` a
  // `string` dentro de esta rama; al revés no puede deducir que si no hay SVG
  // es porque sí había URL.
  if (avatarUrl) {
    return <Image source={{ uri: avatarUrl }} style={style} contentFit="cover" />;
  }

  return (
    // El SVG va dentro de un `View` que lleva el `style` (y con él el
    // `borderRadius`) en vez de pasárselo al `SvgXml` directamente: un `<Svg>`
    // nativo no recorta su contenido por el radio en Android, así que el robot
    // saldría cuadrado dentro de un marco redondo. Con `overflow: 'hidden'` en
    // el contenedor, el recorte lo hace la vista.
    <View style={[style, styles.clip]}>
      {fallback ? <SvgXml xml={fallback} width="100%" height="100%" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  clip: { overflow: 'hidden' },
});
