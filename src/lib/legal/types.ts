import type { Language } from '@/lib/i18n';

/** Un apartado con su encabezado y sus párrafos. */
export type LegalSection = {
  heading: string;
  body: string[];
};

/**
 * Un documento legal completo, en un idioma.
 *
 * Es texto estructurado y no una cadena de Markdown a propósito: la pantalla lo
 * pinta con la tipografía y los colores del sistema de diseño, y el mismo
 * objeto sirve para generar la página pública sin volver a escribir el texto.
 */
export type LegalDocument = {
  title: string;
  /** ISO `AAAA-MM-DD`. Ambas tiendas piden que la política diga desde cuándo rige. */
  lastUpdated: string;
  intro: string[];
  sections: LegalSection[];
};

/** El mismo documento en los idiomas que habla la app. */
export type LocalizedLegalDocument = Record<Language, LegalDocument>;

/**
 * Los datos del responsable del tratamiento.
 *
 * Estado a 15-sep-2026 (KAN-74): los cuatro campos están resueltos.
 *
 * - `email` y `hostingRegion` estaban puestos desde antes de KAN-84.
 * - `entity` se rellenó en KAN-84 con el nombre del producto, `"Prooffit"`,
 *   a sabiendas de que **no identifica a una persona física ni a una
 *   sociedad constituida** — es un proyecto de hackatón de cuatro personas
 *   sin entidad legal propia. El RGPD (art. 13) exige un responsable
 *   identificable, así que esto es un riesgo aceptado explícitamente por el
 *   equipo, no un descuido: si en algún momento se constituye una sociedad o
 *   se decide nombrar a una persona física responsable, hay que volver aquí.
 * - `site` se rellenó el 15-sep-2026 con el dominio comprado, `prooffit.com`.
 *   Revisado a la vez: `landing/scripts/build-legal.mjs` (`SITE_ORIGIN`),
 *   `landing/index.html`, `landing/robots.txt` y `landing/sitemap.xml`
 *   usaban el dominio de ejemplo `prooffit.app` y se han actualizado todos
 *   al dominio real; las tres páginas legales generadas
 *   (`landing/privacy.html`, `terms.html`, `delete-account.html`) se han
 *   regenerado con `pnpm build:legal`.
 *
 * Sin un responsable identificable de verdad, las dos tiendas pueden
 * rechazar la política igualmente — este riesgo sigue abierto para `entity`
 * aun estando "relleno".
 *
 * Se dejan aquí, juntos y en un solo sitio, para que rellenarlos sea una
 * edición de cuatro líneas y no una caza por dentro de los textos.
 */
export const LEGAL_CONTACT = {
  /**
   * Nombre de quien responde por los datos.
   *
   * ⚠️ Es el nombre del producto, no una persona física ni una sociedad
   * constituida — ver el aviso de riesgo aceptado arriba.
   */
  entity: 'Prooffit',
  /**
   * Dirección de contacto para ejercer derechos. Tiene que estar viva: es donde
   * llegan las peticiones de borrado de quien ya desinstaló la app y no puede
   * usar `Ajustes → Borrar cuenta`.
   *
   * Buzón compartido del equipo, no el personal de nadie: si el que lo lee se
   * va de vacaciones, la obligación de responder en 30 días sigue corriendo.
   */
  email: 'porz4.shipaton@gmail.com',
  /**
   * Dominio donde viven las versiones públicas de estos textos (KAN-56).
   *
   * Comprado y en uso desde el 15-sep-2026. Es el mismo valor que
   * `SITE_ORIGIN` en `landing/scripts/build-legal.mjs` — si alguna vez
   * cambian, hay que actualizar los dos y volver a ejecutar
   * `pnpm build:legal`.
   */
  site: 'https://prooffit.com',
  /**
   * Dónde está alojada la base de datos de Supabase. Determina si hay
   * transferencia internacional de datos que declarar: un proyecto en una
   * región de EE. UU. obliga a mencionarla, uno en la UE no.
   *
   * Verificado el 9-sep-2026 contra el panel de Supabase: el proyecto
   * `tirhukkivndhmlknvbfr` está en `eu-central-1` (AWS Fráncfort). Al estar
   * dentro de la UE **no hay transferencia internacional que declarar**, ni en
   * este texto ni en el Data safety de Play (KAN-54).
   *
   * Es el único de los cuatro campos que va por idioma: los otros tres son un
   * nombre, un correo y un dominio, que se escriben igual en cualquier lengua,
   * pero este se interpola dentro de una frase ("Los datos residen en ___" /
   * "Data is stored in ___") y una sola cadena quedaría en el idioma
   * equivocado en la mitad de las lecturas.
   */
  hostingRegion: {
    en: 'the European Union (Frankfurt, Germany)',
    es: 'la Unión Europea (Fráncfort, Alemania)',
  } satisfies Record<Language, string>,
} as const;
