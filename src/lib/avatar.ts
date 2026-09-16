/**
 * Avatar por defecto: el robot que se le pinta a quien no ha subido foto.
 *
 * Es el estilo **bottts-neutral** de DiceBear, generado EN EL DISPOSITIVO con
 * `@dicebear/core` — no se llama a `api.dicebear.com`. Tres motivos, en orden
 * de importancia:
 *
 *   1. **Privacidad.** Pedir el avatar por HTTP significaría mandar el id de
 *      cada usuario a un tercero cada vez que se pinta una lista de amigos.
 *      Eso es una cesión de datos que habría que declarar en la política de
 *      privacidad (`src/lib/legal/`) y justificar ante el RGPD. Generándolo
 *      aquí no sale nada del teléfono y no hay nada que declarar.
 *   2. **La lámina de compartir.** `DuelShareCard` se captura con
 *      `react-native-view-shot` a 1080×1350 en un solo fotograma. Un avatar
 *      que todavía estuviera descargándose saldría como un hueco en blanco en
 *      la imagen que el usuario publica.
 *   3. Funciona sin cobertura y no depende de que un servicio ajeno siga en
 *      pie el día de la entrega.
 *
 * El estilo es un remix de **Bottts, de Pablo Stanley**, «free for personal
 * and commercial use» (https://bottts.com/). DiceBear incrusta esa atribución
 * como un bloque `<metadata>` RDF dentro de cada SVG; aquí se quita al pintar
 * (ver `stripMetadata`) porque `react-native-svg` no lo entiende y son ~400
 * bytes de parseo por avatar y por render. La atribución no se pierde: vive
 * en este comentario y en `docs/design.md`.
 */

import { Avatar, Style } from '@dicebear/core';
import definition from '@dicebear/styles/bottts-neutral.json';

import { Palette } from '@/constants/colors';

/**
 * El `Style` se construye una sola vez para todo el proceso: es inmutable y
 * su constructor valida las ~68 KB de definición del estilo, que no hay que
 * repetir por cada avatar pintado.
 */
const style = new Style(definition as ConstructorParameters<typeof Style>[0]);

/**
 * Fondo de los avatares generados, sin el `#`: DiceBear los quiere así.
 *
 * `raised` es el mismo valor que usa el hueco vacío que había antes
 * (`Card variant="raised"`), para que cambiar de «sin foto» a robot no cambie
 * la superficie sobre la que se recorta el círculo.
 */
const BACKGROUND = [Palette.raised.replace('#', '')];

/**
 * Lado en px del SVG generado. No es el tamaño con el que se pinta —eso lo
 * decide el `style` del componente— sino el del `viewBox`; se fija para que
 * dos avatares del mismo usuario en dos pantallas distintas sean literalmente
 * la misma cadena y compartan entrada de caché.
 */
const SIZE = 128;

/**
 * Tope de la caché. Una lista de amigos larga, más los rivales de la pestaña
 * de duelos, más las búsquedas, se quedan muy por debajo; el límite existe
 * para que una sesión larga navegando búsquedas no crezca sin fin.
 */
const MAX_CACHED = 128;

const cache = new Map<string, string>();

/**
 * Quita el bloque de atribución RDF que DiceBear incrusta en cada SVG.
 *
 * `react-native-svg` ignora las etiquetas que no conoce (`tags[tag] ||
 * missingTag`), así que dejarlo no rompería nada — pero sí se parsea en cada
 * render. La atribución se conserva donde la leen las personas, no el parser:
 * la cabecera de este archivo y `docs/design.md`.
 */
function stripMetadata(svg: string): string {
  return svg.replace(/<metadata[\s\S]*?<\/metadata>/, '');
}

/**
 * SVG del avatar por defecto de alguien, listo para `<SvgXml xml={...} />`.
 *
 * La `seed` tiene que ser **el id del usuario**, no su nombre: el id no
 * cambia nunca, así que el robot de alguien es el mismo para él y para
 * cualquiera que lo vea, y sobrevive a que se cambie el nombre de usuario.
 *
 * Determinista por definición de DiceBear: la misma seed da exactamente el
 * mismo SVG en cualquier dispositivo, que es lo que permite generarlo en cada
 * cliente en vez de guardarlo en el servidor.
 */
export function avatarSvgFor(seed: string): string {
  const cached = cache.get(seed);
  if (cached) return cached;

  const svg = stripMetadata(
    new Avatar(style, { seed, size: SIZE, backgroundColor: BACKGROUND }).toString(),
  );

  // Se descarta la entrada más vieja (la primera que devuelve el iterador de
  // un Map es la insertada antes) en vez de vaciar la caché entera: tirar
  // todo haría que la siguiente pasada por la lista de amigos regenerara
  // todos los avatares a la vez.
  if (cache.size >= MAX_CACHED) {
    const oldest = cache.keys().next();
    if (!oldest.done) cache.delete(oldest.value);
  }

  cache.set(seed, svg);

  return svg;
}
